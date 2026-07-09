-- ============================================================================
-- 004: Product Taxonomy, Attributes & Inventory Management
-- Phase 1 of the backend rebuild
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Extend products table
-- ---------------------------------------------------------------------------

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  ADD COLUMN IF NOT EXISTS low_stock_threshold INT DEFAULT 5,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Migrate existing is_active to status
UPDATE products SET status = 'active' WHERE is_active = TRUE AND status = 'draft';
UPDATE products SET status = 'archived' WHERE is_active = FALSE AND status = 'draft';

-- Extend product_variants
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS low_stock_threshold INT DEFAULT 5;

-- ---------------------------------------------------------------------------
-- Categories (self-referencing hierarchy, capped at 3 levels in app logic)
-- ---------------------------------------------------------------------------

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  is_primary_eligible BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product-category junction (one primary per product enforced by partial unique index)
CREATE TABLE product_categories (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (product_id, category_id)
);

-- Only one primary category per product
CREATE UNIQUE INDEX idx_one_primary_category_per_product
  ON product_categories (product_id)
  WHERE is_primary = TRUE;

CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_product_categories_category_id ON product_categories(category_id);

-- ---------------------------------------------------------------------------
-- Tags
-- ---------------------------------------------------------------------------

CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE product_tags (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (product_id, tag_id)
);

CREATE INDEX idx_tags_slug ON tags(slug);
CREATE INDEX idx_product_tags_tag_id ON product_tags(tag_id);

-- ---------------------------------------------------------------------------
-- Attributes & values
-- ---------------------------------------------------------------------------

CREATE TABLE attributes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  input_type TEXT NOT NULL DEFAULT 'text' CHECK (input_type IN ('text', 'select', 'multiselect', 'boolean', 'number')),
  is_variant_attribute BOOLEAN DEFAULT FALSE,
  is_filterable BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE attribute_values (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attribute_id UUID NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  slug TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(attribute_id, slug)
);

CREATE TABLE product_attribute_values (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  attribute_id UUID NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
  attribute_value_id UUID REFERENCES attribute_values(id) ON DELETE SET NULL,
  text_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (product_id, attribute_id),
  CHECK (
    (attribute_value_id IS NOT NULL AND text_value IS NULL) OR
    (attribute_value_id IS NULL AND text_value IS NOT NULL)
  )
);

CREATE INDEX idx_attribute_values_attribute_id ON attribute_values(attribute_id);
CREATE INDEX idx_product_attr_values_attr_id ON product_attribute_values(attribute_id);
CREATE INDEX idx_product_attr_values_value_id ON product_attribute_values(attribute_value_id);

-- ---------------------------------------------------------------------------
-- Variant option values (replaces flat product_variants.name for logic)
-- ---------------------------------------------------------------------------

CREATE TABLE variant_option_values (
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  attribute_id UUID NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
  attribute_value_id UUID NOT NULL REFERENCES attribute_values(id) ON DELETE CASCADE,
  PRIMARY KEY (variant_id, attribute_id)
);

CREATE INDEX idx_variant_option_values_attr_id ON variant_option_values(attribute_id);
CREATE INDEX idx_variant_option_values_value_id ON variant_option_values(attribute_value_id);

-- ---------------------------------------------------------------------------
-- Inventory movements (full audit trail)
-- ---------------------------------------------------------------------------

CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity_change INT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('restock', 'sale', 'return', 'adjustment', 'damaged', 'initial')),
  reference_type TEXT CHECK (reference_type IN ('order', 'manual', 'return')),
  reference_id UUID,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventory_movements_product_id ON inventory_movements(product_id);
CREATE INDEX idx_inventory_movements_variant_id ON inventory_movements(variant_id);
CREATE INDEX idx_inventory_movements_created_at ON inventory_movements(created_at DESC);

-- Seed initial inventory movements from current stock levels
INSERT INTO inventory_movements (product_id, variant_id, quantity_change, reason, reference_type, notes)
SELECT id, NULL, inventory_quantity, 'initial', 'manual', 'Seeded from products.inventory_quantity'
FROM products
WHERE inventory_quantity > 0;

INSERT INTO inventory_movements (product_id, variant_id, quantity_change, reason, reference_type, notes)
SELECT product_id, id, inventory_quantity, 'initial', 'manual', 'Seeded from product_variants.inventory_quantity'
FROM product_variants
WHERE inventory_quantity > 0;
