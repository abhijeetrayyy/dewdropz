-- Camping and stargazing, which means Trek Buddy now runs after dark.
--
-- Migration 052 refused both on purpose: they are the 17:30 and 21:40 rows on
-- the homepage, they happen in the dark, and a board whose first act is to
-- advertise that a named stranger will be alone at a remote spot at 21:40 is
-- the worst possible thing for it to do first. That reasoning has not changed.
--
-- The owner has asked for them anyway, and it is their product and their call.
-- So this does not simply delete the daylight constraint — that would leave the
-- riskiest outings with the least protection, which is exactly backwards. It
-- replaces one blanket rule with a rule per kind of outing, and makes the
-- night ones carry more structure than the day ones rather than less.
--
--   DAY      trekking, bird watching, cycling, running
--            start 04:30–16:00 IST, back by 19:00, same day.
--            Bird watching genuinely starts before dawn — that is when birds
--            are up — so the floor moved from 06:00 to 04:30 to admit the
--            homepage's own 05:20 row. Pre-dawn is why `min_party` exists.
--
--   EVENING  stargazing
--            start 17:00–22:00 IST, ends the same night or by 02:00.
--            Ends on the following date, which `ends_on` now carries.
--
--   OVERNIGHT camping
--            start 12:00–19:00 IST, ends the NEXT day by 14:00. One night only.
--
-- WHAT THE NIGHT OUTINGS CARRY THAT THE DAY ONES DO NOT:
--
--   * A bigger minimum party. A day walk releases its meeting point at three
--     people. Anything that runs in the dark needs four, so nobody is the
--     third person in a two-plus-one situation on a hillside at midnight.
--     `min_party` is a stored, generated column so the RLS policy reads it
--     rather than hardcoding 3, and the floor cannot be edited per plan.
--
--   * A mandatory `night_note`. The host has to write, in their own words,
--     how people are getting back in the dark. It is not a checkbox: a
--     checkbox is ticked without reading, and a sentence someone had to
--     compose is evidence they thought about the descent.
--
-- Nothing here relaxes anything that already existed. The three-person floor
-- is still the floor for daylight; contact details are still not exchanged;
-- hosting is still invite-only; every write still goes through the RPCs.

-- ---------------------------------------------------------------------------
-- 1. The end of a plan is now its own date
-- ---------------------------------------------------------------------------
-- 052 assumed same-day and stored only `back_by TIME`. Camping ends tomorrow
-- and stargazing can end after midnight, so the date has to be storable. It
-- defaults to the start date, which is what every existing row means.
ALTER TABLE trek_plans ADD COLUMN IF NOT EXISTS ends_on DATE;
UPDATE trek_plans SET ends_on = starts_on WHERE ends_on IS NULL;
ALTER TABLE trek_plans ALTER COLUMN ends_on SET NOT NULL;

-- The instant it ends, in IST, alongside the instant it starts. Same treatment
-- and same reason as `starts_at`: the server is UTC and the walk is not.
ALTER TABLE trek_plans ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;

-- Kind of outing, derived from the activity so it cannot disagree with it.
ALTER TABLE trek_plans DROP COLUMN IF EXISTS day_part;
ALTER TABLE trek_plans ADD COLUMN day_part TEXT
  GENERATED ALWAYS AS (
    CASE activity
      WHEN 'camping'    THEN 'overnight'
      WHEN 'stargazing' THEN 'evening'
      ELSE 'day'
    END
  ) STORED;

-- How many people must be going before the exact meeting point is released.
-- Generated, so a host cannot lower their own floor, and the RLS policy reads
-- this column instead of a hardcoded 3.
ALTER TABLE trek_plans DROP COLUMN IF EXISTS min_party;
ALTER TABLE trek_plans ADD COLUMN min_party INT
  GENERATED ALWAYS AS (
    CASE WHEN activity IN ('camping', 'stargazing') THEN 4 ELSE 3 END
  ) STORED;

-- How everyone gets off the hill in the dark. Required for the night kinds,
-- enforced below rather than in a form.
ALTER TABLE trek_plans ADD COLUMN IF NOT EXISTS night_note TEXT
  CHECK (night_note IS NULL OR length(btrim(night_note)) BETWEEN 10 AND 400);

-- ---------------------------------------------------------------------------
-- 2. The activity list, and the hours each kind may occupy
-- ---------------------------------------------------------------------------
ALTER TABLE trek_plans DROP CONSTRAINT IF EXISTS trek_plans_activity_check;
ALTER TABLE trek_plans ADD CONSTRAINT trek_plans_activity_check
  CHECK (activity IN ('trekking','bird_watching','cycling','running','stargazing','camping'));

-- Replaces trek_plans_daylight. One branch per kind, so widening the board did
-- not widen the day rules by accident.
ALTER TABLE trek_plans DROP CONSTRAINT IF EXISTS trek_plans_daylight;
ALTER TABLE trek_plans DROP CONSTRAINT IF EXISTS trek_plans_hours;
ALTER TABLE trek_plans ADD CONSTRAINT trek_plans_hours CHECK (
  CASE activity
    WHEN 'camping' THEN
      start_time BETWEEN TIME '12:00' AND TIME '19:00'
      AND back_by <= TIME '14:00'
      AND ends_on = starts_on + 1
    WHEN 'stargazing' THEN
      start_time BETWEEN TIME '17:00' AND TIME '22:00'
      AND (
        (ends_on = starts_on AND back_by > start_time)   -- wraps up before midnight
        OR (ends_on = starts_on + 1 AND back_by <= TIME '02:00')
      )
    ELSE
      start_time BETWEEN TIME '04:30' AND TIME '16:00'
      AND back_by > start_time
      AND back_by <= TIME '19:00'
      AND ends_on = starts_on
  END
);

-- A night plan without a plan for the dark is not a plan.
ALTER TABLE trek_plans DROP CONSTRAINT IF EXISTS trek_plans_night_note;
ALTER TABLE trek_plans ADD CONSTRAINT trek_plans_night_note CHECK (
  activity NOT IN ('camping', 'stargazing') OR night_note IS NOT NULL
);

-- ---------------------------------------------------------------------------
-- 3. Keep ends_at in step with the wall-clock the host typed
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trek_plans_set_times()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.starts_at := trek_ist_instant(NEW.starts_on, NEW.start_time);
  NEW.ends_at   := trek_ist_instant(COALESCE(NEW.ends_on, NEW.starts_on), NEW.back_by);
  RETURN NEW;
END $$;

UPDATE trek_plans SET ends_on = ends_on;   -- fires the trigger, backfills ends_at
ALTER TABLE trek_plans ALTER COLUMN ends_at SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. The meeting-point floor now reads the plan's own minimum
-- ---------------------------------------------------------------------------
-- 052 hardcoded `going_count >= 3`. Night outings need four, and the number
-- belongs on the plan rather than in the policy text.
DROP POLICY IF EXISTS "Confirmed party of three reads the meeting point" ON trek_plan_details;
DROP POLICY IF EXISTS "Confirmed party reads the meeting point" ON trek_plan_details;
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

COMMENT ON COLUMN trek_plans.min_party IS
  'People who must be going before the exact meeting point is released. 3 by day, 4 after dark. Generated — a host cannot lower their own floor.';
COMMENT ON COLUMN trek_plans.night_note IS
  'How the party gets back in the dark. Required for camping and stargazing; a sentence rather than a checkbox, because a checkbox is ticked without reading.';
-- Teach trek_create_plan about the after-dark kinds.
--
-- Adds ends_on and night_note. Both default so the day-walk call signature
-- keeps working unchanged; the CHECK constraints in migration 053 decide
-- whether the combination is actually legal, so this function does not
-- re-implement the rules — it just carries the values.
CREATE OR REPLACE FUNCTION trek_create_plan(
  p_activity      TEXT,
  p_place         TEXT,
  p_meet_area     TEXT,
  p_starts_on     DATE,
  p_start_time    TIME,
  p_back_by       TIME,
  p_capacity      INT,
  p_meeting_point TEXT,
  p_effort        TEXT DEFAULT 'moderate',
  p_note          TEXT DEFAULT NULL,
  p_logistics     TEXT DEFAULT NULL,
  p_actor         UUID DEFAULT NULL,
  p_ends_on       DATE DEFAULT NULL,
  p_night_note    TEXT DEFAULT NULL
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

  SELECT count(*) INTO v_open FROM trek_plans
   WHERE host_id = v_user AND status = 'open' AND starts_at > NOW();
  IF v_open >= 3 THEN
    RAISE EXCEPTION 'you already have % open plans — cancel one before posting another', v_open
      USING ERRCODE = 'too_many_rows';
  END IF;

  INSERT INTO trek_plans (
    host_id, host_name, activity, place, meet_area,
    starts_on, ends_on, start_time, back_by, capacity, effort, note, night_note
  ) VALUES (
    v_user, v_name, p_activity, btrim(p_place), btrim(p_meet_area),
    p_starts_on, COALESCE(p_ends_on, p_starts_on), p_start_time, p_back_by,
    p_capacity, p_effort,
    NULLIF(btrim(COALESCE(p_note, '')), ''),
    NULLIF(btrim(COALESCE(p_night_note, '')), '')
  )
  RETURNING * INTO v_plan;

  INSERT INTO trek_plan_details (plan_id, meeting_point, logistics)
  VALUES (v_plan.id, btrim(p_meeting_point), NULLIF(btrim(COALESCE(p_logistics, '')), ''));

  RETURN v_plan;
END $$;

REVOKE ALL ON FUNCTION trek_create_plan(TEXT,TEXT,TEXT,DATE,TIME,TIME,INT,TEXT,TEXT,TEXT,TEXT,UUID,DATE,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION trek_create_plan(TEXT,TEXT,TEXT,DATE,TIME,TIME,INT,TEXT,TEXT,TEXT,TEXT,UUID,DATE,TEXT) TO authenticated, service_role;
-- The 12-argument form is now ambiguous with the 14-argument one for a
-- defaulted call, so it goes.
DROP FUNCTION IF EXISTS trek_create_plan(TEXT,TEXT,TEXT,DATE,TIME,TIME,INT,TEXT,TEXT,TEXT,TEXT,UUID);
