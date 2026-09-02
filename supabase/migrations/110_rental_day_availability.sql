-- ---------------------------------------------------------------------------
-- 110 — the shelf, before you commit to it
-- ---------------------------------------------------------------------------
--
-- WHAT IS MISSING
--
-- `rental_available_units` (096, fixed in 097) answers exactly one question:
-- "which units of THIS item are free between THESE two dates". It is the right
-- function and it is the only one, so both storefronts are pick-then-find-out —
-- a person chooses an item, chooses dates, and is told after the fact that
-- there is nothing free. `/rent/terms` used to promise a calendar. There was
-- none.
--
-- Two more questions need answering, and neither can be assembled from the
-- existing function without N round trips:
--
--   · "which of these SEVEN ITEMS are free for my dates" — one call, so the
--     locker grid can report its own shelf on every card. Calling the existing
--     function once per item is seven round trips from the browser to answer
--     one question, and it gets worse as the catalogue grows.
--
--   · "which DAYS in this month is this item free" — so the date picker shows
--     the answer instead of refusing afterwards.
--
-- SECURITY, WHICH IS THE SAME ARGUMENT 097 MADE
--
-- `rental_reservations` is RLS-protected and its only SELECT policy is "Own
-- reservations" for `authenticated`. An anonymous visitor sees zero rows, so
-- any count computed under the caller's privileges reports everything free,
-- always — the exact bug 097 was written to fix. Both functions below are
-- therefore SECURITY DEFINER with a pinned `search_path`.
--
-- What makes that safe is what they RETURN: a count. No customer, no booking,
-- no dates of anybody else's hire, not even the unit codes 097 returns. "How
-- many tents are free on the 14th" is the shop window. "Who has tent 3" stays
-- private, and is not derivable from either result.
--
-- WHAT "FREE" MEANS, AND WHY THE TWO DIFFER
--
-- The RANGE function asks whether a unit is free for the whole hire, buffer
-- included, so it must match `rental_available_units` exactly or the grid and
-- the checkout would be two opinions about the same shelf. It widens the window
-- by the item's buffer, like 096 does.
--
-- The DAY function asks whether a unit is occupied on a given day, and it does
-- NOT widen: `period` already carries the buffer (096 half-open
-- [start, end+buffer+1)), so a unit due back on the 10th with a day's drying
-- shows held through the 11th and free on the 12th. Widening again would
-- double-count it. A day shown free is a day the unit is genuinely on the shelf.
-- ---------------------------------------------------------------------------

-- ── Every item, one date range ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION rental_items_availability(
  p_start DATE,
  p_end   DATE
)
RETURNS TABLE (item_id UUID, free_units INT, total_units INT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    i.id,
    COUNT(*) FILTER (
      WHERE u.id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
            FROM rental_reservations r
           WHERE r.unit_id = u.id
             AND r.status <> 'cancelled'
             AND r.period && daterange(p_start, (p_end + i.buffer_days + 1)::date, '[)')
        )
    )::INT AS free_units,
    COUNT(u.id)::INT AS total_units
  FROM rental_items i
  -- LEFT JOIN, so an item with no serviceable units still returns a row saying
  -- 0 of 0 rather than vanishing from the result. A card that disappears from
  -- the grid when dates are picked reads as a bug; "none free" reads as an
  -- answer, and the storefront needs to be able to tell them apart.
  LEFT JOIN rental_units u
    ON u.item_id = i.id
   AND u.retired_at IS NULL
   AND u.condition IN ('good', 'fair')
  WHERE i.is_active
  GROUP BY i.id;
$$;

COMMENT ON FUNCTION rental_items_availability IS
  'Free and total serviceable units for every active item over one date range, cleaning buffer included — the same predicate as rental_available_units, so the grid and the checkout cannot disagree. SECURITY DEFINER for the reason 097 documents; returns counts only.';

REVOKE ALL ON FUNCTION rental_items_availability(DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rental_items_availability(DATE, DATE) TO anon, authenticated, service_role;

-- ── One item, every day ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION rental_item_day_availability(
  p_item_id UUID,
  p_from    DATE,
  p_to      DATE
)
RETURNS TABLE (day DATE, free_units INT, total_units INT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH days AS (
    -- Bounded at 400 days so a hand-built query string cannot ask for a
    -- century of calendar and hold a connection open generating it. A month
    -- grid asks for about 42.
    SELECT d::date AS day
      FROM generate_series(p_from, LEAST(p_to, (p_from + 400)::date), INTERVAL '1 day') AS d
  ),
  units AS (
    SELECT u.id
      FROM rental_units u
      JOIN rental_items i ON i.id = u.item_id
     WHERE u.item_id = p_item_id
       AND i.is_active
       AND u.retired_at IS NULL
       AND u.condition IN ('good', 'fair')
  )
  SELECT
    days.day,
    COUNT(*) FILTER (
      WHERE NOT EXISTS (
        SELECT 1
          FROM rental_reservations r
         WHERE r.unit_id = units.id
           AND r.status <> 'cancelled'
           -- `period` already includes the buffer, so containment is the whole
           -- test. No second widening — see the header.
           AND r.period @> days.day
      )
    )::INT AS free_units,
    COUNT(units.id)::INT AS total_units
  FROM days
  -- CROSS JOIN, so every requested day appears in the result even for an item
  -- with no units. A calendar with holes in it is unreadable; a calendar of
  -- zeroes is an answer.
  LEFT JOIN units ON TRUE
  GROUP BY days.day
  ORDER BY days.day;
$$;

COMMENT ON FUNCTION rental_item_day_availability IS
  'Per-day free and total unit counts for one item — what the storefront date picker draws. Counts only, never who booked what. The buffer is not applied twice: reservations.period already carries it.';

REVOKE ALL ON FUNCTION rental_item_day_availability(UUID, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rental_item_day_availability(UUID, DATE, DATE) TO anon, authenticated, service_role;
