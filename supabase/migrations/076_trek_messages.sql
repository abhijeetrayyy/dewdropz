-- ---------------------------------------------------------------------------
-- 076 — the group chat
-- ---------------------------------------------------------------------------
--
-- Coordinating a walk currently happens nowhere. A host can write a note when
-- posting and nobody can answer it, so "are we still on in this rain?" the
-- night before has no home — which is exactly the question that pushes a party
-- onto WhatsApp, and off the only surface anybody can review.
--
-- WHO IS IN IT. The host and the confirmed party, through trek_is_on_plan —
-- the same predicate the rest of the board already trusts. Not people who have
-- asked, and not the waitlist. They are not on the walk, and a chat you can
-- read before you are accepted would make the host's decision a formality
-- taken in front of an audience.
--
-- MODERATION IS THE SAME AS EVERYWHERE ELSE, and that is a deliberate choice
-- with a real cost. The board tells people, in writing, that "phone numbers,
-- emails and handles are refused in every free-text field... arrangements stay
-- on the walk's own page, which is what keeps them reviewable." The chat IS the
-- walk's own page. Exempting it would make that sentence false, so the rules
-- apply here too.
--
-- The cost: a confirmed party cannot swap numbers for the day through this. If
-- that turns out to be the wrong trade, it is a rules change on the moderation
-- desk plus a copy change — a decision somebody makes on purpose, not a hole
-- left by an exemption written into a migration.

CREATE TABLE IF NOT EXISTS trek_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id      UUID NOT NULL REFERENCES trek_plans(id)  ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id)    ON DELETE CASCADE,
  -- Frozen at the time of writing, like trek_plan_requests.display_name. A
  -- message signed with a name somebody has since changed is a small lie about
  -- a conversation that already happened.
  display_name TEXT NOT NULL,
  body         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT trek_messages_body_len CHECK (length(btrim(body)) BETWEEN 1 AND 1000)
);

CREATE INDEX IF NOT EXISTS idx_trek_messages_plan ON trek_messages(plan_id, created_at DESC);

ALTER TABLE trek_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "The party reads the chat"  ON trek_messages;
DROP POLICY IF EXISTS "The party writes the chat" ON trek_messages;

CREATE POLICY "The party reads the chat" ON trek_messages
  FOR SELECT TO authenticated
  USING (trek_is_on_plan(plan_id));

-- user_id must be the writer. Without that check, a member of the party could
-- post a message signed as somebody else in the same party.
CREATE POLICY "The party writes the chat" ON trek_messages
  FOR INSERT TO authenticated
  WITH CHECK (trek_is_on_plan(plan_id) AND user_id = auth.uid());

-- No UPDATE or DELETE policy, deliberately. An edited message is a record of a
-- conversation that can be rewritten after the fact, and the one thing a
-- reviewable surface has to be is not that.

-- ---------------------------------------------------------------------------
-- Moderation, and a walk that has finished
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trek_messages_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_plan trek_plans;
BEGIN
  SELECT * INTO v_plan FROM trek_plans WHERE id = NEW.plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such walk' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_plan.status = 'cancelled' THEN
    RAISE EXCEPTION 'that walk was called off' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  -- Open for a week after the walk, so "thanks, that was great" and "you left a
  -- bottle in my car" both have somewhere to go, and then it closes.
  IF v_plan.ends_at < NOW() - INTERVAL '7 days' THEN
    RAISE EXCEPTION 'this walk finished more than a week ago' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  NEW.body := btrim(NEW.body);
  PERFORM trek_moderate_field(NEW.body, 'the group chat', NEW.plan_id, NEW.user_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trek_messages_10_guard ON trek_messages;
CREATE TRIGGER trek_messages_10_guard
  BEFORE INSERT ON trek_messages
  FOR EACH ROW EXECUTE FUNCTION trek_messages_guard();

-- ---------------------------------------------------------------------------
-- What you have not read
-- ---------------------------------------------------------------------------
-- A high-water mark per person per walk. Cheaper and steadier than a read flag
-- per message per person, which is a row count that grows with the product of
-- both and answers no question anybody asks.
CREATE TABLE IF NOT EXISTS trek_message_reads (
  plan_id      UUID NOT NULL REFERENCES trek_plans(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (plan_id, user_id)
);

ALTER TABLE trek_message_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Your own read marks" ON trek_message_reads;
CREATE POLICY "Your own read marks" ON trek_message_reads
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Unread across every walk the caller is on. Your own messages never count:
-- being told you have one unread message the moment you send one is the fastest
-- way to teach somebody the badge means nothing.
CREATE OR REPLACE FUNCTION trek_unread_messages(p_user UUID)
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT count(*)::INT
    FROM trek_messages m
    JOIN trek_plans p ON p.id = m.plan_id
   WHERE m.user_id <> p_user
     AND p.status = 'open'
     AND (p.host_id = p_user
          OR EXISTS (SELECT 1 FROM trek_plan_requests r
                      WHERE r.plan_id = m.plan_id AND r.user_id = p_user AND r.status = 'confirmed'))
     AND m.created_at > COALESCE(
           (SELECT last_read_at FROM trek_message_reads x
             WHERE x.plan_id = m.plan_id AND x.user_id = p_user),
           '-infinity'::timestamptz);
$$;

REVOKE ALL ON FUNCTION trek_unread_messages(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION trek_unread_messages(UUID) TO authenticated, service_role;
