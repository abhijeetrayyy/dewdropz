-- ---------------------------------------------------------------------------
-- 079 — the host console
-- ---------------------------------------------------------------------------
--
-- Four things a host cannot do today. The first is the one that matters:
--
-- NOTHING ABOUT A POSTED WALK CAN BE CHANGED. There is no UPDATE policy on
-- trek_plans, trek_plan_details or trek_plan_requests — every write goes
-- through a SECURITY DEFINER function, and none of them edits. So a host who
-- mistypes the meeting point has exactly one remedy: cancel the walk and post
-- it again, losing the party. That is a bad enough trade that the likelier
-- outcome is they send the correction some other way, off the board, which is
-- the thing the board exists to prevent.
--
-- Changing the point notifies everyone who can already see it. A meeting point
-- that changes silently is worse than one that was wrong, because the people
-- who read it early are the ones who will be standing in the wrong place.

-- ---------------------------------------------------------------------------
-- 1. Two new things to tell people
-- ---------------------------------------------------------------------------
ALTER TABLE trek_notifications DROP CONSTRAINT IF EXISTS trek_notifications_kind_check;
ALTER TABLE trek_notifications ADD CONSTRAINT trek_notifications_kind_check
  CHECK (kind IN ('request_received','request_confirmed','request_declined','request_withdrawn',
                  'plan_cancelled','point_released','vouched',
                  'waitlisted','waitlist_moved',
                  'point_changed','announcement'));

-- ---------------------------------------------------------------------------
-- 2. Who turned up
-- ---------------------------------------------------------------------------
ALTER TABLE trek_plan_requests ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;

COMMENT ON COLUMN trek_plan_requests.checked_in_at IS
  'Set by the host at the meeting point. A record of who actually stood there, which is the one fact about a walk nobody can establish afterwards.';

CREATE OR REPLACE FUNCTION trek_check_in(p_plan UUID, p_user UUID, p_in BOOLEAN DEFAULT TRUE, p_actor UUID DEFAULT NULL)
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
  IF v_plan.host_id <> v_actor THEN
    RAISE EXCEPTION 'only the host checks people in' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- From twelve hours before, so an 05:10 start can be checked in the night
  -- before if the party gathers early. Not weeks ahead: a walk checked in
  -- before it happened is a record of nothing.
  IF v_plan.starts_at > NOW() + INTERVAL '12 hours' THEN
    RAISE EXCEPTION 'you can check people in on the day, not before'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE trek_plan_requests
     SET checked_in_at = CASE WHEN p_in THEN NOW() ELSE NULL END
   WHERE plan_id = p_plan AND user_id = p_user AND status = 'confirmed';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'that person is not confirmed on this walk' USING ERRCODE = 'no_data_found';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Correcting the meeting point
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trek_update_meeting_point(
  p_plan UUID, p_point TEXT, p_logistics TEXT DEFAULT NULL, p_actor UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor UUID := trek_actor(p_actor);
  v_plan  trek_plans;
  v_old   TEXT;
  v_row   RECORD;
BEGIN
  SELECT * INTO v_plan FROM trek_plans WHERE id = p_plan;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such walk' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_plan.host_id <> v_actor THEN
    RAISE EXCEPTION 'only the host sets the meeting point' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_plan.status <> 'open' THEN
    RAISE EXCEPTION 'that walk was called off' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF btrim(COALESCE(p_point, '')) = '' THEN
    RAISE EXCEPTION 'the meeting point cannot be blank' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT meeting_point INTO v_old FROM trek_plan_details WHERE plan_id = p_plan;

  -- The moderation trigger on trek_plan_details runs on this UPDATE, so a
  -- phone number cannot be smuggled in by editing what was clean at posting.
  UPDATE trek_plan_details
     SET meeting_point = btrim(p_point),
         logistics     = NULLIF(btrim(COALESCE(p_logistics, '')), '')
   WHERE plan_id = p_plan;

  -- Only tell people if it actually moved, and only the people who can see it.
  -- Somebody still waiting on a decision has never been told the old one, so a
  -- "the meeting point changed" alert would hand them the fact that there is
  -- one to change.
  IF v_old IS DISTINCT FROM btrim(p_point) THEN
    FOR v_row IN
      SELECT r.user_id FROM trek_plan_requests r
       WHERE r.plan_id = p_plan AND r.status = 'confirmed'
    LOOP
      PERFORM trek_notify(v_row.user_id, 'point_changed', p_plan, NULL,
        'The meeting point for ' || trek_plan_label(p_plan) ||
        ' has changed. Check the walk before you set off.');
    END LOOP;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Announcements
-- ---------------------------------------------------------------------------
-- An announcement is a chat message the host marks as one. Reusing the table
-- means it inherits the same RLS, the same moderation and the same place in the
-- conversation — a party should read "we are starting an hour later" in the
-- thread where they are already talking, not in a separate stream.
--
-- What it adds is the notification. The chat deliberately does not send one per
-- message; this does, because the whole point of an announcement is that it
-- reaches somebody who is not looking at the page.
ALTER TABLE trek_messages ADD COLUMN IF NOT EXISTS is_announcement BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION trek_announce(p_plan UUID, p_body TEXT, p_actor UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
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
  IF v_plan.host_id <> v_actor THEN
    RAISE EXCEPTION 'only the host makes an announcement' USING ERRCODE = 'insufficient_privilege';
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
END $$;

-- ---------------------------------------------------------------------------
-- 5. Promoting by hand
-- ---------------------------------------------------------------------------
-- Automatic promotion (070) moves the front of the queue when a place frees up.
-- This is the host's override: bringing somebody forward because they carpool,
-- or because the person in front has gone quiet. Same destination — 'requested',
-- never 'confirmed' — so the host still has to decide afterwards and the rule
-- that nobody is seated automatically holds even when a human is doing it.
CREATE OR REPLACE FUNCTION trek_promote_waitlisted(p_plan UUID, p_user UUID, p_actor UUID DEFAULT NULL)
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
  IF v_plan.host_id <> v_actor THEN
    RAISE EXCEPTION 'only the host moves the queue' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE trek_plan_requests SET status = 'requested'
   WHERE plan_id = p_plan AND user_id = p_user AND status = 'waitlisted';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'that person is not on the waitlist' USING ERRCODE = 'no_data_found';
  END IF;

  PERFORM trek_notify(p_user, 'waitlist_moved', p_plan, NULL,
    'The host moved you off the waitlist for ' || trek_plan_label(p_plan) ||
    '. Your ask is now in front of them.');
END $$;

REVOKE ALL ON FUNCTION trek_check_in(UUID, UUID, BOOLEAN, UUID)          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION trek_update_meeting_point(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION trek_announce(UUID, TEXT, UUID)                   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION trek_promote_waitlisted(UUID, UUID, UUID)         FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION trek_check_in(UUID, UUID, BOOLEAN, UUID)          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION trek_update_meeting_point(UUID, TEXT, TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION trek_announce(UUID, TEXT, UUID)                   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION trek_promote_waitlisted(UUID, UUID, UUID)         TO authenticated, service_role;
