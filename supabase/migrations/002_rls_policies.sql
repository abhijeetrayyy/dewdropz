-- Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile, admins can read all
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Collections: public read for active, admin write
CREATE POLICY "Public read active collections" ON collections
  FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admin full access collections" ON collections
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Products: public read for active, admin write
CREATE POLICY "Public read active products" ON products
  FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admin full access products" ON products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Product variants: public read for active products, admin write
CREATE POLICY "Public read variants for active products" ON product_variants
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM products WHERE id = product_id AND is_active = TRUE)
  );
CREATE POLICY "Admin full access variants" ON product_variants
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Addresses: users can CRUD their own addresses
CREATE POLICY "Users can manage own addresses" ON addresses
  FOR ALL USING (auth.uid() = user_id);

-- Carts: users can manage their own cart, guest carts by session
CREATE POLICY "Users can manage own cart" ON carts
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Guest can manage cart by session" ON carts
  FOR ALL USING (session_id IS NOT NULL AND user_id IS NULL);

-- Cart items: users can manage items in their cart
CREATE POLICY "Users can manage cart items" ON cart_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM carts WHERE id = cart_id AND (user_id = auth.uid() OR (session_id IS NOT NULL AND user_id IS NULL)))
  );

-- Orders: users can view own orders, admins can view all
CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all orders" ON orders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Service role can insert orders" ON orders
  FOR INSERT WITH CHECK (true); -- Server-side only

-- Order items: users can view items from their orders
CREATE POLICY "Users can view own order items" ON order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders WHERE id = order_id AND user_id = auth.uid())
  );
CREATE POLICY "Admins can view all order items" ON order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Service role can insert order items" ON order_items
  FOR INSERT WITH CHECK (true);

-- Coupons: public read for active, admin write
CREATE POLICY "Public read active coupons" ON coupons
  FOR SELECT USING (is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW()) AND starts_at <= NOW());
CREATE POLICY "Admin full access coupons" ON coupons
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Coupon usages: users can view own, admin view all
CREATE POLICY "Users can view own coupon usages" ON coupon_usages
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all coupon usages" ON coupon_usages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Service role can insert coupon usages" ON coupon_usages
  FOR INSERT WITH CHECK (true);

-- Reviews: public read approved, users can create for their verified purchases
CREATE POLICY "Public read approved reviews" ON reviews
  FOR SELECT USING (is_approved = TRUE);
CREATE POLICY "Users can create review for verified purchase" ON reviews
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.user_id = auth.uid() 
      AND oi.product_id = product_id
      AND o.status IN ('delivered', 'shipped')
    )
  );
CREATE POLICY "Users can update own review" ON reviews
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all reviews" ON reviews
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Newsletter: public insert, admin read
CREATE POLICY "Public can subscribe" ON newsletter_subscribers
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view subscribers" ON newsletter_subscribers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Webhook events: service role only
CREATE POLICY "Service role full access webhooks" ON webhook_events
  FOR ALL USING (true);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON collections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_addresses_updated_at BEFORE UPDATE ON addresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_carts_updated_at BEFORE UPDATE ON carts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON cart_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON coupons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    'customer'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  prefix TEXT := 'DDZ';
  date_part TEXT := TO_CHAR(NOW(), 'YYYYMMDD');
  random_part TEXT := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
BEGIN
  RETURN prefix || '-' || date_part || '-' || random_part;
END;
$$ LANGUAGE plpgsql;

-- Function to update product inventory on order
CREATE OR REPLACE FUNCTION decrement_inventory()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE products
    SET inventory_quantity = inventory_quantity - NEW.quantity
    WHERE id = NEW.product_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE products
    SET inventory_quantity = inventory_quantity + OLD.quantity
    WHERE id = OLD.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_inventory_on_order
  AFTER INSERT OR DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION decrement_inventory();