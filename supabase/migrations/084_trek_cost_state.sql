-- ---------------------------------------------------------------------------
-- 084 — who has settled up
-- ---------------------------------------------------------------------------
--
-- The design's console shows "paid" and "cash on the day" against each walker.
-- I held this back twice, and the reason still stands, so it shapes what got
-- built rather than being ignored:
--
--   the board takes no money and says so in its own copy — the cost share is
--   "split at face value on the day" — and a paid/unpaid ledger inside the app
--   is the first step toward looking like it settles payments, which matters
--   the first time one goes wrong.
--
-- So this is a HOST'S NOTE, not a payment record. Nothing is transacted, no
-- amount is stored per person, and there is no history of who paid what when.
-- It is three states and a name, so a host standing at a bus stand with eight
-- people and a shared cab does not have to hold it in their head.
--
-- The three come from the design's own vocabulary. 'owed' is the default and is
-- deliberately not called "unpaid": nobody owes this board anything, and the
-- word for what is between two walkers about a cab fare is not the word for a
-- debt to a platform.
ALTER TABLE trek_plan_requests ADD COLUMN IF NOT EXISTS cost_state TEXT NOT NULL DEFAULT 'owed';

ALTER TABLE trek_plan_requests DROP CONSTRAINT IF EXISTS trek_requests_cost_state_check;
ALTER TABLE trek_plan_requests ADD CONSTRAINT trek_requests_cost_state_check
  CHECK (cost_state IN ('owed', 'settled', 'on_the_day'));

COMMENT ON COLUMN trek_plan_requests.cost_state IS
  'The host''s own note on whether somebody has squared up the cost share. Not a payment record: no amount, no history, and no money moves through this site.';

CREATE OR REPLACE FUNCTION trek_set_cost_state(
  p_plan UUID, p_user UUID, p_state TEXT, p_actor UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor UUID := trek_actor(p_actor);
  v_cost  INT;
BEGIN
  IF p_state NOT IN ('owed', 'settled', 'on_the_day') THEN
    RAISE EXCEPTION 'that is not one of the three' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Co-hosts included: collecting for the cab on the day is exactly the job
  -- somebody helps with while the host is parking.
  IF NOT trek_can_manage(p_plan, v_actor) THEN
    RAISE EXCEPTION 'only the host or a co-host tracks the cost share'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT cost_paise INTO v_cost FROM trek_plans WHERE id = p_plan;
  -- A walk with no cost share has nothing to settle, and a state set on one
  -- would surface as a column of "owed" against a free walk.
  IF v_cost IS NULL OR v_cost = 0 THEN
    RAISE EXCEPTION 'this walk has no cost share to settle'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE trek_plan_requests
     SET cost_state = p_state
   WHERE plan_id = p_plan AND user_id = p_user AND status = 'confirmed';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'that person is not confirmed on this walk' USING ERRCODE = 'no_data_found';
  END IF;
END $$;

REVOKE ALL ON FUNCTION trek_set_cost_state(UUID, UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION trek_set_cost_state(UUID, UUID, TEXT, UUID) TO authenticated, service_role;
