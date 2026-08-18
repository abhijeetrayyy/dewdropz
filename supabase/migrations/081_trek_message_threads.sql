-- ---------------------------------------------------------------------------
-- 081 — the messages inbox
-- ---------------------------------------------------------------------------
--
-- Chat exists per walk, and the only way to reach a conversation is to remember
-- which walk it was on and open that page. Somebody on three walks has three
-- conversations and no list of them.
--
-- THE PREDICATE HERE MUST MATCH trek_unread_messages EXACTLY. The badge counts
-- unread; this list is where somebody goes to clear it. If the two disagree by
-- so much as a status filter, the badge counts something the list never shows
-- and can never be cleared — a permanent "4" that teaches people to ignore it.
-- Both use: not my own message, plan is open, I am host or confirmed, and the
-- message is newer than my read mark.
--
-- Only walks that have at least one message. An inbox listing empty threads for
-- every walk somebody is on is a list of things that have not happened.
CREATE OR REPLACE FUNCTION trek_message_threads(p_user UUID, p_limit INT DEFAULT 30)
RETURNS TABLE (
  plan_id      UUID,
  place        TEXT,
  activity     TEXT,
  starts_at    TIMESTAMPTZ,
  start_time   TIME,
  host_name    TEXT,
  is_host      BOOLEAN,
  last_body    TEXT,
  last_author  TEXT,
  last_at      TIMESTAMPTZ,
  last_is_announcement BOOLEAN,
  unread       INT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH mine AS (
    SELECT p.*
      FROM trek_plans p
     WHERE p.status = 'open'
       AND (p.host_id = p_user
            OR EXISTS (SELECT 1 FROM trek_plan_requests r
                        WHERE r.plan_id = p.id AND r.user_id = p_user AND r.status = 'confirmed'))
  ),
  last_msg AS (
    -- id breaks ties on created_at. Two messages share a timestamp whenever
    -- they are written in one transaction, because NOW() is the transaction
    -- clock — an announcement posted alongside another write, for instance.
    -- Without the tiebreaker DISTINCT ON picks arbitrarily between them, and
    -- "the last thing said" becomes whichever row the planner reached first.
    SELECT DISTINCT ON (m.plan_id)
           m.plan_id, m.body, m.display_name, m.created_at, m.is_announcement
      FROM trek_messages m
      JOIN mine ON mine.id = m.plan_id
     ORDER BY m.plan_id, m.created_at DESC, m.id DESC
  )
  SELECT mine.id, mine.place, mine.activity, mine.starts_at, mine.start_time,
         mine.host_name, mine.host_id = p_user,
         last_msg.body, last_msg.display_name, last_msg.created_at, last_msg.is_announcement,
         (SELECT count(*)::INT FROM trek_messages m2
           WHERE m2.plan_id = mine.id
             AND m2.user_id <> p_user
             AND m2.created_at > COALESCE(
                   (SELECT last_read_at FROM trek_message_reads x
                     WHERE x.plan_id = mine.id AND x.user_id = p_user),
                   '-infinity'::timestamptz))
    FROM mine
    JOIN last_msg ON last_msg.plan_id = mine.id
   -- Newest conversation first. An inbox sorted by when the walk leaves would
   -- bury the thread somebody is actually talking in.
   ORDER BY last_msg.created_at DESC
   LIMIT LEAST(GREATEST(p_limit, 1), 60);
$$;

REVOKE ALL ON FUNCTION trek_message_threads(UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION trek_message_threads(UUID, INT) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Marking a thread read, on the database's clock
-- ---------------------------------------------------------------------------
-- The action used to send its own timestamp: `last_read_at: new Date()`, taken
-- from the Node process. Every unread comparison is then between two clocks —
-- the app server's and Postgres's — and if the app's runs even slightly behind,
-- a message written a moment earlier stays newer than the mark that was
-- supposed to clear it, and sits unread forever.
--
-- One clock. The caller says which walk; the database says when.
CREATE OR REPLACE FUNCTION trek_mark_read(p_plan UUID, p_actor UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_actor UUID := trek_actor(p_actor);
BEGIN
  -- Only for a walk you are actually on, so a read mark cannot be planted
  -- against somebody else's conversation.
  IF NOT EXISTS (
    SELECT 1 FROM trek_plans p
     WHERE p.id = p_plan
       AND (p.host_id = v_actor
            OR EXISTS (SELECT 1 FROM trek_plan_requests r
                        WHERE r.plan_id = p.id AND r.user_id = v_actor AND r.status = 'confirmed'))
  ) THEN
    RAISE EXCEPTION 'you are not on this walk' USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO trek_message_reads (plan_id, user_id, last_read_at)
  VALUES (p_plan, v_actor, NOW())
  ON CONFLICT (plan_id, user_id) DO UPDATE SET last_read_at = NOW();
END $$;

REVOKE ALL ON FUNCTION trek_mark_read(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION trek_mark_read(UUID, UUID) TO authenticated, service_role;
