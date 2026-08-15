-- Production tracking for customised items.
--
-- A custom line is the one thing on an order that cannot be picked off a shelf:
-- it has to be printed first. Until now nothing recorded whether that had
-- happened, so the only way to know was to ask the person at the printer — and
-- the order detail page did not even show the print files, so they could not
-- get the artwork from the order in the first place.
--
-- Deliberately on order_items rather than a separate production_jobs table: the
-- unit of work IS the line. A parallel table would need to be kept in step with
-- order lines for no gain.

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS printed_at TIMESTAMPTZ;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS printed_by TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS production_note TEXT;

COMMENT ON COLUMN order_items.printed_at IS
  'When this customised line was printed. NULL on a line with a custom_design_id means it is still queued.';

-- The print queue's own lookup: unprinted custom lines, oldest first. Partial,
-- so it holds the queue rather than every line ever sold.
CREATE INDEX IF NOT EXISTS idx_order_items_print_queue
  ON order_items(created_at)
  WHERE custom_design_id IS NOT NULL AND printed_at IS NULL;
