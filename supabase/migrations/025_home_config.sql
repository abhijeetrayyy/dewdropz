-- The homepage's two product-showcase sections (Season Kit, The Climb) used to
-- hardcode specific product slugs and story text in lib/constants.ts — with a
-- catalogue this small, that meant an admin could never change what the
-- homepage sells without a code change. This gives them a real settings
-- surface instead: one JSONB column, editable from /admin/settings.
--
-- Shape:
-- {
--   "season_kit": {
--     "enabled": true,
--     "eyebrow": "Now shipping",
--     "headline": "Made once. Made yours.",
--     "line": "...",
--     "collection_slug": "mist-and-morning" | null,
--     "product_slugs": ["custom-hoodie", "custom-sweatshirt", "custom-print-tee"]
--   },
--   "climb": {
--     "enabled": true,
--     "headline": "Built to order.",
--     "intro": "...",
--     "stations": [
--       { "product_slug": "custom-hoodie", "label": "01", "line": "..." }
--     ]
--   },
--   "featured_collection_slugs": ["mist-and-morning", "silent-altitude", "o-collection"]
-- }
--
-- featured_collection_slugs empty ([]) means "show all" — CollectionsRow's
-- existing behaviour — so this column can be null/absent without breaking
-- anything already live.
ALTER TABLE store_settings
  ADD COLUMN home_config JSONB NOT NULL DEFAULT '{
    "season_kit": {
      "enabled": true,
      "eyebrow": "Now shipping",
      "headline": "Made once. Made yours.",
      "line": "Three heavyweight blanks, printed to order in Dehradun. Pick a colour, add your artwork, and it ships in 8-10 days.",
      "collection_slug": null,
      "product_slugs": ["custom-hoodie", "custom-sweatshirt", "custom-print-tee"]
    },
    "climb": {
      "enabled": true,
      "headline": "Every blank, made to order.",
      "intro": "No stock sitting in a warehouse — each piece is cut and printed only once someone actually wants it.",
      "stations": [
        { "product_slug": "custom-hoodie", "label": "01", "line": "380 GSM French terry, your design front and back." },
        { "product_slug": "custom-sweatshirt", "label": "02", "line": "Heavyweight and boxy, built for a full-chest print." },
        { "product_slug": "custom-print-tee", "label": "03", "line": "The one you reach for when the idea cannot wait." }
      ]
    },
    "featured_collection_slugs": []
  }'::jsonb;
