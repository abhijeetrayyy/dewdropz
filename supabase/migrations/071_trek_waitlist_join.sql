-- ---------------------------------------------------------------------------
-- 071 — asking for a full walk joins the queue
-- ---------------------------------------------------------------------------
--
-- The half of 070 that lives in the two functions every request passes through.
--
-- trek_request_join stops refusing a full walk and queues the ask instead, and
-- tells the asker where they are standing — a queue nobody can see the inside
-- of is just a rejection with extra steps.
--
-- trek_requests_guard extends its gates to 'waitlisted'. This matters more than
-- it looks: without it, somebody blocked from a women-only walk, or short of
-- the trust bar the host set, could still join its waitlist and be promoted
-- straight past both gates the moment a place opened.

CREATE OR REPLACE FUNCTION public.trek_requests_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_plan trek_plans%ROWTYPE;
  v_gender TEXT;
  v_rung SMALLINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;   -- only reachable by cascade from a deleted account
  END IF;

  SELECT * INTO v_plan FROM trek_plans WHERE id = NEW.plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such trek' USING ERRCODE = 'no_data_found';
  END IF;

  NEW.plan_host_id := v_plan.host_id;

  IF TG_OP = 'UPDATE' AND (NEW.plan_id <> OLD.plan_id OR NEW.user_id <> OLD.user_id) THEN
    RAISE EXCEPTION 'a request cannot be moved to another trek or another person'
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF NEW.status IN ('confirmed','declined','withdrawn','removed') AND NEW.decided_at IS NULL THEN
    NEW.decided_at := NOW();
  END IF;

  IF NEW.status IN ('requested','waitlisted','confirmed')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    IF v_plan.status <> 'open' OR v_plan.hidden_at IS NOT NULL THEN
      RAISE EXCEPTION 'this trek is not taking anyone' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF v_plan.starts_at <= NOW() THEN
      RAISE EXCEPTION 'this trek has already started' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF v_plan.host_id = NEW.user_id THEN
      RAISE EXCEPTION 'this is your own trek' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- The women-only gate.
    IF v_plan.women_only THEN
      SELECT trek_gender INTO v_gender FROM profiles WHERE id = NEW.user_id;
      IF v_gender IS DISTINCT FROM 'woman' THEN
        RAISE EXCEPTION 'this trek is open to women only'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    END IF;

    -- The trust gate, beside the women-only gate and for the same reason: this
    -- is the one place every route into a walk has to pass through — the RPC, a
    -- direct table write, somebody fixing a row by hand. A check that lives in
    -- the action layer is a check that can be walked around.
    --
    -- Only the person asking is measured. A host is never held to their own
    -- bar: they set it to choose who comes, and locking them out of their own
    -- walk for want of a vouch would be absurd.
    IF v_plan.min_trust > 0 THEN
      v_rung := trek_trust_rung(NEW.user_id);
      IF v_rung < v_plan.min_trust THEN
        RAISE EXCEPTION 'this walk is open to % only', trek_trust_label(v_plan.min_trust)
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.trek_request_join(p_plan_id uuid, p_message text DEFAULT NULL::text, p_actor uuid DEFAULT NULL::uuid)
 RETURNS trek_plan_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user UUID := trek_actor(p_actor);
  v_name TEXT := trek_require_member(v_user);
  v_plan trek_plans;
  v_row  trek_plan_requests;
  v_clash TEXT;
  v_full  BOOLEAN;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('dewdropz.trek_host'), hashtext(v_user::text));

  SELECT * INTO v_plan FROM trek_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such plan' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_plan.host_id = v_user THEN
    RAISE EXCEPTION 'this is your own plan' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  -- Asking is free; being confirmed is not. A full walk used to refuse outright,
  -- "so nobody sits in a queue that cannot reach them" — true until 070 built a
  -- queue that moves on its own. Now a full walk queues the ask instead.
  v_full := v_plan.spots_left <= 0;

  -- You cannot be in two places at once, and a phantom fourth member is worse
  -- than a party of three that knew it was three. Compared on the day, because
  -- every plan in v1 is a single daylight day.
  SELECT p.place INTO v_clash
    FROM trek_plans p
   WHERE p.status = 'open' AND p.id <> p_plan_id AND p.starts_on = v_plan.starts_on
     AND (p.host_id = v_user
          OR EXISTS (SELECT 1 FROM trek_plan_requests q
                     WHERE q.plan_id = p.id AND q.user_id = v_user AND q.status = 'confirmed'))
   LIMIT 1;
  IF v_clash IS NOT NULL THEN
    RAISE EXCEPTION 'you are already going somewhere that day (%)', v_clash
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  INSERT INTO trek_plan_requests (plan_id, user_id, plan_host_id, display_name, message, status)
  VALUES (p_plan_id, v_user, v_plan.host_id, v_name, NULLIF(btrim(COALESCE(p_message, '')), ''),
          CASE WHEN v_full THEN 'waitlisted' ELSE 'requested' END)
  ON CONFLICT (plan_id, user_id) DO UPDATE
    SET status       = CASE WHEN trek_plan_requests.status = 'confirmed' THEN 'confirmed'
                            WHEN v_full THEN 'waitlisted'
                            ELSE 'requested' END,
        decided_at   = CASE WHEN trek_plan_requests.status = 'confirmed'
                            THEN trek_plan_requests.decided_at ELSE NULL END,
        display_name = EXCLUDED.display_name,
        message      = COALESCE(EXCLUDED.message, trek_plan_requests.message),
        created_at   = NOW()
  RETURNING * INTO v_row;

  -- The queue only means anything if the person in it is told they are in it.
  IF v_row.status = 'waitlisted' THEN
    PERFORM trek_notify(v_user, 'waitlisted', p_plan_id, NULL,
      trek_plan_label(p_plan_id) || ' is full. You are number ' ||
      trek_waitlist_position(p_plan_id, v_user) ||
      ' on the waitlist, and you move up on your own if somebody drops.');
  END IF;

  RETURN v_row;
END $function$
;
