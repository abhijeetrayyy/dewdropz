-- The analytics page, computed in Postgres.
--
-- It read every order in the range TOGETHER WITH ALL THEIR LINE ITEMS, then
-- aggregated five different ways in Node: revenue, order count, a zero-filled
-- daily trend, top products by revenue, and the status mix. The payload was the
-- problem more than the arithmetic — items are the bulk of it, and they exist
-- only to be summed.
--
-- Less urgent than payments_summary (migration 041) because a date range bounds
-- it, but the same shape, and it is the query that grows fastest per order.
--
-- Everything below reproduces the JavaScript exactly, including its quirks:
--
--   * 'cancelled' orders are excluded from revenue, order count, the trend and
--     top products — but INCLUDED in the status mix, which is the one figure
--     that is meant to show them.
--   * the trend is zero-filled across every day in the window, so the chart
--     does not skip quiet days, and it buckets by UTC date because the old code
--     bucketed on `created_at.slice(0, 10)` of an ISO string, which is UTC.
--   * top products key on product_id, falling back to product_name when the
--     product row has since been deleted — the same `product_id ?? product_name`
--     the Node version used, so a deleted product's sales stay attributed
--     rather than collapsing together under NULL.
--   * average order value rounds half-up on a paise integer, matching
--     Math.round, which is why it is ROUND(x) on numeric rather than integer
--     division.

CREATE OR REPLACE FUNCTION analytics_summary(p_days INT DEFAULT 30)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH bounds AS (
    SELECT (NOW() - make_interval(days => p_days)) AS since
  ),
  in_range AS (
    SELECT o.id, o.status, o.total_amount, o.created_at
    FROM orders o, bounds b
    WHERE o.created_at >= b.since
  ),
  counted AS (
    SELECT * FROM in_range WHERE status <> 'cancelled'
  ),
  totals AS (
    SELECT
      COALESCE(SUM(total_amount), 0)::BIGINT AS total_revenue,
      COUNT(*)::BIGINT                       AS order_count
    FROM counted
  ),
  -- p_days buckets starting at the UTC date of `since`, matching the JS loop
  -- that ran i = 0 .. days-1 and keyed on toISOString().slice(0, 10).
  day_series AS (
    SELECT generate_series(
      ((SELECT since FROM bounds) AT TIME ZONE 'UTC')::date::timestamp,
      (((SELECT since FROM bounds) AT TIME ZONE 'UTC')::date + (p_days - 1))::timestamp,
      '1 day'::interval
    )::date AS day
  ),
  daily AS (
    SELECT (created_at AT TIME ZONE 'UTC')::date AS day, SUM(total_amount)::BIGINT AS revenue
    FROM counted
    GROUP BY 1
  ),
  trend AS (
    SELECT s.day, COALESCE(d.revenue, 0)::BIGINT AS revenue
    FROM day_series s
    LEFT JOIN daily d ON d.day = s.day
    ORDER BY s.day
  ),
  product_totals AS (
    SELECT
      COALESCE(oi.product_id::text, oi.product_name) AS key,
      MAX(oi.product_name)                           AS name,
      SUM(oi.total_price)::BIGINT                    AS revenue,
      SUM(oi.quantity)::BIGINT                       AS quantity
    FROM order_items oi
    JOIN counted c ON c.id = oi.order_id
    GROUP BY COALESCE(oi.product_id::text, oi.product_name)
  ),
  status_mix AS (
    SELECT status, COUNT(*)::BIGINT AS count
    FROM in_range
    GROUP BY status
  )
  SELECT jsonb_build_object(
    'totalRevenue', t.total_revenue,
    'orderCount',   t.order_count,
    'avgOrderValue', CASE WHEN t.order_count > 0
                          THEN ROUND(t.total_revenue::numeric / t.order_count)::BIGINT
                          ELSE 0 END,
    'revenueTrend', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('date', to_char(day, 'YYYY-MM-DD'), 'revenue', revenue) ORDER BY day)
       FROM trend), '[]'::jsonb),
    'topProducts', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('name', name, 'revenue', revenue, 'quantity', quantity)
                        ORDER BY revenue DESC)
       FROM (SELECT * FROM product_totals ORDER BY revenue DESC LIMIT 8) top), '[]'::jsonb),
    'statusMix', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('status', status, 'count', count) ORDER BY count DESC)
       FROM status_mix), '[]'::jsonb)
  )
  FROM totals t;
$$;

-- Same reasoning as payments_summary: SECURITY INVOKER so it cannot be used to
-- read around RLS, and store-wide revenue is for the service-role caller only.
REVOKE ALL ON FUNCTION analytics_summary(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION analytics_summary(INT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION analytics_summary(INT) TO service_role;

COMMENT ON FUNCTION analytics_summary(INT) IS
  'Revenue, order count, daily trend, top products and status mix for /admin/analytics.';
