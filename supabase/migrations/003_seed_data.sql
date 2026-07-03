-- Seed Collections
INSERT INTO collections (slug, name, tagline, description, gradient, sort_order) VALUES
  ('mist-and-morning', 'Mist & Morning', 'Fog, dew, first light.', 'Born from early morning treks where the world feels new. Soft fabrics, earth tones, gear that breathes with the mountain.', 'linear-gradient(165deg, #4A5D52 0%, #9AAE9C 40%, #E8EAE4 100%)', 1),
  ('silent-altitude', 'Silent Altitude', 'Alpine stillness. Deep quiet.', 'For the high passes where the air is thin and the mind is clear. Technical layers, weather protection, minimal weight.', 'linear-gradient(165deg, #0B1520 0%, #1E3347 40%, #5A7A96 100%)', 2),
  ('o-collection', 'O Collection', 'Where the trail becomes a way of life.', 'Our signature line — refined essentials for the daily journey. Timeless design, premium materials, made to last.', 'linear-gradient(165deg, #2E1F16 0%, #6B3F28 50%, #C8906A 100%)', 3)
ON CONFLICT (slug) DO NOTHING;

-- Seed Products
-- Mist & Morning Collection
INSERT INTO products (collection_id, slug, name, description, short_description, price, compare_at_price, sku, inventory_quantity, weight, dimensions, images, is_featured, is_active) VALUES
  ((SELECT id FROM collections WHERE slug = 'mist-and-morning'), 'mist-tee', 'Mist Tee', 'Lightweight organic cotton tee designed for early morning starts. Breathable, moisture-wicking, and soft against the skin. Perfect as a base layer or standalone on warm days.', 'Organic cotton trekking t-shirt', 180000, 220000, 'DDZ-MM-TEE-001', 50, 180, '{"length": 72, "width": 52, "height": 1}', ARRAY['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800'], TRUE, TRUE),
  ((SELECT id FROM collections WHERE slug = 'mist-and-morning'), 'dawn-jogger', 'Dawn Jogger', 'Tapered fit joggers with elastic waist and ankle cuffs. Brushed interior for warmth, water-resistant finish for morning dew. Zip pockets secure your essentials.', 'Water-resistant tapered joggers', 320000, NULL, 'DDZ-MM-JOG-002', 30, 350, '{"length": 100, "width": 40, "height": 2}', ARRAY['https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=800'], TRUE, TRUE),
  ((SELECT id FROM collections WHERE slug = 'mist-and-morning'), 'trail-cap', 'Trail Cap', 'Unstructured 6-panel cap in washed cotton twill. Adjustable strap, embroidered dew peak logo. Packable — stuff it in your pocket.', 'Washed cotton twill cap', 150000, NULL, 'DDZ-MM-CAP-003', 80, 80, '{"length": 25, "width": 18, "height": 12}', ARRAY['https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800'], TRUE, TRUE),

-- Silent Altitude Collection
  ((SELECT id FROM collections WHERE slug = 'silent-altitude'), 'altitude-pack-40l', 'Altitude Pack 40L', 'Full-featured trekking backpack with internal frame, hydration sleeve, and rain cover. Multiple access points, compression straps, and gear loops. Built for multi-day Himalayan treks.', 'Waterproof trail backpack 40L', 280000, 350000, 'DDZ-SA-PAK-001', 15, 1400, '{"length": 68, "width": 32, "height": 28}', ARRAY['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800'], TRUE, TRUE),
  ((SELECT id FROM collections WHERE slug = 'silent-altitude'), 'summit-shell', 'Summit Shell Jacket', '3-layer Gore-Tex Pro shell. Helmet-compatible hood, pit zips, harness-friendly pockets. Taped seams, YKK AquaGuard zippers. Your shield against alpine storms.', '3L Gore-Tex Pro shell jacket', 420000, NULL, 'DDZ-SA-SHL-002', 10, 450, '{"length": 75, "width": 58, "height": 3}', ARRAY['https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=800'], TRUE, TRUE),
  ((SELECT id FROM collections WHERE slug = 'silent-altitude'), 'summit-flask', 'Summit Flask', 'Double-wall vacuum insulated stainless steel bottle. Keeps hot for 12 hours, cold for 24. Wide mouth for ice cubes, leak-proof lid with carry loop.', 'Insulated steel bottle 750ml', 120000, 150000, 'DDZ-SA-FLK-003', 40, 320, '{"length": 28, "width": 9, "height": 9}', ARRAY['https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800'], TRUE, TRUE),

-- O Collection
  ((SELECT id FROM collections WHERE slug = 'o-collection'), 'o-merino-tee', 'O Merino Tee', '17.5 micron merino wool. Naturally odor-resistant, temperature-regulating, and incredibly soft. The ultimate travel and trail companion.', 'Premium merino wool t-shirt', 350000, NULL, 'DDZ-OC-TEE-001', 25, 150, '{"length": 70, "width": 50, "height": 1}', ARRAY['https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800'], TRUE, TRUE),
  ((SELECT id FROM collections WHERE slug = 'o-collection'), 'o-canvas-tote', 'O Canvas Tote', 'Heavyweight organic cotton canvas with leather handles and base. Internal laptop sleeve, external pocket for water bottle. Ages beautifully.', 'Canvas tote with leather accents', 280000, NULL, 'DDZ-OC-TOT-002', 20, 600, '{"length": 42, "width": 35, "height": 15}', ARRAY['https://images.unsplash.com/photo-1544816155-12df9643f363?w=800'], FALSE, TRUE),
  ((SELECT id FROM collections WHERE slug = 'o-collection'), 'o-field-shirt', 'O Field Shirt', 'Japanese selvedge chambray with double-needle stitching. Two chest flaps with button closure, hidden pen slot. Cut for movement, made for life.', 'Selvedge chambray field shirt', 480000, NULL, 'DDZ-OC-SHR-003', 15, 280, '{"length": 76, "width": 56, "height": 2}', ARRAY['https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800'], TRUE, TRUE)
ON CONFLICT (slug) DO NOTHING;

-- Product Variants for Mist Tee
INSERT INTO product_variants (product_id, name, sku, price_adjustment, inventory_quantity, sort_order) VALUES
  ((SELECT id FROM products WHERE slug = 'mist-tee'), 'XS / Sage', 'DDZ-MM-TEE-001-XS-SG', 0, 10, 1),
  ((SELECT id FROM products WHERE slug = 'mist-tee'), 'S / Sage', 'DDZ-MM-TEE-001-S-SG', 0, 15, 2),
  ((SELECT id FROM products WHERE slug = 'mist-tee'), 'M / Sage', 'DDZ-MM-TEE-001-M-SG', 0, 15, 3),
  ((SELECT id FROM products WHERE slug = 'mist-tee'), 'L / Sage', 'DDZ-MM-TEE-001-L-SG', 0, 10, 4),
  ((SELECT id FROM products WHERE slug = 'mist-tee'), 'XL / Sage', 'DDZ-MM-TEE-001-XL-SG', 0, 5, 5),
  ((SELECT id FROM products WHERE slug = 'mist-tee'), 'XS / Clay', 'DDZ-MM-TEE-001-XS-CL', 0, 8, 6),
  ((SELECT id FROM products WHERE slug = 'mist-tee'), 'S / Clay', 'DDZ-MM-TEE-001-S-CL', 0, 12, 7),
  ((SELECT id FROM products WHERE slug = 'mist-tee'), 'M / Clay', 'DDZ-MM-TEE-001-M-CL', 0, 12, 8),
  ((SELECT id FROM products WHERE slug = 'mist-tee'), 'L / Clay', 'DDZ-MM-TEE-001-L-CL', 0, 8, 9),
  ((SELECT id FROM products WHERE slug = 'mist-tee'), 'XL / Clay', 'DDZ-MM-TEE-001-XL-CL', 0, 4, 10)
ON CONFLICT (sku) DO NOTHING;

-- Product Variants for Trail Cap
INSERT INTO product_variants (product_id, name, sku, price_adjustment, inventory_quantity, sort_order) VALUES
  ((SELECT id FROM products WHERE slug = 'trail-cap'), 'One Size / Sage', 'DDZ-MM-CAP-003-OS-SG', 0, 40, 1),
  ((SELECT id FROM products WHERE slug = 'trail-cap'), 'One Size / Clay', 'DDZ-MM-CAP-003-OS-CL', 0, 25, 2),
  ((SELECT id FROM products WHERE slug = 'trail-cap'), 'One Size / Forest', 'DDZ-MM-CAP-003-OS-FR', 0, 15, 3)
ON CONFLICT (sku) DO NOTHING;

-- Product Variants for Summit Flask
INSERT INTO product_variants (product_id, name, sku, price_adjustment, inventory_quantity, sort_order) VALUES
  ((SELECT id FROM products WHERE slug = 'summit-flask'), '750ml / Sage', 'DDZ-SA-FLK-003-750-SG', 0, 20, 1),
  ((SELECT id FROM products WHERE slug = 'summit-flask'), '750ml / Clay', 'DDZ-SA-FLK-003-750-CL', 0, 15, 2),
  ((SELECT id FROM products WHERE slug = 'summit-flask'), '750ml / Forest', 'DDZ-SA-FLK-003-750-FR', 0, 5, 3)
ON CONFLICT (sku) DO NOTHING;

-- Coupons
INSERT INTO coupons (code, type, value, min_order_amount, max_discount_amount, usage_limit, expires_at) VALUES
  ('WELCOME10', 'percentage', 10, 100000, 50000, 100, NOW() + INTERVAL '30 days'),
  ('TRAIL20', 'percentage', 15, 500000, 75000, 50, NOW() + INTERVAL '60 days'),
  ('FREESHIP', 'fixed', 10000, 200000, NULL, 200, NOW() + INTERVAL '90 days')
ON CONFLICT (code) DO NOTHING;

-- Admin user (will be created via auth, this ensures profile exists with admin role)
-- INSERT INTO profiles (id, email, full_name, role) VALUES 
--   ('00000000-0000-0000-0000-000000000000', 'admin@dewdropz.com', 'Admin User', 'admin')
-- ON CONFLICT (id) DO UPDATE SET role = 'admin';