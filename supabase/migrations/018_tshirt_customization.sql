ALTER TABLE products
  ADD COLUMN is_customizable BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN customization_config JSONB;

CREATE TABLE custom_designs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  front_design JSONB,
  back_design JSONB,
  front_preview_url TEXT,
  back_preview_url TEXT,
  front_print_url TEXT,
  back_print_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE custom_designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner or guest can create designs"
  ON custom_designs FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Owner or guest can read designs"
  ON custom_designs FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

ALTER TABLE cart_items ADD COLUMN custom_design_id UUID REFERENCES custom_designs(id) ON DELETE SET NULL;
ALTER TABLE order_items ADD COLUMN custom_design_id UUID REFERENCES custom_designs(id) ON DELETE SET NULL;

ALTER TABLE cart_items DROP CONSTRAINT cart_items_cart_id_product_id_variant_id_key;
CREATE UNIQUE INDEX cart_items_plain_unique ON cart_items(cart_id, product_id, variant_id) WHERE custom_design_id IS NULL;
