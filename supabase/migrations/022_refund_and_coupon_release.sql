-- Full commerce-engine lifecycle audit found three related gaps: cancelling a
-- *paid* order never actually refunded it (payment_status stayed 'paid'
-- forever with nothing to flag it), admin-side cancellation never restored
-- stock at all, and coupon usage was never released on cancel/refund — which,
-- combined with the UNIQUE(coupon_id, user_id) constraint from 021, meant a
-- customer whose order got cancelled could never use that code again. This
-- migration adds the tracking columns/function the app-level fix (in
-- lib/orders-internal.ts) needs.

-- Cumulative amount actually refunded at the gateway so far. Needed because
-- a customer cancelling an already-partially-refunded order must only refund
-- the *remaining* balance, not the full total_amount again.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_amount INT NOT NULL DEFAULT 0;

-- Set true when an automatic gateway refund (on cancellation) fails — the
-- order still gets cancelled (a transient gateway error shouldn't block a
-- customer from stopping fulfillment) but someone needs to manually issue
-- the refund. Cleared whenever a refund is subsequently issued successfully.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_needs_attention BOOLEAN NOT NULL DEFAULT false;

-- Partial index: the admin "needs attention" view only ever queries the true
-- rows, and they're rare — a partial index keeps it cheap without bloating
-- every other query over orders.
CREATE INDEX IF NOT EXISTS idx_orders_refund_needs_attention ON orders(created_at DESC) WHERE refund_needs_attention = true;

-- Mirrors increment_coupon_usage (010/021): floors at 0 so a duplicate call
-- (retried cancellation, cancel-then-refund on the same order) can never
-- take a coupon's usage_count negative.
CREATE OR REPLACE FUNCTION decrement_coupon_usage(coupon_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE coupons
  SET usage_count = GREATEST(COALESCE(usage_count, 0) - 1, 0)
  WHERE id = coupon_id;
END;
$$ LANGUAGE plpgsql;
