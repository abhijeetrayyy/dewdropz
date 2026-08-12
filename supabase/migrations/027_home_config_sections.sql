-- ============================================================================
-- Widens home_config so the light CMS in /admin/settings covers the whole
-- homepage — web AND the mobile apps, which read the same JSON — instead of
-- just the two product blocks 025 shipped.
--
-- Adds three keys to the existing home_config JSONB:
--
--   "featured_category_slugs": []
--       Which categories the "What are you packing for?" row shows, in order.
--       [] means "show every active top-level category" — the behaviour before
--       this migration, so existing rows keep rendering identically.
--
--   "stats": []
--       The numbers band. Previously four hardcoded claims in lib/constants.ts
--       ("12,000+ trekkers geared up", "40+ trails mapped"). Those were
--       invented, and a storefront must not ship invented numbers, so the
--       default here is EMPTY and the band hides itself until an owner enters
--       figures they can stand behind.
--       Shape: [{ "value": 12000, "suffix": "+", "label": "…", "plain": false }]
--
--   "showcase": [...]
--       Product rails, evaluated live against the catalogue rather than pinned
--       to slugs, so they populate on their own as real products and orders
--       arrive and stay empty (and hidden) until then.
--       Shape: [{ "id": "…", "kind": "recent"|"best_sellers"|"category"|"collection",
--                 "title": "…", "category_slug": null, "collection_slug": null,
--                 "limit": 8, "enabled": true }]
--
-- All three are additive with safe defaults, so this can be applied while the
-- current code is live.
-- ============================================================================

UPDATE store_settings
SET home_config = home_config
  || jsonb_build_object(
       'featured_category_slugs', COALESCE(home_config -> 'featured_category_slugs', '[]'::jsonb),
       'stats',                   COALESCE(home_config -> 'stats',                   '[]'::jsonb),
       'showcase',                COALESCE(home_config -> 'showcase',                jsonb_build_array(
         jsonb_build_object(
           'id', 'recent', 'kind', 'recent', 'title', 'Just added',
           'category_slug', NULL, 'collection_slug', NULL, 'limit', 8, 'enabled', true
         ),
         jsonb_build_object(
           'id', 'best', 'kind', 'best_sellers', 'title', 'Most ordered',
           'category_slug', NULL, 'collection_slug', NULL, 'limit', 8, 'enabled', true
         )
       ))
     );

-- Same three keys on the column default, so a freshly provisioned environment
-- starts in the identical state rather than missing them until first save.
ALTER TABLE store_settings
  ALTER COLUMN home_config SET DEFAULT '{
    "season_kit": {
      "enabled": true,
      "eyebrow": "Now shipping",
      "headline": "Made once. Made yours.",
      "line": "Pick a colour, add your artwork, and it ships in 8-10 days.",
      "collection_slug": null,
      "product_slugs": []
    },
    "climb": {
      "enabled": true,
      "headline": "Every blank, made to order.",
      "intro": "No stock sitting in a warehouse — each piece is cut and printed only once someone actually wants it.",
      "stations": []
    },
    "featured_collection_slugs": [],
    "featured_category_slugs": [],
    "stats": [],
    "showcase": [
      { "id": "recent", "kind": "recent", "title": "Just added", "category_slug": null, "collection_slug": null, "limit": 8, "enabled": true },
      { "id": "best", "kind": "best_sellers", "title": "Most ordered", "category_slug": null, "collection_slug": null, "limit": 8, "enabled": true }
    ]
  }'::jsonb;
