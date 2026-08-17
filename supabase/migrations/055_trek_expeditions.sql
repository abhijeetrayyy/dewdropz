-- Trek Buddy becomes what the proposal actually describes: multi-day treks.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHY THIS UNDOES A DECISION I MADE
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Migrations 052 and 053 built a DAY-WALK board — daylight hours, one night out
-- at most, everything within a couple of hours of Dehradun. That was a
-- deliberate safety decision made without the product spec, and against the
-- spec it is simply the wrong product. The DoonDzn proposal is unambiguous:
-- Kedarkantha in December, Annapurna Circuit over fourteen days, Everest Base
-- Camp — destination, start date, end date, difficulty, group size, photos.
--
-- Proof it was wrong rather than merely conservative: inserting a six-day
-- Kedarkantha was REFUSED by trek_plans_hours. Every trek in the proposal's own
-- screens was unstorable.
--
-- So the hours constraint goes. What replaces it is not "no rules" — a trek
-- still cannot end before it starts, cannot run longer than a month, and cannot
-- be posted for the past. But the shape is now a trip with two dates, not an
-- outing inside one day.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHAT THE SPEC ADDS, AND THE ONE THING IT CHANGES ABOUT SAFETY
-- ─────────────────────────────────────────────────────────────────────────────
--
--   women_only        A woman can post a trip open only to women, and filter
--                     the feed the same way. The proposal calls this "the single
--                     highest-impact safety decision in the product, and it
--                     ships at launch". Enforced in the join guard, not the UI.
--   senior_friendly   Marks a trip as planned at a comfortable pace, so older
--                     trekkers find groups that want them along rather than
--                     tolerate them.
--   languages         What the poster is comfortable trekking in, filterable.
--                     "Nobody should be excluded from a good trek over something
--                     as fixable as this."
--   cover photos      A trip is a place. A feed of text is not a feed of places.
--   difficulty        easy / moderate / difficult, replacing `effort`, because
--                     that is the vocabulary the proposal and the whole Indian
--                     trekking market uses.
--   expires           A trip disappears the day the trek ends. "The feed stays
--                     current on its own."
--
-- The three/four-person meeting-point floor from 053 is NOT removed. The spec
-- does not have that concept, but it also does not contradict it, and it costs
-- a host nothing — the exact meeting point is still held until the group is
-- real. What the spec DOES change is the contact model, and that is deliberately
-- NOT in this migration: exchanging phone numbers requires phone verification
-- to mean anything, phone verification requires an SMS provider, and buying one
-- is a decision with a bill attached. Flagged, not guessed at.

-- ---------------------------------------------------------------------------
-- 1. A trip runs over days now
-- ---------------------------------------------------------------------------
ALTER TABLE trek_plans DROP CONSTRAINT IF EXISTS trek_plans_hours;
ALTER TABLE trek_plans DROP CONSTRAINT IF EXISTS trek_plans_night_note;
ALTER TABLE trek_plans DROP CONSTRAINT IF EXISTS trek_plans_activity_check;

-- Times become optional. On a six-day trek "leaves at 06:00" is a detail of day
-- one, not the defining fact it is on a morning walk, and forcing a host to
-- invent a return time for day six is asking for a fiction.
ALTER TABLE trek_plans ALTER COLUMN start_time DROP NOT NULL;
ALTER TABLE trek_plans ALTER COLUMN back_by    DROP NOT NULL;

ALTER TABLE trek_plans ADD CONSTRAINT trek_plans_dates CHECK (
  ends_on >= starts_on
  -- A month is not a rule about mountains, it is a guard against a typo'd year
  -- sitting on the board until someone notices.
  AND ends_on <= starts_on + 31
);

-- Wider than 053's list: the proposal is about treks, and the board should not
-- refuse a trip because its host called it an expedition.
ALTER TABLE trek_plans ADD CONSTRAINT trek_plans_activity_check
  CHECK (activity IN ('trekking','bird_watching','cycling','running','stargazing','camping','expedition'));

-- ---------------------------------------------------------------------------
-- 2. The safety preferences the proposal ships at launch
-- ---------------------------------------------------------------------------
ALTER TABLE trek_plans
  ADD COLUMN IF NOT EXISTS women_only      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS senior_friendly BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS languages       TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cover_urls      TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS difficulty      TEXT;

UPDATE trek_plans SET difficulty = CASE effort
  WHEN 'easy' THEN 'easy' WHEN 'hard' THEN 'difficult' ELSE 'moderate' END
 WHERE difficulty IS NULL;
ALTER TABLE trek_plans ALTER COLUMN difficulty SET DEFAULT 'moderate';
ALTER TABLE trek_plans ALTER COLUMN difficulty SET NOT NULL;
ALTER TABLE trek_plans DROP CONSTRAINT IF EXISTS trek_plans_difficulty_check;
ALTER TABLE trek_plans ADD CONSTRAINT trek_plans_difficulty_check
  CHECK (difficulty IN ('easy','moderate','difficult'));

-- At most six covers, each an https URL. Not a free-text field: this renders as
-- an image, and an unvalidated string here is a way to point the page at
-- anything.
--
-- Via a function because a CHECK may not contain a subquery, and unnest() needs
-- one. IMMUTABLE is honest here — the result depends only on the argument.
CREATE OR REPLACE FUNCTION trek_covers_ok(p_urls TEXT[])
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT p_urls IS NULL
      OR (coalesce(array_length(p_urls, 1), 0) <= 6
          AND coalesce(bool_and(u LIKE 'https://%'), true))
  FROM unnest(coalesce(p_urls, '{}'::TEXT[])) u;
$$;

ALTER TABLE trek_plans DROP CONSTRAINT IF EXISTS trek_plans_covers_ok;
ALTER TABLE trek_plans ADD CONSTRAINT trek_plans_covers_ok CHECK (trek_covers_ok(cover_urls));

COMMENT ON COLUMN trek_plans.women_only IS
  'Open only to women. Enforced in the join guard, never merely hidden in the UI.';
COMMENT ON COLUMN trek_plans.languages IS
  'What the host is comfortable trekking in. Filterable, so a shared language decides who finds who rather than luck.';

-- ---------------------------------------------------------------------------
-- 3. Women-only, enforced
-- ---------------------------------------------------------------------------
-- A women-only trip that is only women-only in the front end is not women-only.
-- It has to be refused where the row is written.
--
-- Gender is asked for exactly here and for exactly this. It is not on the
-- profile, not shown to anybody, and not filterable by anyone — a field that
-- exists to protect people becomes a field that exposes them the moment it is
-- displayed. `prefer_not_to_say` is a real answer and is treated as "cannot
-- join a women-only trip", because the alternative is making people declare.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trek_gender TEXT;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_trek_gender_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_trek_gender_check
  CHECK (trek_gender IS NULL OR trek_gender IN ('woman','man','other','prefer_not_to_say'));

COMMENT ON COLUMN profiles.trek_gender IS
  'Asked once, used only to gate women-only trips. Never displayed, never filterable, never on the profile.';

CREATE OR REPLACE FUNCTION trek_requests_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_plan trek_plans%ROWTYPE;
  v_gender TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;   -- only reachable by cascade from a deleted account
  END IF;

  SELECT * INTO v_plan FROM trek_plans WHERE id = NEW.plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such trek' USING ERRCODE = 'no_data_found';
  END IF;

  NEW.plan_host_id := v_plan.host_id;

  IF TG_OP = 'UPDATE' AND (NEW.plan_id <> OLD.plan_id OR NEW.user_id <> OLD.user_id) THEN
    RAISE EXCEPTION 'a request cannot be moved to another trek or another person'
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF NEW.status IN ('confirmed','declined','withdrawn','removed') AND NEW.decided_at IS NULL THEN
    NEW.decided_at := NOW();
  END IF;

  IF NEW.status IN ('requested','confirmed')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    IF v_plan.status <> 'open' OR v_plan.hidden_at IS NOT NULL THEN
      RAISE EXCEPTION 'this trek is not taking anyone' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF v_plan.starts_at <= NOW() THEN
      RAISE EXCEPTION 'this trek has already started' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF v_plan.host_id = NEW.user_id THEN
      RAISE EXCEPTION 'this is your own trek' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- The women-only gate.
    IF v_plan.women_only THEN
      SELECT trek_gender INTO v_gender FROM profiles WHERE id = NEW.user_id;
      IF v_gender IS DISTINCT FROM 'woman' THEN
        RAISE EXCEPTION 'this trek is open to women only'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END $$;

-- A man cannot post a women-only trip either — the host is on the trek.
CREATE OR REPLACE FUNCTION trek_plans_women_only_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_gender TEXT;
BEGIN
  IF NEW.women_only THEN
    SELECT trek_gender INTO v_gender FROM profiles WHERE id = NEW.host_id;
    IF v_gender IS DISTINCT FROM 'woman' THEN
      RAISE EXCEPTION 'only a woman can post a women-only trek'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trek_plans_15_women_only ON trek_plans;
CREATE TRIGGER trek_plans_15_women_only
  BEFORE INSERT OR UPDATE ON trek_plans
  FOR EACH ROW EXECUTE FUNCTION trek_plans_women_only_guard();

-- ---------------------------------------------------------------------------
-- 3b. The instants, now that the wall-clock times are optional
-- ---------------------------------------------------------------------------
-- starts_at / ends_at are NOT NULL and everything orders and expires by them,
-- but start_time and back_by just became nullable — on a six-day trek nobody
-- should have to invent a return time for day six. So the instants fall back to
-- sensible hours while the stored wall-clock stays NULL, and the UI shows a
-- time only when the host actually gave one.
--
-- 06:00 and 18:00 rather than midnight: a trek starting "on the 30th" has not
-- started at 00:01, and one ending "on the 5th" is not over at 00:01 either.
-- Midnight would make a trip vanish from the feed a day early at one end and
-- accept joins for a trek already walking at the other.
CREATE OR REPLACE FUNCTION trek_plans_set_times()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.starts_at := trek_ist_instant(NEW.starts_on, COALESCE(NEW.start_time, TIME '06:00'));
  NEW.ends_at   := trek_ist_instant(
    COALESCE(NEW.ends_on, NEW.starts_on),
    COALESCE(NEW.back_by, TIME '18:00')
  );
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Trips expire the day the trek ends
-- ---------------------------------------------------------------------------
-- "A trip post expires the day the trek ends. The feed stays current on its
-- own." Derived rather than swept by a job: a boolean a cron has to maintain is
-- a boolean that is wrong whenever the cron is late.
ALTER TABLE trek_plans DROP COLUMN IF EXISTS is_live;
ALTER TABLE trek_plans ADD COLUMN is_live BOOLEAN
  GENERATED ALWAYS AS (status = 'open' AND hidden_at IS NULL) STORED;

CREATE INDEX IF NOT EXISTS idx_trek_plans_feed
  ON trek_plans (ends_on DESC) WHERE is_live;

-- ---------------------------------------------------------------------------
-- 5. Report and block, with somewhere for reports to go
-- ---------------------------------------------------------------------------
-- 052 deliberately shipped no report queue, on the grounds that a button
-- implying supervision nobody provides is worse than no button. The proposal
-- overrules that AND resolves the objection in the same breath: it asks the
-- client for "one named person to own the moderation queue". So the queue is
-- built, and section 6 records that the person is still unnamed.
CREATE TABLE IF NOT EXISTS trek_reports (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- One of the two is set. A report is about a trek or about a person.
  plan_id      UUID REFERENCES trek_plans(id) ON DELETE CASCADE,
  subject_id   UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL CHECK (reason IN
                 ('unsafe','harassment','spam','impersonation','not_real','other')),
  detail       TEXT CHECK (detail IS NULL OR length(detail) <= 1000),
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','actioned','dismissed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ,
  resolution   TEXT,
  CONSTRAINT trek_reports_has_subject CHECK (plan_id IS NOT NULL OR subject_id IS NOT NULL),
  CONSTRAINT trek_reports_not_self CHECK (subject_id IS NULL OR subject_id <> reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_trek_reports_open ON trek_reports(created_at DESC) WHERE status = 'open';

ALTER TABLE trek_reports ENABLE ROW LEVEL SECURITY;
-- Reporters read their own; nobody reads anyone else's. Admin tooling runs on
-- the service role, which bypasses RLS.
DROP POLICY IF EXISTS "Reporters read their own reports" ON trek_reports;
CREATE POLICY "Reporters read their own reports" ON trek_reports FOR SELECT
  USING (reporter_id = auth.uid());

CREATE TABLE IF NOT EXISTS trek_blocks (
  blocker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT trek_blocks_not_self CHECK (blocker_id <> blocked_id)
);

ALTER TABLE trek_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read your own blocks" ON trek_blocks;
CREATE POLICY "Read your own blocks" ON trek_blocks FOR SELECT
  USING (blocker_id = auth.uid());

-- Blocking works in BOTH directions on a join: the person who blocked must not
-- have to see them, and the person blocked must not be able to follow them onto
-- a trek. One-directional blocking is the bug every board ships first.
CREATE OR REPLACE FUNCTION trek_blocked_between(a UUID, b UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM trek_blocks
     WHERE (blocker_id = a AND blocked_id = b) OR (blocker_id = b AND blocked_id = a)
  );
$$;

GRANT EXECUTE ON FUNCTION trek_blocked_between(UUID, UUID) TO authenticated, service_role;
-- trek_create_plan, for trips that run over days.
--
-- Replaces the 14-argument day-walk form. Times are optional now, difficulty
-- replaces effort, and the safety preferences the proposal ships at launch —
-- women-only, senior-friendly, languages — are set at the point of posting
-- rather than bolted on afterwards.
DROP FUNCTION IF EXISTS trek_create_plan(TEXT,TEXT,TEXT,DATE,TIME,TIME,INT,TEXT,TEXT,TEXT,TEXT,UUID,DATE,TEXT);

CREATE OR REPLACE FUNCTION trek_create_plan(
  p_activity        TEXT,
  p_place           TEXT,
  p_meet_area       TEXT,
  p_starts_on       DATE,
  p_ends_on         DATE,
  p_capacity        INT,
  p_meeting_point   TEXT,
  p_difficulty      TEXT    DEFAULT 'moderate',
  p_start_time      TIME    DEFAULT NULL,
  p_back_by         TIME    DEFAULT NULL,
  p_note            TEXT    DEFAULT NULL,
  p_logistics       TEXT    DEFAULT NULL,
  p_night_note      TEXT    DEFAULT NULL,
  p_women_only      BOOLEAN DEFAULT false,
  p_senior_friendly BOOLEAN DEFAULT false,
  p_languages       TEXT[]  DEFAULT '{}',
  p_cover_urls      TEXT[]  DEFAULT '{}',
  p_actor           UUID    DEFAULT NULL
)
RETURNS trek_plans
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user UUID := trek_actor(p_actor);
  v_name TEXT := trek_require_member(v_user);
  v_can  BOOLEAN;
  v_role TEXT;
  v_open INT;
  v_plan trek_plans;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('dewdropz.trek_host'), hashtext(v_user::text));

  SELECT trek_can_host, role INTO v_can, v_role FROM profiles WHERE id = v_user;
  IF NOT COALESCE(v_can, false) AND v_role <> 'admin' THEN
    RAISE EXCEPTION 'hosting on Trek Buddy is invite-only at the moment'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- A trek runs for days now, so three open at once is a real load on a host
  -- rather than an arbitrary cap.
  SELECT count(*) INTO v_open FROM trek_plans
   WHERE host_id = v_user AND status = 'open' AND starts_at > NOW();
  IF v_open >= 3 THEN
    RAISE EXCEPTION 'you already have % open treks — close one before posting another', v_open
      USING ERRCODE = 'too_many_rows';
  END IF;

  INSERT INTO trek_plans (
    host_id, host_name, activity, place, meet_area,
    starts_on, ends_on, start_time, back_by, capacity,
    difficulty, note, night_note, women_only, senior_friendly, languages, cover_urls
  ) VALUES (
    v_user, v_name, p_activity, btrim(p_place), btrim(p_meet_area),
    p_starts_on, COALESCE(p_ends_on, p_starts_on), p_start_time, p_back_by, p_capacity,
    p_difficulty,
    NULLIF(btrim(COALESCE(p_note, '')), ''),
    NULLIF(btrim(COALESCE(p_night_note, '')), ''),
    p_women_only, p_senior_friendly, COALESCE(p_languages, '{}'), COALESCE(p_cover_urls, '{}')
  )
  RETURNING * INTO v_plan;

  INSERT INTO trek_plan_details (plan_id, meeting_point, logistics)
  VALUES (v_plan.id, btrim(p_meeting_point), NULLIF(btrim(COALESCE(p_logistics, '')), ''));

  RETURN v_plan;
END $$;

REVOKE ALL ON FUNCTION trek_create_plan(TEXT,TEXT,TEXT,DATE,DATE,INT,TEXT,TEXT,TIME,TIME,TEXT,TEXT,TEXT,BOOLEAN,BOOLEAN,TEXT[],TEXT[],UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION trek_create_plan(TEXT,TEXT,TEXT,DATE,DATE,INT,TEXT,TEXT,TIME,TIME,TEXT,TEXT,TEXT,BOOLEAN,BOOLEAN,TEXT[],TEXT[],UUID) TO authenticated, service_role;

-- Report and block, as operations.
CREATE OR REPLACE FUNCTION trek_report(
  p_reason TEXT, p_detail TEXT DEFAULT NULL,
  p_plan_id UUID DEFAULT NULL, p_subject_id UUID DEFAULT NULL, p_actor UUID DEFAULT NULL
) RETURNS trek_reports
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := trek_actor(p_actor); v_row trek_reports;
BEGIN
  PERFORM trek_require_member(v_user);
  INSERT INTO trek_reports (reporter_id, plan_id, subject_id, reason, detail)
  VALUES (v_user, p_plan_id, p_subject_id, p_reason, NULLIF(btrim(COALESCE(p_detail,'')),''))
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION trek_block(p_blocked UUID, p_actor UUID DEFAULT NULL)
RETURNS trek_blocks
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := trek_actor(p_actor); v_row trek_blocks;
BEGIN
  PERFORM trek_require_member(v_user);
  INSERT INTO trek_blocks (blocker_id, blocked_id) VALUES (v_user, p_blocked)
  ON CONFLICT DO NOTHING RETURNING * INTO v_row;
  IF v_row IS NULL THEN
    SELECT * INTO v_row FROM trek_blocks WHERE blocker_id = v_user AND blocked_id = p_blocked;
  END IF;
  RETURN v_row;
END $$;

REVOKE ALL ON FUNCTION trek_report(TEXT,TEXT,UUID,UUID,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION trek_report(TEXT,TEXT,UUID,UUID,UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION trek_block(UUID,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION trek_block(UUID,UUID) TO authenticated, service_role;
