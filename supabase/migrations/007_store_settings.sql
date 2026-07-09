-- Settings Table (Singleton Pattern)
CREATE TABLE store_settings (
  id INT PRIMARY KEY DEFAULT 1,
  store_name TEXT NOT NULL DEFAULT 'DewDropz',
  support_email TEXT NOT NULL DEFAULT 'hello@dewdropz.com',
  flat_shipping_rate INT NOT NULL DEFAULT 10000, -- 100.00 INR
  free_shipping_threshold INT NOT NULL DEFAULT 200000, -- 2000.00 INR
  enable_tax BOOLEAN NOT NULL DEFAULT true,
  gst_percentage DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  currency TEXT NOT NULL DEFAULT 'INR',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Initialize the single row
INSERT INTO store_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings
CREATE POLICY "Anyone can read store settings"
  ON store_settings FOR SELECT
  USING (true);

-- Only admins can update
CREATE POLICY "Admins can update store settings"
  ON store_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to automatically update timestamp
CREATE TRIGGER handle_updated_at_store_settings
  BEFORE UPDATE ON store_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
