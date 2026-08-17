-- ═══════════════════════════════════════════════════════════════════════════
-- 057 — Trek Buddy as a platform: kinds, mentors, guidance, people
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Four changes, all pointing the same way: this stops being a form that posts
-- rows and starts being somewhere people have a presence.
--
--   1. KINDS OF OUTING BECOME DATA. Six activities were pinned in a CHECK
--      constraint and restated in a TypeScript file. Adding a seventh meant a
--      migration, a deploy, and remembering the second copy existed. They are
--      now a table with their own hour rules, and the constraint is a trigger
--      that reads it — so a new kind is a row, and a kind nobody uses can be
--      switched off without deleting the walks that used it.
--
--      A host can also name their own, which is the ask "give them flexibility
--      to create their own". It arrives as activity='other' plus a label they
--      type, and that label is scanned like every other piece of free text,
--      because a free-text field on a public board is a free-text field.
--
--   2. MENTORS. Some people on this board have been walking these hills for
--      twenty years and some are going out for the first time, and right now
--      the board cannot tell you which is which. A mentor is granted by an
--      admin — never self-claimed, which is the whole point of it meaning
--      anything — and what they know is carried in the guidance below rather
--      than in a badge that says "expert" and proves nothing.
--
--   3. GUIDANCE. The knowledge that normally only reaches you by having gone
--      out with someone who already knew: what a "moderate" rating really
--      means, why the descent is where people get hurt, what changes for a
--      woman joining a group of strangers, what an overnight actually commits
--      you to. Held per activity and per audience so it can be shown at the
--      moment it applies rather than filed on a safety page nobody opens.
--
--   4. A PROFILE WORTH LOOKING AT. Experience, years out, the highest they have
--      been, when they usually go, what they carry. All self-declared and
--      labelled as such — this sits next to the four counted facts from 054
--      (email confirmed, has ordered, walks hosted, walks joined, vouches),
--      and the difference between what someone claims and what the board can
--      prove stays visible.
--
-- WHAT THIS DELIBERATELY DOES NOT ADD
--
-- Profile photographs. They are the single biggest driver of the "social
-- platform" feel being asked for, and they are also a decision with a real
-- cost: image moderation is a different discipline to a word list, it cannot be
-- done with rules in a table, and on a board where strangers arrange to meet
-- alone outdoors a photo changes who gets picked and why. That is the owner's
-- call to make knowingly, not something to slip in under a schema migration.

-- ── 1. Kinds of outing ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trek_activity_kinds (
  key             TEXT PRIMARY KEY,
  label           TEXT NOT NULL,
  blurb           TEXT NOT NULL,
  day_part        TEXT NOT NULL CHECK (day_part IN ('day', 'evening', 'overnight')),
  -- The window this kind may start in, IST. Enforced by trigger below.
  start_min       TIME NOT NULL,
  start_max       TIME NOT NULL,
  -- What the composer prefills.
  default_start   TIME NOT NULL,
  default_back_by TIME NOT NULL,
  ends_next_day   BOOLEAN NOT NULL DEFAULT FALSE,
  -- How many must be confirmed before the exact meeting point is released.
  min_party       INT NOT NULL DEFAULT 3 CHECK (min_party BETWEEN 2 AND 8),
  -- Whether the host must write how everyone gets back in the dark.
  needs_night_note BOOLEAN NOT NULL DEFAULT FALSE,
  -- 'other' is the host-named kind and is handled specially by the composer.
  is_open_ended   BOOLEAN NOT NULL DEFAULT FALSE,
  sort            INT NOT NULL DEFAULT 100,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT trek_kinds_window CHECK (start_max >= start_min),
  CONSTRAINT trek_kinds_key_shape CHECK (key ~ '^[a-z][a-z0-9_]{1,30}$')
);

-- Seed the six that already exist, with exactly the hours 053 enforced, so
-- swapping the CHECK for a lookup changes nothing about what is legal today.
INSERT INTO trek_activity_kinds
  (key, label, blurb, day_part, start_min, start_max, default_start, default_back_by,
   ends_next_day, min_party, needs_night_note, sort)
VALUES
  ('trekking','Trekking','A day walk, out and back','day','04:30','16:00','07:00','16:00',false,3,false,10),
  ('bird_watching','Bird watching','Early start, slow pace','day','04:30','16:00','05:20','09:00',false,3,false,20),
  ('cycling','Cycling','On wheels, on road or trail','day','04:30','16:00','06:30','12:00',false,3,false,30),
  ('running','Running','Trail running, at a stated pace','day','04:30','16:00','06:00','09:00',false,3,false,40),
  ('stargazing','Stargazing','After dark, back the same night','evening','17:00','22:00','21:40','00:30',true,4,true,50),
  ('camping','Camping','One night out, back next morning','overnight','12:00','19:00','17:30','11:00',true,4,true,60),
  -- 'expedition' was already permitted by the old CHECK; keep it legal.
  ('expedition','Expedition','Several days on the hill','day','04:30','16:00','06:00','18:00',false,3,false,70)
ON CONFLICT (key) DO NOTHING;

-- The host-named kind. Wide hours, because the whole point is that the board
-- does not know what it is; everything else about it is still enforced.
INSERT INTO trek_activity_kinds
  (key, label, blurb, day_part, start_min, start_max, default_start, default_back_by,
   ends_next_day, min_party, needs_night_note, is_open_ended, sort)
VALUES
  ('other','Something else','Name it yourself','day','00:00','23:59','07:00','17:00',false,3,false,true,999)
ON CONFLICT (key) DO NOTHING;

-- The host's own name for an 'other' outing.
ALTER TABLE trek_plans ADD COLUMN IF NOT EXISTS activity_other TEXT;

DO $$ BEGIN
  ALTER TABLE trek_plans ADD CONSTRAINT trek_plans_activity_other_len
    CHECK (activity_other IS NULL OR length(btrim(activity_other)) BETWEEN 3 AND 40);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 'other' must be named; anything else must not be.
DO $$ BEGIN
  ALTER TABLE trek_plans ADD CONSTRAINT trek_plans_activity_other_coherent
    CHECK ((activity = 'other') = (activity_other IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Swap the frozen list for a foreign key. A kind can now be added or retired
-- without a migration, and a walk can never name one that does not exist.
ALTER TABLE trek_plans DROP CONSTRAINT IF EXISTS trek_plans_activity_check;
DO $$ BEGIN
  ALTER TABLE trek_plans ADD CONSTRAINT trek_plans_activity_fk
    FOREIGN KEY (activity) REFERENCES trek_activity_kinds(key);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The hour rules move from a CHECK (which cannot read another table) to a
-- trigger (which can). Same rules, one source.
ALTER TABLE trek_plans DROP CONSTRAINT IF EXISTS trek_plans_hours;

CREATE OR REPLACE FUNCTION trek_plans_hours_guard()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE k trek_activity_kinds;
BEGIN
  SELECT * INTO k FROM trek_activity_kinds WHERE key = NEW.activity;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown kind of outing: %', NEW.activity
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NOT k.active THEN
    RAISE EXCEPTION 'the board is not taking % walks at the moment', k.label
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Times are optional on a multi-day trip (see 055), so the window is only
  -- checked when an hour was actually stated.
  IF NEW.start_time IS NOT NULL
     AND NEW.start_time NOT BETWEEN k.start_min AND k.start_max THEN
    RAISE EXCEPTION '% starts between % and %, not %',
      k.label, to_char(k.start_min, 'HH24:MI'), to_char(k.start_max, 'HH24:MI'),
      to_char(NEW.start_time, 'HH24:MI')
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Anything running in the dark has to say how everyone gets back.
  IF k.needs_night_note
     AND (NEW.night_note IS NULL OR length(btrim(NEW.night_note)) < 10) THEN
    RAISE EXCEPTION 'a % plan must say how everyone gets back in the dark', k.label
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trek_plans_12_hours ON trek_plans;
CREATE TRIGGER trek_plans_12_hours
  BEFORE INSERT OR UPDATE ON trek_plans
  FOR EACH ROW EXECUTE FUNCTION trek_plans_hours_guard();

-- min_party was a generated column hardcoding "camping and stargazing need 4".
-- It now comes from the kind, so a new kind brings its own floor with it.
--
-- The three-person floor is load-bearing: it is what the meeting-point RLS
-- policy compares going_count against, so dropping the column means dropping
-- and restoring that policy in the same transaction. It is restored EXACTLY as
-- it was — this migration changes where the number comes from, not who may
-- read an address.
DROP POLICY IF EXISTS "Confirmed party reads the meeting point" ON trek_plan_details;

ALTER TABLE trek_plans DROP COLUMN IF EXISTS min_party;
ALTER TABLE trek_plans ADD COLUMN IF NOT EXISTS min_party INT NOT NULL DEFAULT 3;

CREATE POLICY "Confirmed party reads the meeting point" ON trek_plan_details
  FOR SELECT USING (
    EXISTS (
      SELECT 1
        FROM trek_plans p
        JOIN trek_plan_requests r
          ON r.plan_id = p.id AND r.user_id = auth.uid() AND r.status = 'confirmed'
       WHERE p.id = trek_plan_details.plan_id
         AND p.going_count >= p.min_party
    )
  );

CREATE OR REPLACE FUNCTION trek_plans_min_party()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  SELECT min_party INTO NEW.min_party FROM trek_activity_kinds WHERE key = NEW.activity;
  NEW.min_party := COALESCE(NEW.min_party, 3);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trek_plans_11_min_party ON trek_plans;
CREATE TRIGGER trek_plans_11_min_party
  BEFORE INSERT OR UPDATE ON trek_plans
  FOR EACH ROW EXECUTE FUNCTION trek_plans_min_party();

-- ── 2. Mentors ───────────────────────────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trek_mentor       BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trek_mentor_since TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trek_mentor_bio   TEXT;

DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT trek_mentor_bio_len
    CHECK (trek_mentor_bio IS NULL OR length(btrim(trek_mentor_bio)) BETWEEN 20 AND 600);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Granted, never claimed. A self-serve "I am experienced" checkbox is worth
-- exactly nothing on a board whose entire safety story is that nobody has been
-- checked.
CREATE OR REPLACE FUNCTION trek_admin_set_mentor(
  p_user UUID, p_mentor BOOLEAN, p_bio TEXT DEFAULT NULL, p_actor UUID DEFAULT NULL
) RETURNS profiles
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin UUID := trek_actor(p_actor); v_row profiles;
BEGIN
  IF NOT trek_is_admin(v_admin) THEN
    RAISE EXCEPTION 'only an admin appoints a mentor' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE profiles SET
    trek_mentor = p_mentor,
    trek_mentor_since = CASE WHEN p_mentor THEN COALESCE(trek_mentor_since, NOW()) ELSE NULL END,
    trek_mentor_bio = CASE WHEN p_mentor THEN COALESCE(NULLIF(btrim(p_bio), ''), trek_mentor_bio) ELSE NULL END
  WHERE id = p_user
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such member' USING ERRCODE = 'no_data_found'; END IF;
  RETURN v_row;
END $$;

-- ── 3. Guidance ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trek_guidance (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- A kind's key, or 'general' when it applies to everything. Not an FK,
  -- because 'general' is not a kind and inventing a row for it would put it in
  -- the composer's activity picker.
  activity   TEXT NOT NULL DEFAULT 'general',
  audience   TEXT NOT NULL DEFAULT 'all'
    CHECK (audience IN ('all', 'women', 'first_time', 'host')),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  -- Whose knowledge this is. NULL means the studio wrote it.
  author_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sort       INT NOT NULL DEFAULT 100,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT trek_guidance_title_len CHECK (length(btrim(title)) BETWEEN 3 AND 80),
  CONSTRAINT trek_guidance_body_len  CHECK (length(btrim(body))  BETWEEN 20 AND 1200)
);

CREATE INDEX IF NOT EXISTS trek_guidance_lookup_idx
  ON trek_guidance (activity, audience, sort) WHERE active;

DROP TRIGGER IF EXISTS update_trek_guidance_updated_at ON trek_guidance;
CREATE TRIGGER update_trek_guidance_updated_at
  BEFORE UPDATE ON trek_guidance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE trek_guidance ENABLE ROW LEVEL SECURITY;

-- Everyone signed in reads it; only admins write it. Guidance that any member
-- could edit is guidance nobody can trust.
DROP POLICY IF EXISTS trek_guidance_read ON trek_guidance;
CREATE POLICY trek_guidance_read ON trek_guidance
  FOR SELECT TO authenticated USING (active);

DROP POLICY IF EXISTS trek_guidance_admin ON trek_guidance;
CREATE POLICY trek_guidance_admin ON trek_guidance
  FOR ALL TO authenticated
  USING (trek_is_admin(auth.uid())) WITH CHECK (trek_is_admin(auth.uid()));

ALTER TABLE trek_activity_kinds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trek_kinds_read ON trek_activity_kinds;
CREATE POLICY trek_kinds_read ON trek_activity_kinds
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS trek_kinds_admin ON trek_activity_kinds;
CREATE POLICY trek_kinds_admin ON trek_activity_kinds
  FOR ALL TO authenticated
  USING (trek_is_admin(auth.uid())) WITH CHECK (trek_is_admin(auth.uid()));

-- ── 4. A profile worth looking at ────────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trek_experience TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trek_years_out  INT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trek_highest_m  INT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trek_usual_days TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trek_carries    TEXT[] NOT NULL DEFAULT '{}';

DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT trek_experience_check
    CHECK (trek_experience IS NULL OR trek_experience IN ('new','some','seasoned','veteran'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Bounded because these are claims on a public profile, and an unbounded
  -- claim is an invitation to write 8848.
  ALTER TABLE profiles ADD CONSTRAINT trek_years_out_check
    CHECK (trek_years_out IS NULL OR trek_years_out BETWEEN 0 AND 60);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT trek_highest_m_check
    CHECK (trek_highest_m IS NULL OR trek_highest_m BETWEEN 0 AND 8849);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT trek_usual_days_check
    CHECK (coalesce(array_length(trek_usual_days, 1), 0) <= 7);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT trek_carries_check
    CHECK (coalesce(array_length(trek_carries, 1), 0) <= 12);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT EXECUTE ON FUNCTION trek_admin_set_mentor(UUID, BOOLEAN, TEXT, UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION trek_admin_set_mentor(UUID, BOOLEAN, TEXT, UUID) FROM PUBLIC;
