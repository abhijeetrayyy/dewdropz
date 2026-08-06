-- "Admins can view all orders/order_items" were written USING (true) — wide
-- open to any authenticated user, not actually admin-gated (admin queries
-- already go through the service-role client and never relied on these
-- policies, so tightening them is pure risk reduction, no admin-facing
-- behavior change). Matches the real admin-check pattern already used
-- elsewhere (e.g. shipping_zones policies).
DROP POLICY "Admins can view all orders" ON orders;
CREATE POLICY "Admins can view all orders"
  ON orders FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY "Admins can view all order items" ON order_items;
CREATE POLICY "Admins can view all order items"
  ON order_items FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
