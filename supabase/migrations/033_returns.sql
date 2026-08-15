-- Returns / RMA.
--
-- A return is a shipment in the other direction, and the shipments table can
-- already model the reverse leg — but nothing drove it, so a customer wanting to
-- send something back had no route except email, and the team had nowhere to
-- record that they had agreed to it.
--
-- Modelled as its own entity rather than a flag on the order because a return
-- has its own lifecycle that does not map onto order status: it is requested
-- before it is agreed, agreed before it arrives, and arrives before it is
-- refunded. Collapsing that into the order would lose the middle.
--
-- Money and stock deliberately do NOT move on approval — only on receipt. The
-- most expensive mistake in returns is refunding for a parcel that never comes
-- back, so `received_at` is the gate for both.

CREATE TABLE IF NOT EXISTS returns (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Human-facing, like order_number. Generated in the action, not here, so it
  -- shares the order's formatting.
  rma_number    TEXT UNIQUE,

  status        TEXT NOT NULL DEFAULT 'requested'
                  CHECK (status IN ('requested','approved','rejected','in_transit',
                                    'received','refunded','cancelled')),

  reason        TEXT NOT NULL,
  customer_note TEXT,
  admin_note    TEXT,

  -- Paise, like every other money column. Null until the team decides what is
  -- actually being refunded — which may be less than the line total if the
  -- item comes back damaged.
  refund_amount INT,
  -- Set on receipt; the gate for restock and refund.
  received_at   TIMESTAMPTZ,
  refunded_at   TIMESTAMPTZ,
  -- The return leg's own parcel, when the customer ships it back.
  shipment_id   UUID REFERENCES shipments(id) ON DELETE SET NULL,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_returns_order  ON returns(order_id);
CREATE INDEX IF NOT EXISTS idx_returns_user   ON returns(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(status, created_at DESC);

-- Which lines, and how many of each. A customer returning one of three tees is
-- the normal case, so this is never assumed to be the whole order.
CREATE TABLE IF NOT EXISTS return_items (
  return_id     UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  quantity      INT  NOT NULL CHECK (quantity > 0),
  -- Recorded on receipt: resellable stock goes back, damaged stock does not.
  restock       BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (return_id, order_item_id)
);
CREATE INDEX IF NOT EXISTS idx_return_items_order_item ON return_items(order_item_id);

CREATE TRIGGER update_returns_updated_at BEFORE UPDATE ON returns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE returns      ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;

-- A customer may read their own returns and open one against their own order.
-- Everything after that — approving, receiving, refunding — is service_role
-- only, so a customer cannot approve their own refund by writing a status.
CREATE POLICY "Users read own returns" ON returns FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users request own returns" ON returns FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'requested'
    AND EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.user_id = auth.uid())
  );

CREATE POLICY "Users read own return items" ON return_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM returns r WHERE r.id = return_items.return_id AND r.user_id = auth.uid()));
