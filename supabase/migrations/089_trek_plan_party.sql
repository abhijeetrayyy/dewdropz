-- ─────────────────────────────────────────────────────────────────────────────
-- 089 · WHO ELSE IS GOING
--
-- THIS MIGRATION WIDENS A READ. Read the whole header before changing it.
--
-- WHAT IT EXPOSES, exactly:
--   To a signed-in, onboarded member, for one open plan:
--     · the FIRST TOKEN of the display name of each CONFIRMED walker
--     · that person's trust rung (0, 1, 2)
--     · whether they run the walk (host or co-host)
--
-- WHAT IT DOES NOT EXPOSE, and must never be edited to:
--   · user_id — not in the return type. This is the single most important line
--     in the file. An id is a join key: with one, a caller can walk to a person
--     page, to their other walks, to their vouches. Without one, this is a
--     description of a party and not a directory of people to approach, which
--     is the distinction app/trek-buddy/people/[id]/page.tsx promises in prose
--     and 052 promises in policy.
--   · surnames — `split_part(name, ' ', 1)`. "Ananya" tells you the group has
--     a woman named Ananya in it. "Ananya Rawat" is a search term.
--   · anybody who merely ASKED. Confirmed only. 052's own policy already says
--     why: "a queue everybody can read is a queue that can be used to work out
--     who was turned down."
--   · the meeting point, or anything from trek_plan_details. Not selected here
--     and not reachable from here.
--
-- WHAT IS ACTUALLY NEW, because most of this is already readable.
--   052's SELECT policy on trek_plan_requests already lets the confirmed party
--   see each other: `status = 'confirmed' AND trek_is_on_plan(plan_id)`. So a
--   person who has been confirmed can already learn who else is going.
--
--   The one who cannot is the person DECIDING WHETHER TO ASK. That is the whole
--   gap this closes, and it is the worst possible place to have it: the product
--   argues on its own landing page that it is somewhere a woman can weigh up "a
--   4am shared cab with five strangers" and somewhere a person in their sixties
--   can go without being left behind. Both are judgements about who else is in
--   the car, and the board was withholding that until after the commitment. The
--   full roster stays the host's alone — names, ids, messages, pending asks —
--   because that is a list of people to contact. This is a description of a
--   group: how many, what they are called, whether anybody has been vouched for.
--
--   It is deliberately NOT the roster with columns dropped. It is a separate
--   function with its own return type, so a future edit to the roster cannot
--   leak into it and an edit to this cannot widen the roster.
--
-- THE HOST IS NOT A ROW IN trek_plan_requests. `going_count` is
-- `confirmed_count + 1` (052:239), the +1 being the host — so a query over
-- requests alone returns a party with the one person you most want to know
-- about missing. They are unioned in from trek_plans.
--
-- STABLE, not VOLATILE: it writes nothing. SECURITY DEFINER because
-- trek_plan_requests must not gain a SELECT policy for people who are not on
-- the walk — the point is that this function, and only this function, is the
-- door for somebody who has not joined yet.
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS trek_plan_party(UUID, UUID);

CREATE OR REPLACE FUNCTION trek_plan_party(p_plan UUID, p_actor UUID DEFAULT NULL)
RETURNS TABLE (
  first_name  TEXT,
  trust_rung  SMALLINT,
  runs_it     BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user UUID := trek_actor(p_actor);
BEGIN
  -- The same gate every other read passes: onboarded, adult, terms accepted.
  -- Somebody who has not finished setup has no business reading a party list.
  PERFORM trek_require_member(v_user);

  -- A cancelled or hidden walk hands over nobody. There is no reason to learn
  -- who was going to a walk that is no longer on the board.
  IF NOT EXISTS (
    SELECT 1 FROM trek_plans
     WHERE id = p_plan AND status = 'open' AND hidden_at IS NULL
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH party AS (
    -- The host, who has no request row of their own.
    SELECT p.host_id AS uid, p.host_name AS name, 0 AS ord, NULL::TIMESTAMPTZ AS at
      FROM trek_plans p
     WHERE p.id = p_plan

    UNION

    -- Everybody the host confirmed. Co-hosts appear here too and are marked by
    -- `runs_it` rather than by being listed separately.
    SELECT r.user_id, r.display_name, 1 AS ord, COALESCE(r.decided_at, r.created_at)
      FROM trek_plan_requests r
     WHERE r.plan_id = p_plan
       AND r.status = 'confirmed'
  )
  SELECT
    -- First token only, and btrim first so a leading space cannot yield ''.
    -- COALESCE keeps a row with an unusable name from vanishing and quietly
    -- undercounting the party.
    COALESCE(NULLIF(split_part(btrim(party.name), ' ', 1), ''), 'A walker')::TEXT,
    trek_trust_rung(party.uid),
    trek_can_manage(p_plan, party.uid)
  FROM party
  -- Whoever runs it first, then longest-standing confirmations. NOT ordered by
  -- anything that could be read back as an id.
  ORDER BY party.ord, party.at NULLS FIRST;
END $$;

COMMENT ON FUNCTION trek_plan_party(UUID, UUID) IS
  'Confirmed walkers on one open plan, as first names and trust rungs, for a member deciding whether to ask. Never returns user_id, surnames, pending requests, or anything from trek_plan_details. Read 089 before widening.';

REVOKE ALL ON FUNCTION trek_plan_party(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION trek_plan_party(UUID, UUID) TO authenticated;
