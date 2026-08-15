-- Two P0 correctness gaps, plus retiring a duplicated source of truth.

-- ---------------------------------------------------------------------------
-- 1. Order idempotency.
--
-- createOrder() had no protection against being called twice for the same
-- checkout. A double-clicked pay button, a retried mobile request, or a network
-- retry after the write succeeded but the response was lost, all place a SECOND
-- order — which also decrements stock a second time and can charge again. This
-- is the single most common way a working checkout still loses money.
--
-- The key is supplied by the caller and generated once per checkout attempt, so
-- a retry of the SAME attempt carries the same key and is recognised, while a
-- genuine second order from the same customer gets a new one. Partial index so
-- historical rows (and any path that legitimately has no key) are unaffected.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_unique
  ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Admin audit log.
--
-- "Who refunded this order?" was unanswerable. Every mutating admin action —
-- refunds, cancellations, price changes, stock adjustments, status flips — left
-- no trace of who did it or what the value was before. For a system that moves
-- money and is operated by a team, that is the difference between a mistake you
-- can investigate and one you can only argue about.
--
-- Deliberately append-only and deliberately generic: `entity_type` + `entity_id`
-- rather than a column per table, so a new admin surface logs without a
-- migration. `before`/`after` hold only the fields that changed, not whole rows.
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT,
  before      JSONB,
  after       JSONB,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON admin_audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor  ON admin_audit_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_recent ON admin_audit_log(created_at DESC);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins may read the log. Nobody may write it through PostgREST and nobody may
-- edit or delete it at all — an audit trail a user can rewrite is not one.
-- Writes happen through the service role only.
CREATE POLICY "Admins read audit log" ON admin_audit_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ---------------------------------------------------------------------------
-- 3. Backfill shipments from the legacy tracking columns.
--
-- orders.carrier / tracking_number / tracking_url predate the shipments table.
-- Leaving both populated means two sources of truth for the same fact, and the
-- customer order page has to guess which to believe. Every order that was
-- shipped the old way becomes a real shipment so there is exactly one answer.
INSERT INTO shipments (order_id, provider, courier_name, awb, tracking_url, status, shipped_at, delivered_at)
SELECT o.id, 'manual', o.carrier, o.tracking_number, o.tracking_url,
       CASE WHEN o.status = 'delivered' THEN 'delivered' ELSE 'in_transit' END,
       o.shipped_at, o.delivered_at
FROM orders o
WHERE o.tracking_number IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM shipments s WHERE s.order_id = o.id);

-- One synthetic event each, so the backfilled parcels are not blank in the
-- customer's history.
INSERT INTO shipment_events (shipment_id, status, description, occurred_at)
SELECT s.id, s.status, 'Recorded before parcel tracking was introduced',
       COALESCE(s.shipped_at, s.created_at)
FROM shipments s
WHERE NOT EXISTS (SELECT 1 FROM shipment_events e WHERE e.shipment_id = s.id);
