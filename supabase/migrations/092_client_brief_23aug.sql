-- ---------------------------------------------------------------------------
-- 092 — the 23 August client brief, in data
-- ---------------------------------------------------------------------------
--
-- Four of the changes in that document are not code. They are things the
-- storefront already reads out of the database, which means the brief is asking
-- for different rows rather than different components:
--
--   1. TREK BUDDY, TEN KINDS. The brief names exactly ten activities. The board
--      is currently taking eighteen.
--   2. CHOOSE YOUR ESSENTIALS, FOUR TILES. Caps, Coffee Mugs, Bottles,
--      Tumblers — and that section reads whatever /admin/settings has pinned.
--   3. THE TRAILS SECTION, EDITABLE. "Keep options so that DEWDROPZ team can
--      add more treks etc in this section with the current layout."
--   4. THE DESIGN LIBRARY. "There will be two options: customer can select from
--      our pre-set design ready library of DEWDROPZ and second — customer can
--      upload their own design." The second half has existed since the studio
--      shipped; the first half has never existed at all.
--
-- Nothing here drops a row. Kinds are switched off rather than deleted, because
-- trek_plans.activity is a foreign key into this table and walks that already
-- happened named some of them.

-- ---------------------------------------------------------------------------
-- 1. Trek Buddy — the ten kinds the brief names, and only those
-- ---------------------------------------------------------------------------
--
-- The brief's list, in its order:
--   Trekking · Camping · Stargazing · Bird Watching · Cycling · Running ·
--   Heritage Walk · Snow Trek · Expedition · Photography Walk
--
-- All ten already exist as rows (057 seeded seven, a later pass added the
-- rest), so this is a re-sort, one relabel — "Photo walk" → "Photography walk"
-- — and switching off the eight the brief does not list.
UPDATE trek_activity_kinds SET sort = 10,  active = TRUE WHERE key = 'trekking';
UPDATE trek_activity_kinds SET sort = 20,  active = TRUE WHERE key = 'camping';
UPDATE trek_activity_kinds SET sort = 30,  active = TRUE WHERE key = 'stargazing';
UPDATE trek_activity_kinds SET sort = 40,  active = TRUE WHERE key = 'bird_watching';
UPDATE trek_activity_kinds SET sort = 50,  active = TRUE WHERE key = 'cycling';
UPDATE trek_activity_kinds SET sort = 60,  active = TRUE WHERE key = 'running';
UPDATE trek_activity_kinds SET sort = 70,  active = TRUE WHERE key = 'heritage_walk';
UPDATE trek_activity_kinds SET sort = 80,  active = TRUE WHERE key = 'snow_trek';
UPDATE trek_activity_kinds SET sort = 90,  active = TRUE WHERE key = 'expedition';
UPDATE trek_activity_kinds
   SET sort = 100, active = TRUE, label = 'Photography walk'
 WHERE key = 'photography';

-- Switched off, not deleted. `active = FALSE` stops the board offering them and
-- stops the hours trigger accepting new plans on them; the walks that already
-- named one keep their foreign key and keep rendering.
UPDATE trek_activity_kinds
   SET active = FALSE
 WHERE key IN (
   'outdoor_yoga', 'waterfall', 'forest_walk', 'sunrise_point',
   'clean_up', 'foraging', 'monsoon_walk', 'night_walk'
 );

-- 'other' stays on and stays at sort 999. It is not an eleventh category: it is
-- the host-named escape hatch the composer handles specially (is_open_ended),
-- and it is what the brief's own core concept — "individuals, hosts, adventure
-- companies, and communities can create outdoor experiences" — actually needs.
-- The homepage's chip list filters it out, so the visitor still counts ten.

-- ---------------------------------------------------------------------------
-- 2. Choose Your Essentials — Caps, Coffee Mugs, Bottles, Tumblers
-- ---------------------------------------------------------------------------
--
-- Three of the four already exist under the Drinkware and Apparel departments.
-- "Tumblers & Bottles" was one category doing two jobs, so it splits: the
-- existing row keeps its id and its products and becomes Tumblers, and Bottles
-- is created alongside it. Splitting rather than renaming-and-adding is what
-- keeps the /shop?category=tumblers links that are already out in the world
-- pointing at something.
UPDATE categories
   SET name        = 'Coffee Mugs',
       slug        = 'coffee-mugs',
       description = COALESCE(description, 'Sip. Pause. Reset.'),
       sort_order  = 2
 WHERE slug = 'mugs';

UPDATE categories
   SET name        = 'Tumblers',
       description = COALESCE(description, 'Hot or cold, always with you.'),
       sort_order  = 4
 WHERE slug = 'tumblers';

INSERT INTO categories (name, slug, parent_id, description, sort_order, is_active)
SELECT 'Bottles', 'bottles', id, 'Hydrate. Explore. Repeat.', 3, TRUE
  FROM categories WHERE slug = 'drinkware'
ON CONFLICT (slug) DO NOTHING;

UPDATE categories
   SET description = COALESCE(description, 'Top off your adventure.'),
       sort_order  = 1
 WHERE slug = 'caps';

-- ---------------------------------------------------------------------------
-- 3. home_config — the four essentials tiles, and the editable trails
-- ---------------------------------------------------------------------------
--
-- `featured_category_slugs` is how /admin/settings pins which tiles the section
-- carries, and it has been empty (= "every category that has stock") since the
-- setting was added. The brief pins it to four.
--
-- Naming them explicitly is also what makes them appear at all: with no
-- products listed against Caps, Coffee Mugs, Bottles or Tumblers yet, the
-- default rule would filter all four away. An explicit editorial pick is
-- honoured as given and the tiles read "Coming soon" until the range is listed
-- — see pickEssentials() in components/sections/ShopByCategory.tsx.
--
-- `trails` is new: the Trails section used to read four routes hardcoded in
-- lib/constants.ts. Seeded here with those same four so nothing on screen moves
-- until somebody edits them at /admin/homepage.
UPDATE store_settings
   SET home_config = home_config
     || jsonb_build_object(
          'featured_category_slugs',
          jsonb_build_array('caps', 'coffee-mugs', 'bottles', 'tumblers')
        )
     || jsonb_build_object('trails', COALESCE(home_config -> 'trails', '[
  {
    "slug": "kedarkantha",
    "name": "Kedarkantha",
    "altitude": "3,800m",
    "difficulty": "Moderate",
    "duration": "4–6 days",
    "bestMonths": ["Dec", "Jan", "Feb", "Mar", "Apr"],
    "season": "A winter trail first and foremost — deep snow from late December through March.",
    "image": "https://images.unsplash.com/photo-1769631417306-a1da09f42b20"
  },
  {
    "slug": "har-ki-dun",
    "name": "Har Ki Dun",
    "altitude": "3,566m",
    "difficulty": "Moderate",
    "duration": "6–8 days",
    "bestMonths": ["Apr", "May", "Jun", "Sep", "Oct", "Nov"],
    "season": "Green and full of water after the snow melts; crisp and clear post-monsoon.",
    "image": "https://images.unsplash.com/photo-1689825422854-8e3083c2fb82"
  },
  {
    "slug": "valley-of-flowers",
    "name": "Valley of Flowers",
    "altitude": "3,658m",
    "difficulty": "Easy–Moderate",
    "duration": "4–6 days",
    "bestMonths": ["Jul", "Aug"],
    "season": "The park opens roughly June to October; the bloom peaks through July and August.",
    "image": "https://images.unsplash.com/photo-1722410141874-5494d14deeca"
  },
  {
    "slug": "kuari-pass",
    "name": "Kuari Pass",
    "altitude": "4,264m",
    "difficulty": "Moderate",
    "duration": "5–7 days",
    "bestMonths": ["Dec", "Jan", "Feb", "Mar", "Apr", "May", "Sep", "Oct", "Nov"],
    "season": "Walkable most of the year — snow-bound and quiet in winter, wide open in autumn.",
    "image": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b"
  }
]'::jsonb));

-- The column default set in 025 is deliberately left alone. A fresh database
-- runs these migrations in order, so the UPDATE above reaches the seeded row
-- there too; rewriting the default as well would mean two copies of this JSON
-- to keep in step, and the one nobody looks at is the one that goes stale.

-- ---------------------------------------------------------------------------
-- 4. The DEWDROPZ design library
-- ---------------------------------------------------------------------------
--
-- The studio has always had exactly one way in: bring your own artwork. That
-- quietly excludes everybody who wants a DEWDROPZ shirt but is not a designer,
-- which — for a shop whose whole differentiator is "print it yourself" — is the
-- larger half of the audience. This is the pre-set library the brief asks for.
--
-- Read by anyone (it is a catalogue of artwork we are advertising), written by
-- admins only.
CREATE TABLE IF NOT EXISTS design_library (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  -- Public URL in the `designs` bucket. PNG with transparency is the useful
  -- case: it goes onto a garment of any colour.
  image_url   TEXT NOT NULL,
  -- Which DEWDROPZ collection this artwork belongs to, as free text — the
  -- studio groups the picker by it. NOT a foreign key into `collections`:
  -- those are ranges of physical garments, and a design collection is a
  -- different thing that happens to share the word.
  collection  TEXT NOT NULL DEFAULT 'DEWDROPZ',
  sort        INT  NOT NULL DEFAULT 100,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT design_library_name_len CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  CONSTRAINT design_library_slug_shape CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,60}$')
);

COMMENT ON TABLE design_library IS
  'Pre-set DEWDROPZ artwork offered in the customisation studio, alongside the customer''s own uploads. Public read, admin write.';

CREATE INDEX IF NOT EXISTS idx_design_library_active ON design_library(active, sort, created_at DESC);

ALTER TABLE design_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active designs" ON design_library;
CREATE POLICY "Public read active designs" ON design_library
  FOR SELECT USING (active = TRUE);

-- Writes go through server actions holding the service-role key, which bypasses
-- RLS — so there is deliberately no INSERT/UPDATE/DELETE policy here. Anything
-- reaching this table with the anon key can read the active rows and no more.

-- The library's artwork lives in the same public bucket customer uploads use.
-- Both end up composited onto the same garment preview, and neither is secret.
INSERT INTO storage.buckets (id, name, public)
VALUES ('design-uploads', 'design-uploads', true)
ON CONFLICT (id) DO NOTHING;
