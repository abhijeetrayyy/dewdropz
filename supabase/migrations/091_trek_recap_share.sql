-- ─────────────────────────────────────────────────────────────────────────────
-- 091 · A WALK THAT HAPPENED, AS SOMETHING YOU CAN SEND SOMEBODY
--
-- The board's hardest problem is proving anybody turns up (078's words). Every
-- other surface is a promise about the future — a plan, a seat count, a
-- countdown — and any of it could have been posted by somebody who never left
-- the house. A recap is the only object here that could not, and until now it
-- rendered in exactly two places, both of them behind a sign-in wall.
--
-- So the one genuinely persuasive thing this product makes was the one thing
-- nobody could show anybody.
--
-- WHAT THIS IS NOT: it is not making recaps public. Nothing becomes readable
-- because it exists. A confirmed walker mints a token when they want to send
-- one to somebody, exactly as 080 did for invite cards, and the page exists
-- only while that token does.
--
-- WHO MAY MINT, and why it is wider than 080. The invite card is an invitation
-- to a future event, so only the host may extend it. A recap is a record of a
-- day that a group had together — the host has no better claim on it than
-- anybody who was there. So any CONFIRMED walker may mint, and any of them may
-- revoke. The host is included by `trek_can_manage`.
--
-- WHAT A STRANGER HOLDING THE LINK SEES:
--   the place, the date, the hour band, distance, climb, difficulty,
--   the host's display name, how many went, the recap's words and photographs,
--   and the FIRST NAMES of the party.
--
-- WHAT THEY NEVER SEE, and what the column list here is for:
--   · the meeting point — in another table, not selectable from here
--   · any user id, including the host's — a share page is not a route into
--     the member directory
--   · surnames — same `split_part` rule as 089
--   · anything about a walk that has not happened yet
--
-- AN EXPLICIT COLUMN LIST, NOT `SELECT *`, for 080's reason: the next person to
-- add a column to trek_plans should have to decide to put it on a page a
-- stranger can read, rather than have it appear because this was written lazily.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE trek_recaps ADD COLUMN IF NOT EXISTS share_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trek_recaps_share_token
  ON trek_recaps(share_token) WHERE share_token IS NOT NULL;

COMMENT ON COLUMN trek_recaps.share_token IS
  'Null until somebody who was on the walk mints one. While set, /w/<token> is readable by anybody holding the link; setting it back to null makes that URL a 404.';

-- ---------------------------------------------------------------------------
-- Minting and revoking
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trek_recap_share_token(p_plan UUID, p_actor UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor UUID := trek_actor(p_actor);
  v_tok   TEXT;
  v_on    BOOLEAN;
BEGIN
  PERFORM trek_require_member(v_actor);

  IF NOT EXISTS (SELECT 1 FROM trek_recaps WHERE plan_id = p_plan) THEN
    RAISE EXCEPTION 'there is no recap for that walk yet' USING ERRCODE = 'no_data_found';
  END IF;

  -- Anybody who was confirmed on it, plus whoever runs it.
  SELECT trek_can_manage(p_plan, v_actor)
      OR EXISTS (SELECT 1 FROM trek_plan_requests r
                  WHERE r.plan_id = p_plan AND r.user_id = v_actor AND r.status = 'confirmed')
    INTO v_on;

  IF NOT COALESCE(v_on, false) THEN
    RAISE EXCEPTION 'only somebody who was on the walk can share its recap'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT share_token INTO v_tok FROM trek_recaps WHERE plan_id = p_plan;
  IF v_tok IS NOT NULL THEN
    RETURN v_tok;
  END IF;

  -- Same shape as 080: 32 hex characters from a v4 UUID — 122 bits, url-safe
  -- by construction, short enough to paste into a message.
  v_tok := replace(gen_random_uuid()::text, '-', '');
  UPDATE trek_recaps SET share_token = v_tok WHERE plan_id = p_plan;
  RETURN v_tok;
END $$;

REVOKE ALL ON FUNCTION trek_recap_share_token(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION trek_recap_share_token(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION trek_revoke_recap_share(p_plan UUID, p_actor UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor UUID := trek_actor(p_actor);
  v_on    BOOLEAN;
BEGIN
  SELECT trek_can_manage(p_plan, v_actor)
      OR EXISTS (SELECT 1 FROM trek_plan_requests r
                  WHERE r.plan_id = p_plan AND r.user_id = v_actor AND r.status = 'confirmed')
    INTO v_on;

  IF NOT COALESCE(v_on, false) THEN
    RAISE EXCEPTION 'only somebody who was on the walk can stop sharing its recap'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE trek_recaps SET share_token = NULL WHERE plan_id = p_plan;
END $$;

REVOKE ALL ON FUNCTION trek_revoke_recap_share(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION trek_revoke_recap_share(UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- What a stranger holding the link may see
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trek_recap_card(p_token TEXT)
RETURNS TABLE (
  place        TEXT,
  activity     TEXT,
  host_name    TEXT,
  starts_at    TIMESTAMPTZ,
  start_time   TIME,
  difficulty   TEXT,
  distance_km  NUMERIC,
  gain_m       INT,
  went         INT,
  body         TEXT,
  photo_urls   TEXT[],
  written_at   TIMESTAMPTZ,
  party        TEXT[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.place, p.activity, p.host_name, p.starts_at, p.start_time,
         p.difficulty, p.distance_km, p.gain_m, p.going_count,
         r.body, r.photo_urls, r.created_at,
         -- First names only, host first, same rule as 089. No ids.
         ARRAY(
           SELECT COALESCE(NULLIF(split_part(btrim(n), ' ', 1), ''), 'A walker')
             FROM (
               SELECT p.host_name AS n, 0 AS ord
               UNION ALL
               SELECT q.display_name, 1
                 FROM trek_plan_requests q
                WHERE q.plan_id = p.id AND q.status = 'confirmed'
             ) s
            ORDER BY s.ord
         )
    FROM trek_recaps r
    JOIN trek_plans p ON p.id = r.plan_id
   WHERE r.share_token = p_token
     -- A recap can only exist for a walk that has finished (078's trigger), but
     -- a cancelled or hidden walk still hands over nothing.
     AND p.hidden_at IS NULL
   LIMIT 1;
$$;

-- Readable by a signed-out visitor holding the token, which is the entire point
-- — and the reason the column list above has no id in it.
REVOKE ALL ON FUNCTION trek_recap_card(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION trek_recap_card(TEXT) TO anon, authenticated;

COMMENT ON FUNCTION trek_recap_card(TEXT) IS
  'One shared recap, for a signed-out visitor holding the token. Never returns a user id, a surname, or the meeting point. Read 091 before adding a column.';
