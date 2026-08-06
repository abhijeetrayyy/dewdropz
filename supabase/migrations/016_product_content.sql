-- Real per-product marketing/content fields the storefront product page
-- needs but the schema never had: an ordered short bullet list of
-- differentiators, and an optional care-instructions override. Both are
-- additive and nullable/defaulted, so no backfill is required — existing
-- rows get an empty highlights list and a NULL care override (the
-- storefront already has an honest generic fallback for the latter).
ALTER TABLE products
  ADD COLUMN highlights TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN care_instructions TEXT;
