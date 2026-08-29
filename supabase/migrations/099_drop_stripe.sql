-- ---------------------------------------------------------------------------
-- 099 — Stripe is gone; stop the database from accepting it
-- ---------------------------------------------------------------------------
--
-- The integration is removed: no keys, no client, no checkout session, no
-- webhook route. What remained was a CHECK constraint still listing 'stripe' as
-- a permitted payment method, which is how a removed integration comes back —
-- some future code path writes the string, nothing rejects it, and an order
-- exists that no refund path can service.
--
-- Verified empty before writing this: zero orders on 'stripe', zero refunds,
-- zero webhook_events. Nothing is being invalidated.
--
-- Razorpay is the gateway. COD is the other way to pay.
-- ---------------------------------------------------------------------------

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method = ANY (ARRAY['razorpay'::text, 'cod'::text]));

COMMENT ON COLUMN orders.payment_method IS
  'razorpay (cards, UPI, netbanking) or cod. Stripe was removed in migration 099 — it was never used by a single order.';
