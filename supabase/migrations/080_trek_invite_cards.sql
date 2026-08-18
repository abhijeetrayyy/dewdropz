-- ---------------------------------------------------------------------------
-- 080 — invite cards
-- ---------------------------------------------------------------------------
--
-- The design's share screen is a page at /e/<slug> that somebody who is not a
-- member can open: "You have been invited", the walk, and a button to come and
-- ask. Today nothing about a walk is visible signed out — the whole board
-- redirects to sign-in — so this is a change of posture, not a new template,
-- and it is built to be the smallest version of that change.
--
-- OPT-IN PER WALK, NOT A PUBLIC PAGE FOR EVERYTHING. The design implies every
-- event has a public URL. That would make the place, date, host and party size
-- of every walk on the board readable by anybody who can guess or obtain an id
-- — including women-only walks, which are the ones the rest of this system
-- works hardest to protect. Instead a host mints a token when they want to
-- invite somebody, and the page exists only while that token does.
--
-- REVOCABLE, because a link sent to one person ends up in a group. Revoking
-- makes the old URL a 404 immediately.
--
-- The token is random rather than derived from the walk. A slug like
-- "e1-nag-tibba-sunrise-push" is guessable from the board, which would make the
-- opt-in decorative.

ALTER TABLE trek_plans ADD COLUMN IF NOT EXISTS share_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trek_plans_share_token
  ON trek_plans(share_token) WHERE share_token IS NOT NULL;

COMMENT ON COLUMN trek_plans.share_token IS
  'Null until the host mints one. While set, /e/<token> is readable by anybody holding the link; setting it back to null makes that URL a 404.';

CREATE OR REPLACE FUNCTION trek_share_token(p_plan UUID, p_actor UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor UUID := trek_actor(p_actor);
  v_plan  trek_plans;
  v_tok   TEXT;
BEGIN
  SELECT * INTO v_plan FROM trek_plans WHERE id = p_plan;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such walk' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_plan.host_id <> v_actor THEN
    RAISE EXCEPTION 'only the host can share a walk' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_plan.status <> 'open' OR v_plan.hidden_at IS NOT NULL THEN
    RAISE EXCEPTION 'that walk is not taking anyone' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_plan.share_token IS NOT NULL THEN
    RETURN v_plan.share_token;
  END IF;

  -- 32 hex characters from a v4 UUID: 122 bits of randomness, url-safe by
  -- construction, and short enough to survive being pasted into a message.
  -- gen_random_uuid is core Postgres; gen_random_bytes is pgcrypto, which is
  -- not on the search path here.
  v_tok := replace(gen_random_uuid()::text, '-', '');
  UPDATE trek_plans SET share_token = v_tok WHERE id = p_plan;
  RETURN v_tok;
END $$;

CREATE OR REPLACE FUNCTION trek_revoke_share(p_plan UUID, p_actor UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_actor UUID := trek_actor(p_actor);
BEGIN
  UPDATE trek_plans SET share_token = NULL
   WHERE id = p_plan AND host_id = v_actor;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'only the host can stop sharing a walk' USING ERRCODE = 'insufficient_privilege';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- What a stranger holding the link may see
-- ---------------------------------------------------------------------------
-- An explicit column list, not SELECT *. The meeting point is in another table
-- and could not arrive here by accident, but the next person to add a column to
-- trek_plans should have to decide to put it on this page rather than have it
-- appear because the function was written lazily.
CREATE OR REPLACE FUNCTION trek_invite_card(p_token TEXT)
RETURNS TABLE (
  place        TEXT,
  activity     TEXT,
  host_name    TEXT,
  starts_at    TIMESTAMPTZ,
  start_time   TIME,
  note         TEXT,
  difficulty   TEXT,
  spots_left   INT,
  capacity     INT,
  cost_paise   INT,
  distance_km  NUMERIC,
  gain_m       INT,
  cover_urls   TEXT[],
  women_only   BOOLEAN,
  meet_area    TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.place, p.activity, p.host_name, p.starts_at, p.start_time, p.note,
         p.difficulty, p.spots_left, p.capacity, p.cost_paise, p.distance_km,
         p.gain_m, p.cover_urls, p.women_only, p.meet_area
    FROM trek_plans p
   WHERE p.share_token = p_token
     AND p.status = 'open'
     AND p.hidden_at IS NULL
     -- A walk that has left is not an invitation. The link going dead by itself
     -- means a card forwarded weeks later shows nothing rather than a place and
     -- a time somebody might turn up to.
     AND p.starts_at > NOW();
$$;

-- The only Trek Buddy function anon may call, and the reason is the whole
-- point: the page is for people who do not have an account yet.
REVOKE ALL ON FUNCTION trek_invite_card(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION trek_invite_card(TEXT) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION trek_share_token(UUID, UUID)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION trek_revoke_share(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION trek_share_token(UUID, UUID)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION trek_revoke_share(UUID, UUID) TO authenticated, service_role;
