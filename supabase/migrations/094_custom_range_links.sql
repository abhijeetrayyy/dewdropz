-- ---------------------------------------------------------------------------
-- 094 — the custom range, joined up
-- ---------------------------------------------------------------------------
--
-- THE GAP
--
-- The studio and the catalogue have never known about each other. A blank
-- (`products.is_customizable`) opens the studio; a finished, already-printed
-- garment is an ordinary product row with its own photographs. Nothing joins
-- the two, so:
--
--   · a printed tee sold in the shop cannot say it came from the studio;
--   · a shopper looking at it has no route to "what else can go on this shirt";
--   · `design_library` (092) is free-floating artwork with no idea which
--     garments it actually suits.
--
-- Every one of those is a missing edge between rows that already exist. This
-- migration adds the three edges and nothing else — no new entity, because a
-- printed tee IS a product and library artwork IS a design. Inventing a third
-- table to sit between them would duplicate both.
--
-- THE EDGES
--
--   products.custom_blank_id   -> the blank this finished product was printed on
--   products.library_design_id -> the artwork printed on it
--   design_library.blank_ids   -> the blanks this artwork is offered on
--
-- WHY TWO COLUMNS ON products AND NOT A JOIN TABLE
--
-- A printed product carries exactly one design on one blank — that is what
-- makes it a distinct SKU with its own photographs and its own price. A join
-- table would model a many-to-many that cannot occur, and would then need a
-- uniqueness constraint to forbid the extra rows it just made possible. Two
-- nullable foreign keys say the true thing directly.
--
-- WHY blank_ids IS AN ARRAY AND NOT A JOIN TABLE EITHER
--
-- The question this answers is "may I show this artwork on that garment?" —
-- asked once per studio session, over a handful of blanks. An empty array
-- means "every blank", which is the common case and costs no rows. A GIN
-- index makes the containment test cheap if the library grows.
--
-- INTEGRITY
--
-- Three things must not be expressible, and two of them a CHECK can catch:
-- a product cannot be printed on itself, and a product that names a design
-- must also name the blank it was printed on (otherwise the storefront has a
-- design with nothing to attach it to). The third — that `custom_blank_id`
-- points at a row which is actually customizable — is cross-row, so it needs
-- a trigger. It gets one, in the same spirit as the stock-integrity trigger in
-- 021: the database refuses the impossible state rather than trusting every
-- caller to remember.
-- ---------------------------------------------------------------------------

-- ── The edges ──────────────────────────────────────────────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS custom_blank_id   UUID REFERENCES products(id)       ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS library_design_id UUID REFERENCES design_library(id) ON DELETE SET NULL;

COMMENT ON COLUMN products.custom_blank_id IS
  'For a finished, already-printed garment: the customizable blank it was printed on. Non-null is what makes this product part of the custom range, so the storefront can badge it and offer the studio.';
COMMENT ON COLUMN products.library_design_id IS
  'For a finished, already-printed garment: which design_library artwork is on it. Optional — a one-off print need not exist in the library.';

ALTER TABLE design_library
  ADD COLUMN IF NOT EXISTS blank_ids UUID[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN design_library.blank_ids IS
  'Which customizable blanks this artwork is offered on. EMPTY MEANS EVERY BLANK — the common case, and the default, so adding a design needs no decision. A narrow design that only suits a pocket zone can name its blanks instead.';

-- ── What must not be expressible ───────────────────────────────────────────

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_custom_blank_not_self;
ALTER TABLE products ADD CONSTRAINT products_custom_blank_not_self
  CHECK (custom_blank_id IS NULL OR custom_blank_id <> id);

-- A design with no blank leaves the product page holding artwork it cannot
-- attribute to a garment, and no way to offer "other designs for this blank".
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_design_needs_blank;
ALTER TABLE products ADD CONSTRAINT products_design_needs_blank
  CHECK (library_design_id IS NULL OR custom_blank_id IS NOT NULL);

-- ── The cross-row rule a CHECK cannot express ──────────────────────────────
--
-- `custom_blank_id` must point at a row that is actually customizable and has
-- print zones. Without this, admin can point a printed tee at another printed
-- tee, and the studio link on the product page opens a studio with nothing to
-- edit. SECURITY DEFINER is deliberately NOT used: this reads `products`,
-- which the caller already has open, so it needs no extra reach.

CREATE OR REPLACE FUNCTION assert_custom_blank_is_customizable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  ok BOOLEAN;
BEGIN
  IF NEW.custom_blank_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.is_customizable
       AND jsonb_array_length(COALESCE(p.customization_config -> 'colors', '[]'::jsonb)) > 0
    INTO ok
    FROM products p
   WHERE p.id = NEW.custom_blank_id;

  IF ok IS NOT TRUE THEN
    RAISE EXCEPTION
      'custom_blank_id must reference a customizable product that has print zones (got %)',
      NEW.custom_blank_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_custom_blank_valid ON products;
CREATE TRIGGER trg_products_custom_blank_valid
  BEFORE INSERT OR UPDATE OF custom_blank_id ON products
  FOR EACH ROW EXECUTE FUNCTION assert_custom_blank_is_customizable();

-- ── Indexes ────────────────────────────────────────────────────────────────
--
-- The storefront's two new questions:
--   "what else was printed on this blank?"  -> idx_products_custom_blank
--   "which designs suit this blank?"        -> idx_design_library_blanks (GIN)

CREATE INDEX IF NOT EXISTS idx_products_custom_blank
  ON products(custom_blank_id) WHERE custom_blank_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_library_design
  ON products(library_design_id) WHERE library_design_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_design_library_blanks
  ON design_library USING GIN (blank_ids);
