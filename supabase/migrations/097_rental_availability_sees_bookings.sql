-- ---------------------------------------------------------------------------
-- 097 — availability has to be able to see the bookings it counts
-- ---------------------------------------------------------------------------
--
-- THE BUG
--
-- `rental_available_units` (096) answers "which units are free between these
-- dates" by checking `NOT EXISTS (... FROM rental_reservations ...)`. It was
-- created as a plain STABLE function, so it runs with the CALLER's privileges
-- and under the caller's RLS.
--
-- `rental_reservations` is row-level secured, and its only SELECT policy is
-- "Own reservations" for `authenticated`. An anonymous visitor therefore sees
-- ZERO reservation rows — so the NOT EXISTS was always true and the function
-- reported every unit free, always.
--
-- Caught by calling it with the anon key rather than the service role: four
-- units, two of them booked, and the shelf still said four. The storefront
-- would have advertised gear that was already out, and the only thing standing
-- between that and a double booking was the exclusion constraint firing at
-- checkout — a promise broken at the last possible moment instead of a shelf
-- that told the truth.
--
-- THE FIX
--
-- SECURITY DEFINER, so the function can count every reservation regardless of
-- who is asking — the same reason `is_profile_admin()` (063) is defined that
-- way. What makes this safe is what it returns: a unit id and the code written
-- on the tag. No customer, no dates, no booking. "Which tents are free" is the
-- shop window; "who has tent 3" stays private.
--
-- `search_path` is pinned, and EXECUTE is granted explicitly, because a
-- SECURITY DEFINER function with a mutable search_path is a privilege
-- escalation waiting to happen.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION rental_available_units(
  p_item_id UUID,
  p_start   DATE,
  p_end     DATE
)
RETURNS TABLE (unit_id UUID, code TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT u.id, u.code
    FROM rental_units u
    JOIN rental_items i ON i.id = u.item_id
   WHERE u.item_id = p_item_id
     AND i.is_active
     AND u.retired_at IS NULL
     AND u.condition IN ('good', 'fair')
     AND NOT EXISTS (
       SELECT 1
         FROM rental_reservations r
        WHERE r.unit_id = u.id
          AND r.status <> 'cancelled'
          AND r.period && daterange(p_start, (p_end + i.buffer_days + 1)::date, '[)')
     )
   ORDER BY u.code;
$$;

COMMENT ON FUNCTION rental_available_units IS
  'Units of an item free for a date range, cleaning buffer included. SECURITY DEFINER because reservations are RLS-protected and an anonymous caller must still get a truthful count — it returns only unit ids and tag codes, never who booked what.';

REVOKE ALL ON FUNCTION rental_available_units(UUID, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rental_available_units(UUID, DATE, DATE) TO anon, authenticated, service_role;
