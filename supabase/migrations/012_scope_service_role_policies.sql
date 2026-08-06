-- Security hotfix. Four policies from 002_rls_policies.sql were written as
-- `USING (true)` / `WITH CHECK (true)` with no `TO` clause — in Postgres that
-- applies to every role, not just the service role the "-- Server-side only"
-- comments intended. On money/audit-critical tables (orders, order_items,
-- coupon_usages, webhook_events), that meant any client holding the public
-- anon key could insert or mutate rows directly via PostgREST — e.g. POST an
-- arbitrary total_amount straight to /rest/v1/orders — bypassing every price,
-- stock, and coupon check in application code entirely.
--
-- Scoping these to `service_role` closes that off. Every current caller of
-- these writes already uses the service-role key (webhook handlers in
-- actions/payments.ts, the Stripe edge function, scripts/seed.ts) except
-- actions/orders.ts's createOrder(), which is updated alongside this
-- migration to use createAdminSupabaseClient() for its writes — the same
-- pattern already used by every other privileged write in that file
-- (updateOrderStatus, refundOrder, restoreOrderStock).

DROP POLICY IF EXISTS "Service role can insert orders" ON orders;
CREATE POLICY "Service role can insert orders" ON orders
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert order items" ON order_items;
CREATE POLICY "Service role can insert order items" ON order_items
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert coupon usages" ON coupon_usages;
CREATE POLICY "Service role can insert coupon usages" ON coupon_usages
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access webhooks" ON webhook_events;
CREATE POLICY "Service role full access webhooks" ON webhook_events
  FOR ALL TO service_role USING (true);

-- "Public can subscribe" on newsletter_subscribers is intentionally left as-is —
-- unauthenticated newsletter signup is meant to be public, that one was never a bug.
