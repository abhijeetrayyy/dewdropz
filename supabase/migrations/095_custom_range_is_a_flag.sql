-- ---------------------------------------------------------------------------
-- 095 — the custom range is a flag, not a recipe
-- ---------------------------------------------------------------------------
--
-- WHAT 094 GOT WRONG
--
-- 094 modelled a finished, already-printed garment as a RECIPE: a blank plus a
-- library design (`custom_blank_id` + `library_design_id`), on the assumption
-- that naming both is how the shop describes the product. It also made
-- `custom_blank_id` load-bearing — a non-null blank was the only thing that put
-- a product in the custom range at all.
--
-- That is not how these products are made. They are photographed, not composed:
-- an admin uploads the picture of a shirt that has already been printed, and
-- the only thing they want to say about it is "this one belongs to the custom
-- range". Requiring them to also pick the artwork out of a library — artwork
-- that may not be in the library, because the print was a one-off — makes them
-- describe the product twice, in a vocabulary the product does not have.
--
-- WHAT THIS CHANGES
--
--   products.is_custom_range   NEW. The switch. A plain boolean an admin ticks.
--                              This alone decides whether the storefront offers
--                              the studio on that product page.
--
--   products.custom_blank_id   Kept, now OPTIONAL and purely a parent link:
--                              "this shirt is a child of that blank". Set it
--                              and the studio opens on exactly that garment;
--                              leave it null and the storefront says the
--                              garment is not in the studio yet and offers the
--                              blanks that are.
--
--   products.library_design_id DROPPED. It only existed to support the recipe
--                              model. Nothing reads it, and a column nothing
--                              reads is a question every future reader has to
--                              answer.
--
-- WHY A SEPARATE FLAG RATHER THAN "custom_blank_id IS NOT NULL"
--
-- Because the two facts are genuinely different, and the difference is the
-- whole feature. "This is a custom-range product" is a merchandising decision
-- the admin makes. "It was printed on that blank" is a fact that may not be
-- known, may not have a blank in the catalogue, or may become false when a
-- blank is archived. Folding them into one column means a product silently
-- leaves the range the day its parent blank is retired — which is exactly when
-- you most want the page to keep saying "this came out of our studio".
-- ---------------------------------------------------------------------------

-- ── The switch ─────────────────────────────────────────────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_custom_range BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN products.is_custom_range IS
  'Ticked in admin: this finished, already-printed garment belongs to the custom range, so its product page offers the studio. Independent of custom_blank_id — a range product need not have a parent blank in the catalogue.';

-- Anything 094 put in the range stays in it. `custom_blank_id` was the only way
-- to be in the range before this migration, so it is an exact backfill.
UPDATE products SET is_custom_range = TRUE WHERE custom_blank_id IS NOT NULL;

-- ── The recipe half goes ───────────────────────────────────────────────────

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_design_needs_blank;
DROP INDEX IF EXISTS idx_products_library_design;
ALTER TABLE products DROP COLUMN IF EXISTS library_design_id;

-- ── The parent link becomes optional, and subordinate to the flag ──────────
--
-- A parent blank without the flag is a contradiction: it would mean "printed on
-- that blank, but not part of the range", which no screen can render. The flag
-- is the switch; the link only refines it.

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_blank_needs_flag;
ALTER TABLE products ADD CONSTRAINT products_blank_needs_flag
  CHECK (custom_blank_id IS NULL OR is_custom_range = TRUE);

COMMENT ON COLUMN products.custom_blank_id IS
  'Optional parent: the customizable blank this finished garment was printed on. Null is normal and means "we do not stock that blank in the studio" — the storefront then offers the blanks that do exist rather than a dead link.';

-- `products_custom_blank_not_self` and the trigger from 094 both still apply:
-- a product cannot be its own parent, and a parent must be a real customizable
-- blank with print zones. Neither is affected by the flag.

-- ── Index ──────────────────────────────────────────────────────────────────
--
-- The storefront's question is now "is this in the range?", asked once per
-- product page, plus "what else is on this blank?" which 094's index covers.

CREATE INDEX IF NOT EXISTS idx_products_custom_range
  ON products(is_custom_range) WHERE is_custom_range = TRUE;
