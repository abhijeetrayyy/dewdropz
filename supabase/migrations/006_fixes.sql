-- ============================================================================
-- 006: Fixes — inventory trigger, indexes, transactional stock adjustment
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Fix 1: Extend decrement_inventory to handle variant stock
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION decrement_inventory()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.variant_id IS NOT NULL THEN
      UPDATE product_variants
      SET inventory_quantity = inventory_quantity - NEW.quantity
      WHERE id = NEW.variant_id;
    END IF;
    UPDATE products
    SET inventory_quantity = inventory_quantity - NEW.quantity
    WHERE id = NEW.product_id;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.variant_id IS NOT NULL THEN
      UPDATE product_variants
      SET inventory_quantity = inventory_quantity + OLD.quantity
      WHERE id = OLD.variant_id;
    END IF;
    UPDATE products
    SET inventory_quantity = inventory_quantity + OLD.quantity
    WHERE id = OLD.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Fix 2: Transactional stock adjustment function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION adjust_stock_atomic(
  p_product_id UUID,
  p_quantity_change INT,
  p_reason TEXT,
  p_variant_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  -- Insert movement
  INSERT INTO inventory_movements (product_id, variant_id, quantity_change, reason, reference_type, notes)
  VALUES (p_product_id, p_variant_id, p_quantity_change, p_reason, 'manual', p_notes);

  -- Update cached stock
  IF p_variant_id IS NOT NULL THEN
    UPDATE product_variants
    SET inventory_quantity = inventory_quantity + p_quantity_change
    WHERE id = p_variant_id;
  END IF;
  UPDATE products
  SET inventory_quantity = inventory_quantity + p_quantity_change
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Fix 3: Missing indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products(deleted_at);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_reason ON inventory_movements(reason);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_ref_type ON inventory_movements(reference_type);
CREATE INDEX IF NOT EXISTS idx_addresses_user_type ON addresses(user_id, type);
