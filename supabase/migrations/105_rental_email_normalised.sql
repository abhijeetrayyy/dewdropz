-- Guest rentals are claimed by matching the account's verified address against
-- rental_bookings.email. That match is `.eq` in SQL — it used to be `.ilike`,
-- which treated `%` and `_` as wildcards and turned the claim into a
-- take-every-booking-in-the-database endpoint (see lib/rentalClaim.ts).
--
-- `.eq` is the right comparison and it is case-sensitive, so the column has to
-- be normalised or a booking made by somebody who capitalised their address can
-- never be claimed by the account that made it. The schema now lowercases on
-- write; this backfills what is already there.
--
-- Idempotent and cheap: the WHERE clause means a second run touches nothing.
UPDATE rental_bookings
   SET email = lower(btrim(email))
 WHERE email <> lower(btrim(email));

-- Belt, so a future writer that bypasses the zod schema cannot reintroduce it.
ALTER TABLE rental_bookings DROP CONSTRAINT IF EXISTS rental_bookings_email_normalised;
ALTER TABLE rental_bookings ADD CONSTRAINT rental_bookings_email_normalised
  CHECK (email = lower(btrim(email)));
