-- adjust_stock_atomic() always hardcoded reference_type to 'manual' with no
-- reference_id, so stock restored by order cancellation/refund couldn't be tied
-- back to the order in the inventory_movements audit trail. Extending it with
-- optional reference_type/reference_id (defaulting to the old behavior) keeps
-- every existing caller working unchanged while letting order-driven restocks
-- record what they actually are.
CREATE OR REPLACE FUNCTION adjust_stock_atomic(
  p_product_id UUID,
  p_quantity_change INT,
  p_reason TEXT,
  p_variant_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT 'manual',
  p_reference_id UUID DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO inventory_movements (product_id, variant_id, quantity_change, reason, reference_type, reference_id, notes)
  VALUES (p_product_id, p_variant_id, p_quantity_change, p_reason, p_reference_type, p_reference_id, p_notes);

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
