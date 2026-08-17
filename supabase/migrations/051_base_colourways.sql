-- The three base colours the brand is actually launching in.
--
-- Client brief: "Please keep 3 base colours only for all 3 Hoodie, Sweatshirt
-- and Tee", specified as Pantone TCX with approximate web hex:
--
--   19-5511 TCX Hunter Green  #355E4B
--   11-0104 TCX Vanilla Ice   #E8E1D1
--   19-0303 TCX Jet Black     #2B2B2F
--
-- What was there instead: Black #1A1A1A, Off-White #F2EFE6, Navy Blue #1F2A44
-- and Light Blue #A8C3D8 — four colours, three of them placeholders from the
-- admin's preset list, none of them the brand's.
--
-- ONE THING THIS CANNOT DO, AND IT MATTERS.
--
-- A colourway is not just a swatch. Each one carries `front` and `back` objects
-- holding the garment photograph AND the print-zone geometry measured against
-- that photograph — where the printable area sits in pixels, and how many
-- inches those pixels represent. The studio composites the customer's artwork
-- onto that photo at that position, and lib/customize/printSpec.ts derives the
-- print DPI from that pixels-per-inch ratio.
--
-- Only ONE colourway per garment has ever had those: Black. The other three
-- were swatches with `available: false` and no mockup at all. So there is no
-- photograph of a Hunter Green hoodie to composite onto, and no measured print
-- zone for one.
--
-- Jet Black therefore inherits Black's mockups — same garment, same photograph,
-- and #2B2B2F against #1A1A1A is a change no camera would record. Hunter Green
-- and Vanilla Ice are created with the correct names and hexes but
-- `available: false`, exactly as the placeholders were, because a customer must
-- not be able to order a colour the studio cannot show them. They become
-- available the moment someone shoots the two garments and measures the zone;
-- that is photography, not code.

UPDATE products
SET customization_config = jsonb_set(
  customization_config,
  '{colors}',
  (
    SELECT jsonb_agg(c ORDER BY ord)
    FROM (
      -- Jet Black, carrying over whatever front/back the existing Black entry
      -- holds. Read from the row rather than hardcoded so each garment keeps
      -- its own measured geometry — the hoodie's print zone is not the tee's.
      SELECT 1 AS ord,
             COALESCE(
               (SELECT elem FROM jsonb_array_elements(products.customization_config->'colors') elem
                 WHERE elem->>'name' = 'Black' LIMIT 1),
               '{}'::jsonb
             )
             || jsonb_build_object('name', 'Jet Black', 'hex', '#2B2B2F', 'available', true)
             AS c
      UNION ALL
      -- No mockup exists for these two, so they stay unavailable. Deliberately
      -- present rather than omitted: the brand's palette is three colours, and
      -- the admin should see the two that are waiting on photography.
      SELECT 2, jsonb_build_object(
        'name', 'Hunter Green', 'hex', '#355E4B', 'available', false)
      UNION ALL
      SELECT 3, jsonb_build_object(
        'name', 'Vanilla Ice', 'hex', '#E8E1D1', 'available', false)
    ) rows
  )
)
WHERE slug IN ('custom-hoodie', 'custom-sweatshirt', 'custom-print-tee')
  AND customization_config ? 'colors';
