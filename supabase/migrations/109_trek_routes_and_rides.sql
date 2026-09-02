-- ═══════════════════════════════════════════════════════════════════════════
-- 109 — A trip can have two ends
-- ═══════════════════════════════════════════════════════════════════════════
--
-- The client's brief, in their own words:
--
--   "update post of walk to a poster event or something like that, because it
--    is just not a walk. People can post for long rides like Bangalore to
--    Ladakh, Delhi to Ladakh, and whatever it is, routes."
--
-- The interface stopped saying "walk" in an earlier pass. This is the half that
-- makes the sentence true, because renaming the noun did not give the schema
-- anywhere to put a route:
--
--   * `place` is ONE 80-character string. Bangalore→Leh is an origin, a
--     destination and a line between them, and the only place to put the other
--     two was the free-text note.
--   * Nineteen kinds of outing are seeded and every one is a Dehradun day out.
--     Somebody posting a twelve-day motorcycle tour picks "Something else".
--   * `min_party` is 3 or 4 on every kind. TWO PEOPLE ON TWO MOTORCYCLES IS A
--     NORMAL AND SAFE THING and it is currently unpostable.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHAT THIS DOES NOT DO
-- ─────────────────────────────────────────────────────────────────────────────
--
-- No stages table. A twelve-day ride really is a sequence of days — "day 4:
-- Sarchu to Leh" — and modelling that properly means a child table, its own
-- RLS, its own editor and its own moderation hooks. `itinerary` (068) is
-- already a JSONB list of moments and it carries a day's shape well enough to
-- post a ride today. Two columns and five kinds is the smallest change that
-- makes the client's sentence expressible; stages can come when somebody has
-- actually posted enough rides to show what shape they need.
--
-- No renaming of tables. TREKBUDDY-COUNCIL R7: renaming `trek_plans` buys
-- nothing and risks everything. The words changed in the interface; the schema
-- keeps its name.

BEGIN;

-- ── 1 · The other end, and the line between ─────────────────────────────────

ALTER TABLE trek_plans ADD COLUMN IF NOT EXISTS ends_place TEXT;
ALTER TABLE trek_plans ADD COLUMN IF NOT EXISTS route_note TEXT;

ALTER TABLE trek_plans DROP CONSTRAINT IF EXISTS trek_plans_ends_place_len;
ALTER TABLE trek_plans ADD CONSTRAINT trek_plans_ends_place_len
  CHECK (ends_place IS NULL OR length(btrim(ends_place)) BETWEEN 2 AND 80);

ALTER TABLE trek_plans DROP CONSTRAINT IF EXISTS trek_plans_route_note_len;
ALTER TABLE trek_plans ADD CONSTRAINT trek_plans_route_note_len
  CHECK (route_note IS NULL OR length(btrim(route_note)) BETWEEN 2 AND 400);

-- A destination that equals the origin is a loop somebody typed twice, and it
-- would render as "Dehradun → Dehradun" on every card.
ALTER TABLE trek_plans DROP CONSTRAINT IF EXISTS trek_plans_ends_place_differs;
ALTER TABLE trek_plans ADD CONSTRAINT trek_plans_ends_place_differs
  CHECK (ends_place IS NULL OR lower(btrim(ends_place)) <> lower(btrim(place)));

COMMENT ON COLUMN trek_plans.ends_place IS
  'Where a point-to-point trip finishes. NULL means it returns to `place`, which is every day walk on this board.';
COMMENT ON COLUMN trek_plans.route_note IS
  'The line between the two ends, in the host''s own words — "via Manali, Sarchu, Tanglang La". Not a stages table; see 109.';

-- ── 2 · Which shape a kind of outing has ────────────────────────────────────

ALTER TABLE trek_activity_kinds ADD COLUMN IF NOT EXISTS route_shape TEXT NOT NULL DEFAULT 'loop';
ALTER TABLE trek_activity_kinds DROP CONSTRAINT IF EXISTS trek_activity_kinds_route_shape_check;
ALTER TABLE trek_activity_kinds ADD CONSTRAINT trek_activity_kinds_route_shape_check
  CHECK (route_shape IN ('loop', 'point_to_point', 'either'));

COMMENT ON COLUMN trek_activity_kinds.route_shape IS
  'loop = returns to where it started, so the composer never asks for a destination. point_to_point = it must. either = it offers the field and does not require it. Default loop, which is correct for every kind seeded before 109.';

-- Cycling can genuinely be either — a Sunday loop out of Dehradun, or Manali to
-- Leh. Expedition likewise.
UPDATE trek_activity_kinds SET route_shape = 'either' WHERE key IN ('cycling', 'expedition');

-- ── 3 · The kinds that could not be posted ──────────────────────────────────
--
-- Windows are honest rather than tidy. Long-distance riding legitimately starts
-- at 04:00 and finishes after dark, and 057 built `start_min`/`start_max` per
-- kind precisely so a kind could say so instead of being refused by a daylight
-- instinct written for day walks.

INSERT INTO trek_activity_kinds
  (key, label, blurb, day_part, start_min, start_max, default_start, default_back_by,
   ends_next_day, min_party, needs_night_note, is_open_ended, route_shape, sort, active)
SELECT * FROM (VALUES
  -- `default_back_by` is NOT NULL on this table and every seeded kind carries
  -- one, so these do too. It is only what the composer PREFILLS: `is_open_ended`
  -- is TRUE on all three, and `trek_plans.back_by` is itself nullable — 055 made
  -- it so precisely because "on a six-day trek nobody should have to invent a
  -- return time for day six." 18:00 is a plausible end to a riding day, offered
  -- and clearable, not a claim about when the trip finishes.
  ('motorcycle_tour', 'Motorcycle tour',
   'Long-distance riding over several days, own bike, self-supported.',
   'overnight', '04:00'::time, '11:00'::time, '06:00'::time, '18:00'::time,
   TRUE, 2, TRUE, TRUE, 'point_to_point', 30, TRUE),

  ('road_trip', 'Road trip',
   'A shared drive over a distance, with the route and the stops agreed in advance.',
   'overnight', '04:00'::time, '12:00'::time, '06:00'::time, '18:00'::time,
   TRUE, 2, TRUE, TRUE, 'point_to_point', 31, TRUE),

  ('backpacking', 'Backpacking',
   'Several days on foot between places, carrying what you need.',
   'overnight', '04:00'::time, '10:00'::time, '06:00'::time, '18:00'::time,
   TRUE, 2, TRUE, TRUE, 'either', 32, TRUE),

  ('climbing', 'Climbing',
   'Roped climbing or bouldering. Bring your own gear and say what you have.',
   'day', '04:00'::time, '14:00'::time, '06:00'::time, '18:00'::time,
   FALSE, 2, FALSE, FALSE, 'loop', 33, TRUE),

  ('water', 'Kayak or raft',
   'On the water. Say the grade and whether an operator is involved.',
   'day', '06:00'::time, '15:00'::time, '08:00'::time, '17:00'::time,
   FALSE, 3, FALSE, FALSE, 'point_to_point', 34, TRUE)
) AS v(key, label, blurb, day_part, start_min, start_max, default_start, default_back_by,
       ends_next_day, min_party, needs_night_note, is_open_ended, route_shape, sort, active)
WHERE NOT EXISTS (SELECT 1 FROM trek_activity_kinds k WHERE k.key = v.key);

-- ── 4 · A pair is a party, for the kinds where it is ────────────────────────
--
-- The floor of three exists for a real reason and it is NOT being lowered
-- generally: 052 sets `going_count >= 3` as the gate on releasing the meeting
-- point, because "nobody meets one-to-one" when the people involved are
-- strangers off a public board. That boundary is untouched and still applies to
-- every trip.
--
-- `min_party` is a different number: the smallest group the HOST is willing to
-- go with. For two people riding their own motorcycles to Ladakh, three is not
-- a safety floor, it is a refusal to let a normal trip exist. Cycling gets it
-- too, for the same reason.
UPDATE trek_activity_kinds SET min_party = 2 WHERE key IN ('cycling');

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5 · The composer's RPC has to be able to carry the two new fields
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WHY THIS IS A DROP AND NOT A CREATE OR REPLACE
--
-- Adding a parameter changes the signature, and CREATE OR REPLACE with a
-- different signature does not replace anything — it creates an OVERLOAD, and
-- PostgREST calling `trek_create_plan` by named arguments against two
-- candidates fails as ambiguous. So the old one is dropped by its exact
-- identity arguments and the new one created in the same transaction.
--
-- THE BODY BELOW IS THE LIVE DEFINITION, READ OUT OF THE CATALOGUE WITH
-- pg_get_functiondef AND EDITED. It is not transcribed from an earlier
-- migration: the function is redefined by six of them and which is live depends
-- on what was applied by hand. Two parameters and two INSERT columns are added.
-- Everything else — the advisory lock, the invite-only gate, the open-trip cap
-- on `ends_at` from 107, the `other` handling, every COALESCE — is byte-for-byte
-- what was already running.
--
-- DROPPING A FUNCTION DROPS ITS GRANTS. The live ACL is
-- {postgres, authenticated, service_role} and it is restored at the foot.

BEGIN;

DROP FUNCTION IF EXISTS public.trek_create_plan(
  text, text, text, date, date, integer, text, text, time without time zone,
  time without time zone, text, text, text, boolean, boolean, text[], text[],
  text, smallint, numeric, integer, integer, text[], jsonb, uuid
);

CREATE FUNCTION public.trek_create_plan(
  p_activity text, p_place text, p_meet_area text, p_starts_on date,
  p_ends_on date DEFAULT NULL::date, p_capacity integer DEFAULT 4,
  p_meeting_point text DEFAULT NULL::text, p_difficulty text DEFAULT 'moderate'::text,
  p_start_time time without time zone DEFAULT NULL::time without time zone,
  p_back_by time without time zone DEFAULT NULL::time without time zone,
  p_note text DEFAULT NULL::text, p_logistics text DEFAULT NULL::text,
  p_night_note text DEFAULT NULL::text, p_women_only boolean DEFAULT false,
  p_senior_friendly boolean DEFAULT false, p_languages text[] DEFAULT '{}'::text[],
  p_cover_urls text[] DEFAULT '{}'::text[], p_activity_other text DEFAULT NULL::text,
  p_min_trust smallint DEFAULT 0, p_distance_km numeric DEFAULT NULL::numeric,
  p_gain_m integer DEFAULT NULL::integer, p_cost_paise integer DEFAULT NULL::integer,
  p_bring text[] DEFAULT '{}'::text[], p_itinerary jsonb DEFAULT '[]'::jsonb,
  -- NEW in 109. Both default NULL and both sit AFTER every existing parameter,
  -- so a caller that does not know about them is unaffected.
  p_ends_place text DEFAULT NULL::text, p_route_note text DEFAULT NULL::text,
  p_actor uuid DEFAULT NULL::uuid
)
RETURNS trek_plans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user UUID := trek_actor(p_actor);
  v_name TEXT := trek_require_member(v_user);
  v_can  BOOLEAN;
  v_role TEXT;
  v_open INT;
  v_plan trek_plans;
BEGIN
  PERFORM trek_require_active(v_user);
  PERFORM pg_advisory_xact_lock(hashtext('dewdropz.trek_host'), hashtext(v_user::text));

  SELECT trek_can_host, role INTO v_can, v_role FROM profiles WHERE id = v_user;
  IF NOT COALESCE(v_can, false) AND v_role <> 'admin' THEN
    RAISE EXCEPTION 'hosting on Trek Buddy is invite-only at the moment'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT count(*) INTO v_open FROM trek_plans
   WHERE host_id = v_user AND status = 'open' AND ends_at > NOW();
  IF v_open >= 3 THEN
    RAISE EXCEPTION 'you already have % open treks — close one before posting another', v_open
      USING ERRCODE = 'too_many_rows';
  END IF;

  INSERT INTO trek_plans (
    host_id, host_name, activity, activity_other, place, meet_area,
    starts_on, ends_on, start_time, back_by, capacity,
    difficulty, note, night_note, women_only, senior_friendly, languages, cover_urls, min_trust,
    distance_km, gain_m, cost_paise, bring, itinerary,
    ends_place, route_note
  ) VALUES (
    v_user, v_name, p_activity,
    CASE WHEN p_activity = 'other' THEN NULLIF(btrim(COALESCE(p_activity_other, '')), '') END,
    btrim(p_place), btrim(p_meet_area),
    p_starts_on, COALESCE(p_ends_on, p_starts_on), p_start_time, p_back_by, p_capacity,
    p_difficulty,
    NULLIF(btrim(COALESCE(p_note, '')), ''),
    NULLIF(btrim(COALESCE(p_night_note, '')), ''),
    p_women_only, p_senior_friendly, COALESCE(p_languages, '{}'), COALESCE(p_cover_urls, '{}'), COALESCE(p_min_trust, 0),
    p_distance_km, p_gain_m, p_cost_paise,
    COALESCE(p_bring, '{}'), COALESCE(p_itinerary, '[]'::jsonb),
    NULLIF(btrim(COALESCE(p_ends_place, '')), ''),
    NULLIF(btrim(COALESCE(p_route_note, '')), '')
  )
  RETURNING * INTO v_plan;

  INSERT INTO trek_plan_details (plan_id, meeting_point, logistics)
  VALUES (v_plan.id, btrim(p_meeting_point), NULLIF(btrim(COALESCE(p_logistics, '')), ''));

  RETURN v_plan;
END $function$;

REVOKE ALL ON FUNCTION public.trek_create_plan FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trek_create_plan TO authenticated, service_role;

-- ── 6 · The two new fields are free text, so they are scanned ───────────────
--
-- 058's rule: there is no way to get text into this board without passing the
-- scan. `ends_place` and `route_note` are typed by a host and rendered to
-- strangers, so they are no different from `place` and `note`.
--
-- This restates the whole function because CREATE OR REPLACE cannot add to a
-- body — and it carries `SET search_path = public`, because a replace resets
-- every property and dropping that pin is the fault behind 085, 087 and 088.
-- The seven existing checks are exactly as 104 left them.

CREATE OR REPLACE FUNCTION trek_plans_moderate()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.place IS DISTINCT FROM OLD.place THEN
    PERFORM trek_moderate_field(NEW.place, 'place', NEW.id, NEW.host_id);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.meet_area IS DISTINCT FROM OLD.meet_area THEN
    PERFORM trek_moderate_field(NEW.meet_area, 'meeting area', NEW.id, NEW.host_id);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.note IS DISTINCT FROM OLD.note THEN
    PERFORM trek_moderate_field(NEW.note, 'note', NEW.id, NEW.host_id);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.night_note IS DISTINCT FROM OLD.night_note THEN
    PERFORM trek_moderate_field(NEW.night_note, 'note about getting back', NEW.id, NEW.host_id);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.activity_other IS DISTINCT FROM OLD.activity_other THEN
    PERFORM trek_moderate_field(NEW.activity_other, 'name for this outing', NEW.id, NEW.host_id);
  END IF;
  IF NEW.cancel_reason IS DISTINCT FROM OLD.cancel_reason THEN
    PERFORM trek_moderate_field(NEW.cancel_reason, 'reason for cancelling', NEW.id, NEW.host_id);
  END IF;

  -- NEW in 109.
  IF TG_OP = 'INSERT' OR NEW.ends_place IS DISTINCT FROM OLD.ends_place THEN
    PERFORM trek_moderate_field(NEW.ends_place, 'destination', NEW.id, NEW.host_id);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.route_note IS DISTINCT FROM OLD.route_note THEN
    PERFORM trek_moderate_field(NEW.route_note, 'route', NEW.id, NEW.host_id);
  END IF;

  RETURN NULL;
END $$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY
-- ─────────────────────────────────────────────────────────────────────────────
--
--   SELECT count(*) FROM trek_activity_kinds WHERE active;              -- 24
--   SELECT proacl FROM pg_proc WHERE proname='trek_create_plan';        -- authenticated + service_role
--   SELECT count(*) FROM pg_proc WHERE proname='trek_create_plan';      -- exactly 1, no overload
--
--   -- and 087's guard, which every migration that touches a trigger must clear
--   SELECT DISTINCT p.proname FROM pg_trigger t
--     JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace
--    WHERE NOT t.tgisinternal AND n.nspname='public'
--      AND (p.proconfig IS NULL OR NOT (p.proconfig::text LIKE '%search_path%'));
