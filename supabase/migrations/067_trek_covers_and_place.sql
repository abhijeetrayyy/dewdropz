-- ---------------------------------------------------------------------------
-- 067 — photographs, and a place in the world
-- ---------------------------------------------------------------------------
--
-- Two things the board needs before it can look like the design.
--
-- 1. COVERS. trek_plans.cover_urls has existed since 055 and nothing has ever
--    written to it, so every card on the board is text on paper. A board of
--    strangers becomes a place people go when you can see where they are going.
--    This adds the bucket that column was always meant to point at.
--
-- 2. WHERE IN THE WORLD. The board says "Dehradun and around" and the model
--    agrees with it by knowing nothing else. Widening later would then be a
--    migration over live rows rather than a change of copy, so country and
--    region go in now, defaulted to India, and nothing on screen changes yet.

-- ---------------------------------------------------------------------------
-- 1. Where a walk is
-- ---------------------------------------------------------------------------
ALTER TABLE trek_plans ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'India';
ALTER TABLE trek_plans ADD COLUMN IF NOT EXISTS region  TEXT;

COMMENT ON COLUMN trek_plans.country IS
  'Defaulted to India and not surfaced yet. Present so that widening beyond Dehradun is a copy change and a filter, not a migration against live walks.';
COMMENT ON COLUMN trek_plans.region IS
  'State or province — "Uttarakhand", "Trentino". Free text on purpose: a fixed list is wrong somewhere on day one.';

CREATE INDEX IF NOT EXISTS idx_trek_plans_country ON trek_plans(country, starts_at DESC);

-- ---------------------------------------------------------------------------
-- 2. The bucket
-- ---------------------------------------------------------------------------
-- Public, like products and avatars. A cover is a photograph of a hillside
-- chosen by the host to advertise a walk; there is nothing in it that the board
-- is keeping back. The thing the board actually withholds — the meeting point —
-- lives in trek_plan_details behind RLS and is not affected by this.
INSERT INTO storage.buckets (id, name, public)
VALUES ('trek-covers', 'trek-covers', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read trek covers"        ON storage.objects;
DROP POLICY IF EXISTS "Members upload own trek covers" ON storage.objects;
DROP POLICY IF EXISTS "Members delete own trek covers" ON storage.objects;

CREATE POLICY "Public read trek covers" ON storage.objects
  FOR SELECT USING (bucket_id = 'trek-covers');

-- Same shape as the avatars policies next door: the first path segment must be
-- the uploader's own id, so nobody can write into someone else's folder or
-- overwrite the photograph on a walk that is not theirs.
CREATE POLICY "Members upload own trek covers" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'trek-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Members delete own trek covers" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'trek-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
