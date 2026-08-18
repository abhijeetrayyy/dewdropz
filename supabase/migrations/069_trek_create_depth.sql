-- ---------------------------------------------------------------------------
-- 069 — post a walk with its depth
-- ---------------------------------------------------------------------------
--
-- 068 added the columns; trek_create_plan is still the only way a walk reaches
-- the board, so without this they could only ever be filled in by hand.
--
-- Dropped and recreated rather than replaced, for the third time and the same
-- reason: everything after p_ends_on carries a default, so an added parameter
-- makes a second overload that Postgres cannot choose between.
DROP FUNCTION IF EXISTS trek_create_plan(
  TEXT, TEXT, TEXT, DATE, DATE, INT, TEXT, TEXT, TIME, TIME, TEXT, TEXT, TEXT,
  BOOLEAN, BOOLEAN, TEXT[], TEXT[], TEXT, SMALLINT, UUID
);

CREATE OR REPLACE FUNCTION trek_create_plan(
  p_activity        TEXT,
  p_place           TEXT,
  p_meet_area       TEXT,
  p_starts_on       DATE,
  p_ends_on         DATE     DEFAULT NULL,
  p_capacity        INT      DEFAULT 4,
  p_meeting_point   TEXT     DEFAULT NULL,
  p_difficulty      TEXT     DEFAULT 'moderate',
  p_start_time      TIME     DEFAULT NULL,
  p_back_by         TIME     DEFAULT NULL,
  p_note            TEXT     DEFAULT NULL,
  p_logistics       TEXT     DEFAULT NULL,
  p_night_note      TEXT     DEFAULT NULL,
  p_women_only      BOOLEAN  DEFAULT FALSE,
  p_senior_friendly BOOLEAN  DEFAULT FALSE,
  p_languages       TEXT[]   DEFAULT '{}',
  p_cover_urls      TEXT[]   DEFAULT '{}',
  p_activity_other  TEXT     DEFAULT NULL,
  p_min_trust       SMALLINT DEFAULT 0,
  p_distance_km     NUMERIC  DEFAULT NULL,
  p_gain_m          INT      DEFAULT NULL,
  p_cost_paise      INT      DEFAULT NULL,
  p_bring           TEXT[]   DEFAULT '{}',
  p_itinerary       JSONB    DEFAULT '[]'::jsonb,
  p_actor           UUID     DEFAULT NULL
) RETURNS trek_plans
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
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
   WHERE host_id = v_user AND status = 'open' AND starts_at > NOW();
  IF v_open >= 3 THEN
    RAISE EXCEPTION 'you already have % open treks — close one before posting another', v_open
      USING ERRCODE = 'too_many_rows';
  END IF;

  INSERT INTO trek_plans (
    host_id, host_name, activity, activity_other, place, meet_area,
    starts_on, ends_on, start_time, back_by, capacity,
    difficulty, note, night_note, women_only, senior_friendly, languages, cover_urls, min_trust,
    distance_km, gain_m, cost_paise, bring, itinerary
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
    COALESCE(p_bring, '{}'), COALESCE(p_itinerary, '[]'::jsonb)
  )
  RETURNING * INTO v_plan;

  INSERT INTO trek_plan_details (plan_id, meeting_point, logistics)
  VALUES (v_plan.id, btrim(p_meeting_point), NULLIF(btrim(COALESCE(p_logistics, '')), ''));

  RETURN v_plan;
END $$;

REVOKE ALL ON FUNCTION trek_create_plan(
  TEXT, TEXT, TEXT, DATE, DATE, INT, TEXT, TEXT, TIME, TIME, TEXT, TEXT, TEXT,
  BOOLEAN, BOOLEAN, TEXT[], TEXT[], TEXT, SMALLINT, NUMERIC, INT, INT, TEXT[], JSONB, UUID
) FROM PUBLIC, anon;
