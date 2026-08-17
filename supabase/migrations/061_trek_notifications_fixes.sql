-- ═══════════════════════════════════════════════════════════════════════════
-- 061 — Fixing 060, found by adversarial review rather than by use
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Six defects in the notification work. Two would have been noticed only when
-- somebody tried to delete their account, and one only when a walk filled up.

-- ── 1. The DELETE branch bricked account erasure ─────────────────────────────
--
-- Nothing in this product ever DELETEs a request — trek_withdraw_request sets
-- status = 'withdrawn' — so the DELETE branch was reachable ONLY by cascade
-- from a deleted profile or plan. And on every such cascade it raised:
--
--   * Deleting a member: their request rows cascade away, the trigger inserts
--     a notification with actor_id pointing at the profile that was just
--     removed, and the FK check on that INSERT fails with 23503. The whole
--     transaction rolls back, so anybody who had ever asked to join a walk
--     could no longer be deleted at all.
--   * Deleting a host: profiles -> trek_plans -> trek_plan_requests, so by the
--     time the trigger runs the plan is gone, trek_plan_label returns NULL,
--     `||` is strict, and the body is NULL against a NOT NULL column — 23502.
--
-- 052 deliberately left DELETE on trek_plans unblocked so erasure keeps
-- working ("Losing a plan with its host is the right trade; blocking erasure
-- is not"). 060 silently reversed that. The branch bought nothing — the
-- withdrawal notice people actually receive comes from the UPDATE path — so
-- it goes, and the trigger no longer fires on DELETE at all.

-- ── 2. point_released fanned out on EVERY confirmation past the floor ────────
--
-- The gate was `v_going >= v_min`, a level test rather than a transition test.
-- Past the floor, every later confirmation re-sent the notice to the whole
-- confirmed party. Filling a capacity-8 trekking walk (floor 3) sent
-- 2+3+4+5+6+7 = 27 copies, and the first walker got six identical rows.
--
-- confirmed_count moves by exactly one at a time — trek_plans_guard enforces
-- that — so the crossing is exactly the moment the count EQUALS the floor.

-- ── 3. Re-asking told nobody ─────────────────────────────────────────────────
--
-- trek_request_join is `INSERT ... ON CONFLICT (plan_id, user_id) DO UPDATE`,
-- and the PK row is permanent by design ("one row per person per plan,
-- forever"). So a second ask — after withdrawing, or after being declined —
-- is an UPDATE, and 'request_received' only fired on INSERT. The host was
-- never told.

CREATE OR REPLACE FUNCTION trek_requests_notify()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_label TEXT;
  v_host  TEXT;
  v_going INT;
  v_min   INT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_label := trek_plan_label(NEW.plan_id);
    PERFORM trek_notify(
      NEW.plan_host_id, 'request_received', NEW.plan_id, NEW.user_id,
      NEW.display_name || ' asked to come on ' || v_label || '.'
    );
    RETURN NULL;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_label := trek_plan_label(NEW.plan_id);
    SELECT host_name, going_count, min_party INTO v_host, v_going, v_min
    FROM trek_plans WHERE id = NEW.plan_id;

    IF NEW.status = 'requested' THEN
      -- Asking again after withdrawing or being turned down. Same row, so
      -- this arrives as an UPDATE and the INSERT branch above never sees it.
      PERFORM trek_notify(
        NEW.plan_host_id, 'request_received', NEW.plan_id, NEW.user_id,
        NEW.display_name || ' asked to come on ' || v_label ||
        CASE WHEN OLD.status = 'withdrawn' THEN ' — they had pulled out earlier.'
             ELSE '.' END
      );

    ELSIF NEW.status = 'confirmed' THEN
      PERFORM trek_notify(
        NEW.user_id, 'request_confirmed', NEW.plan_id, NEW.plan_host_id,
        'You are going on ' || v_label || '. ' || v_host || ' confirmed you.'
      );

      -- ONLY on the crossing. `>=` re-sent this to everybody already told,
      -- every time anybody else was confirmed.
      IF v_going = v_min THEN
        PERFORM trek_notify(r.user_id, 'point_released', NEW.plan_id, NULL,
          'Enough people are going on ' || v_label ||
          ' — the exact meeting point is on the walk''s page now.')
        FROM trek_plan_requests r
        WHERE r.plan_id = NEW.plan_id AND r.status = 'confirmed';
      END IF;

    ELSIF NEW.status = 'withdrawn' THEN
      PERFORM trek_notify(
        NEW.plan_host_id, 'request_withdrawn', NEW.plan_id, NEW.user_id,
        NEW.display_name || ' has pulled out of ' || v_label ||
        CASE WHEN OLD.status = 'confirmed'
             THEN '. They were confirmed, so you are one down.'
             ELSE '.' END
      );

    ELSIF NEW.status = 'declined' THEN
      PERFORM trek_notify(
        NEW.user_id, 'request_declined', NEW.plan_id, NEW.plan_host_id,
        v_host || ' is not taking you on ' || v_label ||
        '. It is not personal — a host picks a group.'
      );
    END IF;
  END IF;

  RETURN NULL;
END $$;

-- No DELETE in the event list any more. See (1).
DROP TRIGGER IF EXISTS trek_requests_zz_notify ON trek_plan_requests;
CREATE TRIGGER trek_requests_zz_notify
  AFTER INSERT OR UPDATE ON trek_plan_requests
  FOR EACH ROW EXECUTE FUNCTION trek_requests_notify();

-- ── 4. A suspended member could still act ────────────────────────────────────
--
-- trek_require_active had exactly one caller in the whole schema —
-- trek_create_plan. So somebody suspended for harassment could still ask to
-- join walks and vouch for people, pushing their display name into other
-- members' inboxes. Added as BEFORE triggers rather than by editing three
-- RPCs, for the same reason the moderation scan lives on the tables: it then
-- covers every write path, including ones that do not exist yet.

CREATE OR REPLACE FUNCTION trek_requests_require_active()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Only on the way in. A suspension must not freeze somebody's ability to
  -- withdraw from a walk they already joined.
  IF TG_OP = 'INSERT' OR NEW.status IN ('requested', 'confirmed') THEN
    PERFORM trek_require_active(NEW.user_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trek_requests_05_active ON trek_plan_requests;
CREATE TRIGGER trek_requests_05_active
  BEFORE INSERT OR UPDATE ON trek_plan_requests
  FOR EACH ROW EXECUTE FUNCTION trek_requests_require_active();

CREATE OR REPLACE FUNCTION trek_vouches_require_active()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM trek_require_active(NEW.voucher_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trek_vouches_05_active ON trek_vouches;
CREATE TRIGGER trek_vouches_05_active
  BEFORE INSERT ON trek_vouches
  FOR EACH ROW EXECUTE FUNCTION trek_vouches_require_active();

-- ── 5. trek_plan_label was readable by anyone ────────────────────────────────
--
-- SECURITY DEFINER over trek_plans, granted to authenticated, and never
-- revoked from PUBLIC — which includes anon. So POST /rest/v1/rpc/
-- trek_plan_label with any plan id returned "place on date" for hidden and
-- cancelled walks alike, straight past the read policies. It is only ever
-- called from triggers, which run as the definer and need no grant at all.

REVOKE ALL ON FUNCTION trek_plan_label(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION trek_plan_label(UUID) FROM authenticated;

-- ── 6. A member could rewrite their own notifications ────────────────────────
--
-- RLS cannot restrict columns, and Supabase's default privileges hand UPDATE
-- on a new public table to `authenticated`. With a policy keyed only on
-- user_id, a member could PATCH the body and kind of their own rows — turning
-- "not this one" into anything they liked and then screenshotting it. Harmless
-- to everybody else, but a record that its subject can edit is not a record.
-- Column-level GRANT is the only tool that fixes it.

REVOKE UPDATE ON trek_notifications FROM authenticated;
GRANT UPDATE (read_at) ON trek_notifications TO authenticated;
