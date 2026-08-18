-- ---------------------------------------------------------------------------
-- 064 — let a host say who may ask
-- ---------------------------------------------------------------------------
--
-- 062 added trek_plans.min_trust and the gate that enforces it, but nothing
-- could set it: trek_create_plan is the only way a walk gets posted, and it did
-- not know the column existed. So every walk was created at 0 and the gate,
-- while correct, was unreachable.
--
-- The old function has to be dropped rather than replaced. Every parameter
-- after p_ends_on carries a default, so adding one more would leave two
-- overloads that Postgres cannot choose between, and calls would start failing
-- with "function is not unique" instead of doing anything useful.
DROP FUNCTION IF EXISTS trek_create_plan(
  TEXT, TEXT, TEXT, DATE, DATE, INT, TEXT, TEXT, TIME, TIME, TEXT, TEXT, TEXT,
  BOOLEAN, BOOLEAN, TEXT[], TEXT[], TEXT, UUID
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
    difficulty, note, night_note, women_only, senior_friendly, languages, cover_urls, min_trust
  ) VALUES (
    v_user, v_name, p_activity,
    CASE WHEN p_activity = 'other' THEN NULLIF(btrim(COALESCE(p_activity_other, '')), '') END,
    btrim(p_place), btrim(p_meet_area),
    p_starts_on, COALESCE(p_ends_on, p_starts_on), p_start_time, p_back_by, p_capacity,
    p_difficulty,
    NULLIF(btrim(COALESCE(p_note, '')), ''),
    NULLIF(btrim(COALESCE(p_night_note, '')), ''),
    p_women_only, p_senior_friendly, COALESCE(p_languages, '{}'), COALESCE(p_cover_urls, '{}'), COALESCE(p_min_trust, 0)
  )
  RETURNING * INTO v_plan;

  INSERT INTO trek_plan_details (plan_id, meeting_point, logistics)
  VALUES (v_plan.id, btrim(p_meeting_point), NULLIF(btrim(COALESCE(p_logistics, '')), ''));

  RETURN v_plan;
END $$;
COMMENT ON FUNCTION trek_create_plan IS
  'Posts a walk. p_min_trust is the lowest rung that may ask to come; the gate itself lives in trek_requests_guard (062) so that every route in is checked, not just this one.';
