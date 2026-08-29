-- ---------------------------------------------------------------------------
-- 098 — the same piece of gear can be bought OR rented
-- ---------------------------------------------------------------------------
--
-- THE DECISION
--
-- A tent is one thing. Until now the app could only rent it: `rental_items`
-- and `products` were two unrelated catalogues, so selling gear would have
-- meant a second listing with its own name, photographs and copy, and the two
-- would have drifted the first time somebody edited one of them.
--
-- Instead the rental row points at the sellable product. The pair is what makes
-- an item both:
--
--   rental_items.product_id IS NULL   → rent-only (bundles, the camp kitchen —
--                                       kits we assemble and do not sell)
--   products with no rental row       → buy-only (a tee)
--   both                              → the customer chooses on either page
--
-- WHY THE LINK LIVES ON `rental_items`
--
-- Renting is the narrower case: most products will never be rentable, and a
-- nullable column on the smaller table costs nothing. `products` stays ignorant
-- of rentals, which matters because every storefront list already selects from
-- it and none of them should start paying for a join they do not use.
--
-- UNIQUE, because "which tent do I rent when you buy this one" has to have
-- exactly one answer.
--
-- WHAT THIS DELIBERATELY DOES NOT DO: SHARE A STOCK COUNT
--
-- It is tempting to make one number mean "how many tents we have". It would be
-- wrong. `products.inventory_quantity` is how many we can SELL and is
-- decremented at checkout. `rental_units` is how many physical copies exist to
-- LEND, and availability is decided by the exclusion constraint over their
-- booked date ranges (096) — a unit out on hire is not free, but it is also not
-- gone. Selling the last sellable tent must not make the rental locker empty,
-- and returning a hired tent must not create sellable stock.
--
-- Two questions, two mechanisms, on purpose. If they are ever unified it must
-- be a deliberate piece of inventory design, not a side effect of this column.
-- ---------------------------------------------------------------------------

ALTER TABLE rental_items
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;

COMMENT ON COLUMN rental_items.product_id IS
  'The sellable product this gear corresponds to, when we also sell it. NULL means rent-only (kits and bundles). Never a stock link — selling is governed by products.inventory_quantity, lending by rental_units and the no-double-booking constraint.';

-- One rental row per product: "which tent do I rent when you buy this one"
-- needs exactly one answer. Partial, so the many rent-only rows (all NULL) do
-- not collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS rental_items_one_per_product
  ON rental_items (product_id)
  WHERE product_id IS NOT NULL;

-- A rental row may only point at a product that can actually be bought. An
-- archived or deleted product is not an offer, and linking to one would put a
-- dead "own it instead" price on the rental page.
CREATE OR REPLACE FUNCTION assert_rental_product_is_sellable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  ok BOOLEAN;
BEGIN
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT (status = 'active' AND deleted_at IS NULL)
    INTO ok
    FROM products
   WHERE id = NEW.product_id;

  IF ok IS NULL THEN
    RAISE EXCEPTION 'That product does not exist.';
  END IF;

  IF NOT ok THEN
    RAISE EXCEPTION 'That product is not on sale, so it cannot be offered as a buy-instead.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rental_product_is_sellable ON rental_items;
CREATE TRIGGER rental_product_is_sellable
  BEFORE INSERT OR UPDATE OF product_id ON rental_items
  FOR EACH ROW EXECUTE FUNCTION assert_rental_product_is_sellable();
