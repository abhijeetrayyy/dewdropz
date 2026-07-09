-- createOrder() has called supabase.rpc('increment_coupon_usage', { coupon_id }) since
-- coupons were built, but this function never existed in any prior migration or on the
-- live database — the call has been failing silently (its result was never checked)
-- on every coupon checkout, so coupons.usage_count never actually increments. That
-- breaks usage_limit and user_limit enforcement in validateCoupon(), which reads
-- usage_count to decide whether a coupon is exhausted.
CREATE OR REPLACE FUNCTION increment_coupon_usage(coupon_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE coupons SET usage_count = COALESCE(usage_count, 0) + 1 WHERE id = coupon_id;
END;
$$ LANGUAGE plpgsql;
