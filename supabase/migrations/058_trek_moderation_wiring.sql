-- ═══════════════════════════════════════════════════════════════════════════
-- 058 — Wiring the scan into every path a person can type down
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 056 built the rules and the scan. This is where they actually bite.
--
-- WHY TRIGGERS AND NOT THE RPCs
--
-- The obvious place to put a content check is inside trek_create_plan, and it
-- would have been wrong. `saveTrekPerson` does not go through an RPC at all —
-- it writes to `profiles` with the service-role client, so a check living in
-- an RPC would have covered walks and missed every profile on the board. The
-- same is true of anything written by a future admin screen, a repair script,
-- or a hand-typed UPDATE at 2am.
--
-- So the scan hangs off the tables. There is no way to get text into this board
-- without passing it, which is the same reasoning that put the rest of Trek
-- Buddy's rules in the database rather than in an action.
--
-- WHY AFTER AND NOT BEFORE
--
-- A flagged write is allowed through and recorded as an open report, and the
-- report has to point at the row that caused it — which does not have an id
-- until it exists. Raising inside an AFTER trigger still aborts the statement,
-- so a `block` refuses the write exactly as it would from a BEFORE trigger.
-- One trigger, both outcomes, no split logic.
--
-- WHY THE PROFILE TRIGGER CHECKS WHETHER ANYTHING CHANGED
--
-- `profiles` is written on every order, address edit and login. Scanning the
-- intro on all of those would re-open the same report every time somebody
-- bought a t-shirt.

-- ── An automated report has no reporter ──────────────────────────────────────
--
-- reporter_id was NOT NULL from 054, when every report came from a person. The
-- scan is not a person, and forcing it to name one would mean either lying
-- (attributing the report to the member it is about, which the not_self CHECK
-- rightly refuses) or crashing — which is what it did: a `flag` aborted the
-- write instead of quietly queueing it, so the gentler of the two moderation
-- outcomes was the one that turned members away.
ALTER TABLE trek_reports ALTER COLUMN reporter_id DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE trek_reports ADD CONSTRAINT trek_reports_reporter_coherent
    CHECK ((source = 'member') = (reporter_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- `status` predates `resolution` and the resolver was not touching it, so a
-- worked report still read 'open'. One notion of done, written in both places.
CREATE OR REPLACE FUNCTION trek_admin_resolve_report(
  p_report_id  UUID,
  p_resolution TEXT,
  p_note       TEXT DEFAULT NULL,
  p_actor      UUID DEFAULT NULL
) RETURNS trek_reports
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin UUID := trek_actor(p_actor);
  v_rep   trek_reports;
BEGIN
  IF NOT trek_is_admin(v_admin) THEN
    RAISE EXCEPTION 'only an admin resolves reports' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_rep FROM trek_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such report' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_rep.resolved_at IS NOT NULL THEN
    RAISE EXCEPTION 'that report was already resolved as %', v_rep.resolution
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF p_resolution = 'plan_hidden' THEN
    IF v_rep.plan_id IS NULL THEN
      RAISE EXCEPTION 'that report is not about a walk' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    UPDATE trek_plans
       SET hidden_at = NOW(),
           hidden_reason = COALESCE(NULLIF(btrim(p_note), ''), 'hidden after a report')
     WHERE id = v_rep.plan_id;

  ELSIF p_resolution IN ('member_suspended', 'member_banned') THEN
    IF v_rep.subject_id IS NULL THEN
      RAISE EXCEPTION 'that report is not about a member' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    UPDATE profiles
       SET trek_suspended_at = NOW(),
           trek_suspended_reason = COALESCE(NULLIF(btrim(p_note), ''), 'suspended after a report'),
           trek_can_host = FALSE
     WHERE id = v_rep.subject_id;
    UPDATE trek_plans
       SET status = 'cancelled', cancelled_at = NOW(),
           cancel_reason = 'the host is no longer on the board'
     WHERE host_id = v_rep.subject_id AND status = 'open' AND starts_at > NOW();

  ELSIF p_resolution = 'warned' THEN
    IF v_rep.subject_id IS NULL THEN
      RAISE EXCEPTION 'that report is not about a member' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    UPDATE profiles
       SET trek_warned_at = NOW(), trek_warn_note = NULLIF(btrim(p_note), '')
     WHERE id = v_rep.subject_id;

  ELSIF p_resolution <> 'dismissed' THEN
    RAISE EXCEPTION 'unknown resolution %', p_resolution USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE trek_reports
     SET resolved_at = NOW(), resolved_by = v_admin,
         resolution = p_resolution, admin_note = NULLIF(btrim(p_note), ''),
         status = CASE WHEN p_resolution = 'dismissed' THEN 'dismissed' ELSE 'actioned' END
   WHERE id = p_report_id
   RETURNING * INTO v_rep;

  RETURN v_rep;
END $$;

-- ── One place that decides what happens to a piece of text ───────────────────

CREATE OR REPLACE FUNCTION trek_moderate_field(
  p_text    TEXT,
  p_field   TEXT,
  p_plan    UUID,
  p_subject UUID
) RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_flags UUID[];
BEGIN
  -- Raises, and takes the whole statement with it, when a rule blocks.
  v_flags := trek_guard_text(p_text, p_field);

  IF coalesce(array_length(v_flags, 1), 0) > 0 THEN
    PERFORM trek_open_auto_report(
      'other', p_field, p_text, p_plan, p_subject, NULL, v_flags
    );
  END IF;
END $$;

-- ── Walks ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trek_plans_moderate()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Only rescan what a person actually changed. An UPDATE that moves
  -- confirmed_count must not re-flag a note that was already reviewed.
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
  -- The kind a host named themselves. The whole reason it can be scanned is
  -- that it is free text, and the whole reason it must be is the same.
  IF TG_OP = 'INSERT' OR NEW.activity_other IS DISTINCT FROM OLD.activity_other THEN
    PERFORM trek_moderate_field(NEW.activity_other, 'name for this outing', NEW.id, NEW.host_id);
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trek_plans_50_moderate ON trek_plans;
CREATE TRIGGER trek_plans_50_moderate
  AFTER INSERT OR UPDATE ON trek_plans
  FOR EACH ROW EXECUTE FUNCTION trek_plans_moderate();

-- ── The withheld details ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trek_plan_details_moderate()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_host UUID;
BEGIN
  SELECT host_id INTO v_host FROM trek_plans WHERE id = NEW.plan_id;
  IF TG_OP = 'INSERT' OR NEW.meeting_point IS DISTINCT FROM OLD.meeting_point THEN
    PERFORM trek_moderate_field(NEW.meeting_point, 'meeting point', NEW.plan_id, v_host);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.logistics IS DISTINCT FROM OLD.logistics THEN
    PERFORM trek_moderate_field(NEW.logistics, 'getting there', NEW.plan_id, v_host);
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trek_plan_details_50_moderate ON trek_plan_details;
CREATE TRIGGER trek_plan_details_50_moderate
  AFTER INSERT OR UPDATE ON trek_plan_details
  FOR EACH ROW EXECUTE FUNCTION trek_plan_details_moderate();

-- ── Join messages ────────────────────────────────────────────────────────────
--
-- The likeliest place on the whole board for a phone number, because it is the
-- one field that reaches a specific person.

CREATE OR REPLACE FUNCTION trek_requests_moderate()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.message IS DISTINCT FROM OLD.message THEN
    PERFORM trek_moderate_field(NEW.message, 'message to the host', NEW.plan_id, NEW.user_id);
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trek_plan_requests_50_moderate ON trek_plan_requests;
CREATE TRIGGER trek_plan_requests_50_moderate
  AFTER INSERT OR UPDATE ON trek_plan_requests
  FOR EACH ROW EXECUTE FUNCTION trek_requests_moderate();

-- ── Profiles ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION profiles_trek_moderate()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Nothing to do unless a Trek Buddy text field actually moved. This table is
  -- written on every order and every address edit.
  IF TG_OP = 'UPDATE'
     AND NEW.trek_intro      IS NOT DISTINCT FROM OLD.trek_intro
     AND NEW.trek_display_name IS NOT DISTINCT FROM OLD.trek_display_name
     AND NEW.trek_mentor_bio IS NOT DISTINCT FROM OLD.trek_mentor_bio THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.trek_intro IS DISTINCT FROM OLD.trek_intro THEN
    PERFORM trek_moderate_field(NEW.trek_intro, 'profile introduction', NULL, NEW.id);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.trek_display_name IS DISTINCT FROM OLD.trek_display_name THEN
    PERFORM trek_moderate_field(NEW.trek_display_name, 'display name', NULL, NEW.id);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.trek_mentor_bio IS DISTINCT FROM OLD.trek_mentor_bio THEN
    PERFORM trek_moderate_field(NEW.trek_mentor_bio, 'mentor note', NULL, NEW.id);
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS profiles_50_trek_moderate ON profiles;
CREATE TRIGGER profiles_50_trek_moderate
  AFTER INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_trek_moderate();

-- ── A suspended member does nothing ──────────────────────────────────────────
--
-- Replaces the 18-argument creator from 055. Two changes: the actor must not be
-- suspended, and a host may name their own kind of outing.

DROP FUNCTION IF EXISTS trek_create_plan(
  TEXT, TEXT, TEXT, DATE, DATE, INT, TEXT, TEXT, TIME, TIME, TEXT, TEXT, TEXT,
  BOOLEAN, BOOLEAN, TEXT[], TEXT[], UUID
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
    difficulty, note, night_note, women_only, senior_friendly, languages, cover_urls
  ) VALUES (
    v_user, v_name, p_activity,
    CASE WHEN p_activity = 'other' THEN NULLIF(btrim(COALESCE(p_activity_other, '')), '') END,
    btrim(p_place), btrim(p_meet_area),
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

REVOKE ALL ON FUNCTION trek_create_plan(
  TEXT, TEXT, TEXT, DATE, DATE, INT, TEXT, TEXT, TIME, TIME, TEXT, TEXT, TEXT,
  BOOLEAN, BOOLEAN, TEXT[], TEXT[], TEXT, UUID
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION trek_create_plan(
  TEXT, TEXT, TEXT, DATE, DATE, INT, TEXT, TEXT, TIME, TIME, TEXT, TEXT, TEXT,
  BOOLEAN, BOOLEAN, TEXT[], TEXT[], TEXT, UUID
) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION trek_moderate_field(TEXT, TEXT, UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION trek_open_auto_report(TEXT, TEXT, TEXT, UUID, UUID, UUID, UUID[])
  TO authenticated, service_role;
