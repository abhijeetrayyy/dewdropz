-- generate_order_number() (002_rls_policies.sql) was defined but never actually
-- wired to anything — not a column DEFAULT, not a trigger, and createOrder() never
-- sets order_number itself. Since the column is TEXT UNIQUE NOT NULL with no
-- default, every real checkout insert has been failing outright with a not-null
-- violation; the only orders that ever existed were scripts/seed.ts's dummy rows,
-- which happen to hardcode order_number by hand and so never exposed this.
--
-- Fixed as a BEFORE INSERT trigger (same pattern already used here for updated_at
-- and handle_new_user) rather than a plain column default, so it can retry on the
-- rare collision instead of letting the unique constraint just reject the insert —
-- generate_order_number()'s 4-digit random suffix only has 10,000 values per day,
-- which is not enough headroom to trust a single unguarded attempt at real volume.
-- Only fills the column in when NULL, so explicit values (like the seed script's)
-- are left alone.

CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
DECLARE
  attempt INT := 0;
BEGIN
  IF NEW.order_number IS NULL THEN
    LOOP
      NEW.order_number := generate_order_number();
      attempt := attempt + 1;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM orders WHERE order_number = NEW.order_number) OR attempt >= 5;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_order_number_before_insert ON orders;
CREATE TRIGGER set_order_number_before_insert
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION set_order_number();
