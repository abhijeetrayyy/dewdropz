-- Refunds: a record of what the gateway actually did.
--
-- Two problems this fixes, and the first one caused the second.
--
-- 1. ONE COLUMN HELD THREE DIFFERENT IDENTIFIERS. `orders.payment_intent_id`
--    was written with a Razorpay ORDER id at checkout (`order_…`), a Stripe
--    SESSION id on the Stripe path (`cs_…`), and then OVERWRITTEN with a
--    Razorpay PAYMENT id (`pay_…`) by the browser success callback that runs on
--    essentially every Razorpay order.
--
--    The refund path reads that column and calls
--    `GET /v1/orders/{id}/payments`. Handed a `pay_…` id it 404s, the response
--    was never checked, so the list of payments came back undefined, the
--    "find the captured payment" step quietly found nothing, the refund POST
--    never fired — and the function returned success. The order was then marked
--    refunded, the audit log recorded it, stock went back, and the customer was
--    emailed that their money was on its way. No money moved.
--
--    `gateway_payment_id` separates the two. `payment_intent_id` keeps its
--    original meaning (the gateway's order/session handle); the captured
--    payment id lives here.
--
-- 2. NOTHING RECORDED A REFUND. There was no refunds table and no gateway
--    refund id stored anywhere, so even once you suspected the above, you could
--    not produce the list of who was affected, and nothing could ever be
--    reconciled against a Razorpay or Stripe statement. `orders.refunded_amount`
--    is a running total — it cannot tell you about the attempt that failed.
--
-- Failed attempts are rows too. A refund that the gateway rejected is exactly
-- the thing someone needs to find later, and a table that only holds successes
-- is how it stays hidden.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS gateway_payment_id TEXT;

COMMENT ON COLUMN orders.payment_intent_id IS
  'The gateway''s ORDER/SESSION handle — Razorpay order_… or Stripe cs_…. Not the payment.';
COMMENT ON COLUMN orders.gateway_payment_id IS
  'The captured PAYMENT id — Razorpay pay_… or Stripe pi_…. What a refund is issued against.';

CREATE TABLE IF NOT EXISTS refunds (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  gateway           TEXT NOT NULL CHECK (gateway IN ('stripe', 'razorpay', 'cod', 'manual')),
  -- Null on a failure, and null for COD where there is no gateway to refund
  -- through. Present means the gateway acknowledged it and this is the handle
  -- to reconcile against.
  gateway_refund_id TEXT,

  amount            INT  NOT NULL CHECK (amount > 0),
  status            TEXT NOT NULL CHECK (status IN ('succeeded', 'failed')),

  -- Why it was refunded, and — when it failed — what the gateway said.
  reason            TEXT,
  error             TEXT,

  -- Who asked for it. Text rather than a profiles FK so the trail survives the
  -- staff member's account being deleted, same reasoning as admin_audit_log.
  actor_email       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id, created_at DESC);
-- The query someone runs after discovering a problem: "what failed, recently?"
CREATE INDEX IF NOT EXISTS idx_refunds_failed ON refunds(created_at DESC) WHERE status = 'failed';

ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

-- Same shape as admin_audit_log: SELECT is the only policy, so rows are written
-- through the service role and nobody can edit away a refund that failed.
CREATE POLICY "Admins read refunds" ON refunds FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

COMMENT ON TABLE refunds IS
  'One row per refund ATTEMPT, successful or not. Append-only via service role.';
