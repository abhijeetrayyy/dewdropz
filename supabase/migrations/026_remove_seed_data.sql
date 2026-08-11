-- ============================================================================
-- DESTRUCTIVE / IRREVERSIBLE. Run manually in the Supabase SQL editor.
-- Not applied automatically by this codebase.
--
-- What this does:
--   1. Empties every cart (cart_items + carts), for logged-in users and
--      guests alike.
--   2. Hard-deletes every product NOT flagged is_customizable (the same flag
--      /customize already filters on) — i.e. every seed/demo product except
--      the three real ones: Custom Hoodie, Custom Sweatshirt, Custom Print
--      Tee. Verified against the live database before writing this file:
--      exactly those 3 rows have is_customizable = true out of 16 total.
--      Collections and categories are untouched — they stay in the admin
--      backend and on the homepage per the request that triggered this
--      cleanup.
--
-- Referential integrity (already enforced by existing FK constraints, no
-- manual cleanup needed):
--   - cart_items, reviews, product_categories, product_tags,
--     product_attribute_values, custom_designs, inventory_movements
--     all ON DELETE CASCADE from products — removed automatically.
--   - order_items.product_id is ON DELETE SET NULL — past orders keep their
--     line items intact (name/price/etc. are already snapshotted directly on
--     order_items), only the FK link to the deleted product is nulled.
--
-- There is no server-side wishlist table (wishlist is client-side
-- localStorage only), so there is nothing to clear for it here.
-- ============================================================================

BEGIN;

-- 1. Clear all carts (guest + logged-in).
DELETE FROM cart_items;
DELETE FROM carts;

-- 2. Remove every non-customizable (seed/demo) product.
DELETE FROM products
WHERE is_customizable = false;

COMMIT;
