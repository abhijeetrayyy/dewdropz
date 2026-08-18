-- ---------------------------------------------------------------------------
-- 082 — co-hosts
-- ---------------------------------------------------------------------------
--
-- Deferred twice on purpose. Confirming who comes is the board's central safety
-- decision — everything else it promises rests on a named person having chosen
-- each member of a party — and handing that to a second person needs three
-- things before it needs a button:
--
--   a permission model, so a co-host cannot quietly become a host;
--   an audit trail, so "who let this person in" always has an answer;
--   and a way to see it, which is the console.
--
-- WHAT A CO-HOST CAN DO. Confirm and decline, announce, and check people in —
-- the three things that need doing while the host is driving or out of signal,
-- which is the entire reason for the feature.
--
-- WHAT A CO-HOST CANNOT DO, and each of these is a deliberate line:
--   * cancel the walk — it is not theirs to call off;
--   * edit the meeting point — the safety-critical field stays with one person;
--   * add or remove co-hosts — otherwise the permission spreads on its own;
--   * mint or revoke the invite link, or write the recap.
--
-- WHO CAN BE ONE. Somebody already confirmed on the walk. A co-host who is not
-- going is an administrator, and this board does not have those.

CREATE TABLE IF NOT EXISTS trek_plan_co_hosts (
  plan_id    UUID NOT NULL REFERENCES trek_plans(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,
  added_by   UUID NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (plan_id, user_id)
);

ALTER TABLE trek_plan_co_hosts ENABLE ROW LEVEL SECURITY;

-- Readable by anybody on the walk: the party should be able to see who can
-- admit people. Writes go through the functions below, so there is no policy
-- for them — a co-host list nobody can edit directly is a co-host list that
-- cannot be edited by a co-host.
DROP POLICY IF EXISTS "The party sees who runs the walk" ON trek_plan_co_hosts;
CREATE POLICY "The party sees who runs the walk" ON trek_plan_co_hosts
  FOR SELECT TO authenticated USING (trek_is_on_plan(plan_id));

-- ---------------------------------------------------------------------------
-- The audit trail
-- ---------------------------------------------------------------------------
-- Who actually made each decision. Without this, adding co-hosts would make
-- "who confirmed this person" unanswerable — and that question is the one a
-- host will ask first if a walk goes wrong.
ALTER TABLE trek_plan_requests ADD COLUMN IF NOT EXISTS decided_by UUID REFERENCES profiles(id);
ALTER TABLE trek_plan_requests ADD COLUMN IF NOT EXISTS checked_in_by UUID REFERENCES profiles(id);

COMMENT ON COLUMN trek_plan_requests.decided_by IS
  'Who confirmed or declined this person — the host or a co-host. Null for rows decided before 082, which is honest: it was the host, but nothing recorded it.';

-- ---------------------------------------------------------------------------
-- One predicate for "may run this walk"
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trek_can_manage(p_plan UUID, p_user UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM trek_plans WHERE id = p_plan AND host_id = p_user)
      OR EXISTS (SELECT 1 FROM trek_plan_co_hosts WHERE plan_id = p_plan AND user_id = p_user);
$$;

REVOKE ALL ON FUNCTION trek_can_manage(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION trek_can_manage(UUID, UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Appointing and removing — the host alone
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trek_add_co_host(p_plan UUID, p_user UUID, p_actor UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor UUID := trek_actor(p_actor);
  v_plan  trek_plans;
BEGIN
  SELECT * INTO v_plan FROM trek_plans WHERE id = p_plan;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such walk' USING ERRCODE = 'no_data_found';
  END IF;
  -- Not trek_can_manage: a co-host appointing co-hosts is how one person's
  -- decision becomes everybody's.
  IF v_plan.host_id <> v_actor THEN
    RAISE EXCEPTION 'only the host appoints a co-host' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_user = v_plan.host_id THEN
    RAISE EXCEPTION 'you are already hosting this walk' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM trek_plan_requests
                  WHERE plan_id = p_plan AND user_id = p_user AND status = 'confirmed') THEN
    RAISE EXCEPTION 'a co-host has to be somebody you have confirmed on the walk'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  INSERT INTO trek_plan_co_hosts (plan_id, user_id, added_by)
  VALUES (p_plan, p_user, v_actor)
  ON CONFLICT (plan_id, user_id) DO NOTHING;

  PERFORM trek_notify(p_user, 'announcement', p_plan, v_actor,
    'You are co-hosting ' || trek_plan_label(p_plan) ||
    '. You can confirm people, check them in and post announcements.');
END $$;

CREATE OR REPLACE FUNCTION trek_remove_co_host(p_plan UUID, p_user UUID, p_actor UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_actor UUID := trek_actor(p_actor);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM trek_plans WHERE id = p_plan AND host_id = v_actor) THEN
    RAISE EXCEPTION 'only the host removes a co-host' USING ERRCODE = 'insufficient_privilege';
  END IF;
  DELETE FROM trek_plan_co_hosts WHERE plan_id = p_plan AND user_id = p_user;
END $$;

-- A co-host who leaves the walk stops being one. Without this, declining or
-- removing somebody would leave them able to confirm people onto a walk they
-- are no longer on.
CREATE OR REPLACE FUNCTION trek_co_host_follows_membership()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'confirmed' THEN
    DELETE FROM trek_plan_co_hosts WHERE plan_id = NEW.plan_id AND user_id = NEW.user_id;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trek_requests_yy_cohost ON trek_plan_requests;
CREATE TRIGGER trek_requests_yy_cohost
  AFTER UPDATE ON trek_plan_requests
  FOR EACH ROW
  WHEN (OLD.status = 'confirmed' AND NEW.status <> 'confirmed')
  EXECUTE FUNCTION trek_co_host_follows_membership();

REVOKE ALL ON FUNCTION trek_add_co_host(UUID, UUID, UUID)    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION trek_remove_co_host(UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION trek_add_co_host(UUID, UUID, UUID)    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION trek_remove_co_host(UUID, UUID, UUID) TO authenticated, service_role;
