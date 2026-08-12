-- ============================================================================
-- Best-sellers, computed in the database.
--
-- The "Most ordered" homepage rail needs units-sold per product, but
-- order_items is correctly locked down by RLS: a customer may read only their
-- own lines. That left two bad options — pull thousands of order rows into the
-- web server and aggregate in JS (which is what actions/showcase.ts did, and
-- which does not scale), or expose order data to the storefront (which is not
-- happening).
--
-- This is the third option: a SECURITY DEFINER function that returns ONLY the
-- aggregate — product id and total units — with no order id, customer, email,
-- address, price or date attached. That is merchandising data, not personal
-- data, and it is already implicit in any "best sellers" list on any shop.
--
-- Counting only `payment_status = 'paid'` matters: without it, abandoned and
-- failed checkouts would rank products that nobody actually bought.
--
-- Both surfaces call this — the web homepage and the mobile apps — so the two
-- can't drift, and the phone gets best-sellers without needing the Next.js
-- server to be reachable at all.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.product_sales_ranking(p_limit int DEFAULT 12)
RETURNS TABLE (product_id uuid, units bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
-- Pinned so the definer's rights can't be redirected at a shadowed table.
SET search_path = public, pg_temp
AS $$
  SELECT oi.product_id, SUM(oi.quantity)::bigint AS units
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.product_id IS NOT NULL
    AND o.payment_status = 'paid'
  GROUP BY oi.product_id
  ORDER BY units DESC, oi.product_id
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 12), 50));
$$;

REVOKE ALL ON FUNCTION public.product_sales_ranking(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.product_sales_ranking(int) TO anon, authenticated;

COMMENT ON FUNCTION public.product_sales_ranking(int) IS
  'Aggregate units-sold per product across paid orders. Returns no order or customer data. Used by the best-sellers rail on web and mobile.';
