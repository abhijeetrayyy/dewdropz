-- The payments page's four headline figures, computed in Postgres.
--
-- They were computed in Node from `select('payment_status, total_amount,
-- payment_method')` with no filter — every order ever placed, pulled across the
-- wire, to produce four numbers and a short per-method breakdown. It is the
-- same shape as the promotions page before `promotion_spend()` (migration 037),
-- and it grows with the order table rather than with what is on screen.
--
-- The arithmetic below is a deliberate, literal translation of what the Node
-- code did, so the numbers cannot move:
--
--   total_captured   SUM(total_amount) over payment_status = 'paid'
--   pending_count    COUNT of payment_status = 'pending'
--   failed_count     COUNT of payment_status = 'failed'
--   refunded_count   COUNT of 'refunded' OR 'partially_refunded'
--   by_method        those same PAID rows, summed per payment_method, with a
--                    null method reported as 'unknown' exactly as before
--
-- One difference, and it is an improvement rather than a change of meaning: the
-- old breakdown came back in whatever order the rows happened to arrive, since
-- it was built by inserting into a JS Map. This orders by amount, so the list
-- is stable between loads.

CREATE OR REPLACE FUNCTION payments_summary()
RETURNS TABLE (
  total_captured BIGINT,
  pending_count  BIGINT,
  failed_count   BIGINT,
  refunded_count BIGINT,
  by_method      JSONB
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH totals AS (
    SELECT
      COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'paid'), 0)::BIGINT AS total_captured,
      COUNT(*) FILTER (WHERE payment_status = 'pending')::BIGINT                    AS pending_count,
      COUNT(*) FILTER (WHERE payment_status = 'failed')::BIGINT                     AS failed_count,
      COUNT(*) FILTER (WHERE payment_status IN ('refunded', 'partially_refunded'))::BIGINT AS refunded_count
    FROM orders
  ),
  methods AS (
    SELECT
      COALESCE(payment_method, 'unknown') AS method,
      SUM(total_amount)::BIGINT           AS amount
    FROM orders
    WHERE payment_status = 'paid'
    GROUP BY COALESCE(payment_method, 'unknown')
  )
  SELECT
    t.total_captured,
    t.pending_count,
    t.failed_count,
    t.refunded_count,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('method', m.method, 'amount', m.amount) ORDER BY m.amount DESC)
       FROM methods m),
      '[]'::jsonb
    )
  FROM totals t;
$$;

-- SECURITY INVOKER, so this cannot become a way around RLS. The admin action
-- calls it with the service-role client, which is the only caller that should
-- see store-wide payment totals — so the grant says exactly that rather than
-- relying on nobody thinking to call it.
REVOKE ALL ON FUNCTION payments_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION payments_summary() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION payments_summary() TO service_role;

COMMENT ON FUNCTION payments_summary() IS
  'Store-wide payment totals for /admin/payments. Replaces reading every order row into Node.';
