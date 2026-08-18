-- ---------------------------------------------------------------------------
-- 065 — put the rung on the person card
-- ---------------------------------------------------------------------------
--
-- The ladder from 062 is enforced and settable, but invisible: a host looking
-- at somebody's card sees a vouch count and nothing about phone verification,
-- so the one screen where trust is actually weighed cannot show it.
--
-- Both functions must be dropped rather than replaced. Postgres will not let
-- CREATE OR REPLACE change a function's return type, and adding a column to
-- RETURNS TABLE is exactly that.
--
-- trek_trust_rung is called per row rather than the rung being stored. It reads
-- one already-fetched column and one indexed count, and a stored copy would be
-- a second source of truth to keep in step with every vouch.
DROP FUNCTION IF EXISTS trek_person_card(UUID);
DROP FUNCTION IF EXISTS trek_people(TEXT, TEXT, INT);

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
  vouches       BIGINT,
  trust_rung    SMALLINT
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
    (SELECT count(*) FROM trek_vouches v WHERE v.vouchee_id = p.id),
    trek_trust_rung(p.id)
  FROM profiles p
  -- A suspended member is off the board: their profile stops resolving rather
  -- than rendering with an explanation, because "why is this person suspended"
  -- is not a question the board should answer to strangers.
  WHERE p.id = p_user
    AND p.trek_display_name IS NOT NULL
    AND p.trek_suspended_at IS NULL;
$$;
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
  vouches      BIGINT,
  trust_rung   SMALLINT
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
    (SELECT count(*) FROM trek_vouches v WHERE v.vouchee_id = p.id),
    trek_trust_rung(p.id)
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
-- ---------------------------------------------------------------------------
-- Grants, which the DROP above threw away
-- ---------------------------------------------------------------------------
-- Both of these are SECURITY DEFINER and read profiles. A freshly created
-- function is EXECUTE-able by PUBLIC unless told otherwise, so recreating them
-- without this block silently handed every profile back to `anon` — exactly the
-- hole 063 had just closed, reopened through a different door. Verified after
-- writing it: has_function_privilege('anon', ...) was true until this ran.
-- FROM anon, not just FROM PUBLIC, and this distinction is the whole point.
-- Supabase ships ALTER DEFAULT PRIVILEGES granting EXECUTE on new functions to
-- anon by name, so every function is created with an explicit `anon=X` entry in
-- its ACL. REVOKE ... FROM PUBLIC removes the PUBLIC entry and leaves that one
-- untouched, which means the REVOKE-from-PUBLIC written in 059 never did
-- anything and these functions have been anon-callable since the day they were
-- made. Checked in pg_proc.proacl rather than assumed.
REVOKE ALL ON FUNCTION trek_person_card(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION trek_person_card(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION trek_people(TEXT, TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION trek_people(TEXT, TEXT, INT) TO authenticated, service_role;

-- Same treatment for the rung helper added in 062, which has the same exposure.
REVOKE ALL ON FUNCTION trek_trust_rung(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION trek_trust_rung(UUID) TO authenticated, service_role;

-- The superseded single-argument version from 054. It has sat beside the 059
-- one ever since, which made a bare trek_people() ambiguous — "could not choose
-- a best candidate function". The application always passes all three named
-- arguments so it never hit this, but it is dead and it is a trap.
DROP FUNCTION IF EXISTS trek_people(INT);
