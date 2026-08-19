-- ---------------------------------------------------------------------------
-- 088 — the join guard blocked its own cascade
-- ---------------------------------------------------------------------------
--
-- The last thing standing between a member and being deletable. With 086's
-- SET NULL in place, deleting a host raised:
--
--   ERROR: no such trek   (trek_requests_guard, on UPDATE)
--
-- Deleting a profile sets off two referential actions against the same rows at
-- once: `trek_plans.host_id` CASCADEs, taking the host's walks and — through
-- the composite key on (plan_id, plan_host_id) — every request on them; and
-- `trek_plan_requests.decided_by` SET NULLs, which is an UPDATE. Some of those
-- UPDATEs land on rows whose walk has already gone in the same statement, so
-- the guard's opening lookup finds nothing and raises.
--
-- The raise is right on INSERT: asking to join a walk that does not exist is a
-- caller error and should be refused loudly. It is meaningless on UPDATE. A
-- request cannot outlive its walk — the composite foreign key guarantees it —
-- so "the walk is gone" during an UPDATE can only mean the row is itself on the
-- way out, and there is nothing left to guard. Refusing at that point does not
-- protect anybody; it just makes the account undeletable.
--
-- Nothing else changes. Every gate below — the women-only check, the trust
-- rung, the started/cancelled checks, the immovable plan_id and user_id — is
-- byte-for-byte what 064 left, and all of them are downstream of a plan that
-- was found. DELETE already returned early for exactly this reason, with the
-- comment "only reachable by cascade from a deleted account"; this extends the
-- same reasoning to the UPDATE that the cascade now performs.
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
    -- On INSERT this is a caller error and stays an error. On UPDATE it means
    -- the walk is being deleted in this very statement and this row is going
    -- with it — see 088. There is nothing to guard, and raising here is what
    -- made a host who had confirmed anybody impossible to delete.
    IF TG_OP = 'UPDATE' THEN
      RETURN NEW;
    END IF;
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
END $function$;
