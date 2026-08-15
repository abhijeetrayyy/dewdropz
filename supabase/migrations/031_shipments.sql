-- Shipments.
--
-- Today a shipment is four loose columns on `orders`: carrier, tracking_number,
-- tracking_url, shipped_at — typed in by hand. That models "an order is exactly
-- one parcel, dispatched once, by a human who remembers to paste the AWB." Four
-- things a real engine needs are impossible in that shape:
--
--   * SPLIT SHIPMENTS. Two items, one in stock and one printed to order, ship on
--     different days on different AWBs. One tracking_number column cannot hold
--     that, so today the second parcel is invisible to the customer.
--   * SHIPMENT STATUS SEPARATE FROM ORDER STATUS. An order is 'shipped' the
--     moment anything leaves; a parcel is in_transit / out_for_delivery / rto /
--     delivered. Collapsing them means the order flips to 'delivered' when the
--     first of two parcels lands.
--   * A PLACE FOR A WEBHOOK TO WRITE. Courier webhooks deliver a stream of scan
--     events. Without an events table each one overwrites the last and the
--     history is gone — which is exactly what a customer asks for when a parcel
--     stalls ("where has it been since Tuesday?").
--   * RETURNS / RTO. A return is a shipment in the other direction. With one set
--     of columns on the order there is nowhere to put it.
--
-- Deliberately provider-agnostic: `provider` is free text and `provider_payload`
-- keeps whatever the courier returned, so adding Delhivery next to Shiprocket is
-- a new adapter and no schema change. The existing columns on `orders` are left
-- untouched — they keep working, and are backfillable from the first shipment.

CREATE TABLE IF NOT EXISTS shipments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  -- 'shiprocket' | 'delhivery' | 'manual' — free text on purpose, see above.
  provider         TEXT NOT NULL DEFAULT 'manual',
  -- The courier's own identifiers. Nullable because a shipment exists from the
  -- moment it is packed, before an AWB has been bought.
  provider_ref     TEXT,
  awb              TEXT,
  courier_name     TEXT,

  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','label_created','picked_up','in_transit',
                                       'out_for_delivery','delivered','failed','rto','cancelled')),

  label_url        TEXT,
  tracking_url     TEXT,

  -- What actually went in the box, so a split shipment can say which items.
  -- Nullable = the whole order, which keeps the common case simple.
  weight_grams     INT,
  -- Paise, like every other money column in this schema. Never a float.
  shipping_cost    INT,

  shipped_at       TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  -- Whatever the courier returned, kept verbatim for debugging a bad label or a
  -- disputed delivery months later.
  provider_payload JSONB,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One AWB can only belong to one shipment. Partial, because AWB is null until
-- the label is bought and several pending shipments may coexist.
CREATE UNIQUE INDEX IF NOT EXISTS shipments_awb_unique
  ON shipments(provider, awb) WHERE awb IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status_recent ON shipments(status, created_at DESC);

-- Which line items are in which parcel. Absent rows = the whole order.
CREATE TABLE IF NOT EXISTS shipment_items (
  shipment_id   UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  quantity      INT  NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (shipment_id, order_item_id)
);
CREATE INDEX IF NOT EXISTS idx_shipment_items_order_item ON shipment_items(order_item_id);

-- The scan history a courier webhook appends to. Append-only by intent.
CREATE TABLE IF NOT EXISTS shipment_events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id  UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  status       TEXT NOT NULL,
  description  TEXT,
  location     TEXT,
  occurred_at  TIMESTAMPTZ NOT NULL,
  -- The courier's own event id where one exists. Together with shipment_id this
  -- makes redelivered webhooks idempotent by constraint rather than by a
  -- read-then-decide check — the same pattern already used for payment webhooks.
  provider_event_id TEXT,
  raw          JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS shipment_events_dedupe
  ON shipment_events(shipment_id, provider_event_id) WHERE provider_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipment_events_shipment ON shipment_events(shipment_id, occurred_at DESC);

CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE shipments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_events ENABLE ROW LEVEL SECURITY;

-- A customer may read the shipments for their own orders, and nothing else.
-- Writes are service_role only: shipments are created by the dispatch flow and
-- updated by courier webhooks, never by a browser.
CREATE POLICY "Users read own shipments" ON shipments FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = shipments.order_id AND o.user_id = auth.uid()));

CREATE POLICY "Users read own shipment items" ON shipment_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM shipments s JOIN orders o ON o.id = s.order_id
    WHERE s.id = shipment_items.shipment_id AND o.user_id = auth.uid()
  ));

CREATE POLICY "Users read own shipment events" ON shipment_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM shipments s JOIN orders o ON o.id = s.order_id
    WHERE s.id = shipment_events.shipment_id AND o.user_id = auth.uid()
  ));
