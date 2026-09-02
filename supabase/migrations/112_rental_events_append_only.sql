-- ---------------------------------------------------------------------------
-- 112 — the append-only log becomes append-only
-- ---------------------------------------------------------------------------
--
-- 096:207 calls `rental_events` an "append-only log of everything that
-- happened". It has no append-only trigger, and `service_role` — the client
-- EVERY rental write uses — can rewrite or delete any row in it.
--
-- This is the table that answers "why was I charged ₹400?" with a row rather
-- than a recollection. A log that can be edited by the same code path that
-- writes it answers that question only as well as the code is trusted, which
-- is the opposite of what a log is for. It is also, on the day it matters, the
-- evidence for a disputed deposit deduction.
--
-- Verified before writing this: across `actions/` and `lib/` there are 28
-- references to `rental_events` and every one of them is an INSERT. Nothing
-- updates or deletes a row, so this trigger constrains no existing behaviour.
--
-- THE ONE CASCADE, AND WHY IT IS NOT A PROBLEM
--
-- `rental_events.booking_id` is ON DELETE CASCADE, and there is exactly one
-- DELETE of a booking in the codebase: `actions/rentals.ts:553`, the rollback
-- when reservation inserts fail. At that point the booking's first event — the
-- `created` row — has not been written yet; it is inserted after the
-- reservations succeed. The cascade therefore deletes zero rows and a
-- row-level trigger never fires.
--
-- If that ordering ever changes, this raises at exactly the right moment
-- instead of silently discarding a financial history.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION rental_events_are_append_only()
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
BEGIN
  RAISE EXCEPTION
    'rental_events is append-only: a % on booking history is refused. Record a correcting event instead.',
    lower(TG_OP);
END;
$$;

DROP TRIGGER IF EXISTS rental_events_no_rewrite ON rental_events;
CREATE TRIGGER rental_events_no_rewrite
  BEFORE UPDATE OR DELETE ON rental_events
  FOR EACH ROW EXECUTE FUNCTION rental_events_are_append_only();

COMMENT ON TABLE rental_events IS
  'Append-only history of one booking — created, handed over, paid, returned, refunded. Enforced by trigger since 112: correcting a mistake means recording another event, never editing the one that was wrong.';
