-- Real GST rules, replacing "one percentage for the whole shop".
--
-- The single `store_settings.gst_percentage` was wrong for this catalogue in
-- three separate ways, and every one of them is a wrong number on an invoice:
--
--   1. Rates differ by product. Apparel is not taxed like a steel bottle.
--   2. Apparel's rate depends on the PRICE of the piece — 5% at or below
--      ₹1,000, 12% above it. A rate that is a function of value cannot be
--      expressed as a store-wide setting at all.
--   3. An intra-state sale is CGST + SGST and an inter-state sale is IGST.
--      Same total, different invoice — and getting it wrong is a filing
--      problem, not a cosmetic one.
--
-- Rates live in a table because they are the government's numbers, not ours:
-- when a slab changes, the team edits a row instead of waiting for a deploy.
-- `gst_percentage` survives as the fallback for anything unmapped, so nothing
-- becomes untaxed by accident.

-- --------------------------------------------------------------------------
-- 1. Where we sell FROM — decides CGST/SGST vs IGST
-- --------------------------------------------------------------------------
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS origin_state TEXT NOT NULL DEFAULT 'Uttarakhand';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS gstin TEXT;

COMMENT ON COLUMN store_settings.origin_state IS
  'Place of supply origin. Buyer in the same state = CGST+SGST, any other state = IGST.';

-- --------------------------------------------------------------------------
-- 2. The rate table
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_rates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  hsn_code    TEXT NOT NULL,
  -- Per-unit price band, in paise, that this row applies to. Both bounds are
  -- inclusive-of-lower / exclusive-of-upper, and max_price NULL means "no
  -- ceiling". Two rows with the same HSN and adjacent bands are how the
  -- apparel threshold is expressed.
  min_price   INT NOT NULL DEFAULT 0,
  max_price   INT,
  rate        DECIMAL(5,2) NOT NULL CHECK (rate >= 0 AND rate <= 100),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tax_rates_band_sane CHECK (max_price IS NULL OR max_price > min_price)
);

-- The resolver's lookup. Narrow band first so the more specific row wins.
CREATE INDEX IF NOT EXISTS idx_tax_rates_lookup
  ON tax_rates(hsn_code, min_price) WHERE is_active = true;

-- Two active rows for one HSN must not cover the same price. Without this an
-- editor can create an overlap and the rate a product gets becomes a matter of
-- row order.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_rates_no_duplicate_band
  ON tax_rates(hsn_code, min_price) WHERE is_active = true;

ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;
-- Readable by anyone: the storefront has to be able to show a tax-inclusive
-- estimate before checkout. Writes are service-role only.
DROP POLICY IF EXISTS "Anyone reads active tax rates" ON tax_rates;
CREATE POLICY "Anyone reads active tax rates" ON tax_rates FOR SELECT USING (is_active = true);

-- --------------------------------------------------------------------------
-- 3. What a product is, for tax purposes
-- --------------------------------------------------------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS hsn_code TEXT;
COMMENT ON COLUMN products.hsn_code IS
  'HSN classification. Unmapped products fall back to store_settings.gst_percentage rather than going untaxed.';

-- --------------------------------------------------------------------------
-- 4. Tax recorded where an invoice needs it: per line
-- --------------------------------------------------------------------------
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS hsn_code      TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tax_rate      DECIMAL(5,2) NOT NULL DEFAULT 0;
-- The line's value AFTER its share of any discount — the figure the rate is
-- applied to, stored because it is not recoverable from total_price once an
-- order-level discount has been apportioned across lines.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS taxable_value INT NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tax_amount    INT NOT NULL DEFAULT 0;

-- --------------------------------------------------------------------------
-- 5. And summarised on the order, the way it is printed
-- --------------------------------------------------------------------------
-- [{ rate: 5, taxable: 123400, tax: 6170 }, …] — one entry per distinct rate,
-- which is exactly the shape a GST invoice's tax summary takes.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb;
-- True when buyer and seller are in different states. Kept as a stored fact
-- rather than recomputed later: the split has to match what was on the invoice
-- even if the store moves state afterwards.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_is_igst BOOLEAN NOT NULL DEFAULT false;

-- --------------------------------------------------------------------------
-- 6. Seed the slabs this catalogue actually needs
-- --------------------------------------------------------------------------
-- Apparel carries the value-based threshold; the rest are flat. These are
-- starting values for the team to confirm against their own CA's advice —
-- which is why they are rows and not constants.
INSERT INTO tax_rates (name, hsn_code, min_price, max_price, rate)
SELECT * FROM (VALUES
  ('Apparel up to ₹1,000',    '6109', 0,       100001, 5.00),
  ('Apparel above ₹1,000',    '6109', 100001,  NULL,   12.00),
  ('Sweatshirts up to ₹1,000','6110', 0,       100001, 5.00),
  ('Sweatshirts above ₹1,000','6110', 100001,  NULL,   12.00),
  ('Headwear',                '6505', 0,       NULL,   12.00),
  ('Vacuum flasks & bottles', '9617', 0,       NULL,   18.00),
  ('Ceramic mugs',            '6912', 0,       NULL,   12.00),
  ('Backpacks & bags',        '4202', 0,       NULL,   18.00)
) AS v(name, hsn_code, min_price, max_price, rate)
WHERE NOT EXISTS (SELECT 1 FROM tax_rates);
