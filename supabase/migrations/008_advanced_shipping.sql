CREATE TABLE shipping_zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  countries TEXT[] DEFAULT '{}',
  states TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shipping_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zone_id UUID NOT NULL REFERENCES shipping_zones(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('flat', 'weight_based', 'price_based')),
  price INT NOT NULL, -- Stored in paise
  min_value INT DEFAULT 0, -- Min weight in grams or Min price in paise
  max_value INT, -- Max weight/price, nullable for no limit
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for shipping_zones
ALTER TABLE shipping_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read shipping zones"
  ON shipping_zones FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert shipping zones"
  ON shipping_zones FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Admins can update shipping zones"
  ON shipping_zones FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Admins can delete shipping zones"
  ON shipping_zones FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- RLS for shipping_rates
ALTER TABLE shipping_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read shipping rates"
  ON shipping_rates FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert shipping rates"
  ON shipping_rates FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Admins can update shipping rates"
  ON shipping_rates FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Admins can delete shipping rates"
  ON shipping_rates FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Triggers for updated_at
CREATE TRIGGER handle_updated_at_shipping_zones
  BEFORE UPDATE ON shipping_zones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER handle_updated_at_shipping_rates
  BEFORE UPDATE ON shipping_rates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
