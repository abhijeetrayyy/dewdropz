ALTER TABLE products
  ADD COLUMN story_blocks JSONB NOT NULL DEFAULT '[]';

ALTER TABLE shipping_rates
  ADD COLUMN estimated_min_days INT,
  ADD COLUMN estimated_max_days INT;
