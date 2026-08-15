-- Index audit.
--
-- Postgres does NOT create an index for a FOREIGN KEY column automatically —
-- only for PRIMARY KEY and UNIQUE. That has two costs, and the second is the
-- one that bites without warning:
--
--   1. Joins and lookups on the child side do a sequential scan.
--   2. Every DELETE or key UPDATE on the PARENT table must scan the whole child
--      table to enforce the constraint. Deleting one product with an unindexed
--      cart_items.product_id means a full scan of every cart line in the system,
--      while holding a lock. At three products nobody notices; at three thousand
--      products and a year of carts, an admin deleting a product stalls the shop.
--
-- Every index below was checked against what already exists so nothing is
-- duplicated. Composite PKs already cover their own leading column
-- (product_tags, product_attribute_values, variant_option_values), so those are
-- deliberately absent. cart_items is NOT covered despite its UNIQUE, because
-- that constraint leads with cart_id — an index on (cart_id, product_id,
-- variant_id) cannot serve a lookup by product_id alone.
--
-- CONCURRENTLY is deliberately not used: these run in a migration transaction,
-- and the tables are small enough today that a brief lock is the right trade.
-- If this ever needs re-running against a large live table, split it out and
-- add CONCURRENTLY there.

-- ── Unindexed foreign keys ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id   ON cart_items(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_variant_id   ON cart_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_order_id  ON coupon_usages(order_id);
CREATE INDEX IF NOT EXISTS idx_custom_designs_user_id  ON custom_designs(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_designs_product_id ON custom_designs(product_id);
CREATE INDEX IF NOT EXISTS idx_custom_designs_variant_id ON custom_designs(variant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_by ON inventory_movements(created_by);
CREATE INDEX IF NOT EXISTS idx_notifications_order_id ON notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id        ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_order_id       ON reviews(order_id);

-- ── Indexes shaped like the queries that actually run ───────────────────────
-- getFeaturedReviews(): WHERE is_approved = true AND content IS NOT NULL
-- ORDER BY created_at DESC. A bare index on is_approved is useless here — it is
-- a two-value column, so it selects roughly half the table and Postgres will
-- ignore it. This one carries the sort as well, so the query is an index scan
-- with no sort step, and the partial WHERE keeps it to the rows that qualify.
CREATE INDEX IF NOT EXISTS idx_reviews_approved_recent
  ON reviews(created_at DESC)
  WHERE is_approved = true AND content IS NOT NULL;

-- Product listings are always "active, newest first" (getProducts, shop, home).
-- Same reasoning: is_active alone is low-cardinality, so pair it with the sort.
CREATE INDEX IF NOT EXISTS idx_products_active_recent
  ON products(created_at DESC)
  WHERE is_active = true;

-- A customer's own order history: WHERE user_id = ? ORDER BY created_at DESC.
-- idx_orders_user_id serves the filter but leaves the sort to be done in memory
-- for every page load; this serves both.
CREATE INDEX IF NOT EXISTS idx_orders_user_recent ON orders(user_id, created_at DESC);

-- Admin order queues filter by status and read newest first.
CREATE INDEX IF NOT EXISTS idx_orders_status_recent ON orders(status, created_at DESC);

-- Cart reads are always "this cart's lines"; cart_id leads the UNIQUE, so this
-- is already served — recorded here only so the omission reads as deliberate.
