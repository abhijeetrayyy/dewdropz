-- ═══════════════════════════════════════════════════════════════════════════
-- 059 — The person card carries the rest of the person
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 057 added the self-declared half of a profile — experience, years out, the
-- highest they have been, when they usually go, what they carry — plus the
-- mentor grant. None of it reached the app, because trek_person_card still
-- returned the 054 column list.
--
-- The card keeps the two halves separate and the app keeps them visibly apart:
-- the counted facts at the bottom are things the board can prove, and
-- everything added here is a claim the member typed about themselves. Mixing
-- them would make the proven half worth nothing, which is the whole reason the
-- counted facts exist.

DROP FUNCTION IF EXISTS trek_person_card(UUID);

CREATE OR REPLACE FUNCTION trek_person_card(p_user UUID)
RETURNS TABLE (
  display_name  TEXT,
  home_base     TEXT,
  intro         TEXT,
  pace          TEXT,
  activities    TEXT[],
  languages     TEXT[],
  member_since  TIMESTAMPTZ,
  can_host      BOOLEAN,
  mentor        BOOLEAN,
  mentor_bio    TEXT,
  experience    TEXT,
  years_out     INT,
  highest_m     INT,
  usual_days    TEXT[],
  carries       TEXT[],
  email_ok      BOOLEAN,
  is_customer   BOOLEAN,
  walks_hosted  BIGINT,
  walks_joined  BIGINT,
  vouches       BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    p.trek_display_name,
    p.trek_home_base,
    p.trek_intro,
    p.trek_pace,
    p.trek_activities,
    p.trek_languages,
    p.trek_terms_at,
    p.trek_can_host,
    p.trek_mentor,
    p.trek_mentor_bio,
    p.trek_experience,
    p.trek_years_out,
    p.trek_highest_m,
    p.trek_usual_days,
    p.trek_carries,
    EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id AND u.email_confirmed_at IS NOT NULL),
    EXISTS (SELECT 1 FROM orders o WHERE o.user_id = p.id AND o.status = 'delivered'),
    (SELECT count(*) FROM trek_plans t
      WHERE t.host_id = p.id AND t.starts_at < NOW() AND t.status <> 'cancelled'),
    (SELECT count(*) FROM trek_plan_requests r
      JOIN trek_plans t2 ON t2.id = r.plan_id
     WHERE r.user_id = p.id AND r.status = 'confirmed'
       AND t2.starts_at < NOW() AND t2.status <> 'cancelled'),
    (SELECT count(*) FROM trek_vouches v WHERE v.vouchee_id = p.id)
  FROM profiles p
  -- A suspended member is off the board: their profile stops resolving rather
  -- than rendering with an explanation, because "why is this person suspended"
  -- is not a question the board should answer to strangers.
  WHERE p.id = p_user
    AND p.trek_display_name IS NOT NULL
    AND p.trek_suspended_at IS NULL;
$$;

REVOKE ALL ON FUNCTION trek_person_card(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION trek_person_card(UUID) TO authenticated, service_role;

-- The people directory drops suspended members too, and surfaces mentors so
-- the browse page can lead with them.
DROP FUNCTION IF EXISTS trek_people(TEXT, TEXT, INT);

CREATE OR REPLACE FUNCTION trek_people(
  p_activity TEXT DEFAULT NULL,
  p_home     TEXT DEFAULT NULL,
  p_limit    INT  DEFAULT 60
)
RETURNS TABLE (
  user_id      UUID,
  display_name TEXT,
  home_base    TEXT,
  intro        TEXT,
  pace         TEXT,
  activities   TEXT[],
  languages    TEXT[],
  experience   TEXT,
  years_out    INT,
  mentor       BOOLEAN,
  can_host     BOOLEAN,
  member_since TIMESTAMPTZ,
  walks_hosted BIGINT,
  walks_joined BIGINT,
  vouches      BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    p.id, p.trek_display_name, p.trek_home_base, p.trek_intro, p.trek_pace,
    p.trek_activities, p.trek_languages, p.trek_experience, p.trek_years_out,
    p.trek_mentor, p.trek_can_host, p.trek_terms_at,
    (SELECT count(*) FROM trek_plans t
      WHERE t.host_id = p.id AND t.starts_at < NOW() AND t.status <> 'cancelled'),
    (SELECT count(*) FROM trek_plan_requests r
      JOIN trek_plans t2 ON t2.id = r.plan_id
     WHERE r.user_id = p.id AND r.status = 'confirmed'
       AND t2.starts_at < NOW() AND t2.status <> 'cancelled'),
    (SELECT count(*) FROM trek_vouches v WHERE v.vouchee_id = p.id)
  FROM profiles p
  WHERE p.trek_display_name IS NOT NULL
    AND p.trek_terms_at IS NOT NULL
    AND p.trek_suspended_at IS NULL
    AND (p_activity IS NULL OR p_activity = ANY(p.trek_activities))
    AND (p_home IS NULL OR p.trek_home_base = p_home)
    -- Mentors first, then people who have actually been out, then the newest.
    -- A directory ordered by signup date puts the emptiest profiles on top,
    -- which is the worst possible first impression of a board like this.
  ORDER BY p.trek_mentor DESC,
           (SELECT count(*) FROM trek_vouches v2 WHERE v2.vouchee_id = p.id) DESC,
           p.trek_terms_at DESC
  LIMIT COALESCE(p_limit, 60);
$$;

REVOKE ALL ON FUNCTION trek_people(TEXT, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION trek_people(TEXT, TEXT, INT) TO authenticated, service_role;
