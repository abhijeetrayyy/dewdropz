-- One source of truth for whether a product is live.
--
-- There were three flags and only two were maintained:
--
--   is_active   toggled by the admin's activate/deactivate control
--   deleted_at  set by "Delete", which is a soft archive
--   status      NEVER WRITTEN BY ANY CODE
--
-- `createProduct`, `toggleProductActive`, `bulkSetProductsActive` and
-- `archiveProduct` all touch only the first two. Migration 004 backfilled
-- `status` once, in 2026, and nothing has written it since — every row in this
-- database currently reads 'active', including any product that has been
-- deactivated.
--
-- That column is what the admin list renders as its Status badge, so the badge
-- says "Active" for a product that is switched off. And `getLowStockReport`
-- filters `.neq('status','archived')`, which can never exclude anything, so
-- soft-deleted products generate low-stock noise forever.
--
-- Rather than teach four more call sites to maintain a third flag — the way it
-- drifted in the first place — `status` becomes derived. It cannot disagree
-- with the columns it describes, existing readers keep working, and anyone
-- querying the database directly gets the truth.
--
-- Safe to drop and recreate: nothing writes it (verified across actions/ and
-- app/), and its only index is recreated below.

DROP INDEX IF EXISTS idx_products_status;
ALTER TABLE products DROP COLUMN IF EXISTS status;

ALTER TABLE products ADD COLUMN status TEXT
  GENERATED ALWAYS AS (
    CASE
      WHEN deleted_at IS NOT NULL THEN 'archived'
      WHEN is_active THEN 'active'
      ELSE 'draft'
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

COMMENT ON COLUMN products.status IS
  'Derived from deleted_at and is_active. Generated — never write it. archived > draft > active.';
