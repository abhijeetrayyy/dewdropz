-- ═══════════════════════════════════════════════════════════════════════════
-- 060 — Telling people things
-- ═══════════════════════════════════════════════════════════════════════════
--
-- The largest hole in this product, and it was not a missing screen — it was
-- that nothing ever reached anybody.
--
--   * Somebody accepted onto a trek was never told. They found out by coming
--     back and looking, which means the moment the product exists to create
--     depended on the person refreshing a page on the off-chance.
--   * A declined request just disappeared: getMyTreks filters to requested and
--     confirmed, so the walk vanished from their list with no explanation and
--     no way to tell "declined" from "cancelled" from "I imagined it".
--   * A host was told about a new request only through Slack, and
--     SLACK_WEBHOOK_URL is not set — so in practice, not at all.
--
-- WHY IN-APP AND NOT EMAIL
--
-- Email needs RESEND_API_KEY, which is unset, and SMS needs a provider nobody
-- has bought yet. Both are decisions with a bill attached. A notification row
-- needs neither, works today, and is the thing an email would have linked to
-- anyway. When a channel is chosen it can read this table rather than being
-- bolted on beside it.
--
-- WHY TRIGGERS
--
-- Same reason the moderation scan is on the tables: trek_decide_request is not
-- the only thing that can move a row, and a notification that only fires when
-- one particular RPC is used is a notification that silently stops existing
-- the first time somebody writes a repair script.

CREATE TABLE IF NOT EXISTS trek_notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Who is being told.
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN (
    'request_received',   -- somebody asked to come on your walk
    'request_confirmed',  -- you are on
    'request_declined',   -- you are not
    'request_withdrawn',  -- somebody who asked has pulled out
    'plan_cancelled',     -- the walk you were on is off
    'point_released',     -- enough people are going; the meeting point is yours
    'vouched'             -- somebody vouched for you
  )),
  plan_id    UUID REFERENCES trek_plans(id) ON DELETE CASCADE,
  -- Who caused it. Never shown as a link when it would leak a stranger's
  -- profile to somebody they have not agreed to walk with.
  actor_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Written at the moment it happens, because the walk it refers to can be
  -- cancelled or renamed afterwards and the notification still has to read
  -- correctly. A notification assembled at read time is a notification that
  -- rewrites history.
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at    TIMESTAMPTZ,
  CONSTRAINT trek_notifications_body_len CHECK (length(btrim(body)) BETWEEN 3 AND 300)
);

CREATE INDEX IF NOT EXISTS trek_notifications_inbox_idx
  ON trek_notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS trek_notifications_unread_idx
  ON trek_notifications (user_id) WHERE read_at IS NULL;

ALTER TABLE trek_notifications ENABLE ROW LEVEL SECURITY;

-- You read yours. Nobody writes through the API at all — every row here is
-- made by a trigger, so there is no policy for INSERT and no way to forge one.
DROP POLICY IF EXISTS trek_notifications_own ON trek_notifications;
CREATE POLICY trek_notifications_own ON trek_notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS trek_notifications_mark ON trek_notifications;
CREATE POLICY trek_notifications_mark ON trek_notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── Writing them ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trek_notify(
  p_user UUID, p_kind TEXT, p_plan UUID, p_actor UUID, p_body TEXT
) RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Never tell somebody about their own action. A host confirming a walker
  -- does not need an inbox item saying they did it.
  IF p_user IS NULL OR p_user = p_actor THEN RETURN; END IF;
  INSERT INTO trek_notifications (user_id, kind, plan_id, actor_id, body)
  VALUES (p_user, p_kind, p_plan, p_actor, left(btrim(p_body), 300));
END $$;

/** A walk, named the way a person would say it. */
CREATE OR REPLACE FUNCTION trek_plan_label(p_plan UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(p.place, 'a walk') ||
         ' on ' || to_char(p.starts_at AT TIME ZONE 'Asia/Kolkata', 'FMDD Mon')
  FROM trek_plans p WHERE p.id = p_plan;
$$;

-- ── Requests ─────────────────────────────────────────────────────────────────

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

  -- A hard delete, which nothing does today but a repair script might.
  IF TG_OP = 'DELETE' THEN
    v_label := trek_plan_label(OLD.plan_id);
    PERFORM trek_notify(
      OLD.plan_host_id, 'request_withdrawn', OLD.plan_id, OLD.user_id,
      OLD.display_name || ' has pulled out of ' || v_label || '.'
    );
    RETURN NULL;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_label := trek_plan_label(NEW.plan_id);
    SELECT host_name, going_count, min_party INTO v_host, v_going, v_min
    FROM trek_plans WHERE id = NEW.plan_id;

    IF NEW.status = 'confirmed' THEN
      PERFORM trek_notify(
        NEW.user_id, 'request_confirmed', NEW.plan_id, NEW.plan_host_id,
        'You are going on ' || v_label || '. ' || v_host || ' confirmed you.'
      );

      -- The meeting point unlocks on a count, and until now the moment it
      -- unlocked was invisible — the page simply started showing an address to
      -- anyone who happened to reload. Tell the party it is theirs.
      IF v_going >= v_min THEN
        PERFORM trek_notify(r.user_id, 'point_released', NEW.plan_id, NULL,
          'Enough people are going on ' || v_label ||
          ' — the exact meeting point is on the walk''s page now.')
        FROM trek_plan_requests r
        WHERE r.plan_id = NEW.plan_id AND r.status = 'confirmed';
      END IF;

    ELSIF NEW.status = 'withdrawn' THEN
      -- Withdrawing is an UPDATE to 'withdrawn', not a DELETE — checked
      -- against trek_withdraw_request rather than assumed. Written as a DELETE
      -- branch alone, this notification was dead code and a host was never
      -- told that somebody had pulled out of their walk.
      PERFORM trek_notify(
        NEW.plan_host_id, 'request_withdrawn', NEW.plan_id, NEW.user_id,
        NEW.display_name || ' has pulled out of ' || v_label ||
        CASE WHEN OLD.status = 'confirmed'
             THEN '. They were confirmed, so you are one down.'
             ELSE '.' END
      );

    ELSIF NEW.status = 'declined' THEN
      -- The one that mattered most and existed least. A declined walk drops
      -- out of getMyTreks entirely, so without this it simply vanished.
      PERFORM trek_notify(
        NEW.user_id, 'request_declined', NEW.plan_id, NEW.plan_host_id,
        v_host || ' is not taking you on ' || v_label ||
        '. It is not personal — a host picks a group.'
      );
    END IF;
  END IF;

  RETURN NULL;
END $$;

-- NAME MATTERS HERE, and it is not cosmetic.
--
-- Postgres fires AFTER triggers in alphabetical order by name, and the count
-- this one reads — trek_plans.going_count, a generated column over
-- confirmed_count — is maintained by trek_requests_recount, another AFTER
-- trigger on this same table. Named trek_plan_requests_60_notify it sorted
-- BEFORE the recount ('p' < 'r'), so it read the party size as it was a moment
-- ago: the third walker was confirmed, the floor was reached, and the
-- meeting-point notice never fired because the count still said two.
--
-- `zz` puts it last, after every other AFTER trigger on this table. Anything
-- added later that this needs to observe must sort before it.
DROP TRIGGER IF EXISTS trek_plan_requests_60_notify ON trek_plan_requests;
DROP TRIGGER IF EXISTS trek_requests_zz_notify ON trek_plan_requests;
CREATE TRIGGER trek_requests_zz_notify
  AFTER INSERT OR UPDATE OR DELETE ON trek_plan_requests
  FOR EACH ROW EXECUTE FUNCTION trek_requests_notify();

-- ── Cancellations ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trek_plans_notify()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_label TEXT;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    v_label := trek_plan_label(NEW.id);
    -- Everybody who had asked, not only the confirmed ones: somebody still
    -- waiting on an answer is also planning their weekend around this.
    PERFORM trek_notify(r.user_id, 'plan_cancelled', NEW.id, NEW.host_id,
      v_label || ' is off' ||
      CASE WHEN NEW.cancel_reason IS NULL OR btrim(NEW.cancel_reason) = ''
           THEN '.' ELSE ' — ' || NEW.cancel_reason END)
    FROM trek_plan_requests r
    WHERE r.plan_id = NEW.id AND r.status IN ('requested', 'confirmed');
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trek_plans_60_notify ON trek_plans;
CREATE TRIGGER trek_plans_60_notify
  AFTER UPDATE ON trek_plans
  FOR EACH ROW EXECUTE FUNCTION trek_plans_notify();

-- ── Vouches ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trek_vouches_notify()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_who TEXT;
BEGIN
  SELECT trek_display_name INTO v_who FROM profiles WHERE id = NEW.voucher_id;
  PERFORM trek_notify(
    NEW.vouchee_id, 'vouched', NEW.plan_id, NEW.voucher_id,
    COALESCE(v_who, 'Somebody') || ' vouched for you. It is the strongest thing on your profile.'
  );
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trek_vouches_60_notify ON trek_vouches;
CREATE TRIGGER trek_vouches_60_notify
  AFTER INSERT ON trek_vouches
  FOR EACH ROW EXECUTE FUNCTION trek_vouches_notify();

-- ── Reading them ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trek_mark_notifications_read(p_actor UUID DEFAULT NULL)
RETURNS INT
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := trek_actor(p_actor); v_n INT;
BEGIN
  UPDATE trek_notifications SET read_at = NOW()
   WHERE user_id = v_user AND read_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

REVOKE ALL ON FUNCTION trek_notify(UUID, TEXT, UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION trek_mark_notifications_read(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION trek_mark_notifications_read(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION trek_plan_label(UUID) TO authenticated, service_role;
