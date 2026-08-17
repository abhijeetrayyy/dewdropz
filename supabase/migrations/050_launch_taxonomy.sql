-- The catalogue the shop is actually launching with.
--
-- The seeded categories described a different business. "Bottles & Extras",
-- "Head & Sun", "Layers & Shells" and "Packs & Carry" are the shelves of an
-- expedition outfitter — jackets, packs, hardware — and the client's brief is
-- explicit that this reads as a Patagonia/Arc'teryx gear company, which is not
-- what DEWDROPZ is launching. The first drop is apparel and drinkware.
--
-- None of the four was ever attached to anything: product_categories is empty,
-- which is also why the shop's category filter chips have never filtered
-- anything. So this is a replacement, not a migration of live data.
--
-- Two levels, because the brief's own structure has two: a customer browses by
-- department (Apparel, Drinkware) and then by garment (T-Shirts, Hoodies…).
-- `parent_id` already exists for exactly this and was unused.
--
-- Collections are left alone. The three the brief names — O Collection, Mist &
-- Morning, Silent Altitude — already exist with those exact names and slugs.
-- What was missing is that no product belonged to one, so every collection page
-- was empty; the products are attached below.

-- ---------------------------------------------------------------------------
-- 1. Retire the outfitter shelves
-- ---------------------------------------------------------------------------
-- Deleted rather than deactivated: nothing references them (verified — zero
-- product_categories rows), they carry no history worth keeping, and leaving
-- four dead rows behind means the next person has to work out which set is
-- real. The slugs are freed for reuse at the same time.
DELETE FROM categories WHERE slug IN ('hydration', 'headwear', 'layers', 'packs');

-- ---------------------------------------------------------------------------
-- 2. The two departments, and what sits under each
-- ---------------------------------------------------------------------------
-- sort_order is set explicitly so the filter rail and the SHOP dropdown both
-- read in the brief's order rather than alphabetically — "T-Shirts, Hoodies,
-- Sweatshirts, Caps" is how the client lists them, and alphabetical would put
-- Caps first.
INSERT INTO categories (slug, name, parent_id, sort_order, is_primary_eligible, is_active) VALUES
  ('apparel',   'Apparel',   NULL, 1, false, true),
  ('drinkware', 'Drinkware', NULL, 2, false, true)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, is_active = true;

INSERT INTO categories (slug, name, parent_id, sort_order, is_primary_eligible, is_active)
SELECT v.slug, v.name, p.id, v.sort_order, true, true
FROM (VALUES
  ('t-shirts',    'T-Shirts',          1, 'apparel'),
  ('hoodies',     'Hoodies',           2, 'apparel'),
  ('sweatshirts', 'Sweatshirts',       3, 'apparel'),
  ('caps',        'Caps',              4, 'apparel'),
  ('mugs',        'Mugs',              1, 'drinkware'),
  ('tumblers',    'Tumblers & Bottles',2, 'drinkware')
) AS v(slug, name, sort_order, parent_slug)
JOIN categories p ON p.slug = v.parent_slug
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id,
      sort_order = EXCLUDED.sort_order, is_active = true;

-- ---------------------------------------------------------------------------
-- 3. Put the three live products on their shelves
-- ---------------------------------------------------------------------------
-- Matched on slug, not name, because names are editable in admin and slugs are
-- the stable handle. Idempotent, so re-running this migration is harmless.
INSERT INTO product_categories (product_id, category_id)
SELECT p.id, c.id
FROM (VALUES
  ('custom-print-tee',  't-shirts'),
  ('custom-hoodie',     'hoodies'),
  ('custom-sweatshirt', 'sweatshirts')
) AS v(product_slug, category_slug)
JOIN products   p ON p.slug = v.product_slug
JOIN categories c ON c.slug = v.category_slug
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Give every product a collection
-- ---------------------------------------------------------------------------
-- Every product had collection_id NULL, so all three collection pages rendered
-- empty and "Shop by Collection" on the homepage had nothing behind it. The
-- brief says a customer entering Silent Altitude should see T-Shirts, Hoodies,
-- Sweatshirts, Mug and Tumbler/Bottle — i.e. the full range carries each story,
-- rather than each product belonging to one story.
--
-- products.collection_id is a single foreign key, so it cannot express
-- "this tee is in all three collections". Assigning one collection per product
-- as a starting point, spread across the three so none is empty; the team can
-- move them in admin. Making a product belong to several stories needs a join
-- table and is a separate change — flagged rather than guessed at.
UPDATE products SET collection_id = (SELECT id FROM collections WHERE slug = 'silent-altitude')
  WHERE slug = 'custom-hoodie' AND collection_id IS NULL;
UPDATE products SET collection_id = (SELECT id FROM collections WHERE slug = 'mist-and-morning')
  WHERE slug = 'custom-sweatshirt' AND collection_id IS NULL;
UPDATE products SET collection_id = (SELECT id FROM collections WHERE slug = 'o-collection')
  WHERE slug = 'custom-print-tee' AND collection_id IS NULL;
