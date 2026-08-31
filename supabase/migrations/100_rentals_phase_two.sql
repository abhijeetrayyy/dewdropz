-- ---------------------------------------------------------------------------
-- 100 — rentals, phase two: money, extensions, evidence and logistics
-- ---------------------------------------------------------------------------
--
-- 096 built a rental system that can take a booking and settle it at a counter.
-- Everything it could not do had the same root: a booking was an agreement with
-- no money attached to it. There was no payment status, no gateway reference,
-- no way to hold a deposit as anything other than a word an operator typed, no
-- way to charge for extra days, and no way to discount.
--
-- This migration adds the money and the three things that hang off it.
--
--   · PAYMENT.    A rental can be paid for online, so gear can be posted to
--                 somebody the shop has never met.
--   · DEPOSIT.    Held as a real instrument — cash at a counter, or a captured
--                 payment that is refunded, part-refunded or forfeited, with
--                 the gateway reference stored either way.
--   · EXTENSION.  Its own table, because extending is a second agreement about
--                 the same gear and it has to be priced, paid for and audited
--                 separately from the first one.
--   · COUPONS.    On the rent only, never on the deposit — see the note there.
--   · EVIDENCE.   Photographs at handover and at return, so a damage charge is
--                 something you can show rather than something you assert.
--   · LOGISTICS.  Both legs of a posted rental: what went out, and what is
--                 coming back.
--   · REMINDERS.  State on the booking, so a reminder is sent once.
--
-- WHAT IS DELIBERATELY NOT HERE
--
-- The rental invoice. It belongs on the existing GST invoicing machinery from
-- 048 — the serial counter, the frozen supplier snapshot, the refusal to print
-- a document that would have to be reissued — and extending that safely is its
-- own migration. See 101.
-- ---------------------------------------------------------------------------

-- ── Money on a booking ─────────────────────────────────────────────────────
--
-- Mirrors `orders` deliberately: the same column names, the same paise, the
-- same 'razorpay' | 'cod' vocabulary that 099 narrowed the sale side to. An
-- operator reading both tables should not have to learn two dialects.
--
-- `cod` here means "pay when you collect it", which is what it has always meant
-- for a rental picked up in person.

ALTER TABLE rental_bookings
  ADD COLUMN IF NOT EXISTS payment_method   TEXT
    CHECK (payment_method IS NULL OR payment_method IN ('razorpay', 'cod')),
  ADD COLUMN IF NOT EXISTS payment_status   TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'refunded', 'failed')),
  ADD COLUMN IF NOT EXISTS gateway_order_id   TEXT,
  ADD COLUMN IF NOT EXISTS gateway_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS amount_paid      INT NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  ADD COLUMN IF NOT EXISTS paid_at          TIMESTAMPTZ;

COMMENT ON COLUMN rental_bookings.payment_status IS
  'The rent, not the deposit. The deposit has its own state because the two move independently: a rental can be paid in full online while its deposit is still cash in a drawer.';

-- ── The deposit as an instrument ───────────────────────────────────────────
--
-- 096 recorded `deposit_state` and nothing else, because the deposit was always
-- cash taken face to face. That is still the right answer for collection — but
-- a posted rental cannot take cash, and "held" typed by a person is not a hold.
--
-- The refunded amount is stored rather than derived. Deriving it would mean
-- recomputing late and damage fees at read time, and those are settled once,
-- at return, against the rules in force then.

ALTER TABLE rental_bookings
  ADD COLUMN IF NOT EXISTS deposit_method   TEXT NOT NULL DEFAULT 'cash'
    CHECK (deposit_method IN ('cash', 'gateway', 'waived')),
  ADD COLUMN IF NOT EXISTS deposit_payment_id  TEXT,
  ADD COLUMN IF NOT EXISTS deposit_refund_id   TEXT,
  ADD COLUMN IF NOT EXISTS deposit_refunded    INT NOT NULL DEFAULT 0 CHECK (deposit_refunded >= 0),
  ADD COLUMN IF NOT EXISTS deposit_settled_at  TIMESTAMPTZ;

-- A gateway deposit that has been taken must carry the payment it was taken by,
-- otherwise there is nothing to refund it against and "held" is a claim with no
-- evidence. Cash and waived deposits are exempt because there is nothing to
-- reference.
ALTER TABLE rental_bookings DROP CONSTRAINT IF EXISTS rental_bookings_gateway_deposit_has_payment;
ALTER TABLE rental_bookings ADD CONSTRAINT rental_bookings_gateway_deposit_has_payment
  CHECK (
    deposit_method <> 'gateway'
    OR deposit_state IN ('pending', 'waived')
    OR deposit_payment_id IS NOT NULL
  );

-- You cannot give back more than you took.
ALTER TABLE rental_bookings DROP CONSTRAINT IF EXISTS rental_bookings_refund_within_deposit;
ALTER TABLE rental_bookings ADD CONSTRAINT rental_bookings_refund_within_deposit
  CHECK (deposit_refunded <= deposit_amount);

-- ── Discounts ──────────────────────────────────────────────────────────────
--
-- Two amounts, kept apart on purpose:
--
--   `long_rental_discount` is a property of the item and the duration. It is
--   already inside `rent_amount` as priced, and is recorded here only so the
--   breakdown can be shown and reconciled.
--
--   `coupon_discount` is a marketing instrument applied afterwards.
--
-- Summing them into one "discount" column would make it impossible to answer
-- "how much did that campaign actually cost", which is the only question a
-- coupon column exists to answer.

ALTER TABLE rental_bookings
  ADD COLUMN IF NOT EXISTS long_rental_discount INT NOT NULL DEFAULT 0 CHECK (long_rental_discount >= 0),
  ADD COLUMN IF NOT EXISTS coupon_id       UUID REFERENCES coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_code     TEXT,
  ADD COLUMN IF NOT EXISTS coupon_discount INT NOT NULL DEFAULT 0 CHECK (coupon_discount >= 0);

COMMENT ON COLUMN rental_bookings.coupon_code IS
  'Snapshotted beside coupon_id, because a code can be renamed or its coupon deleted, and the booking must still be able to say what was applied.';

-- ── Which coupons may be spent on what ─────────────────────────────────────
--
-- A code written for the shop is not automatically valid on the gear locker.
-- The two have different margins and different fixed costs — a rental carries a
-- return-postage leg the shop cannot avoid — so "20% off everything" meaning
-- both was never a decision anybody made.
--
-- Default 'sale', so EVERY EXISTING COUPON KEEPS ITS CURRENT MEANING and no
-- code silently becomes spendable on rentals the day this ships.

ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS applies_to TEXT NOT NULL DEFAULT 'sale'
    CHECK (applies_to IN ('sale', 'rental', 'both'));

COMMENT ON COLUMN coupons.applies_to IS
  'Default sale, so existing codes are unchanged by the arrival of rentals. A code must be deliberately marked before it can be spent on a rental.';

-- `coupon_usages.order_id` is NOT NULL-able already; a rental usage has no
-- order, so the booking reference is added beside it and exactly one must be
-- present. Without the check, a usage row could reference neither and the
-- per-user limit would count a row nobody could trace.
ALTER TABLE coupon_usages
  ADD COLUMN IF NOT EXISTS rental_booking_id UUID REFERENCES rental_bookings(id) ON DELETE SET NULL;

ALTER TABLE coupon_usages DROP CONSTRAINT IF EXISTS coupon_usages_belongs_to_something;
ALTER TABLE coupon_usages ADD CONSTRAINT coupon_usages_belongs_to_something
  CHECK (order_id IS NOT NULL OR rental_booking_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_coupon_usages_rental ON coupon_usages(rental_booking_id)
  WHERE rental_booking_id IS NOT NULL;

-- ── Logistics: both legs ───────────────────────────────────────────────────
--
-- A posted rental is charged for two journeys and, until now, tracked for
-- neither. One row per booking rather than a shipments table: a rental goes out
-- as one parcel and comes back as one parcel, and inventing a one-to-many here
-- would be modelling a case the business does not have.

ALTER TABLE rental_bookings
  ADD COLUMN IF NOT EXISTS out_carrier      TEXT,
  ADD COLUMN IF NOT EXISTS out_tracking     TEXT,
  ADD COLUMN IF NOT EXISTS dispatched_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_carrier   TEXT,
  ADD COLUMN IF NOT EXISTS return_tracking  TEXT,
  ADD COLUMN IF NOT EXISTS return_label_url TEXT,
  ADD COLUMN IF NOT EXISTS return_booked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS returned_at      TIMESTAMPTZ;

-- ── Reminders ──────────────────────────────────────────────────────────────
--
-- Timestamps rather than booleans, because "when did we tell them" is the
-- question asked in a dispute, and because a nullable timestamp is its own
-- idempotency key: the sender writes it in the same statement it claims the
-- work, so a cron that runs twice cannot send twice.

ALTER TABLE rental_bookings
  ADD COLUMN IF NOT EXISTS reminder_due_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_overdue_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_starts_at   TIMESTAMPTZ;

COMMENT ON COLUMN rental_bookings.reminder_due_at IS
  'When the "due back tomorrow" reminder was sent, not when it is due. Null means unsent, and the sender claims it by writing this in the same UPDATE that selects it.';

-- ── Extensions ─────────────────────────────────────────────────────────────
--
-- Its own table, for the same reason `order_items` is not a JSON column: an
-- extension is priced, paid for and audited, and every one of those needs a row
-- to point at.
--
-- WHY THE PRICE IS A DELTA AND NOT A RE-QUOTE. Re-running the whole quote over
-- the new range would re-apply the long-rental discount to days already paid
-- for, and can therefore REDUCE what has been charged — a customer asking for
-- more could end up owing less. So an extension prices only the days it adds,
-- at the rate frozen on the reservation.

CREATE TABLE IF NOT EXISTS rental_extensions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id     UUID NOT NULL REFERENCES rental_bookings(id) ON DELETE CASCADE,

  -- The end date before and after. `days_added` is derived at write time and
  -- stored, because it is what was charged for.
  previous_end   DATE NOT NULL,
  new_end        DATE NOT NULL,
  days_added     INT  NOT NULL CHECK (days_added > 0),

  rent_amount    INT NOT NULL DEFAULT 0 CHECK (rent_amount >= 0),
  tax_amount     INT NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount   INT NOT NULL DEFAULT 0 CHECK (total_amount >= 0),

  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'confirmed', 'declined', 'cancelled')),

  payment_status TEXT NOT NULL DEFAULT 'unpaid'
                   CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed')),
  gateway_order_id   TEXT,
  gateway_payment_id TEXT,

  requested_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  decline_reason TEXT,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT rental_extensions_forward CHECK (new_end > previous_end)
);

CREATE INDEX IF NOT EXISTS idx_rental_extensions_booking
  ON rental_extensions(booking_id, created_at DESC);

COMMENT ON TABLE rental_extensions IS
  'A second agreement about gear already out. Priced as a delta over the days added, at the rate frozen on the original reservation — never as a re-quote of the whole rental.';

-- ── Evidence ───────────────────────────────────────────────────────────────
--
-- Damage was a number and a note. In a dispute that is an assertion. A
-- photograph taken at handover and another at return is the cheapest protection
-- either side has, and it protects the CUSTOMER as much as the shop — "it was
-- already like that" is a defensible position when there is a handover picture.

CREATE TABLE IF NOT EXISTS rental_damage_photos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id     UUID NOT NULL REFERENCES rental_bookings(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES rental_reservations(id) ON DELETE SET NULL,

  -- Which end of the rental this was taken at. The distinction is the whole
  -- point: a photograph with no stage proves nothing about who caused what.
  stage          TEXT NOT NULL CHECK (stage IN ('handover', 'return')),
  url            TEXT NOT NULL,
  note           TEXT,
  actor_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rental_damage_photos_booking
  ON rental_damage_photos(booking_id, stage, created_at);

-- ── The event vocabulary, widened ──────────────────────────────────────────
--
-- Same append-only log, more verbs. Dropping and recreating the check rather
-- than adding a second one, so there is exactly one place that says what an
-- event may be.

ALTER TABLE rental_events DROP CONSTRAINT IF EXISTS rental_events_kind_check;
ALTER TABLE rental_events ADD CONSTRAINT rental_events_kind_check
  CHECK (kind IN (
    -- 096
    'created', 'deposit_held', 'handed_over', 'returned', 'inspected',
    'late_fee', 'damage_fee', 'deposit_refunded', 'deposit_forfeited',
    'cancelled', 'note',
    -- 100
    'payment_received', 'payment_failed', 'refunded',
    'coupon_applied',
    'extension_requested', 'extension_confirmed', 'extension_declined',
    'photo_added',
    'reminder_sent',
    'dispatched', 'delivered', 'return_booked'
  ));

-- ── Availability, when the caller is already holding the unit ──────────────
--
-- `rental_available_units` answers "what is free", and an extension needs a
-- slightly different question: "is this unit free for the NEW range, ignoring
-- the hold I am about to widen". Without the exclusion the function sees the
-- reservation's own period, reports the unit busy, and no rental could ever be
-- extended.
--
-- A separate function rather than a nullable parameter on the existing one:
-- that one is granted to `anon` and is the shop window. This one takes a
-- reservation id, which is not a public thing to be passing around, so it is
-- granted only to the roles that already hold the booking.

CREATE OR REPLACE FUNCTION rental_unit_free_excluding(
  p_unit_id       UUID,
  p_start         DATE,
  p_end           DATE,
  p_except_res_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT NOT EXISTS (
    SELECT 1
      FROM rental_reservations r
      JOIN rental_units u ON u.id = r.unit_id
      JOIN rental_items i ON i.id = u.item_id
     WHERE r.unit_id = p_unit_id
       AND r.id <> p_except_res_id
       AND r.status <> 'cancelled'
       AND r.period && daterange(p_start, (p_end + i.buffer_days + 1)::date, '[)')
  );
$$;

COMMENT ON FUNCTION rental_unit_free_excluding IS
  'Is this unit free for a range, ignoring one reservation — the one being extended. SECURITY DEFINER for the same reason as rental_available_units: reservations are RLS-protected and the answer must still be truthful. Returns a boolean and nothing else.';

REVOKE ALL ON FUNCTION rental_unit_free_excluding(UUID, DATE, DATE, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rental_unit_free_excluding(UUID, DATE, DATE, UUID) TO authenticated, service_role;

-- ── Utilisation ────────────────────────────────────────────────────────────
--
-- The data to answer "which gear earns its shelf space" has been sitting in
-- reservations since 096 and nothing has ever read it. This is that read.
--
-- UNIT-DAYS, NOT BOOKINGS. A tent booked once for ten days and a tent booked
-- ten times for a day each are the same utilisation and very different
-- businesses, so the numerator is days a unit was out and the denominator is
-- days a unit existed and was serviceable. Counting bookings would flatter
-- short rentals and hide a shelf full of gear nobody wants.
--
-- The overlap is clipped to the window, so a rental that straddles the start of
-- the period contributes only the days inside it.

CREATE OR REPLACE FUNCTION rental_utilisation(p_from DATE, p_to DATE)
RETURNS TABLE (
  item_id        UUID,
  slug           TEXT,
  name           TEXT,
  units          INT,
  unit_days      INT,
  booked_days    INT,
  utilisation    NUMERIC(5,2),
  bookings       INT,
  rent_collected BIGINT,
  late_collected BIGINT,
  damage_collected BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH window_days AS (
    SELECT GREATEST(1, (p_to - p_from) + 1) AS n
  ),
  -- Days each unit was available to be rented inside the window. A unit
  -- acquired mid-window or retired mid-window only counts for the part of the
  -- window it actually existed for; counting the whole window would make a tent
  -- bought yesterday look like a tent nobody wanted.
  serviceable AS (
    SELECT
      u.item_id,
      u.id AS unit_id,
      GREATEST(
        0,
        (LEAST(p_to, COALESCE(u.retired_at, p_to)) - GREATEST(p_from, u.acquired_at)) + 1
      ) AS days
      FROM rental_units u
     WHERE u.condition IN ('good', 'fair')
        OR u.retired_at IS NOT NULL
  ),
  booked AS (
    SELECT
      r.item_id,
      SUM(GREATEST(0, (LEAST(p_to, r.ends_on) - GREATEST(p_from, r.starts_on)) + 1))::INT AS days,
      COUNT(DISTINCT r.booking_id)::INT AS bookings
      FROM rental_reservations r
     WHERE r.status <> 'cancelled'
       AND r.starts_on <= p_to
       AND r.ends_on   >= p_from
     GROUP BY r.item_id
  ),
  -- Money is attributed to the item through its reservations, apportioned by
  -- line rent, because a booking can carry several different items and the
  -- booking-level totals cannot be split any other way.
  money AS (
    SELECT
      r.item_id,
      SUM(r.rent_amount)::BIGINT AS rent,
      SUM(
        CASE WHEN b.rent_amount > 0
             THEN (b.late_fee::NUMERIC * r.rent_amount / b.rent_amount)
             ELSE 0 END
      )::BIGINT AS late,
      SUM(
        CASE WHEN b.rent_amount > 0
             THEN (b.damage_fee::NUMERIC * r.rent_amount / b.rent_amount)
             ELSE 0 END
      )::BIGINT AS damage
      FROM rental_reservations r
      JOIN rental_bookings b ON b.id = r.booking_id
     WHERE r.status <> 'cancelled'
       AND r.starts_on <= p_to
       AND r.ends_on   >= p_from
     GROUP BY r.item_id
  )
  SELECT
    i.id,
    i.slug,
    i.name,
    COUNT(s.unit_id)::INT                                    AS units,
    COALESCE(SUM(s.days), 0)::INT                            AS unit_days,
    COALESCE(MAX(bk.days), 0)                                AS booked_days,
    CASE WHEN COALESCE(SUM(s.days), 0) > 0
         THEN ROUND(100.0 * COALESCE(MAX(bk.days), 0) / SUM(s.days), 2)
         ELSE 0 END                                          AS utilisation,
    COALESCE(MAX(bk.bookings), 0)                            AS bookings,
    COALESCE(MAX(m.rent), 0)                                 AS rent_collected,
    COALESCE(MAX(m.late), 0)                                 AS late_collected,
    COALESCE(MAX(m.damage), 0)                               AS damage_collected
    FROM rental_items i
    LEFT JOIN serviceable s ON s.item_id = i.id
    LEFT JOIN booked      bk ON bk.item_id = i.id
    LEFT JOIN money       m  ON m.item_id  = i.id
   GROUP BY i.id, i.slug, i.name
   ORDER BY utilisation DESC, i.name;
$$;

COMMENT ON FUNCTION rental_utilisation IS
  'Unit-days out against unit-days available, per item, over a window. Definer because it reads RLS-protected reservations; admin-only by grant, because it aggregates revenue.';

REVOKE ALL ON FUNCTION rental_utilisation(DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rental_utilisation(DATE, DATE) TO service_role;

-- ── The calendar's read ────────────────────────────────────────────────────
--
-- One query for the admin calendar, rather than the screen fetching every
-- reservation and working it out in JavaScript. Returns the held ranges for an
-- item's units over a window, with just enough to label a bar: who, which
-- booking, what state.

CREATE OR REPLACE FUNCTION rental_calendar(p_from DATE, p_to DATE, p_item_id UUID DEFAULT NULL)
RETURNS TABLE (
  item_id        UUID,
  item_name      TEXT,
  unit_id        UUID,
  unit_code      TEXT,
  unit_condition TEXT,
  reservation_id UUID,
  booking_id     UUID,
  booking_number TEXT,
  customer_email TEXT,
  starts_on      DATE,
  ends_on        DATE,
  buffer_until   DATE,
  status         TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    i.id, i.name,
    u.id, u.code, u.condition,
    r.id, b.id, b.booking_number, b.email,
    r.starts_on, r.ends_on,
    -- The end of the HELD range, which is what actually blocks the shelf. The
    -- calendar draws the cleaning days differently, so it needs them separately
    -- rather than folded into ends_on.
    (upper(r.period) - 1)::date,
    r.status
    FROM rental_units u
    JOIN rental_items i ON i.id = u.item_id
    LEFT JOIN rental_reservations r
      ON r.unit_id = u.id
     AND r.status <> 'cancelled'
     AND r.period && daterange(p_from, (p_to + 1)::date, '[)')
    LEFT JOIN rental_bookings b ON b.id = r.booking_id
   WHERE (p_item_id IS NULL OR u.item_id = p_item_id)
     AND u.retired_at IS NULL
   ORDER BY i.name, u.code, r.starts_on;
$$;

COMMENT ON FUNCTION rental_calendar IS
  'Every unit and its held ranges over a window, for the admin calendar. Returns customer email, so it is service_role only — this is the staff view, not the shop window.';

REVOKE ALL ON FUNCTION rental_calendar(DATE, DATE, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rental_calendar(DATE, DATE, UUID) TO service_role;

-- ── RLS on the new tables ──────────────────────────────────────────────────
--
-- Same shape as 096, which is the shape 093 established: reads scoped to the
-- owner, and NO write policies at all, because every write goes through a
-- server action on the service-role client. A table with no write policy cannot
-- be written by the key that ships in the browser.

ALTER TABLE rental_extensions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_damage_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own extensions" ON rental_extensions;
CREATE POLICY "Own extensions" ON rental_extensions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM rental_bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
  );

-- Deliberately NOT readable by the customer.
--
-- A handover photograph is evidence in a dispute the shop may be having with
-- the person it would be showing it to, and the return set can contain other
-- people's gear in frame. The customer is told what they are charged and why,
-- with a note; if they contest it, the photographs are produced deliberately
-- rather than served automatically.
DROP POLICY IF EXISTS "Damage photos are staff evidence" ON rental_damage_photos;

-- ── updated_at ─────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS set_updated_at ON rental_extensions;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON rental_extensions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Indexes for the two queries this migration makes common ────────────────

-- The reminder sweep: bookings that are out, due in a window, not yet told.
CREATE INDEX IF NOT EXISTS idx_rental_bookings_reminders
  ON rental_bookings(status)
  WHERE status = 'out';

CREATE INDEX IF NOT EXISTS idx_rental_bookings_payment
  ON rental_bookings(payment_status, created_at DESC);

-- ── Per-line tax, frozen ───────────────────────────────────────────────────
--
-- 096 computed tax once, at booking level, because nothing downstream needed it
-- broken out. An invoice does: Rule 46(f)-(l) wants a rate, a taxable value and
-- a tax amount PER LINE, and s.15(3)(a) makes a discount excludable from value
-- only if it is recorded in the invoice — so the discount has to be apportioned
-- to lines too, not silently netted off a total.
--
-- FROZEN, like `daily_rate` beside them, and for the same reason: `rental_items`
-- is editable, and an invoice issued next month must not be able to restate the
-- rate a rental was actually taxed at. This is the same decision 048 made when
-- it snapshotted the whole supplier block.

ALTER TABLE rental_reservations
  ADD COLUMN IF NOT EXISTS sac_code        TEXT,
  ADD COLUMN IF NOT EXISTS gst_rate        NUMERIC(5,2) NOT NULL DEFAULT 18
    CHECK (gst_rate >= 0 AND gst_rate <= 28),
  ADD COLUMN IF NOT EXISTS discount_amount INT NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  ADD COLUMN IF NOT EXISTS taxable_value   INT NOT NULL DEFAULT 0 CHECK (taxable_value >= 0),
  ADD COLUMN IF NOT EXISTS tax_amount      INT NOT NULL DEFAULT 0 CHECK (tax_amount >= 0);

COMMENT ON COLUMN rental_reservations.taxable_value IS
  'Rent for this line after every discount. The value of supply under s.15 — what tax is charged on, and what an invoice line prints.';

-- Backfill what can be known truthfully.
--
-- `rent_amount` on existing rows is ALREADY net of the long-rental discount (the
-- pricer subtracted it before the row was written), so it is the taxable value
-- as it stands. The rate comes from the item, which for existing rows has not
-- changed since they were booked — this is the one moment where reading it live
-- is correct, because it is also the moment the value is frozen.
--
-- `discount_amount` is left at zero rather than reverse-engineered: the split
-- between the long-rental discount and nothing else cannot be recovered per line
-- from a booking-level figure, and a guessed discount printed on an invoice is
-- worse than an absent one.
UPDATE rental_reservations r
   SET sac_code      = i.sac_code,
       gst_rate      = i.gst_rate,
       taxable_value = r.rent_amount,
       tax_amount    = ROUND(r.rent_amount * i.gst_rate / 100)
  FROM rental_items i
 WHERE i.id = r.item_id
   AND r.taxable_value = 0
   AND r.rent_amount > 0;
