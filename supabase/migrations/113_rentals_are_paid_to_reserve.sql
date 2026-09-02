-- ---------------------------------------------------------------------------
-- 113 — a reservation is something you have paid for
-- ---------------------------------------------------------------------------
--
-- THE CHANGE
--
-- Until now a booking was an agreement with no money attached: `status` went
-- straight to 'reserved', `payment_status` stayed 'unpaid', and the rent was
-- settled face to face at handover. The shop now requires the rent to be paid,
-- through the gateway, before any gear is held.
--
-- THE STATE THAT DID NOT EXIST, AND WHY IT HAS TO
--
-- "Pay first" cannot mean "write the booking only after the payment clears".
-- Between opening a payment sheet and a bank one-time password arriving, thirty
-- seconds to two minutes pass — and during that time the units MUST be held,
-- or two people pay for the same last tent and one of them gets a refund and an
-- apology instead of a holiday.
--
-- So the booking is written first, holding its units through the same exclusion
-- constraint everything else uses, in a new state: `pending_payment`. It is not
-- a reservation. It is a claim on the shelf with a deadline.
--
--   pending_payment ──paid──> reserved ──> out ──> returned ──> closed
--         │
--         └──expired / abandoned──> cancelled
--
-- THE DEADLINE IS THE WHOLE DESIGN. Without `hold_expires_at`, an abandoned
-- checkout holds a tent until somebody notices — and because the exclusion
-- constraint is doing its job, that unit is genuinely, permanently unbookable.
-- A pay-to-reserve flow without an expiry is a denial-of-inventory feature.
--
-- AND AN EXPIRED HOLD IS NOT A HOLD. The availability functions are rewritten
-- below to ignore reservations belonging to a pending booking whose deadline
-- has passed, so the storefront tells the truth the moment a hold dies rather
-- than at whatever moment a sweep happens to run. The sweep still exists — the
-- exclusion constraint reads the table, not the view of it these functions
-- take, so the rows must actually be cancelled before the unit can be booked
-- again. `createRentalBooking` releases expired holds before it checks the
-- shelf, and the cron catches whatever is left.
--
-- WHY NOT MAKE THE EXCLUSION CONSTRAINT ITSELF IGNORE EXPIRED HOLDS: it tests
-- columns on `rental_reservations`, and the deadline belongs to the booking.
-- Denormalising the deadline onto every reservation row to satisfy a constraint
-- would put the same timestamp in two places, which is how `period` became
-- three hand-written strings.
-- ---------------------------------------------------------------------------

-- ── The new state ──────────────────────────────────────────────────────────

ALTER TABLE rental_bookings DROP CONSTRAINT IF EXISTS rental_bookings_status_check;
ALTER TABLE rental_bookings ADD CONSTRAINT rental_bookings_status_check
  CHECK (status IN ('pending_payment', 'reserved', 'out', 'returned', 'closed', 'cancelled'));

ALTER TABLE rental_bookings
  ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN rental_bookings.hold_expires_at IS
  'When an unpaid hold stops holding. Set on creation, cleared when the rent is paid. NULL on a paid booking — a reservation that has been paid for does not expire.';

-- A hold with no deadline is the failure this column exists to prevent, so it
-- is refused rather than merely discouraged.
ALTER TABLE rental_bookings DROP CONSTRAINT IF EXISTS rental_bookings_hold_has_deadline;
ALTER TABLE rental_bookings ADD CONSTRAINT rental_bookings_hold_has_deadline
  CHECK (status <> 'pending_payment' OR hold_expires_at IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_rental_bookings_expiring
  ON rental_bookings (hold_expires_at)
  WHERE status = 'pending_payment';

-- ── The cancellation, as a record rather than a status ─────────────────────
--
-- `status = 'cancelled'` says a booking ended. It does not say who ended it,
-- when, why, or what went back — and every one of those is a question somebody
-- asks three months later with a bank statement in front of them.
--
-- `cancelled_by` matters most. The refund policy returns EVERYTHING when the
-- shop cancels and applies notice bands when the customer does, and until this
-- column existed the code could not tell the two apart: an admin calling off a
-- booking the night before, because a tent came back damaged, applied the
-- customer's band and the shop kept three quarters of their money. The shop
-- must never profit from its own failure.

ALTER TABLE rental_bookings
  ADD COLUMN IF NOT EXISTS cancelled_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by        TEXT
    CHECK (cancelled_by IS NULL OR cancelled_by IN ('customer', 'shop', 'expired')),
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  -- Stored rather than derived. Deriving it would mean re-running the bands at
  -- read time against a `today` that has moved, so a booking cancelled with a
  -- fortnight's notice would start reporting a smaller refund as the hire date
  -- passed. What went back is a fact about a day, not a function of now.
  ADD COLUMN IF NOT EXISTS rent_refunded       INT NOT NULL DEFAULT 0 CHECK (rent_refunded >= 0);

COMMENT ON COLUMN rental_bookings.cancelled_by IS
  '''customer'' pays the notice bands; ''shop'' is always refunded in full, because the shop must not profit from its own cancellation; ''expired'' is an unpaid hold that timed out, where no money ever moved.';

-- ── Partly refunded is a real state ────────────────────────────────────────
--
-- The bands return a share of the rent, so 'refunded' — which reads as "all of
-- it" — was being written for a booking where three quarters came back and a
-- quarter did not. An operator reconciling a statement cannot tell those apart,
-- and neither can the customer.

ALTER TABLE rental_bookings DROP CONSTRAINT IF EXISTS rental_bookings_payment_status_check;
ALTER TABLE rental_bookings ADD CONSTRAINT rental_bookings_payment_status_check
  CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'refunded', 'part_refunded', 'failed'));

-- You cannot give back more rent than was taken.
ALTER TABLE rental_bookings DROP CONSTRAINT IF EXISTS rental_bookings_rent_refund_sane;
ALTER TABLE rental_bookings ADD CONSTRAINT rental_bookings_rent_refund_sane
  CHECK (rent_refunded <= total_amount);

-- ── Availability: an expired hold is not a hold ────────────────────────────
--
-- All three functions gain the same predicate, and it is written the same way
-- in each so that a future change is a search-and-replace rather than an
-- archaeology exercise. `rental_available_units` is the one the BOOKING WRITE
-- calls, so it and the storefront cannot disagree about what a dead checkout
-- means.

CREATE OR REPLACE FUNCTION rental_reservation_is_live(p_booking_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM rental_bookings b
     WHERE b.id = p_booking_id
       AND b.status = 'pending_payment'
       AND b.hold_expires_at < NOW()
  );
$$;

COMMENT ON FUNCTION rental_reservation_is_live IS
  'False for a reservation belonging to an unpaid hold whose deadline has passed. Availability must ignore those the moment they die, not whenever the sweep next runs.';

REVOKE ALL ON FUNCTION rental_reservation_is_live(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rental_reservation_is_live(UUID) TO anon, authenticated, service_role;

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
          AND rental_reservation_is_live(r.booking_id)
          AND r.period && daterange(p_start, (p_end + i.buffer_days + 1)::date, '[)')
     )
   ORDER BY u.code;
$$;

REVOKE ALL ON FUNCTION rental_available_units(UUID, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rental_available_units(UUID, DATE, DATE) TO anon, authenticated, service_role;

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
             AND rental_reservation_is_live(r.booking_id)
             AND r.period && daterange(p_start, (p_end + i.buffer_days + 1)::date, '[)')
        )
    )::INT AS free_units,
    COUNT(u.id)::INT AS total_units
  FROM rental_items i
  LEFT JOIN rental_units u
    ON u.item_id = i.id
   AND u.retired_at IS NULL
   AND u.condition IN ('good', 'fair')
  WHERE i.is_active
  GROUP BY i.id;
$$;

REVOKE ALL ON FUNCTION rental_items_availability(DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rental_items_availability(DATE, DATE) TO anon, authenticated, service_role;

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
           AND rental_reservation_is_live(r.booking_id)
           AND r.period @> days.day
      )
    )::INT AS free_units,
    COUNT(units.id)::INT AS total_units
  FROM days
  LEFT JOIN units ON TRUE
  GROUP BY days.day
  ORDER BY days.day;
$$;

REVOKE ALL ON FUNCTION rental_item_day_availability(UUID, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rental_item_day_availability(UUID, DATE, DATE) TO anon, authenticated, service_role;

-- ── Releasing what has died ────────────────────────────────────────────────
--
-- One function, called from the booking write (so a customer never loses a
-- tent to somebody else's abandoned checkout) and from the cron (so holds do
-- not accumulate on a quiet day). Idempotent, bounded, and it cancels the
-- reservations as well as the booking — cancelling only the booking would
-- leave the exclusion constraint still holding the unit, which is the whole
-- thing this is for.

CREATE OR REPLACE FUNCTION release_expired_rental_holds(p_limit INT DEFAULT 200)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  ids UUID[];
BEGIN
  SELECT ARRAY(
    SELECT b.id FROM rental_bookings b
     WHERE b.status = 'pending_payment'
       AND b.hold_expires_at < NOW()
     ORDER BY b.hold_expires_at
     LIMIT GREATEST(p_limit, 0)
     -- Two sweeps running at once — the cron and a booking write — must not
     -- both claim the same holds and write the same events twice.
     FOR UPDATE SKIP LOCKED
  ) INTO ids;

  IF array_length(ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  -- Reservations first: this is what actually frees the shelf, because the
  -- exclusion constraint ignores cancelled rows.
  UPDATE rental_reservations SET status = 'cancelled' WHERE booking_id = ANY(ids);

  UPDATE rental_bookings
     SET status = 'cancelled',
         cancelled_at = NOW(),
         cancelled_by = 'expired',
         cancellation_reason = 'The payment was not completed in time, so the gear went back on the shelf.'
   WHERE id = ANY(ids);

  INSERT INTO rental_events (booking_id, kind, note)
  SELECT id, 'cancelled', 'Hold expired before payment — no money was taken.'
    FROM unnest(ids) AS id;

  RETURN array_length(ids, 1);
END;
$$;

COMMENT ON FUNCTION release_expired_rental_holds IS
  'Cancels unpaid holds past their deadline and frees their units. Called by the booking write before it checks the shelf, and by the reminder cron. SKIP LOCKED so two callers never claim the same holds.';

REVOKE ALL ON FUNCTION release_expired_rental_holds(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION release_expired_rental_holds(INT) TO service_role;

-- ── Existing rows ──────────────────────────────────────────────────────────
--
-- Every booking taken before this migration was made under the old promise:
-- reserve now, pay at the counter. Retroactively demanding payment from those
-- customers, or expiring their bookings out from under them, would be changing
-- a deal after it was struck. They keep the reservation they were given, and
-- the counter-payment path stays available for exactly this cohort.

UPDATE rental_bookings
   SET hold_expires_at = NULL
 WHERE status <> 'pending_payment';
