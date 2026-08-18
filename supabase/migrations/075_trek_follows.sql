-- ---------------------------------------------------------------------------
-- 075 — following people
-- ---------------------------------------------------------------------------
--
-- The design's Basecamp is a feed of "walks from people whose hours match
-- yours", and following is what fills it. It is deliberately the lightest
-- possible social tie: one-directional, needs no consent, and grants nothing.
--
-- WHAT A FOLLOW DOES NOT DO. It does not let you see anything you could not see
-- already — every walk in a follower's feed is a walk that was already on the
-- public board. It does not notify the person followed, because a board where
-- strangers get told "somebody is watching you" is a worse place to be a woman
-- than one where they do not. And it does not affect who gets onto a walk: the
-- host still decides, and being followed by them counts for nothing.
--
-- So the whole feature is a saved search over people, and it is written to stay
-- that way.

CREATE TABLE IF NOT EXISTS trek_follows (
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  followed_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, followed_id),
  CONSTRAINT trek_follows_not_self CHECK (follower_id <> followed_id)
);

CREATE INDEX IF NOT EXISTS idx_trek_follows_followed ON trek_follows(followed_id);

ALTER TABLE trek_follows ENABLE ROW LEVEL SECURITY;

-- You may read and write only your own following list. Deliberately NOT "you
-- may read who follows you": a follower list is the raw material for working
-- out who is interested in whom, and nothing on this board needs it.
DROP POLICY IF EXISTS "Read your own follows"   ON trek_follows;
DROP POLICY IF EXISTS "Manage your own follows" ON trek_follows;
CREATE POLICY "Read your own follows" ON trek_follows
  FOR SELECT TO authenticated USING (follower_id = auth.uid());
CREATE POLICY "Manage your own follows" ON trek_follows
  FOR ALL TO authenticated
  USING (follower_id = auth.uid())
  WITH CHECK (follower_id = auth.uid());

-- A block is mutual silence. Following somebody who blocked you — or somebody
-- you blocked — would put their walks back in front of you, which is most of
-- what a block is for.
CREATE OR REPLACE FUNCTION trek_follows_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF trek_blocked_between(NEW.follower_id, NEW.followed_id) THEN
    RAISE EXCEPTION 'there is a block between you and that person'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- A suspended member is off the board; their walks do not show, so a follow
  -- would be a tie to nothing.
  IF EXISTS (SELECT 1 FROM profiles
              WHERE id = NEW.followed_id
                AND (trek_suspended_at IS NOT NULL OR trek_display_name IS NULL)) THEN
    RAISE EXCEPTION 'that person is not on the board' USING ERRCODE = 'no_data_found';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trek_follows_10_guard ON trek_follows;
CREATE TRIGGER trek_follows_10_guard
  BEFORE INSERT ON trek_follows
  FOR EACH ROW EXECUTE FUNCTION trek_follows_guard();

-- ---------------------------------------------------------------------------
-- The feed
-- ---------------------------------------------------------------------------
-- Upcoming, open, unhidden walks hosted by somebody the caller follows. The
-- same visibility rules as the board — this is a filter over it, never a way
-- around it. Women-only walks stay in, because they are on the board too; the
-- gate is on asking to come, not on seeing that it exists.
CREATE OR REPLACE FUNCTION trek_basecamp(p_user UUID, p_limit INT DEFAULT 30)
RETURNS SETOF trek_plans
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.*
    FROM trek_plans p
    JOIN trek_follows f ON f.followed_id = p.host_id AND f.follower_id = p_user
   WHERE p.status = 'open'
     AND p.hidden_at IS NULL
     AND p.starts_at > NOW()
     AND NOT trek_blocked_between(p_user, p.host_id)
   ORDER BY p.starts_at
   LIMIT LEAST(GREATEST(p_limit, 1), 60);
$$;

REVOKE ALL ON FUNCTION trek_basecamp(UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION trek_basecamp(UUID, INT) TO authenticated, service_role;

-- How many people follow somebody. Shown on their card; the list behind it is
-- not readable by anyone, which is the point of counting in a function.
CREATE OR REPLACE FUNCTION trek_follower_count(p_user UUID)
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT count(*)::INT FROM trek_follows WHERE followed_id = p_user;
$$;

REVOKE ALL ON FUNCTION trek_follower_count(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION trek_follower_count(UUID) TO authenticated, service_role;
