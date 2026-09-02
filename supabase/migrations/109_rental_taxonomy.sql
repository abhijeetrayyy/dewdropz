-- ---------------------------------------------------------------------------
-- 109 — the locker gets shelves, and gear gets specifications
-- ---------------------------------------------------------------------------
--
-- THE PROBLEM
--
-- `/rent` is one flat grid. Seven items today and no way to say "show me
-- shelter" or "show me what I can carry", because `rental_items` has no
-- category column at all. The shop next door has had a two-level taxonomy since
-- 004 and a filter rail with counts on every facet since the 23 August brief;
-- the rental locker — which is the HARDER browse, because availability is a
-- calendar rather than a number — got none of it.
--
-- WHY NOT REUSE `categories` / `product_categories`
--
-- Two reasons, and the second is the one that decides it.
--
-- The vocabularies are different axes. 050 replaced the outfitter shelves with
-- the two departments the shop actually launched with — Apparel and Drinkware —
-- and a four-season tent belongs under neither. Putting rental shelves into the
-- same table means the shop's filter rail starts offering "Shelter" for a
-- catalogue that has none, or every read grows a discriminator column.
--
-- And rental categorisation is SINGLE-select. `product_categories` is a
-- junction table with an is_primary flag because a garment is legitimately a
-- T-Shirt and an O Collection piece at once. A tent is shelter and nothing
-- else. A junction table for a one-to-many relationship is a join every read
-- pays for to express a constraint it then has to enforce in application code.
--
-- So: a small table of shelves, and a nullable FK. Same reasoning as 098's
-- "the link lives on rental_items because renting is the narrower case".
--
-- WHY THE SPECS ARE THREE COLUMNS AND A JSONB, NOT ALL JSONB
--
-- `weight_grams` and `capacity` are here as real columns because they are the
-- two things a person FILTERS on — "what can I carry" and "how many of us are
-- going" — and a filter over a JSONB key is a filter that cannot be indexed,
-- cannot be checked, and silently returns nothing when somebody types the key
-- with different capitalisation. Everything else about a piece of gear is a
-- display row on the item page and varies per category (a tent has a season
-- rating, a pack does not), so it goes in `specs` where the shape is free.
--
-- NOTE ON `weight_grams`: this is the SHIPPING weight the council flagged at
-- 100:weightGrams → 1kg. It is not wired to delivery pricing here — every
-- configured rate is `flat`, and changing that raises posted prices, which is
-- open question 5 for the client. This column is what makes answering it
-- possible later without a second migration.
-- ---------------------------------------------------------------------------

-- ── The shelves ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rental_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  -- One sentence, shown on the category tile. The shop's `categories` has a
  -- `description` nobody ever wrote into; this is named for what it is so it
  -- either carries a line of copy or is plainly empty.
  blurb      TEXT,
  sort       INT NOT NULL DEFAULT 100,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT rental_categories_slug_shape CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,60}$')
);

COMMENT ON TABLE rental_categories IS
  'Shelves in the gear locker. Deliberately separate from `categories`, which holds the SHOP''s departments (Apparel, Drinkware) — a different vocabulary on a different axis. Single-select: a tent is shelter and nothing else.';

-- ── What sits on them ──────────────────────────────────────────────────────
--
-- ON DELETE SET NULL, not RESTRICT: removing a shelf must never be able to
-- take a bookable item off the storefront with it. An uncategorised item still
-- renders — it simply falls into "Everything else" in the rail.

ALTER TABLE rental_items
  ADD COLUMN IF NOT EXISTS category_id  UUID REFERENCES rental_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS weight_grams INT CHECK (weight_grams IS NULL OR weight_grams > 0),
  ADD COLUMN IF NOT EXISTS capacity     INT CHECK (capacity IS NULL OR capacity > 0),
  ADD COLUMN IF NOT EXISTS specs        JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN rental_items.weight_grams IS
  'Packed weight of one unit. Filterable ("what can I carry"), and the figure a weight-based delivery rate would read if the client ever moves off flat rates — see open question 5.';
COMMENT ON COLUMN rental_items.capacity IS
  'How many people this serves — a 2P tent is 2, a kitchen kit that cooks for four is 4. NULL for gear where the question is meaningless (poles, spikes).';
COMMENT ON COLUMN rental_items.specs IS
  'Free-shape display specifications for the item page, as {label: value}. Anything filterable belongs in a real column instead — a filter over a JSONB key cannot be indexed or checked and fails silently on a mistyped key.';

-- `specs` is a flat object of strings or numbers, not an array and not nested.
-- Enforced, because the item page renders it as a definition list and a nested
-- value would reach a customer as "[object Object]".
--
-- Via an IMMUTABLE function because a CHECK constraint may not contain a
-- subquery, and testing "every value is a scalar" needs one. The function is a
-- pure fold over its argument, so it is genuinely immutable and safe to index
-- a constraint on.

CREATE OR REPLACE FUNCTION rental_specs_is_flat(p_specs JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT jsonb_typeof(p_specs) = 'object'
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_each(p_specs) AS e(k, v)
        WHERE jsonb_typeof(e.v) NOT IN ('string', 'number')
     );
$$;

ALTER TABLE rental_items DROP CONSTRAINT IF EXISTS rental_items_specs_is_flat_object;
ALTER TABLE rental_items ADD CONSTRAINT rental_items_specs_is_flat_object
  CHECK (rental_specs_is_flat(specs));

CREATE INDEX IF NOT EXISTS idx_rental_items_category ON rental_items(category_id, sort);

DROP TRIGGER IF EXISTS set_updated_at ON rental_categories;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON rental_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── The six shelves the locker actually has ────────────────────────────────
--
-- Derived from what is in it, not from what an outfitter's site would list —
-- the mistake 050 had to undo. Seven items fall into six groups; "Bundles"
-- earns its own shelf rather than being filed under shelter, because a person
-- browsing bundles is shopping for a trip and a person browsing shelter is
-- shopping for a tent.

INSERT INTO rental_categories (slug, name, blurb, sort) VALUES
  ('shelter',  'Shelter',           'Tents and tarps. The thing between you and the weather.',        1),
  ('sleep',    'Sleeping',          'Bags and mats, rated honestly and dried between every trip.',    2),
  ('carry',    'Packs & carrying',  'Rucksacks big enough for a multi-day, fitted at the counter.',   3),
  ('cooking',  'Camp kitchen',      'Stoves, pots and the rest of cooking for a group outdoors.',     4),
  ('traction', 'Trail hardware',    'Poles, spikes and what gets you across the difficult bit.',      5),
  ('bundles',  'Complete kits',     'Everything for a trip, in one booking and at one deposit.',      6)
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name, blurb = EXCLUDED.blurb, sort = EXCLUDED.sort, is_active = TRUE;

-- ── Shelving what is already in the locker ─────────────────────────────────
--
-- By slug, matching the seed scripts. An item whose slug is not listed keeps
-- category_id NULL and renders under "Everything else" — a gap the admin can
-- close in the editor, not a reason for it to disappear.

UPDATE rental_items i SET category_id = c.id
  FROM rental_categories c
 WHERE i.category_id IS NULL
   AND c.slug = CASE i.slug
     WHEN 'four-season-tent'    THEN 'shelter'
     WHEN 'basecamp-dome-tent-4p' THEN 'shelter'
     WHEN 'down-sleeping-bag'   THEN 'sleep'
     WHEN 'sixty-litre-pack'    THEN 'carry'
     WHEN 'camp-kitchen-kit'    THEN 'cooking'
     WHEN 'trekking-poles'      THEN 'traction'
     WHEN 'microspikes'         THEN 'traction'
     WHEN 'weekend-camp-bundle' THEN 'bundles'
   END;

-- Capacity where the catalogue already states it in its own name and copy.
-- Weight is deliberately left NULL rather than guessed: an invented packed
-- weight on a filter a person chooses gear by is worse than no figure at all.
UPDATE rental_items SET capacity = 2 WHERE slug IN ('four-season-tent', 'weekend-camp-bundle') AND capacity IS NULL;
UPDATE rental_items SET capacity = 1 WHERE slug IN ('down-sleeping-bag', 'sixty-litre-pack') AND capacity IS NULL;
UPDATE rental_items SET capacity = 4 WHERE slug IN ('camp-kitchen-kit', 'basecamp-dome-tent-4p') AND capacity IS NULL;

-- ── RLS ────────────────────────────────────────────────────────────────────
--
-- The shelves are shop window, like `rental_items` itself: anyone may read an
-- active one. No write policies — every write goes through a server action on
-- the service-role client, which is the shape 093 established.

ALTER TABLE rental_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active rental categories" ON rental_categories;
CREATE POLICY "Public read active rental categories" ON rental_categories
  FOR SELECT USING (is_active = TRUE);
