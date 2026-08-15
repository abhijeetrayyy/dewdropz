-- Indexes and one aggregate, chosen from EXPLAIN ANALYZE against a database
-- loaded with 10,000 orders, 2,000 reviews, 500 returns and 5,000 promotion
-- links — not from guessing about what might be slow.
--
-- Most of the engine was already fine at that size: the order list, its saved
-- views, the abandoned-cart sweep, the live-promotion lookup and the shipment
-- joins all took under a millisecond on an index. These are the four that were
-- not.

-- --------------------------------------------------------------------------
-- 1. Admin order search — the worst offender at 34.7ms and a full table scan
-- --------------------------------------------------------------------------
-- `ILIKE '%term%'` cannot use a btree index, and this is the query an admin
-- runs most: someone is on the phone and they are typing an order number. At
-- 10k orders it scanned every row; at 100k it would be a third of a second of
-- pure table scan, every keystroke.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_orders_number_trgm ON orders USING gin (order_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_orders_email_trgm  ON orders USING gin (email gin_trgm_ops);

-- --------------------------------------------------------------------------
-- 2. Reviews — a customer-facing sequential scan
-- --------------------------------------------------------------------------
-- The partial index from 030 covers the homepage's "recent approved reviews"
-- and nothing else, so the per-product review list on every product page was
-- scanning the whole table. That one is on the storefront's critical path.
CREATE INDEX IF NOT EXISTS idx_reviews_product_recent
  ON reviews(product_id, created_at DESC) WHERE is_approved;

-- And the admin queue, which reads newest-first across every review including
-- the unapproved ones the partial index deliberately excludes.
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);

-- --------------------------------------------------------------------------
-- 3. Returns list ordering
-- --------------------------------------------------------------------------
-- `idx_returns_status` already serves the filtered tabs. The unfiltered list
-- had nothing to sort on.
CREATE INDEX IF NOT EXISTS idx_returns_created_at ON returns(created_at DESC);

-- --------------------------------------------------------------------------
-- 4. Promotion spend, summed in the database
-- --------------------------------------------------------------------------
-- The admin promotions page was reading EVERY order_promotions row into Node
-- and reducing it there to show "cost so far". That is one row per promotion
-- per order, forever — 5,000 rows crossed the wire in this test to produce
-- eight numbers. Postgres should do the arithmetic.
CREATE OR REPLACE FUNCTION promotion_spend()
RETURNS TABLE (promotion_id UUID, spend BIGINT, orders BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT op.promotion_id, COALESCE(SUM(op.amount), 0)::BIGINT, COUNT(*)::BIGINT
  FROM order_promotions op
  GROUP BY op.promotion_id;
$$;

-- SECURITY DEFINER because order_promotions is service-role/owner-scoped; the
-- function returns only aggregates, never a row belonging to a customer, and
-- the admin action that calls it is behind requireAdmin().
REVOKE ALL ON FUNCTION promotion_spend() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION promotion_spend() TO service_role;

-- --------------------------------------------------------------------------
-- 5. Abandoned-cart summary, also summed in the database
-- --------------------------------------------------------------------------
-- The admin page's three header numbers describe the WHOLE set, so they cannot
-- be computed from the page of rows on screen — and fetching every cart just to
-- add up three figures is what pagination was introduced to stop.
CREATE OR REPLACE FUNCTION abandoned_cart_summary(cutoff TIMESTAMPTZ)
RETURNS TABLE (carts BIGINT, value BIGINT, emailed BIGINT, recovered BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH live AS (
    SELECT c.id, c.recovery_sent_at, c.recovered_at,
           (SELECT COALESCE(SUM(p.price * i.quantity), 0)
              FROM cart_items i JOIN products p ON p.id = i.product_id
             WHERE i.cart_id = c.id) AS cart_value
    FROM carts c
    WHERE c.user_id IS NOT NULL
      AND c.last_activity_at < cutoff
      -- An empty cart is a converted or cleared one, not an abandoned one.
      AND EXISTS (SELECT 1 FROM cart_items i WHERE i.cart_id = c.id)
  )
  SELECT COUNT(*)::BIGINT,
         COALESCE(SUM(cart_value), 0)::BIGINT,
         COUNT(*) FILTER (WHERE recovery_sent_at IS NOT NULL)::BIGINT,
         COUNT(*) FILTER (WHERE recovered_at IS NOT NULL)::BIGINT
  FROM live;
$$;

REVOKE ALL ON FUNCTION abandoned_cart_summary(TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION abandoned_cart_summary(TIMESTAMPTZ) TO service_role;
