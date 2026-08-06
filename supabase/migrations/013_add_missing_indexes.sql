-- Missing indexes on FKs/filter columns that are actively queried by application
-- code but were never indexed: product_variants.product_id (every PDP load),
-- order_items.product_id/variant_id (reviews' verified-purchase check, and any
-- "orders containing product X" query), coupon_usages.coupon_id/user_id (every
-- coupon-code checkout attempt in validateCoupon()), shipping_rates.zone_id
-- (every shipping-cost calculation at checkout), orders.payment_status (admin
-- filtering/reporting — only `status` had an index, not payment_status).
-- Plain CREATE INDEX, not CONCURRENTLY: this migration runner applies each file
-- inside a transaction, and CONCURRENTLY can't run inside one. Table sizes at
-- this stage make the brief write-lock a non-issue.

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_variant_id ON order_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_coupon_id ON coupon_usages(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_user_id ON coupon_usages(user_id);
CREATE INDEX IF NOT EXISTS idx_shipping_rates_zone_id ON shipping_rates(zone_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
