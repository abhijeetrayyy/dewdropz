-- Three independent integrity gaps found during a full commerce-engine audit,
-- fixed together since they're all "can a bad actor or a race condition put
-- the database in a state the app assumes can't happen."

-- ---------------------------------------------------------------------------
-- Fix 1: stock can go negative / be oversold.
-- decrement_inventory() (006_fixes.sql) subtracts unconditionally on every
-- order_items insert with no floor check — two concurrent checkouts against
-- the last unit both succeed. A CHECK constraint closes this at the table
-- level for every write path at once (the order trigger, adjust_stock_atomic,
-- any future code), not just the one function — Postgres's row lock on the
-- UPDATE already serializes concurrent attempts, so this constraint is what
-- turns that serialization into a real rejection instead of silent negative
-- stock. createOrder() catches the resulting 23514 violation and returns a
-- clean "item just sold out" message instead of a 500.
ALTER TABLE products ADD CONSTRAINT products_inventory_non_negative CHECK (inventory_quantity >= 0);
ALTER TABLE product_variants ADD CONSTRAINT product_variants_inventory_non_negative CHECK (inventory_quantity >= 0);

-- ---------------------------------------------------------------------------
-- Fix 2: privilege escalation via self-update.
-- "Users can update own profile" (002_rls_policies.sql) has no WITH CHECK, so
-- any signed-in user can UPDATE profiles SET role='admin' WHERE id=auth.uid()
-- directly against PostgREST, bypassing updateProfile() (which never exposes
-- role) entirely — RLS, not the server action, is the real enforcement layer
-- here. A BEFORE UPDATE trigger silently pins role back to its old value
-- unless the caller already is an admin, so every other self-update (name,
-- phone, avatar) keeps working unchanged.
CREATE OR REPLACE FUNCTION protect_profile_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
      NEW.role := OLD.role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_profile_role_trigger ON profiles;
CREATE TRIGGER protect_profile_role_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile_role();

-- ---------------------------------------------------------------------------
-- Fix 3: coupon user_limit race condition.
-- validateCoupon() does a read-then-decide check (count existing usages, then
-- let the order through) with no DB-level enforcement — two concurrent
-- checkouts can both read "under the limit" before either records usage.
-- user_limit is always 1 today (DEFAULT 1, no admin UI ever sets it higher),
-- so a UNIQUE constraint is the exact right enforcement; NULL user_id (guest
-- checkouts, which aren't subject to a per-user limit anyway) is correctly
-- exempt since Postgres treats every NULL as distinct under UNIQUE. If
-- per-user limits >1 are ever added to the admin UI, this constraint needs
-- to be dropped in favor of a counted atomic check.
ALTER TABLE coupon_usages ADD CONSTRAINT coupon_usages_coupon_user_unique UNIQUE (coupon_id, user_id);

-- increment_coupon_usage (010) was a bare increment with no limit check of its
-- own — harmless once the UNIQUE constraint above blocks the same user twice,
-- but the global usage_limit (not per-user) was still only enforced by the
-- same read-then-decide race. Making the increment itself conditional closes
-- that gap too: it now simply becomes a no-op past the limit instead of ever
-- exceeding it.
CREATE OR REPLACE FUNCTION increment_coupon_usage(coupon_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE coupons
  SET usage_count = COALESCE(usage_count, 0) + 1
  WHERE id = coupon_id AND (usage_limit IS NULL OR COALESCE(usage_count, 0) < usage_limit);
END;
$$ LANGUAGE plpgsql;
