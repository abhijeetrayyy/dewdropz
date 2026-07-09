-- ============================================================================
-- 005: RLS Policies & Triggers for Phase 1 tables
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE attribute_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_attribute_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_option_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is admin
-- Reusable policy helper already exists implicitly in 002, repeating for clarity:
-- EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')

-- Categories: public read for active, admin full access
CREATE POLICY "Public read active categories" ON categories
  FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admin full access categories" ON categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Product categories: public read, admin write
CREATE POLICY "Public read product_categories" ON product_categories
  FOR SELECT USING (TRUE);
CREATE POLICY "Admin full access product_categories" ON product_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Tags: public read, admin write
CREATE POLICY "Public read tags" ON tags
  FOR SELECT USING (TRUE);
CREATE POLICY "Admin full access tags" ON tags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Product tags: public read, admin write
CREATE POLICY "Public read product_tags" ON product_tags
  FOR SELECT USING (TRUE);
CREATE POLICY "Admin full access product_tags" ON product_tags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Attributes: public read, admin write
CREATE POLICY "Public read attributes" ON attributes
  FOR SELECT USING (TRUE);
CREATE POLICY "Admin full access attributes" ON attributes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Attribute values: public read, admin write
CREATE POLICY "Public read attribute_values" ON attribute_values
  FOR SELECT USING (TRUE);
CREATE POLICY "Admin full access attribute_values" ON attribute_values
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Product attribute values: public read, admin write
CREATE POLICY "Public read product_attribute_values" ON product_attribute_values
  FOR SELECT USING (TRUE);
CREATE POLICY "Admin full access product_attribute_values" ON product_attribute_values
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Variant option values: public read, admin write
CREATE POLICY "Public read variant_option_values" ON variant_option_values
  FOR SELECT USING (TRUE);
CREATE POLICY "Admin full access variant_option_values" ON variant_option_values
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Inventory movements: public read for own (via orders), admin full access
CREATE POLICY "Users can view own inventory movements" ON inventory_movements
  FOR SELECT USING (
    auth.uid() = created_by
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admin full access inventory_movements" ON inventory_movements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- Triggers for updated_at on new tables
-- ---------------------------------------------------------------------------

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attributes_updated_at BEFORE UPDATE ON attributes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Function: wire order_items INSERT to inventory_movements
-- Runs AFTER the existing decrement_inventory trigger (which updates products.inventory_quantity)
-- and ALSO writes the inventory_movements audit row
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION record_inventory_movement_on_order()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO inventory_movements (product_id, variant_id, quantity_change, reason, reference_type, reference_id, created_by, notes)
  VALUES (
    NEW.product_id,
    NEW.variant_id,
    -NEW.quantity,
    'sale',
    'order',
    NEW.order_id,
    (SELECT user_id FROM orders WHERE id = NEW.order_id),
    'Order placed'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create the trigger if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'record_inventory_movement_on_order_item') THEN
    CREATE TRIGGER record_inventory_movement_on_order_item
      AFTER INSERT ON order_items
      FOR EACH ROW EXECUTE FUNCTION record_inventory_movement_on_order();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Function: compute current stock from inventory_movements
-- Used to reconcile products.inventory_quantity / product_variants.inventory_quantity
-- with the audit trail when they drift.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_current_stock(p_product_id UUID, p_variant_id UUID DEFAULT NULL)
RETURNS INT AS $$
DECLARE
  total INT;
BEGIN
  SELECT COALESCE(SUM(quantity_change), 0)
  INTO total
  FROM inventory_movements
  WHERE product_id = p_product_id
    AND (p_variant_id IS NULL OR variant_id = p_variant_id);
  RETURN total;
END;
$$ LANGUAGE plpgsql;
