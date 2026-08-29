-- ---------------------------------------------------------------------------
-- 096 — renting gear
-- ---------------------------------------------------------------------------
--
-- WHY THIS IS NOT A FLAG ON `products`
--
-- Every sale in this shop decrements `inventory_quantity`, and 021 put a
-- CHECK (inventory_quantity >= 0) at table level so overselling is impossible
-- for every write path at once. That model cannot express a rental. A tent is
-- not *gone* when somebody takes it — it is unavailable between the 12th and
-- the 16th and back on the shelf after that. Availability is a function of
-- overlapping date ranges, not a single integer, so it needs its own tables.
--
-- Rentals also check out separately from purchases (a deliberate product
-- decision): one booking, one lifecycle, one tax treatment. Nothing in this
-- migration touches `orders`, `order_items`, or lib/checkoutPricing.ts — the
-- code that already bills people correctly is left exactly as it is.
--
-- THE SHAPE
--
--   rental_items         what can be rented — rate, deposit, limits, tax code
--   rental_units         the physical copies, each with its own condition
--   rental_bookings      one checkout: customer, fulfilment, totals
--   rental_reservations  one unit held for one date range (a booking line)
--   rental_events        append-only log of everything that happened
--
-- THE CONSTRAINT THAT MATTERS
--
-- Two overlapping reservations on the same physical unit are made impossible
-- by Postgres itself, with an exclusion constraint over a daterange — the same
-- reasoning as the stock CHECK in 021. Availability logic in application code
-- can be wrong, raced, or bypassed; a unit that is already booked simply
-- cannot be booked again.
--
-- GST: A RENTAL IS A SERVICE, NOT GOODS
--
-- Renting equipment is a supply of service under an SAC code, not a supply of
-- goods under HSN, and it is taxed at its own rate. `lib/checkoutPricing.ts`
-- computes GST per line from HSN and would therefore charge the WRONG RATE on
-- every rental. So the rate lives on the item here and rental tax is computed
-- in the rental path, never in the sale path.
--
-- And the deposit is NOT taxable. It is a refundable security, not
-- consideration for a supply — taxing it would overcharge every renter and
-- overstate output tax. Tax is charged on rent, late fees and damage only.
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ── What can be rented ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rental_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  summary       TEXT,
  description   TEXT,
  images        TEXT[] NOT NULL DEFAULT '{}',

  -- Money, in paise, like every other amount in this database.
  daily_rate    INT NOT NULL CHECK (daily_rate > 0),
  deposit       INT NOT NULL DEFAULT 0 CHECK (deposit >= 0),

  -- A weekly rate is expressed as a discount rather than a second price, so
  -- there is exactly one rate to reason about and long hires cannot end up
  -- cheaper per day than the arithmetic says.
  weekly_discount_pct INT NOT NULL DEFAULT 0 CHECK (weekly_discount_pct BETWEEN 0 AND 60),

  min_days      INT NOT NULL DEFAULT 1 CHECK (min_days >= 1),
  max_days      INT NOT NULL DEFAULT 30 CHECK (max_days >= 1),

  -- Days a unit is held back after return for cleaning, drying and checking.
  -- Enforced by the exclusion constraint, not by hoping the calendar is read
  -- correctly — wet canvas is the reason this exists.
  buffer_days   INT NOT NULL DEFAULT 1 CHECK (buffer_days BETWEEN 0 AND 14),

  -- Supply of SERVICE. 997314 is leasing/rental of machinery and equipment.
  sac_code      TEXT,
  gst_rate      NUMERIC(5,2) NOT NULL DEFAULT 18 CHECK (gst_rate >= 0 AND gst_rate <= 28),

  -- Both fulfilment paths, per item: some gear is too bulky to post.
  allows_pickup   BOOLEAN NOT NULL DEFAULT TRUE,
  allows_shipping BOOLEAN NOT NULL DEFAULT FALSE,

  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort          INT NOT NULL DEFAULT 100,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT rental_items_slug_shape CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  CONSTRAINT rental_items_day_range  CHECK (max_days >= min_days),
  CONSTRAINT rental_items_some_fulfilment CHECK (allows_pickup OR allows_shipping)
);

COMMENT ON TABLE rental_items IS
  'Gear offered for hire. Separate from products because availability is a calendar, not a stock count, and because a rental is a supply of service taxed under SAC rather than goods under HSN.';

-- ── The physical copies ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rental_units (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     UUID NOT NULL REFERENCES rental_items(id) ON DELETE CASCADE,
  -- What is written on the tag, so a person and the database agree.
  code        TEXT NOT NULL,
  condition   TEXT NOT NULL DEFAULT 'good'
                CHECK (condition IN ('good', 'fair', 'repair', 'retired')),
  notes       TEXT,
  acquired_at DATE NOT NULL DEFAULT CURRENT_DATE,
  retired_at  DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (item_id, code)
);

COMMENT ON COLUMN rental_units.condition IS
  'A unit in repair or retired is never offered. Kept as a row rather than deleted so its booking history and the reason it left service survive.';

-- ── One checkout ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rental_bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number  TEXT NOT NULL UNIQUE,
  user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  email           TEXT NOT NULL,
  phone           TEXT,

  fulfilment      TEXT NOT NULL CHECK (fulfilment IN ('pickup', 'ship')),
  -- Snapshotted, like orders.shipping_address: an address edited later must not
  -- rewrite where something was actually sent.
  address         JSONB,
  pickup_slot     TIMESTAMPTZ,

  status          TEXT NOT NULL DEFAULT 'reserved'
                    CHECK (status IN ('reserved','out','returned','closed','cancelled')),

  -- Money, all paise. Deposit sits outside the taxable base on purpose.
  rent_amount     INT  NOT NULL DEFAULT 0 CHECK (rent_amount >= 0),
  delivery_amount INT  NOT NULL DEFAULT 0 CHECK (delivery_amount >= 0),
  tax_amount      INT  NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  deposit_amount  INT  NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
  late_fee        INT  NOT NULL DEFAULT 0 CHECK (late_fee >= 0),
  damage_fee      INT  NOT NULL DEFAULT 0 CHECK (damage_fee >= 0),
  total_amount    INT  NOT NULL DEFAULT 0 CHECK (total_amount >= 0),

  -- The deposit is taken face to face at handover, so its state is recorded
  -- rather than driven by a payment gateway.
  deposit_state   TEXT NOT NULL DEFAULT 'pending'
                    CHECK (deposit_state IN ('pending','held','refunded','forfeited','waived')),

  notes           TEXT,
  admin_notes     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- A posted rental needs somewhere to go; a collected one needs a time.
  CONSTRAINT rental_bookings_fulfilment_detail
    CHECK ((fulfilment = 'ship' AND address IS NOT NULL)
        OR (fulfilment = 'pickup'))
);

-- ── One unit, held for one range ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rental_reservations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID NOT NULL REFERENCES rental_bookings(id) ON DELETE CASCADE,
  item_id      UUID NOT NULL REFERENCES rental_items(id) ON DELETE RESTRICT,
  unit_id      UUID NOT NULL REFERENCES rental_units(id) ON DELETE RESTRICT,

  -- What the customer agreed to: inclusive start, inclusive end.
  starts_on    DATE NOT NULL,
  ends_on      DATE NOT NULL,

  -- What the shelf actually loses. Half-open [start, end+buffer+1) so the
  -- cleaning window is part of the same range the exclusion constraint tests —
  -- it cannot be forgotten by a caller because no caller writes it.
  period       DATERANGE NOT NULL,

  status       TEXT NOT NULL DEFAULT 'reserved'
                 CHECK (status IN ('reserved','out','returned','cancelled')),

  -- Priced per line and frozen, so a later change to the item's rate cannot
  -- rewrite what somebody already agreed to pay. Same reasoning as order_items.
  daily_rate   INT NOT NULL CHECK (daily_rate > 0),
  days         INT NOT NULL CHECK (days > 0),
  rent_amount  INT NOT NULL CHECK (rent_amount >= 0),
  deposit      INT NOT NULL DEFAULT 0 CHECK (deposit >= 0),

  returned_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT rental_reservations_dates CHECK (ends_on >= starts_on)
);

-- THE CONSTRAINT THIS WHOLE TABLE EXISTS FOR.
--
-- Two overlapping holds on the same physical unit are refused by Postgres.
-- Cancelled rows are excluded from the test so a cancellation genuinely frees
-- the dates. Application code still checks availability to give a good error —
-- but this is what makes the bad state unreachable, including under two
-- simultaneous checkouts for the last tent.
ALTER TABLE rental_reservations DROP CONSTRAINT IF EXISTS rental_no_double_booking;
ALTER TABLE rental_reservations ADD CONSTRAINT rental_no_double_booking
  EXCLUDE USING gist (unit_id WITH =, period WITH &&)
  WHERE (status <> 'cancelled');

-- ── What happened, in order ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rental_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id     UUID NOT NULL REFERENCES rental_bookings(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES rental_reservations(id) ON DELETE SET NULL,
  kind           TEXT NOT NULL CHECK (kind IN (
                   'created','deposit_held','handed_over','returned','inspected',
                   'late_fee','damage_fee','deposit_refunded','deposit_forfeited',
                   'cancelled','note')),
  -- Present when the event moved money, so "why was I charged ₹400?" always
  -- has an answer that is a row rather than a recollection.
  amount         INT,
  note           TEXT,
  actor_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_rental_items_active   ON rental_items(is_active, sort);
CREATE INDEX IF NOT EXISTS idx_rental_units_item     ON rental_units(item_id, condition);
CREATE INDEX IF NOT EXISTS idx_rental_res_unit       ON rental_reservations(unit_id);
CREATE INDEX IF NOT EXISTS idx_rental_res_booking    ON rental_reservations(booking_id);
CREATE INDEX IF NOT EXISTS idx_rental_res_period     ON rental_reservations USING gist (period);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_user  ON rental_bookings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_state ON rental_bookings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rental_events_booking ON rental_events(booking_id, created_at);

-- ── updated_at ─────────────────────────────────────────────────────────────

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['rental_items','rental_units','rental_bookings','rental_reservations'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', t);
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t);
  END LOOP;
END $$;

-- ── Availability, answered by the database ─────────────────────────────────
--
-- One place computes "which units of this item are free between these dates",
-- and the storefront, the admin calendar and the booking write all call it —
-- so the shelf a customer is shown and the shelf they book against can never
-- be two different opinions.
--
-- The requested window is widened by the item's buffer so a unit due back the
-- morning somebody wants it is correctly reported as unavailable.

CREATE OR REPLACE FUNCTION rental_available_units(
  p_item_id UUID,
  p_start   DATE,
  p_end     DATE
)
RETURNS TABLE (unit_id UUID, code TEXT)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT u.id, u.code
    FROM rental_units u
    JOIN rental_items i ON i.id = u.item_id
   WHERE u.item_id = p_item_id
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
  'Units of an item free for a date range, buffer included. The single source of truth for availability — storefront, admin and the booking write all call it.';

-- ── RLS ────────────────────────────────────────────────────────────────────
--
-- The catalogue half is a shop window: anyone may read active items and their
-- units, because "how many tents do you have" is not a secret and the
-- storefront needs it to show availability. Bookings are private to the person
-- who made them. Every write goes through a server action on the service-role
-- client, so there are deliberately no INSERT/UPDATE/DELETE policies here —
-- exactly the shape 093 established after fourteen tables were found writable.

ALTER TABLE rental_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_units        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_bookings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_events       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active rental items" ON rental_items;
CREATE POLICY "Public read active rental items" ON rental_items
  FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Public read rental units" ON rental_units;
CREATE POLICY "Public read rental units" ON rental_units
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM rental_items i WHERE i.id = item_id AND i.is_active)
  );

DROP POLICY IF EXISTS "Own bookings" ON rental_bookings;
CREATE POLICY "Own bookings" ON rental_bookings
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Own reservations" ON rental_reservations;
CREATE POLICY "Own reservations" ON rental_reservations
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM rental_bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Own booking events" ON rental_events;
CREATE POLICY "Own booking events" ON rental_events
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM rental_bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
  );
