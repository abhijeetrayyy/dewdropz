-- ---------------------------------------------------------------------------
-- 078 — recaps, and weeks in a row
-- ---------------------------------------------------------------------------
--
-- The design's landing page carries "From last weekend — it happened, here is
-- the proof". That is doing more work than a photo gallery: the hardest thing
-- for a new board to establish is that anybody actually turns up, and a walk
-- that finished with pictures and a paragraph is the only evidence of that
-- which cannot be written in advance.
--
-- WHO WRITES ONE. The host, and only after the walk has finished. It is their
-- walk and their account of it, and one recap per walk keeps it an account
-- rather than a comment thread — the group chat already exists for the party's
-- own conversation.

CREATE TABLE IF NOT EXISTS trek_recaps (
  -- One per walk, so the primary key is the plan.
  plan_id    UUID PRIMARY KEY REFERENCES trek_plans(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT trek_recaps_body_len   CHECK (length(btrim(body)) BETWEEN 10 AND 1200),
  CONSTRAINT trek_recaps_photo_count CHECK (array_length(photo_urls, 1) IS NULL
                                            OR array_length(photo_urls, 1) <= 6)
);

CREATE INDEX IF NOT EXISTS idx_trek_recaps_recent ON trek_recaps(created_at DESC);

ALTER TABLE trek_recaps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read recaps"     ON trek_recaps;
DROP POLICY IF EXISTS "The host writes a recap" ON trek_recaps;

-- Readable by any signed-in member, like the board itself. A recap is the
-- board's evidence that it works, and evidence nobody can see proves nothing.
-- Not readable signed-out, for the same reason the board is not.
CREATE POLICY "Members read recaps" ON trek_recaps
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "The host writes a recap" ON trek_recaps
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM trek_plans p WHERE p.id = plan_id AND p.host_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM trek_plans p WHERE p.id = plan_id AND p.host_id = auth.uid())
              AND author_id = auth.uid());

CREATE OR REPLACE FUNCTION trek_recaps_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_plan trek_plans;
BEGIN
  SELECT * INTO v_plan FROM trek_plans WHERE id = NEW.plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such walk' USING ERRCODE = 'no_data_found';
  END IF;
  -- Before the walk this would be fiction, and fiction is the one thing the
  -- proof cannot be.
  IF v_plan.ends_at > NOW() THEN
    RAISE EXCEPTION 'you can write this after the walk, not before'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_plan.status = 'cancelled' THEN
    RAISE EXCEPTION 'that walk was called off' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  NEW.body := btrim(NEW.body);
  NEW.updated_at := NOW();
  PERFORM trek_moderate_field(NEW.body, 'recap', NEW.plan_id, NEW.author_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trek_recaps_10_guard ON trek_recaps;
CREATE TRIGGER trek_recaps_10_guard
  BEFORE INSERT OR UPDATE ON trek_recaps
  FOR EACH ROW EXECUTE FUNCTION trek_recaps_guard();

-- The most recent walks that actually happened, with their account attached.
CREATE OR REPLACE FUNCTION trek_recent_recaps(p_limit INT DEFAULT 6)
RETURNS TABLE (
  plan_id   UUID,
  place     TEXT,
  activity  TEXT,
  starts_at TIMESTAMPTZ,
  host_name TEXT,
  host_id   UUID,
  body      TEXT,
  photo_urls TEXT[],
  going     INT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.place, p.activity, p.starts_at, p.host_name, p.host_id,
         r.body, r.photo_urls, p.going_count
    FROM trek_recaps r
    JOIN trek_plans p ON p.id = r.plan_id
   WHERE p.hidden_at IS NULL AND p.status <> 'cancelled'
   ORDER BY p.starts_at DESC
   LIMIT LEAST(GREATEST(p_limit, 1), 24);
$$;

REVOKE ALL ON FUNCTION trek_recent_recaps(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION trek_recent_recaps(INT) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Weeks in a row
-- ---------------------------------------------------------------------------
-- Derived, never stored. A stored streak is a number that has to be recomputed
-- on every walk, every withdrawal and every cancellation, and one missed
-- recompute leaves somebody wearing a badge they no longer hold.
--
-- The grace matters. A streak anchored strictly to the current week would break
-- at one minute past midnight on Monday for somebody who walks every Saturday,
-- which is both wrong and the exact moment they would notice. So the count runs
-- back from the most recent week they were out, and only counts as live if that
-- week is this one or the one before.
CREATE OR REPLACE FUNCTION trek_streak_weeks(p_user UUID)
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH weeks AS (
    SELECT DISTINCT date_trunc('week', (p.starts_at AT TIME ZONE 'Asia/Kolkata')) AS wk
      FROM trek_plans p
     WHERE p.status <> 'cancelled'
       AND p.starts_at <= NOW()
       AND (p.host_id = p_user
            OR EXISTS (SELECT 1 FROM trek_plan_requests r
                        WHERE r.plan_id = p.id AND r.user_id = p_user AND r.status = 'confirmed'))
  ),
  -- Number each week backwards from the newest, then compare that ordinal to
  -- how far the week actually is from the newest. While they agree the weeks
  -- are unbroken; the first disagreement is the gap.
  ranked AS (
    SELECT wk, row_number() OVER (ORDER BY wk DESC) - 1 AS n,
           (SELECT max(wk) FROM weeks) AS newest
      FROM weeks
  )
  SELECT COALESCE((
    SELECT count(*)::INT FROM ranked
     WHERE wk = newest - (n || ' weeks')::INTERVAL
       -- Live only: the newest week is this week or last week.
       AND newest >= date_trunc('week', (NOW() AT TIME ZONE 'Asia/Kolkata')) - INTERVAL '1 week'
  ), 0);
$$;

REVOKE ALL ON FUNCTION trek_streak_weeks(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION trek_streak_weeks(UUID) TO authenticated, service_role;
