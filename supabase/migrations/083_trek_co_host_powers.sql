-- ---------------------------------------------------------------------------
-- 083 — the three things a co-host may do
-- ---------------------------------------------------------------------------
--
-- Each of these tested host_id directly. They now ask trek_can_manage, which is
-- the only place the answer lives — so widening or narrowing what a co-host may
-- do is one edit, not three that can drift apart.
--
-- Two of them also record WHO acted. That is the part that made co-hosts safe
-- to build: the moment a second person can confirm somebody onto a walk, "who
-- let them in" stops having an obvious answer, and it is the first question a
-- host asks if a day goes wrong.
--
-- Everything else stays with the host alone — cancelling, the meeting point,
-- appointing co-hosts, the invite link, the recap. A co-host runs the party;
-- they do not own the walk.

CREATE OR REPLACE FUNCTION public.trek_decide_request(p_plan_id uuid, p_user_id uuid, p_decision text, p_actor uuid DEFAULT NULL::uuid)
 RETURNS trek_plan_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user UUID := trek_actor(p_actor);
  v_plan trek_plans;
  v_row  trek_plan_requests;
BEGIN
  IF p_decision NOT IN ('confirmed','declined','removed') THEN
    RAISE EXCEPTION 'decision must be confirmed, declined or removed'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT * INTO v_plan FROM trek_plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such plan' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT trek_can_manage(p_plan_id, v_user) THEN
    RAISE EXCEPTION 'only the host or a co-host decides who comes'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_decision = 'confirmed' AND v_plan.spots_left <= 0 THEN
    RAISE EXCEPTION 'that was the last spot — this plan is full'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE trek_plan_requests
     SET status = p_decision, decided_at = NOW(), decided_by = v_user
   WHERE plan_id = p_plan_id AND user_id = p_user_id
     AND status IN ('requested','confirmed')
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no open request from that person' USING ERRCODE = 'no_data_found';
  END IF;

  RETURN v_row;
END $function$
;

CREATE OR REPLACE FUNCTION public.trek_check_in(p_plan uuid, p_user uuid, p_in boolean DEFAULT true, p_actor uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor UUID := trek_actor(p_actor);
  v_plan  trek_plans;
BEGIN
  SELECT * INTO v_plan FROM trek_plans WHERE id = p_plan;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such walk' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT trek_can_manage(p_plan, v_actor) THEN
    RAISE EXCEPTION 'only the host or a co-host checks people in'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- From twelve hours before, so an 05:10 start can be checked in the night
  -- before if the party gathers early. Not weeks ahead: a walk checked in
  -- before it happened is a record of nothing.
  IF v_plan.starts_at > NOW() + INTERVAL '12 hours' THEN
    RAISE EXCEPTION 'you can check people in on the day, not before'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE trek_plan_requests
     SET checked_in_at = CASE WHEN p_in THEN NOW() ELSE NULL END,
         checked_in_by = CASE WHEN p_in THEN v_actor ELSE NULL END
   WHERE plan_id = p_plan AND user_id = p_user AND status = 'confirmed';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'that person is not confirmed on this walk' USING ERRCODE = 'no_data_found';
  END IF;
END $function$
;

CREATE OR REPLACE FUNCTION public.trek_announce(p_plan uuid, p_body text, p_actor uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor UUID := trek_actor(p_actor);
  v_name  TEXT := trek_require_member(v_actor);
  v_plan  trek_plans;
  v_row   RECORD;
BEGIN
  SELECT * INTO v_plan FROM trek_plans WHERE id = p_plan;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such walk' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT trek_can_manage(p_plan, v_actor) THEN
    RAISE EXCEPTION 'only the host or a co-host makes an announcement'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Goes through the messages table, so trek_messages_guard moderates it and
  -- applies the same cancelled/finished rules.
  INSERT INTO trek_messages (plan_id, user_id, display_name, body, is_announcement)
  VALUES (p_plan, v_actor, v_name, p_body, TRUE);

  FOR v_row IN
    SELECT r.user_id FROM trek_plan_requests r
     WHERE r.plan_id = p_plan AND r.status = 'confirmed'
  LOOP
    PERFORM trek_notify(v_row.user_id, 'announcement', p_plan, v_actor,
      v_name || ' posted an announcement on ' || trek_plan_label(p_plan) || '.');
  END LOOP;
END $function$
;
