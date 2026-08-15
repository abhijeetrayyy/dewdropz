-- Abandoned cart recovery.
--
-- Idempotent, and re-applied once during development after the first version
-- was found to be built on the wrong column (see below).
--
-- Two problems had to be solved before a sweep could even be written:
--
-- 1. There was no column meaning "when did the customer last touch this cart".
--    `carts.updated_at` looks like it, but it is not:
--      * the trigger from 002 only fires on UPDATE of the carts row, and items
--        live in cart_items — so it never moved when a cart actually changed;
--      * worse, that trigger sets updated_at = NOW() on EVERY update, so the
--        recovery job stamping its own bookkeeping columns would reset the very
--        clock it was reading. A cart would be emailed and then immediately
--        look freshly active.
--    Hence `last_activity_at`, written by exactly one thing: item changes.
--
-- 2. There was no way to tell an un-emailed cart from one already chased. Two
--    cron runs an hour apart would have mailed the same customer twice.
--
-- Deliberately NOT built: a campaign engine, templates, or multi-step drip
-- sequences. One reminder, one email, one flag.

-- --------------------------------------------------------------------------
-- 1. A column that means what it says
-- --------------------------------------------------------------------------
ALTER TABLE carts ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE OR REPLACE FUNCTION touch_cart_on_item_change()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE carts SET last_activity_at = NOW()
  WHERE id = COALESCE(NEW.cart_id, OLD.cart_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS touch_cart_on_item_change ON cart_items;
CREATE TRIGGER touch_cart_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON cart_items
  FOR EACH ROW EXECUTE FUNCTION touch_cart_on_item_change();

-- Existing carts: best available guess is the newest thing in them.
UPDATE carts c
SET last_activity_at = COALESCE(
  (SELECT MAX(GREATEST(i.created_at, i.updated_at)) FROM cart_items i WHERE i.cart_id = c.id),
  c.updated_at,
  c.created_at
)
WHERE c.last_activity_at IS NULL OR c.last_activity_at = c.created_at;

-- --------------------------------------------------------------------------
-- 2. Recovery bookkeeping
-- --------------------------------------------------------------------------
ALTER TABLE carts ADD COLUMN IF NOT EXISTS recovery_token   TEXT;
ALTER TABLE carts ADD COLUMN IF NOT EXISTS recovery_sent_at TIMESTAMPTZ;
ALTER TABLE carts ADD COLUMN IF NOT EXISTS recovered_at     TIMESTAMPTZ;

-- The token is the credential in the emailed link, so it must be unique. Partial
-- because most carts never get one.
CREATE UNIQUE INDEX IF NOT EXISTS idx_carts_recovery_token
  ON carts(recovery_token) WHERE recovery_token IS NOT NULL;

-- The sweep's own query: carts never chased, oldest activity first. Partial so
-- the index stays small no matter how many carts exist — once a cart has been
-- emailed it leaves the index for good.
DROP INDEX IF EXISTS idx_carts_pending_recovery;
CREATE INDEX IF NOT EXISTS idx_carts_pending_recovery
  ON carts(last_activity_at) WHERE recovery_sent_at IS NULL AND user_id IS NOT NULL;

-- A recovery link is opened by someone who is not necessarily signed in (they
-- clicked from their inbox), so the token lookup cannot go through the normal
-- "owns the row" policy. It runs service-role from a server route instead; no
-- new policy is added here, which means anon still cannot read carts at all.

COMMENT ON COLUMN carts.last_activity_at IS
  'When the customer last changed this cart. Maintained only by the cart_items trigger, so unrelated writes to the row cannot reset the abandonment clock.';
COMMENT ON COLUMN carts.recovery_token IS
  'Single-use-ish credential in the recovery email link. Cleared when the cart converts.';
COMMENT ON COLUMN carts.recovery_sent_at IS
  'Set once. Its presence is what stops a second cron run re-emailing the same cart.';
COMMENT ON COLUMN carts.recovered_at IS
  'Stamped when the customer opens the link — the measure of whether this is worth running at all.';
