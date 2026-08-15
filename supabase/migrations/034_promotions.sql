-- Automatic promotions.
--
-- Deliberately NOT a rewrite of `coupons`. That table works, its races are
-- already closed (021), and codes are a different product to automatic offers:
-- a coupon is something a customer types, a promotion is something the shop
-- applies whether or not they know about it. Rewriting one into the other would
-- put the money path — currently correct — at risk for no gain.
--
-- So: coupons stay for codes. This adds the thing that was actually missing —
-- rules that fire on their own. "10% off when the cart is over ₹3,000", "free
-- shipping over ₹2,000", "buy 2 get 1" — none of which can be expressed by a
-- flat code table, and all of which are how a shop lifts average order value.
--
-- Conditions and actions are JSONB rather than columns because the useful shapes
-- are not knowable up front and every new offer type would otherwise be a
-- migration. The resolver validates them; the database only stores them.

CREATE TABLE IF NOT EXISTS promotions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  -- Shown to the customer in the cart: "Free shipping applied". Without this the
  -- total simply drops and nobody knows why, which reads as a bug.
  label        TEXT NOT NULL,

  action_type  TEXT NOT NULL CHECK (action_type IN ('percentage','fixed','free_shipping','bogo')),
  -- percentage: 0-100. fixed: paise. free_shipping: ignored. bogo: items free.
  action_value INT NOT NULL DEFAULT 0,
  -- Ceiling for percentage promotions, in paise. Null = uncapped.
  max_discount INT,

  -- { minSubtotal?: paise, collectionSlugs?: string[], productSlugs?: string[],
  --   minQuantity?: int }  — all present conditions must hold.
  conditions   JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Lower runs first. Matters because a percentage applied before or after a
  -- fixed discount gives different money, so the order cannot be incidental.
  priority     INT NOT NULL DEFAULT 100,
  -- Whether this may combine with other promotions. A non-stackable promotion
  -- that wins ends evaluation — otherwise "best offer" silently becomes "every
  -- offer at once", which is how shops give away margin by accident.
  stackable    BOOLEAN NOT NULL DEFAULT FALSE,

  starts_at    TIMESTAMPTZ,
  ends_at      TIMESTAMPTZ,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The resolver's hot query: active, in-window, in priority order.
CREATE INDEX IF NOT EXISTS idx_promotions_live
  ON promotions(priority, starts_at, ends_at) WHERE is_active = true;

CREATE TRIGGER update_promotions_updated_at BEFORE UPDATE ON promotions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- Anyone may read a live promotion — the storefront has to show them in the
-- cart before checkout. Writes are service_role only.
CREATE POLICY "Anyone reads active promotions" ON promotions FOR SELECT
  USING (is_active = true);

-- Which promotions actually fired on an order, and for how much. Without this
-- there is no way to answer "what did this campaign cost us".
CREATE TABLE IF NOT EXISTS order_promotions (
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE RESTRICT,
  label        TEXT NOT NULL,
  amount       INT  NOT NULL,
  PRIMARY KEY (order_id, promotion_id)
);
CREATE INDEX IF NOT EXISTS idx_order_promotions_promo ON order_promotions(promotion_id);

ALTER TABLE order_promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own order promotions" ON order_promotions FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_promotions.order_id AND o.user_id = auth.uid()));
