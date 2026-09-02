-- ---------------------------------------------------------------------------
-- 111 — `period` becomes a fact the database computes
-- ---------------------------------------------------------------------------
--
-- 096:174 already states the correct design, in the schema, as a comment:
--
--     "Half-open [start, end+buffer+1) so the cleaning window is part of the
--      same range the exclusion constraint tests — it cannot be forgotten by a
--      caller because no caller writes it."
--
-- It was never implemented. `period` is `NOT NULL` with no default and no
-- trigger, so every caller writes it, by hand, as a template string:
--
--     actions/rentals.ts:533   `[${line.startsOn},${addDays(line.endsOn, item.buffer_days + 1)})`
--     actions/rentals.ts:1100  `[${r.starts_on},${end})`
--
-- WHY THIS MATTERS MORE THAN IT LOOKS
--
-- `rental_no_double_booking` — the exclusion constraint that makes overbooking
-- unreachable, the single strongest guarantee in the rental system — tests
-- `period` AND NOTHING ELSE. It does not look at starts_on, ends_on, or the
-- item's buffer. So the constraint is only as correct as the two string
-- concatenations above. A caller that forgets the `+ 1`, drops the buffer, or
-- writes an inclusive `]` produces a row that passes every CHECK, satisfies the
-- exclusion constraint, and double-books a tent.
--
-- WHY NOW
--
-- Four reservations exist. Backfilling is four rows. This is the cheapest it
-- will ever be, and it gets more expensive every week the shop trades.
--
-- THE INTERACTION THAT HAD TO SHIP IN THE SAME COMMIT
--
-- `returnBooking` frees the shelf by writing a NARROWED period when gear comes
-- back early. Under a trigger that ignores what the caller sent, that write
-- would silently stop working and every returned unit would stay held for its
-- full original window — a regression that looks like nothing at all until a
-- customer is told the last tent is out.
--
-- So the derivation reads `returned_on`, which this migration adds, and
-- `returnBooking` sets that column instead of building a range. Returning early
-- still frees the shelf; it now does it by stating the fact rather than by
-- restating the arithmetic.
-- ---------------------------------------------------------------------------

ALTER TABLE rental_reservations
  -- FROZEN at insert from the item. If the shop later changes an item's drying
  -- time, hires already agreed must not silently re-length or re-shorten on the
  -- shelf — the same reasoning that freezes `daily_rate` on this table.
  ADD COLUMN IF NOT EXISTS buffer_days INT NOT NULL DEFAULT 0
    CHECK (buffer_days BETWEEN 0 AND 14),
  -- When the gear actually came back, which is not always `ends_on`.
  ADD COLUMN IF NOT EXISTS returned_on DATE;

COMMENT ON COLUMN rental_reservations.buffer_days IS
  'The item''s cleaning buffer, frozen at booking. A later change to the item must not re-length a hire already on the shelf.';
COMMENT ON COLUMN rental_reservations.returned_on IS
  'The day the unit actually came back. Drives `period` — setting it is how an early return frees the shelf. NULL until returned.';

-- Backfill the buffer from the item, for rows written before it existed.
UPDATE rental_reservations r
   SET buffer_days = i.buffer_days
  FROM rental_items i
 WHERE i.id = r.item_id
   AND r.buffer_days = 0
   AND i.buffer_days <> 0;

-- ── The derivation ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION rental_reservation_period()
RETURNS TRIGGER
LANGUAGE plpgsql
-- Carries its own pin. `CREATE OR REPLACE FUNCTION` does NOT preserve settings
-- applied by a later `ALTER FUNCTION ... SET` — it resets proconfig to null,
-- verified on the live database. 110 pins these two, and it only survives there
-- because 110 happened to be run after this file; applied in filename order
-- (110 → 111 → 112) the pin would be silently wiped and 087's hardening lost on
-- a fresh environment. Every definition carrying its own SET removes the
-- ordering dependency entirely, which is what 087 asked for.
SET search_path = public
AS $$
DECLARE
  effective_end DATE;
BEGIN
  -- On INSERT the buffer comes from the item unless the caller supplied one;
  -- on UPDATE it is immutable, because it is frozen by definition.
  IF TG_OP = 'INSERT' THEN
    IF NEW.buffer_days IS NULL OR NEW.buffer_days = 0 THEN
      SELECT i.buffer_days INTO NEW.buffer_days
        FROM rental_items i WHERE i.id = NEW.item_id;
      NEW.buffer_days := COALESCE(NEW.buffer_days, 0);
    END IF;
  ELSE
    NEW.buffer_days := OLD.buffer_days;
  END IF;

  -- An early return shortens the hold; a late one does NOT lengthen it here.
  -- Lateness is a money question, settled by `lateFee` against the dates the
  -- customer agreed to — letting it push `period` out would silently hold a
  -- shelf a returned unit is standing on.
  effective_end := LEAST(COALESCE(NEW.returned_on, NEW.ends_on), NEW.ends_on);
  -- And never behind the start, so the range cannot invert on a same-day
  -- return recorded against an earlier date.
  effective_end := GREATEST(effective_end, NEW.starts_on);

  NEW.period := daterange(
    NEW.starts_on,
    (effective_end + NEW.buffer_days + 1)::date,
    '[)'
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION rental_reservation_period IS
  'Derives rental_reservations.period from the dates, the frozen buffer and the actual return. Whatever a caller sends in `period` is discarded — which is the point: the exclusion constraint tests this column and nothing else.';

-- Named to sort BEFORE `set_updated_at`; they touch different columns so the
-- order is not load-bearing, but a deterministic one is easier to reason about.
DROP TRIGGER IF EXISTS derive_period ON rental_reservations;
CREATE TRIGGER derive_period
  BEFORE INSERT OR UPDATE ON rental_reservations
  FOR EACH ROW EXECUTE FUNCTION rental_reservation_period();

-- ── Backfill, then assert ──────────────────────────────────────────────────
--
-- A no-op UPDATE runs the trigger over every existing row, so what is on the
-- shelf now is what the derivation says it should be. Any row the hand-written
-- strings got wrong is corrected here — and if a correction would collide with
-- another hold, this migration fails loudly rather than leaving a double
-- booking in place, which is the right outcome.

UPDATE rental_reservations SET starts_on = starts_on;

-- The invariant, stated. A future writer who bypasses the trigger — by
-- disabling it, or on a table this migration has not seen — is refused rather
-- than quietly granted the ability to overlap two hires on one tent.
ALTER TABLE rental_reservations DROP CONSTRAINT IF EXISTS rental_reservations_period_matches_start;
ALTER TABLE rental_reservations ADD CONSTRAINT rental_reservations_period_matches_start
  CHECK (lower(period) = starts_on);
