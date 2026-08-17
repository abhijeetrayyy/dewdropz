-- Trek Buddy: a board where someone posts a daylight walk and other people ask
-- to come. The host decides who comes. Nobody pays for anything.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHY THIS IS SMALLER THAN THE FEATURE THE HOMEPAGE ADVERTISES
-- ─────────────────────────────────────────────────────────────────────────────
--
-- The hero panel (components/sections/SummitHero.tsx:103) shows four outings:
-- 05:20 bird watching, 09:00 trekking, 17:30 camping, 21:40 stargazing. Two of
-- those four are in the dark. This migration will not store them, and the CHECK
-- constraint `trek_plans_daylight` is where that decision lives rather than in a
-- form validator somebody edits later.
--
-- The reason is not squeamishness. A Trek Buddy plan is a published statement
-- that a named person will be at a specific spot at a specific hour, in terrain
-- with no witnesses and usually no phone signal. Everything else in this file is
-- an attempt to make that statement safe to publish. The controls that would
-- actually make a 1:1 pre-dawn meeting defensible — a verified phone number, a
-- checked age, a named human reading reports within the hour — do not exist at
-- this shop and cannot be built in this migration:
--
--   * There is no SMS provider and no phone-OTP flow. `profiles.phone` is a
--     shipping field that nobody has ever verified. So this feature exchanges
--     NO contact details of any kind. There is no phone column here, no email
--     column, no messaging table. A host publishes a meeting point; people turn
--     up. That is the whole coordination model, and it is deliberately the
--     model a paper noticeboard had.
--
--   * RESEND_API_KEY is unset, so outbound email is inert (lib/email.ts). Every
--     notification this feature sends therefore has to be complete as an in-app
--     `notifications` row on its own. Section 6 widens that table's type CHECK.
--
--   * Nobody is on report duty. So there is no report queue in this file. A
--     queue with nobody behind it is worse than no queue, because the button
--     implies supervision. Reports go to the owner's existing channels
--     (lib/slack.ts from the server action, and /contact), and takedown is the
--     owner setting `hidden_at` by hand. That is honest about the staffing.
--
-- Given all three absences, the schema buys back safety with structure instead:
--
--   1. DAYLIGHT ONLY. Start between 06:00 and 16:00 IST, back by 19:00 IST, same
--      day. `trek_plans_daylight`. Camping and stargazing are not in the
--      activity CHECK at all — they are the 17:30 and 21:40 rows, they are the
--      dark-hours product, and they are phase 2, after this has a track record.
--
--   2. NOBODY MEETS ONE-TO-ONE. `capacity` starts at 3, and — the part that
--      actually bites — the exact meeting point is not released until three
--      people are confirmed. Witnesses change the calculus more than any column
--      in this table. A plan that never reaches three simply never happens,
--      which is the correct way for this to fail. See the RLS on
--      `trek_plan_details` in section 5: the threshold is enforced in the policy,
--      not in a component.
--
--   3. THE HOST CHOOSES. There is no instant join and no `join_mode` setting to
--      turn one on. A request is a row with status 'requested'; only
--      `trek_decide_request` can move it to 'confirmed', and only the host can
--      call it. Declining needs no reason and reveals nothing.
--
--   4. THE EXACT MEETING POINT IS IN A DIFFERENT TABLE. Postgres RLS is
--      row-level: it cannot hide a column. A field believed to be private
--      sitting on a publicly readable row is private only until somebody types
--      `select=*` against PostgREST — which is exactly how the guest-design leak
--      in 045_custom_design_privacy.sql happened, verified against the live
--      database. So `trek_plan_details` is a separate table with its own
--      policies, and adding a column to `trek_plans` is therefore a privacy
--      decision made in the open at review time.
--
--   5. THE BOARD IS NOT PUBLIC. There is no anon SELECT policy on any table
--      here. A logged-out visitor gets the pitch and a count; a crawler gets
--      nothing. An indexed plan means a stalker never needs an account.
--
--   6. HOSTING IS INVITE-ONLY AT LAUNCH. `profiles.trek_can_host` defaults to
--      false. Admins can always host. The owner flips the bit per person. This
--      is what lets the board open before the terms of service and the named
--      grievance officer exist — the owner hosts the first plans themselves,
--      which is founder work and not seeding, and nothing here is fabricated.
--      Flipping the default to true is the moment this becomes a public board,
--      and it is an owner decision with legal preconditions, not a deploy.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHAT IS DELIBERATELY ABSENT, SO NOBODY ADDS IT BACK BY ACCIDENT
-- ─────────────────────────────────────────────────────────────────────────────
--
--   MONEY. No price, no deposit, no fuel-split integer, not even a displayed
--   figure. app/treks/page.tsx:14 records that a booking funnel with dates,
--   prices and live "spots left" was deleted from this codebase once already,
--   for a business line that does not run. The moment a spot has a number
--   attached, the shop is selling guided travel to strangers, which has a
--   different insurer and a different regulator.
--
--   A VERIFIED BADGE. Nobody at this shop verifies anybody. A badge is a
--   representation by DEWDROPZ about a stranger's safety, made with no basis, to
--   someone about to meet them. There is no verified_at column here.
--
--   AN SOS OR TRACKING FEATURE. An emergency button that reaches nobody
--   manufactures reliance where there is no capability, and converts a
--   noticeboard into a service with a duty of care. `back_by` is the entire
--   safety-timing model: it is a fact the host states so their own people know
--   when to worry. The plan page prints 112 and the district control room.
--
--   A BLOCK TABLE AND A REPORT QUEUE. At this size, blocking is declining a
--   request, and reporting is telling the owner. Both become real when there is
--   somebody to operate them.
--
--   AN EDIT PATH. There is no UPDATE policy on any table in this file, for
--   anyone. Every mutation goes through the five SECURITY DEFINER functions in
--   section 7. That is not tidiness: a host who can PATCH their own row can
--   back-date a plan to manufacture a history of walks they never led, and can
--   walk `confirmed_count` down to defeat the capacity CHECK and up to advertise
--   "4 going" while standing alone at a trailhead. Closing the write path closes
--   both. A host who needs to change the time cancels and reposts, and everyone
--   who was confirmed is told.
--
--   A TRAIL FOREIGN KEY. lib/constants.ts:226 TRAILS is a TypeScript constant,
--   not a table, and there is no /treks/[slug] route to link to. `place` is free
--   text. The connection to the trail guide is reciprocal copy, which is a
--   connection; a slug column pointing at nothing is not.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Trek Buddy onboarding — four columns on profiles, not a table
-- ─────────────────────────────────────────────────────────────────────────────
-- `profiles.full_name` is the name someone gave a clothing shop to put on a
-- courier label. Publishing it next to a time and a lonely place, because they
-- once bought a t-shirt, is a use they never agreed to — and `profiles`' own
-- SELECT policy is owner-only (002_rls_policies.sql:20), so a joiner could not
-- read it anyway. Hence a separate display name, chosen for this purpose.
--
-- A date of birth is still only a claim. It differs from a tick-box in the one
-- way that matters: it creates a specific, recorded misrepresentation, which is
-- worth something for enforcement and worth something in a dispute. Minors are
-- the highest-consequence scenario here and the cheapest to exclude.
--
-- Columns rather than a `trek_profiles` table because a table would need its own
-- RLS, its own cascade behaviour and its own opt-in flow, and would put a
-- DELETE-refusing trigger in the path of `auth.users` deletion — which is how
-- account deletion silently becomes impossible for anyone who ever posted a
-- walk. These four cascade with the profile, and erasure keeps working.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS trek_display_name TEXT,
  ADD COLUMN IF NOT EXISTS trek_dob          DATE,
  ADD COLUMN IF NOT EXISTS trek_terms_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trek_can_host     BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_trek_display_name_len;
ALTER TABLE profiles ADD CONSTRAINT profiles_trek_display_name_len
  CHECK (trek_display_name IS NULL OR length(btrim(trek_display_name)) BETWEEN 2 AND 40);

COMMENT ON COLUMN profiles.trek_display_name IS
  'Name shown on the Trek Buddy board. Never full_name — that is a courier label.';
COMMENT ON COLUMN profiles.trek_dob IS
  'Self-declared. Not verified. Under-18s are refused by trek_require_member().';
COMMENT ON COLUMN profiles.trek_can_host IS
  'Invite-only hosting. Defaults false; admins bypass. Flipping the default to true opens the board to the public and is an owner decision with legal preconditions.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. The hour, in IST, on purpose
-- ─────────────────────────────────────────────────────────────────────────────
-- A plan happens at a wall-clock time on a date in Dehradun: "09:00 on the 3rd".
-- The server is UTC. 06:00 IST on 3 October is 00:30 UTC on the 3rd, and 05:00
-- IST is the previous day in UTC — so a plan compared naively sorts into the
-- wrong place on the board and, worse, is judged "already started" against the
-- wrong instant. Same trap 048_gst_invoicing.sql:47 documented for the financial
-- year, same remedy: convert explicitly, never via the session TimeZone GUC.
--
-- Both representations are stored. `starts_on` + `start_time` are the host's
-- intent exactly as typed, and are what the card prints. `starts_at` is the
-- instant, for ordering and for every "has it started" comparison. Only the
-- trigger in section 4 writes `starts_at`, so the two cannot drift.
--
-- Not a GENERATED column: `AT TIME ZONE` with a named zone is STABLE, not
-- IMMUTABLE (the tz database can change), so Postgres refuses it in generated
-- columns, indexes and CHECKs. India has not observed DST since 1945, so the
-- practical risk is nil; the rule is still the rule.
CREATE OR REPLACE FUNCTION trek_ist_instant(p_date DATE, p_time TIME)
RETURNS TIMESTAMPTZ LANGUAGE sql STABLE AS $$
  SELECT (p_date + p_time) AT TIME ZONE 'Asia/Kolkata';
$$;

COMMENT ON FUNCTION trek_ist_instant(DATE, TIME) IS
  'IST wall-clock date+time -> instant, evaluated in Asia/Kolkata explicitly. STABLE: never index it, never CHECK on it.';

-- Today in Dehradun. `CURRENT_DATE` is today in UTC, which is yesterday for five
-- and a half hours of every Indian evening.
CREATE OR REPLACE FUNCTION trek_ist_today()
RETURNS DATE LANGUAGE sql STABLE AS $$
  SELECT (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. The plan
-- ─────────────────────────────────────────────────────────────────────────────
-- This table is the row a signed-in member may read. Nothing on it is a secret.
-- The exact meeting point is in trek_plan_details; see the WHY above for why
-- that is a table split and not a column comment.
--
-- `capacity` and `confirmed_count` are both columns on this row, and the count
-- is maintained by trigger rather than derived at read time, for one reason
-- beyond speed: a derived count cannot be constrained. With the count here,
-- `CHECK (confirmed_count + 1 <= capacity)` makes an overfilled plan a state
-- Postgres will not store, by any write path. That is the trade 021_stock_
-- integrity.sql:10 made for stock, for the same reason — the row lock on the
-- UPDATE already serialises concurrent confirmations, and the constraint is what
-- turns that serialisation into a real rejection instead of a silent overfill.
--
-- Seats, not joiners: capacity includes the host, who is never a request row.
-- So `going_count` is confirmed_count + 1, generated rather than stored twice.
CREATE TABLE IF NOT EXISTS trek_plans (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Snapshotted at post time. The board must render a name without reading
  -- `profiles`, whose SELECT policy is owner-only, and a later change to the
  -- host's display name must not silently rewrite a plan people already joined.
  host_name   TEXT NOT NULL CHECK (length(btrim(host_name)) BETWEEN 2 AND 40),

  -- Two activities, not four. Camping and stargazing are the 17:30 and 21:40
  -- rows on the hero; they cannot be posted in the daylight window below, and a
  -- dead option in a dropdown is worse than an absent one.
  activity    TEXT NOT NULL CHECK (activity IN ('trekking','bird_watching')),

  -- "Nag Tibba", "Benog Sanctuary". Coarse, and public to members.
  place       TEXT NOT NULL CHECK (length(btrim(place)) BETWEEN 2 AND 80),
  -- Town-level rendezvous: "Mussoorie", "Clock Tower, Dehradun". A board that
  -- will not say which town is not usable. The gate, the landmark and the
  -- pin are in trek_plan_details.
  meet_area   TEXT NOT NULL CHECK (length(btrim(meet_area)) BETWEEN 2 AND 120),

  starts_on   DATE NOT NULL,
  start_time  TIME NOT NULL,
  -- Mandatory. The single most useful datum if anything goes wrong, and stating
  -- it forces a host to think about whether the plan is physically coherent.
  -- It is not a tracking feature and nothing watches it: it exists so the
  -- host's own people know when to start worrying.
  back_by     TIME NOT NULL,
  -- Written only by trek_plans_10_set_times(). Never set by hand.
  starts_at   TIMESTAMPTZ NOT NULL,

  capacity        INT NOT NULL CHECK (capacity BETWEEN 3 AND 8),
  confirmed_count INT NOT NULL DEFAULT 0 CHECK (confirmed_count >= 0),
  going_count     INT GENERATED ALWAYS AS (confirmed_count + 1) STORED,
  spots_left      INT GENERATED ALWAYS AS (capacity - confirmed_count - 1) STORED,

  effort      TEXT NOT NULL DEFAULT 'moderate' CHECK (effort IN ('easy','moderate','hard')),
  note        TEXT CHECK (note IS NULL OR length(note) <= 400),

  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','cancelled')),
  cancelled_at  TIMESTAMPTZ,
  cancel_reason TEXT,
  -- Owner takedown, done by hand in Supabase Studio. Hide, never delete: a
  -- deleted plan takes its roster with it, and the roster is the answer to
  -- "who was supposed to be there".
  hidden_at     TIMESTAMPTZ,
  hidden_reason TEXT,

  -- Recorded, not asserted. "DEWDROPZ organises nothing and vets nobody" is a
  -- claim that needs evidence per plan, not a sentence in a footer.
  terms_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- The seat arithmetic, as a constraint. This one line is what makes
  -- overfilling unrepresentable; everything in trek_decide_request is ergonomics.
  CONSTRAINT trek_plans_capacity_not_exceeded CHECK (confirmed_count + 1 <= capacity),

  -- Daylight, same day, in IST wall-clock terms. See the WHY at the top.
  CONSTRAINT trek_plans_daylight CHECK (
    start_time >= TIME '06:00' AND start_time <= TIME '16:00'
    AND back_by > start_time AND back_by <= TIME '19:00'
  ),

  CONSTRAINT trek_plans_cancel_coherent
    CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL)),
  CONSTRAINT trek_plans_hidden_has_reason
    CHECK (hidden_at IS NULL OR btrim(COALESCE(hidden_reason, '')) <> ''),

  -- Referenced by trek_plan_requests' composite foreign key, which is how "the
  -- host is not a joiner on their own plan" becomes structural rather than a
  -- check somebody can forget. Not decoration: dropping this drops that.
  CONSTRAINT trek_plans_id_host_key UNIQUE (id, host_id)
);

-- The board: open, upcoming, soonest first. Partial, so it is the size of what
-- is coming up rather than of everything ever posted.
CREATE INDEX IF NOT EXISTS idx_trek_plans_board
  ON trek_plans(starts_at) WHERE status = 'open' AND hidden_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_trek_plans_host
  ON trek_plans(host_id, starts_at DESC);

DROP TRIGGER IF EXISTS update_trek_plans_updated_at ON trek_plans;
CREATE TRIGGER update_trek_plans_updated_at BEFORE UPDATE ON trek_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE trek_plans IS
  'The member-readable row of a plan. Nothing here is secret. Exact meeting point lives in trek_plan_details. No anon SELECT policy exists.';
COMMENT ON COLUMN trek_plans.starts_at IS
  'The instant, computed from starts_on + start_time in Asia/Kolkata by trigger. Never write this directly.';
COMMENT ON COLUMN trek_plans.confirmed_count IS
  'Confirmed joiners; the host is not one. Maintained by trek_requests_recount() only.';

-- --- the half of a plan a non-participant does not get -----------------------
-- One row per plan, same key, different policies. The split IS the enforcement.
CREATE TABLE IF NOT EXISTS trek_plan_details (
  plan_id       UUID PRIMARY KEY REFERENCES trek_plans(id) ON DELETE CASCADE,
  -- "The blue gate 200m past the Benog barrier, opposite the water tank."
  meeting_point TEXT NOT NULL CHECK (length(btrim(meeting_point)) BETWEEN 2 AND 300),
  -- Transport, what to carry, where the party turns back.
  logistics     TEXT CHECK (logistics IS NULL OR length(logistics) <= 1000),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_trek_plan_details_updated_at ON trek_plan_details;
CREATE TRIGGER update_trek_plan_details_updated_at BEFORE UPDATE ON trek_plan_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE trek_plan_details IS
  'The private half of a plan. A separate table because RLS cannot hide a column — see 045_custom_design_privacy.sql.';

-- --- asking to come ----------------------------------------------------------
-- PRIMARY KEY (plan_id, user_id) makes a double request impossible. Withdrawing
-- sets a status rather than deleting, so the key still holds, a re-request is an
-- UPDATE of the same row, and the host keeps the history — "asked, withdrew,
-- asked again" is a fact a host is entitled to see.
--
-- `plan_host_id` is denormalised and tied back by a COMPOSITE foreign key to
-- trek_plans(id, host_id), so it is provably this plan's real host and not a
-- value the caller chose. `CHECK (user_id <> plan_host_id)` is then a plain row
-- constraint and the database cannot represent a host joining their own plan.
-- It is filled by the guard trigger, never passed in.
CREATE TABLE IF NOT EXISTS trek_plan_requests (
  plan_id      UUID NOT NULL,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_host_id UUID NOT NULL,
  -- Snapshotted for the same reason host_name is.
  display_name TEXT NOT NULL CHECK (length(btrim(display_name)) BETWEEN 2 AND 40),

  status       TEXT NOT NULL DEFAULT 'requested'
                 CHECK (status IN ('requested','confirmed','declined','withdrawn','removed')),
  -- A word to the host when asking. Bounded and single-shot: this is not a
  -- message thread, because a thread is a moderation surface, a retention
  -- policy and a notification pipeline, and none of the three has an owner yet.
  message      TEXT CHECK (message IS NULL OR length(message) <= 300),

  terms_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at   TIMESTAMPTZ,

  PRIMARY KEY (plan_id, user_id),
  FOREIGN KEY (plan_id, plan_host_id)
    REFERENCES trek_plans(id, host_id) ON DELETE CASCADE,

  CONSTRAINT trek_requests_host_is_not_a_joiner CHECK (user_id <> plan_host_id),
  CONSTRAINT trek_requests_decided_coherent
    CHECK ((status = 'requested') = (decided_at IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_trek_requests_user
  ON trek_plan_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trek_requests_confirmed
  ON trek_plan_requests(plan_id) WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS idx_trek_requests_pending
  ON trek_plan_requests(plan_host_id) WHERE status = 'requested';

COMMENT ON TABLE trek_plan_requests IS
  'One row per person per plan, forever. PK stops a double request; the composite FK to (id, host_id) stops a host joining their own plan.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Triggers — where the rules actually hold
-- ─────────────────────────────────────────────────────────────────────────────
-- Not CHECK constraints: a CHECK must be IMMUTABLE, `now()` is not, and a row
-- valid when written would become invalid as time passed — which Postgres does
-- not re-evaluate, so the constraint would be a lie precisely when it mattered.
--
-- Not RLS alone: every server action in this codebase runs as the service role,
-- which bypasses RLS entirely (048_gst_invoicing.sql:494). A rule enforced only
-- in a policy is enforced on the path nobody uses and absent from the path
-- everybody uses. Triggers fire for the service role, for the anon key, for psql
-- and for whatever client somebody writes next year.

CREATE OR REPLACE FUNCTION trek_plans_set_times()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.starts_at := trek_ist_instant(NEW.starts_on, NEW.start_time);
  RETURN NEW;
END $$;

-- TRIGGER NAMES ARE LOAD-BEARING. Postgres fires BEFORE ROW triggers on the same
-- table and event in NAME order, and the guard below reads NEW.starts_at, which
-- does not exist until this one has computed it. The numeric prefixes make that
-- explicit; the obvious unprefixed names sort the wrong way round.
DROP TRIGGER IF EXISTS trek_plans_set_times ON trek_plans;
DROP TRIGGER IF EXISTS trek_plans_10_set_times ON trek_plans;
CREATE TRIGGER trek_plans_10_set_times
  BEFORE INSERT OR UPDATE ON trek_plans
  FOR EACH ROW EXECUTE FUNCTION trek_plans_set_times();

CREATE OR REPLACE FUNCTION trek_plans_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Two hours of lead time. A plan posted for ten minutes from now cannot be
    -- found by anyone, which makes it not a plan; it is also how somebody games
    -- the board into showing a full-looking outing nobody could have joined.
    IF NEW.starts_at < NOW() + interval '2 hours' THEN
      RAISE EXCEPTION 'a plan must start at least two hours from now'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    -- The board has to stay a board.
    IF NEW.starts_at > NOW() + interval '90 days' THEN
      RAISE EXCEPTION 'a plan cannot be posted more than 90 days ahead'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF NEW.status <> 'open' OR NEW.confirmed_count <> 0 THEN
      RAISE EXCEPTION 'a plan is created open and empty';
    END IF;
    RETURN NEW;
  END IF;

  -- ---- UPDATE --------------------------------------------------------------
  -- There is no edit feature and no UPDATE policy for anybody. These are the
  -- guarantees that must survive a future action, a hand-typed UPDATE, or a
  -- service-role write at 2am — see "AN EDIT PATH" in the header.

  -- The host anchors the composite FK that makes "host is not a joiner"
  -- structural. If it could move, a host could hand a plan to somebody already
  -- on its roster and the constraint would have held at a moment that no longer
  -- exists.
  IF NEW.host_id <> OLD.host_id THEN
    RAISE EXCEPTION 'a plan cannot change hands — cancel it and let the new host post their own'
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- What people agreed to come to. Frozen from the moment it is posted, not
  -- merely from the first confirmation: a back-dated or re-pointed plan is how
  -- somebody manufactures a history of walks they never led.
  IF (NEW.starts_on, NEW.start_time, NEW.back_by, NEW.activity, NEW.place, NEW.meet_area)
     IS DISTINCT FROM
     (OLD.starts_on, OLD.start_time, OLD.back_by, OLD.activity, OLD.place, OLD.meet_area) THEN
    RAISE EXCEPTION 'the time, activity and place of a plan are fixed once posted — cancel and repost'
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- Only trek_requests_recount() moves this, and only by one at a time. Anything
  -- else is editing the roster size without editing the roster, which is how a
  -- plan comes to advertise "4 going" with the host standing alone.
  IF NEW.confirmed_count <> OLD.confirmed_count
     AND abs(NEW.confirmed_count - OLD.confirmed_count) <> 1 THEN
    RAISE EXCEPTION 'confirmed_count moves by one, from the roster (% -> %)',
      OLD.confirmed_count, NEW.confirmed_count USING ERRCODE = 'restrict_violation';
  END IF;

  IF OLD.status = 'cancelled' AND NEW.status <> 'cancelled' THEN
    RAISE EXCEPTION 'a cancelled plan is not reopened — post a new one'
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trek_plans_20_guard ON trek_plans;
CREATE TRIGGER trek_plans_20_guard
  BEFORE INSERT OR UPDATE ON trek_plans
  FOR EACH ROW EXECUTE FUNCTION trek_plans_guard();

-- DELETE is deliberately NOT refused. trek_plans.host_id cascades from profiles,
-- which cascades from auth.users (001_initial_schema.sql:7), so a trigger that
-- raised on DELETE would make deleting any account that ever posted a walk
-- impossible — from the dashboard, from the API, and from the DPDP erasure path.
-- Losing a plan with its host is the right trade; blocking erasure is not.
-- TRUNCATE is a different matter: row triggers do not fire for it, and nothing
-- legitimate truncates these. deny_truncate() is from 048_gst_invoicing.sql:308.
DROP TRIGGER IF EXISTS trek_plans_no_truncate ON trek_plans;
CREATE TRIGGER trek_plans_no_truncate BEFORE TRUNCATE ON trek_plans
  FOR EACH STATEMENT EXECUTE FUNCTION deny_truncate();
DROP TRIGGER IF EXISTS trek_requests_no_truncate ON trek_plan_requests;
CREATE TRIGGER trek_requests_no_truncate BEFORE TRUNCATE ON trek_plan_requests
  FOR EACH STATEMENT EXECUTE FUNCTION deny_truncate();

-- --- the counter -------------------------------------------------------------
-- Keeps trek_plans.confirmed_count equal to the number of 'confirmed' rows. The
-- capacity CHECK is what refuses an overfill; this is what makes the CHECK see
-- the truth.
--
-- SECURITY DEFINER is not optional here. A trigger function runs as the role
-- that fired it, and this UPDATE targets trek_plans — a table with no UPDATE
-- policy at all. Under the caller's own rights the UPDATE would match zero rows,
-- raise nothing, leave confirmed_count where it was, and the capacity CHECK
-- would then be enforced against a number that never moves. A plan would fill
-- to infinity, silently, on exactly the path RLS was supposed to be guarding.
CREATE OR REPLACE FUNCTION trek_requests_recount()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan UUID := COALESCE(NEW.plan_id, OLD.plan_id);
  v_was  INT  := CASE WHEN TG_OP <> 'INSERT' AND OLD.status = 'confirmed' THEN 1 ELSE 0 END;
  v_is   INT  := CASE WHEN TG_OP <> 'DELETE' AND NEW.status = 'confirmed' THEN 1 ELSE 0 END;
BEGIN
  IF v_is <> v_was THEN
    UPDATE trek_plans SET confirmed_count = confirmed_count + (v_is - v_was) WHERE id = v_plan;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trek_requests_recount ON trek_plan_requests;
CREATE TRIGGER trek_requests_recount
  AFTER INSERT OR UPDATE OR DELETE ON trek_plan_requests
  FOR EACH ROW EXECUTE FUNCTION trek_requests_recount();

-- --- the request guard -------------------------------------------------------
-- SECURITY DEFINER for the mirror-image reason: every check here is one the
-- caller must not be able to pass by being unable to SEE the row that would have
-- failed them. A guard with a partial view can be walked around by arranging not
-- to look.
CREATE OR REPLACE FUNCTION trek_requests_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan trek_plans%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;   -- only reachable by cascade from a deleted account
  END IF;

  SELECT * INTO v_plan FROM trek_plans WHERE id = NEW.plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such plan %', NEW.plan_id USING ERRCODE = 'no_data_found';
  END IF;

  -- Fill the FK's other half ourselves, so it cannot be forged and the composite
  -- FK then proves it against the plan.
  NEW.plan_host_id := v_plan.host_id;

  IF TG_OP = 'UPDATE' AND (NEW.plan_id <> OLD.plan_id OR NEW.user_id <> OLD.user_id) THEN
    RAISE EXCEPTION 'a request cannot be moved to another plan or another person'
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF NEW.status IN ('confirmed','declined','withdrawn','removed') AND NEW.decided_at IS NULL THEN
    NEW.decided_at := NOW();
  END IF;

  -- Nothing joins a plan that is off, hidden, or already under way.
  IF NEW.status IN ('requested','confirmed')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    IF v_plan.status <> 'open' OR v_plan.hidden_at IS NOT NULL THEN
      RAISE EXCEPTION 'this plan is not taking anyone' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    -- WHERE A PAST PLAN IS MADE UNJOINABLE. In a trigger, because no write path
    -- escapes one.
    IF v_plan.starts_at <= NOW() THEN
      RAISE EXCEPTION 'this plan has already started' USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trek_requests_guard ON trek_plan_requests;
CREATE TRIGGER trek_requests_guard
  BEFORE INSERT OR UPDATE OR DELETE ON trek_plan_requests
  FOR EACH ROW EXECUTE FUNCTION trek_requests_guard();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
-- Read this as the answer to three questions.
--
-- WHAT DOES AN ANONYMOUS VISITOR SEE? Nothing. There is no policy granting anon
-- SELECT on any table in this file. /trek-buddy renders a pitch and a count for
-- logged-out visitors, and the count is produced by a server action on the
-- service role — one integer, no rows. A crawler gets a marketing page.
--
-- WHAT DOES A SIGNED-IN MEMBER SEE? The board: activity, place, town-level
-- rendezvous, date, IST start time, back-by, how many are going, spots left, the
-- host's chosen display name. Not the exact meeting point. Not the roster.
--
-- WHAT DOES A CONFIRMED JOINER SEE THAT A MEMBER DOES NOT? The exact meeting
-- point and the logistics — and only once at least three people are going. The
-- threshold is in the policy, not in a component, because a component is a
-- filter and a policy is a boundary. Also the first names of the others going,
-- which is what makes a group feel like a group.
--
-- AND THE THING RLS DOES NOT DO: every server action here runs on the service
-- role and bypasses all of it. These policies are the wall for direct PostgREST
-- access with the anon key, which ships in the client bundle. The triggers above
-- are the wall for our own code. Both are needed; neither is sufficient.

ALTER TABLE trek_plans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE trek_plan_details  ENABLE ROW LEVEL SECURITY;
ALTER TABLE trek_plan_requests ENABLE ROW LEVEL SECURITY;

-- Is the caller confirmed on this plan, or hosting it? SECURITY DEFINER and
-- STABLE so the answer does not itself depend on what the caller may read.
CREATE OR REPLACE FUNCTION trek_is_on_plan(p_plan UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM trek_plans p WHERE p.id = p_plan AND p.host_id = auth.uid())
    OR EXISTS (SELECT 1 FROM trek_plan_requests r
               WHERE r.plan_id = p_plan AND r.user_id = auth.uid() AND r.status = 'confirmed')
  );
$$;

REVOKE ALL ON FUNCTION trek_is_on_plan(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION trek_is_on_plan(UUID) TO authenticated, service_role;

-- --- trek_plans --------------------------------------------------------------
DROP POLICY IF EXISTS "Members read the open board" ON trek_plans;
CREATE POLICY "Members read the open board" ON trek_plans FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND status = 'open'
    AND hidden_at IS NULL
    -- Still readable through the outing itself, so somebody standing at the
    -- meeting point can still load the page. Gone the next day.
    AND starts_at > NOW() - interval '12 hours'
  );

-- Your own, in any state, forever — including cancelled and hidden, so a host is
-- told rather than left wondering where their post went.
DROP POLICY IF EXISTS "Participants read their own plans" ON trek_plans;
CREATE POLICY "Participants read their own plans" ON trek_plans FOR SELECT
  USING (
    host_id = auth.uid()
    OR EXISTS (SELECT 1 FROM trek_plan_requests r
               WHERE r.plan_id = trek_plans.id AND r.user_id = auth.uid())
  );

-- No INSERT, UPDATE or DELETE policy, for anyone, deliberately. Section 7.

-- --- trek_plan_details -------------------------------------------------------
-- The whole reason this table exists. Note what is NOT here: no anon policy, no
-- policy keyed on the plan merely being open, and none for a member who has
-- looked at it or asked to come. A pending requester who could read the exact
-- meeting point would not need approving.
DROP POLICY IF EXISTS "Host reads own meeting point" ON trek_plan_details;
CREATE POLICY "Host reads own meeting point" ON trek_plan_details FOR SELECT
  USING (EXISTS (SELECT 1 FROM trek_plans p
                 WHERE p.id = trek_plan_details.plan_id AND p.host_id = auth.uid()));

DROP POLICY IF EXISTS "Confirmed party of three reads the meeting point" ON trek_plan_details;
CREATE POLICY "Confirmed party of three reads the meeting point" ON trek_plan_details FOR SELECT
  USING (
    trek_is_on_plan(plan_id)
    AND EXISTS (
      SELECT 1 FROM trek_plans p
      WHERE p.id = trek_plan_details.plan_id
        AND p.status = 'open'
        AND p.hidden_at IS NULL
        -- NOBODY MEETS ONE-TO-ONE. Host plus two confirmed. Until then the plan
        -- is a proposal, not a rendezvous, and the address stays with the host.
        AND p.going_count >= 3
    )
  );

COMMENT ON POLICY "Confirmed party of three reads the meeting point" ON trek_plan_details IS
  'The three-person floor, enforced as a boundary rather than a filter. A stranger has no SELECT path to these columns at all.';

-- --- trek_plan_requests ------------------------------------------------------
DROP POLICY IF EXISTS "Requester, host and confirmed party read requests" ON trek_plan_requests;
CREATE POLICY "Requester, host and confirmed party read requests" ON trek_plan_requests FOR SELECT
  USING (
    user_id = auth.uid()
    OR plan_host_id = auth.uid()
    -- Confirmed people see the other confirmed people. Pending requests stay
    -- between the requester and the host: a queue everybody can read is a queue
    -- that can be used to work out who was turned down.
    OR (status = 'confirmed' AND trek_is_on_plan(plan_id))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Wiring into what already exists
-- ─────────────────────────────────────────────────────────────────────────────
-- notifications.type is a CHECK of three values from 024_notifications.sql:10,
-- written before this feature existed, and mirrored in types/database.ts:196 and
-- in the mobile inbox's icon map. Widen it here; the TypeScript union and the
-- mobile map are widened in the same change.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('order_update','promotion','back_in_stock','trek_buddy'));

-- The settings screen reads this object (024_notifications.sql:40). A key that
-- does not exist reads as undefined, which a toggle renders as off — so an
-- existing customer would silently receive nothing, including the one message
-- that must never be missed: the plan you were confirmed on has been cancelled.
ALTER TABLE profiles ALTER COLUMN notification_preferences SET DEFAULT
  '{"order_updates": true, "promotions": true, "back_in_stock": true, "trek_buddy": true}'::jsonb;

UPDATE profiles
   SET notification_preferences = notification_preferences || '{"trek_buddy": true}'::jsonb
 WHERE NOT (notification_preferences ? 'trek_buddy');

COMMENT ON CONSTRAINT notifications_type_check ON notifications IS
  'trek_buddy added in 052. Cancellation notices ignore notification_preferences — see the force flag in lib/notifications.ts. They are safety messages, not updates.';

-- Free hardening while we are here, and it belongs in this migration because
-- this feature made the pattern dangerous. The integrity views in 048 run with
-- owner rights (no security_invoker) and are protected only by REVOKE ... FROM
-- PUBLIC. Supabase's bootstrap grants table privileges directly to `anon` and
-- `authenticated` via ALTER DEFAULT PRIVILEGES, not to PUBLIC, so that REVOKE
-- does not remove them and PostgREST will serve anything in the public schema.
-- This file adds no views at all for the same reason; 048's are revoked properly
-- here. Wrapped so a database that predates 048 still applies 052.
DO $$
BEGIN
  IF to_regclass('public.uninvoiced_supplies') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON invoice_series_integrity, uninvoiced_supplies,
             uncredited_refunds, addresses_without_state_code FROM anon, authenticated';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. The operations — the only way anything in here is written
-- ─────────────────────────────────────────────────────────────────────────────
-- All SECURITY DEFINER. Each takes an optional p_actor honoured only when
-- auth.uid() is absent — which means the service role, because anon holds
-- EXECUTE on none of these. A signed-in caller can never act as somebody else.

CREATE OR REPLACE FUNCTION trek_actor(p_actor UUID)
RETURNS UUID LANGUAGE plpgsql STABLE AS $$
DECLARE v UUID := COALESCE(auth.uid(), p_actor);
BEGIN
  IF v IS NULL THEN
    RAISE EXCEPTION 'sign in to use Trek Buddy' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN v;
END $$;

-- The one gate every operation passes through: onboarded, adult, not a minor by
-- their own statement. Returns the display name, which is what the callers need.
CREATE OR REPLACE FUNCTION trek_require_member(p_user UUID)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE p profiles%ROWTYPE;
BEGIN
  SELECT * INTO p FROM profiles WHERE id = p_user;
  IF NOT FOUND OR p.trek_display_name IS NULL OR p.trek_terms_at IS NULL THEN
    RAISE EXCEPTION 'set up your Trek Buddy profile first' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p.trek_dob IS NULL OR p.trek_dob > trek_ist_today() - interval '18 years' THEN
    RAISE EXCEPTION 'Trek Buddy is for adults only' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN p.trek_display_name;
END $$;

-- --- posting -----------------------------------------------------------------
-- Public row and private row in one transaction. Separately they are two
-- requests, and the window between them is a plan on the board with no meeting
-- point — which is exactly the plan somebody asks to join.
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
  p_actor         UUID DEFAULT NULL
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
  -- Serialised per host so the open-plans cap cannot be passed by two requests
  -- that both read before either wrote.
  PERFORM pg_advisory_xact_lock(hashtext('dewdropz.trek_host'), hashtext(v_user::text));

  SELECT trek_can_host, role INTO v_can, v_role FROM profiles WHERE id = v_user;
  IF NOT COALESCE(v_can, false) AND v_role <> 'admin' THEN
    RAISE EXCEPTION 'hosting on Trek Buddy is invite-only at the moment'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- A board where one person holds ten open outings is not a board, it is an
  -- advertisement.
  SELECT count(*) INTO v_open FROM trek_plans
   WHERE host_id = v_user AND status = 'open' AND starts_at > NOW();
  IF v_open >= 3 THEN
    RAISE EXCEPTION 'you already have % open plans — cancel one before posting another', v_open
      USING ERRCODE = 'too_many_rows';
  END IF;

  -- starts_at is omitted although it is NOT NULL: constraints are checked after
  -- BEFORE-row triggers, so trek_plans_10_set_times has already filled it.
  INSERT INTO trek_plans (
    host_id, host_name, activity, place, meet_area,
    starts_on, start_time, back_by, capacity, effort, note
  ) VALUES (
    v_user, v_name, p_activity, btrim(p_place), btrim(p_meet_area),
    p_starts_on, p_start_time, p_back_by, p_capacity, p_effort,
    NULLIF(btrim(COALESCE(p_note, '')), '')
  )
  RETURNING * INTO v_plan;

  INSERT INTO trek_plan_details (plan_id, meeting_point, logistics)
  VALUES (v_plan.id, btrim(p_meeting_point), NULLIF(btrim(COALESCE(p_logistics, '')), ''));

  RETURN v_plan;
END $$;

-- --- asking ------------------------------------------------------------------
-- Idempotent for the double-tapped button. A previously declined or withdrawn
-- row can ask again — people change their minds, and the host still decides.
CREATE OR REPLACE FUNCTION trek_request_join(
  p_plan_id UUID,
  p_message TEXT DEFAULT NULL,
  p_actor   UUID DEFAULT NULL
)
RETURNS trek_plan_requests
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user UUID := trek_actor(p_actor);
  v_name TEXT := trek_require_member(v_user);
  v_plan trek_plans;
  v_row  trek_plan_requests;
  v_clash TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('dewdropz.trek_host'), hashtext(v_user::text));

  SELECT * INTO v_plan FROM trek_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such plan' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_plan.host_id = v_user THEN
    RAISE EXCEPTION 'this is your own plan' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  -- Asking is free; being confirmed is not. Refuse when the plan is already
  -- full, so nobody sits in a queue that cannot reach them.
  IF v_plan.spots_left <= 0 THEN
    RAISE EXCEPTION 'this plan is full' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- You cannot be in two places at once, and a phantom fourth member is worse
  -- than a party of three that knew it was three. Compared on the day, because
  -- every plan in v1 is a single daylight day.
  SELECT p.place INTO v_clash
    FROM trek_plans p
   WHERE p.status = 'open' AND p.id <> p_plan_id AND p.starts_on = v_plan.starts_on
     AND (p.host_id = v_user
          OR EXISTS (SELECT 1 FROM trek_plan_requests q
                     WHERE q.plan_id = p.id AND q.user_id = v_user AND q.status = 'confirmed'))
   LIMIT 1;
  IF v_clash IS NOT NULL THEN
    RAISE EXCEPTION 'you are already going somewhere that day (%)', v_clash
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  INSERT INTO trek_plan_requests (plan_id, user_id, plan_host_id, display_name, message)
  VALUES (p_plan_id, v_user, v_plan.host_id, v_name, NULLIF(btrim(COALESCE(p_message, '')), ''))
  ON CONFLICT (plan_id, user_id) DO UPDATE
    SET status       = CASE WHEN trek_plan_requests.status = 'confirmed'
                            THEN 'confirmed' ELSE 'requested' END,
        decided_at   = CASE WHEN trek_plan_requests.status = 'confirmed'
                            THEN trek_plan_requests.decided_at ELSE NULL END,
        display_name = EXCLUDED.display_name,
        message      = COALESCE(EXCLUDED.message, trek_plan_requests.message),
        created_at   = NOW()
  RETURNING * INTO v_row;

  RETURN v_row;
END $$;

-- --- deciding ----------------------------------------------------------------
-- Host only. Declining takes no reason and gives none: a reason is a
-- conversation, and there is no conversation here by design.
--
-- On the race for the last seat: this takes the plan's row lock before reading,
-- so the ordinary case comes back as a sentence. What actually guarantees
-- correctness is trek_plans_capacity_not_exceeded, enforced when the recount
-- trigger's UPDATE lands. Remove the lock and this is still correct; remove the
-- constraint and it is not.
CREATE OR REPLACE FUNCTION trek_decide_request(
  p_plan_id  UUID,
  p_user_id  UUID,
  p_decision TEXT,
  p_actor    UUID DEFAULT NULL
)
RETURNS trek_plan_requests
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user UUID := trek_actor(p_actor);
  v_plan trek_plans;
  v_row  trek_plan_requests;
BEGIN
  IF p_decision NOT IN ('confirmed','declined','removed') THEN
    RAISE EXCEPTION 'decision must be confirmed, declined or removed'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT * INTO v_plan FROM trek_plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such plan' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_plan.host_id <> v_user THEN
    RAISE EXCEPTION 'only the host decides who comes' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_decision = 'confirmed' AND v_plan.spots_left <= 0 THEN
    RAISE EXCEPTION 'that was the last spot — this plan is full'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE trek_plan_requests
     SET status = p_decision, decided_at = NOW()
   WHERE plan_id = p_plan_id AND user_id = p_user_id
     AND status IN ('requested','confirmed')
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no open request from that person' USING ERRCODE = 'no_data_found';
  END IF;

  RETURN v_row;
END $$;

-- --- withdrawing -------------------------------------------------------------
CREATE OR REPLACE FUNCTION trek_withdraw_request(
  p_plan_id UUID,
  p_actor   UUID DEFAULT NULL
)
RETURNS trek_plan_requests
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user UUID := trek_actor(p_actor);
  v_row  trek_plan_requests;
BEGIN
  UPDATE trek_plan_requests
     SET status = 'withdrawn', decided_at = NOW()
   WHERE plan_id = p_plan_id AND user_id = v_user AND status IN ('requested','confirmed')
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'you have no open request on this plan' USING ERRCODE = 'no_data_found';
  END IF;

  RETURN v_row;
END $$;

-- --- calling it off ----------------------------------------------------------
-- Terminal, and the notification it triggers is the one that must never be
-- missed: somebody will otherwise stand at a trailhead on their own.
CREATE OR REPLACE FUNCTION trek_cancel_plan(
  p_plan_id UUID,
  p_reason  TEXT DEFAULT NULL,
  p_actor   UUID DEFAULT NULL
)
RETURNS trek_plans
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user UUID := trek_actor(p_actor);
  v_role TEXT;
  v_plan trek_plans;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = v_user;

  SELECT * INTO v_plan FROM trek_plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such plan' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_plan.host_id <> v_user AND COALESCE(v_role, '') <> 'admin' THEN
    RAISE EXCEPTION 'only the host can cancel this plan' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE trek_plans
     SET status = 'cancelled', cancelled_at = NOW(),
         cancel_reason = NULLIF(btrim(COALESCE(p_reason, '')), '')
   WHERE id = p_plan_id AND status = 'open'
  RETURNING * INTO v_plan;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'this plan is not open' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN v_plan;
END $$;

-- Notifications are deliberately NOT inserted by these functions. They go
-- through lib/notifications.ts notifyUser() from the calling server action, so
-- that notification_preferences is actually consulted — a raw INSERT here would
-- make the toggle this migration adds dead on arrival.

REVOKE ALL ON FUNCTION trek_actor(UUID)                   FROM PUBLIC;
REVOKE ALL ON FUNCTION trek_require_member(UUID)          FROM PUBLIC;
REVOKE ALL ON FUNCTION trek_create_plan(TEXT,TEXT,TEXT,DATE,TIME,TIME,INT,TEXT,TEXT,TEXT,TEXT,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION trek_request_join(UUID,TEXT,UUID)  FROM PUBLIC;
REVOKE ALL ON FUNCTION trek_decide_request(UUID,UUID,TEXT,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION trek_withdraw_request(UUID,UUID)   FROM PUBLIC;
REVOKE ALL ON FUNCTION trek_cancel_plan(UUID,TEXT,UUID)   FROM PUBLIC;

-- anon is absent from every grant below, which is what makes the p_actor
-- fallback safe: only a caller with no auth.uid() can use it, and the only such
-- caller holding EXECUTE is the service role.
GRANT EXECUTE ON FUNCTION trek_create_plan(TEXT,TEXT,TEXT,DATE,TIME,TIME,INT,TEXT,TEXT,TEXT,TEXT,UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION trek_request_join(UUID,TEXT,UUID)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION trek_decide_request(UUID,UUID,TEXT,UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION trek_withdraw_request(UUID,UUID)   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION trek_cancel_plan(UUID,TEXT,UUID)   TO authenticated, service_role;

COMMENT ON FUNCTION trek_decide_request(UUID,UUID,TEXT,UUID) IS
  'Host-only. The whole join model: there is no instant-join path and no setting that creates one.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. No seed data, and why
-- ─────────────────────────────────────────────────────────────────────────────
-- The board launches empty. It is tempting to insert a handful of plausible
-- plans so it has shape, and this codebase has deleted exactly that pattern
-- twice: the guided-departures funnel with invented dates and "spots left"
-- (lib/constants.ts:214), and four fabricated customers stamped "Verified buyer"
-- (components/sections/Community.tsx:14). A fake plan is worse than either. A
-- fake testimonial is a lie about the past; a fake plan is an invitation to meet
-- somebody at a real place and a real time who will not be there.
--
-- The first plans are posted by the owner, as walks they will actually turn up
-- for. That is founder work, not seeding, and it is why trek_can_host defaults
-- to false rather than true.
