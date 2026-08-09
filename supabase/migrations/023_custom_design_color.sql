-- Which garment colorway a saved design was made against. Needed for
-- fulfilment: the same artwork on a black vs off-white blank is a different
-- physical order line, and the print file alone doesn't carry that.
-- Nullable because designs saved before colorways existed have no colour to
-- backfill honestly -- they were all made against the single black mockup,
-- but recording that as fact here would be an assumption, so those rows stay
-- NULL and are read as "unspecified" downstream.
ALTER TABLE custom_designs
  ADD COLUMN color_name TEXT,
  ADD COLUMN color_hex TEXT;
