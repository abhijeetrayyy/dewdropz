-- ---------------------------------------------------------------------------
-- 070 — the waitlist
-- ---------------------------------------------------------------------------
--
-- trek_request_join refuses a full walk today, and its comment says why:
-- "Refuse when the plan is already full, so nobody sits in a queue that cannot
-- reach them." That was right when there was no queue. This builds the thing
-- that makes the objection stop applying — a queue that moves on its own.
--
-- WHAT PROMOTION DOES, AND DELIBERATELY DOES NOT DO. When a confirmed walker
-- drops, the earliest waitlisted ask becomes 'requested'. It does NOT become
-- 'confirmed'. The host choosing who comes is the board's central safety
-- promise, and a queue that auto-seats strangers while the host is asleep would
-- quietly repeal it. So the waitlist moves you to the front of the host's desk,
-- never past it.
--
-- One at a time, and only one. A walk that loses one walker gains one live
-- request, so the host is never handed a pile of asks for a single free place.

-- ---------------------------------------------------------------------------
-- 1. The status, and the notifications that go with it
-- ---------------------------------------------------------------------------
ALTER TABLE trek_plan_requests DROP CONSTRAINT IF EXISTS trek_plan_requests_status_check;
ALTER TABLE trek_plan_requests ADD CONSTRAINT trek_plan_requests_status_check
  CHECK (status IN ('requested','waitlisted','confirmed','declined','withdrawn','removed'));

ALTER TABLE trek_notifications DROP CONSTRAINT IF EXISTS trek_notifications_kind_check;
ALTER TABLE trek_notifications ADD CONSTRAINT trek_notifications_kind_check
  CHECK (kind IN ('request_received','request_confirmed','request_declined','request_withdrawn',
                  'plan_cancelled','point_released','vouched',
                  'waitlisted','waitlist_moved'));

-- Position is read off created_at rather than stored. A stored position has to
-- be renumbered on every withdrawal, and a renumbering that half-runs leaves
-- two people holding the same place in a queue.
CREATE INDEX IF NOT EXISTS idx_trek_requests_waitlist
  ON trek_plan_requests(plan_id, created_at)
  WHERE status = 'waitlisted';

-- ---------------------------------------------------------------------------
-- 2. Asking for a full walk queues instead of failing
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trek_waitlist_position(p_plan UUID, p_user UUID)
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT count(*)::INT + 1
    FROM trek_plan_requests r
   WHERE r.plan_id = p_plan
     AND r.status = 'waitlisted'
     AND r.created_at < (SELECT created_at FROM trek_plan_requests
                          WHERE plan_id = p_plan AND user_id = p_user);
$$;

REVOKE ALL ON FUNCTION trek_waitlist_position(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION trek_waitlist_position(UUID, UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Promotion
-- ---------------------------------------------------------------------------
-- Named to sort after trek_requests_recount and before trek_requests_zz_notify:
-- AFTER triggers fire in alphabetical order, recount is what makes spots_left
-- current, and reading a stale count here would promote nobody or promote twice.
-- That ordering trap has already bitten this schema once, in 060.
CREATE OR REPLACE FUNCTION trek_requests_promote()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_plan trek_plans;
  v_next trek_plan_requests;
BEGIN
  SELECT * INTO v_plan FROM trek_plans WHERE id = NEW.plan_id;
  IF NOT FOUND OR v_plan.status <> 'open' OR v_plan.hidden_at IS NOT NULL THEN
    RETURN NULL;
  END IF;
  -- A walk that has already left takes nobody else.
  IF v_plan.starts_at <= NOW() THEN
    RETURN NULL;
  END IF;
  IF v_plan.spots_left <= 0 THEN
    RETURN NULL;
  END IF;

  -- FOR UPDATE SKIP LOCKED: two walkers dropping in the same instant must
  -- promote two different people, not race for the same one.
  SELECT * INTO v_next
    FROM trek_plan_requests
   WHERE plan_id = NEW.plan_id AND status = 'waitlisted'
   ORDER BY created_at
   FOR UPDATE SKIP LOCKED
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE trek_plan_requests
     SET status = 'requested'
   WHERE plan_id = v_next.plan_id AND user_id = v_next.user_id;

  PERFORM trek_notify(v_next.user_id, 'waitlist_moved', v_plan.id, NULL,
    'A place opened on ' || trek_plan_label(v_plan.id) ||
    '. Your ask is now in front of the host.');
  PERFORM trek_notify(v_plan.host_id, 'request_received', v_plan.id, v_next.user_id,
    v_next.display_name || ' moved off the waitlist for ' || trek_plan_label(v_plan.id) || '.');

  RETURN NULL;
END $$;

-- Fires only when a confirmed place is actually given up. Without this WHEN the
-- promotion would re-run on its own UPDATE and walk the whole queue.
DROP TRIGGER IF EXISTS trek_requests_xx_promote ON trek_plan_requests;
CREATE TRIGGER trek_requests_xx_promote
  AFTER UPDATE ON trek_plan_requests
  FOR EACH ROW
  WHEN (OLD.status = 'confirmed' AND NEW.status <> 'confirmed')
  EXECUTE FUNCTION trek_requests_promote();
