-- ---------------------------------------------------------------------------
-- 093 — the catalogue was writable by anybody
-- ---------------------------------------------------------------------------
--
-- The same defect 063 fixed on `profiles`, on fourteen more tables — including
-- `products`. 063 found it, wrote it up, and fixed exactly one table.
--
-- THE DEFECT
--
-- A policy with no TO clause applies to PUBLIC, which includes `anon`, and
-- policies are OR'd. So a policy of the shape
--
--     CREATE POLICY "Admin full access products" ON products FOR ALL USING (true)
--
-- does not give admins extra reach on top of the public-read policy beside it.
-- It gives EVERYONE total reach — SELECT, INSERT, UPDATE and DELETE — and makes
-- every other policy on the table decorative.
--
-- VERIFIED AGAINST THE LIVE DATABASE, using only the anon key that ships inside
-- the browser bundle. Each probe was an INSERT chosen to violate a unique
-- constraint, so a `23505` proves RLS permitted the write while nothing was
-- actually written:
--
--     coupons      23505  -> RLS ALLOWED the write
--     tags         23505  -> RLS ALLOWED the write
--     categories   23505  -> RLS ALLOWED the write
--     collections  23505  -> RLS ALLOWED the write
--     products     UPDATE succeeded against a live product row
--
-- WHY THIS IS THE WHOLE SHOP
--
-- `lib/checkoutPricing.ts` is careful, correct, and reads `products.price` from
-- the database because the browser must not be trusted with a price. That is
-- the right design and it is completely undone by this: an attacker sets the
-- price to one paisa with the public key, then checks out, and the server
-- faithfully bills one paisa. Every other control in the money path — the
-- single pricing function, the idempotency key, the GST apportionment — is
-- downstream of a number the attacker just wrote.
--
-- Coupons were readable outright as well, so every live code, its value, its
-- minimum spend and its usage cap were public; and `inventory_movements` gave
-- away stock levels and sales velocity.
--
-- WHY THE MIGRATION FILES LOOK INNOCENT
--
-- 002 and 005 in this repo contain the admin EXISTS check, not `USING (true)`.
-- The live database has `USING (true)`. The files and the database disagree,
-- which means the schema has drifted from the migrations at some point in this
-- project's history. This file is therefore written to be idempotent and to
-- assert the end state rather than to patch a known start state — it drops by
-- name and recreates, so it lands correctly whichever version is live.
--
-- THE FIX
--
-- `is_profile_admin()` already exists (063): SECURITY DEFINER, so a policy can
-- ask "is the caller an admin?" without re-entering profiles' own policies and
-- recursing. Every policy below is scoped `TO authenticated` — `anon` now
-- matches no write policy on any of these tables at all, which is the correct
-- amount of write access for a caller with no session: none.
--
-- Nothing in the application breaks. Every admin write in this codebase goes
-- through a server action holding the service-role key, and service_role
-- bypasses RLS entirely — these policies were never what let the admin screens
-- work. The public SELECT policies ("Public read active products" and friends)
-- are untouched, so the storefront reads exactly as before.

-- ---------------------------------------------------------------------------
-- 1. Make sure the helper is there and callable
-- ---------------------------------------------------------------------------
-- 063 created this. Repeated here so 093 can be applied to a database that has
-- somehow drifted past it, and so this file stands on its own.
CREATE OR REPLACE FUNCTION is_profile_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;

REVOKE ALL ON FUNCTION is_profile_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_profile_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Re-scope every "Admin full access" policy
-- ---------------------------------------------------------------------------
-- One DO block rather than fourteen copy-pasted pairs: the policy name differs
-- per table but the shape does not, and fourteen hand-written copies is how one
-- of them ends up subtly different from the other thirteen — which is the exact
-- class of mistake this migration exists to correct.
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('products',                 'Admin full access products'),
      ('product_variants',         'Admin full access variants'),
      ('collections',              'Admin full access collections'),
      ('categories',               'Admin full access categories'),
      ('product_categories',       'Admin full access product_categories'),
      ('tags',                     'Admin full access tags'),
      ('product_tags',             'Admin full access product_tags'),
      ('attributes',               'Admin full access attributes'),
      ('attribute_values',         'Admin full access attribute_values'),
      ('product_attribute_values', 'Admin full access product_attribute_values'),
      ('variant_option_values',    'Admin full access variant_option_values'),
      ('inventory_movements',      'Admin full access inventory_movements'),
      ('coupons',                  'Admin full access coupons'),
      ('reviews',                  'Admins can manage all reviews')
    ) AS v(tbl, pol)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t.pol, t.tbl);
    -- Same name back, so anyone reading pg_policies sees the intent the
    -- original author wrote down — now actually enforced.
    --
    -- WITH CHECK as well as USING. Without it, an admin-only USING still lets a
    -- permitted row be rewritten into a shape the policy would not have
    -- admitted; 063 hit the same thing on profiles and said so.
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (is_profile_admin()) WITH CHECK (is_profile_admin())',
      t.pol, t.tbl
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Coupons are not a public list
-- ---------------------------------------------------------------------------
-- "Public read active coupons" let anyone enumerate every live code with its
-- value and minimum spend. A discount code is a marketing instrument that is
-- given to somebody; a code anyone can read off the wire is a sitewide sale
-- nobody decided to run.
--
-- Nothing needs this policy: coupons are validated by `validateCoupon` in
-- actions/cart.ts, server-side. The customer types a code and the server says
-- yes or no — which is the only coupon read a storefront ever legitimately
-- needs, and it never requires handing over the list.
DROP POLICY IF EXISTS "Public read active coupons" ON coupons;

-- ---------------------------------------------------------------------------
-- 4. Stock history is not public either
-- ---------------------------------------------------------------------------
-- `inventory_movements` returned every row to `anon` once the blanket policy
-- above stopped covering it — the remaining policy is "own or admin", and
-- `created_by` is null on trigger-written rows, so this makes the intent
-- explicit rather than leaving it to how NULL compares.
DROP POLICY IF EXISTS "Users can view own inventory movements" ON inventory_movements;
CREATE POLICY "Admins read inventory movements" ON inventory_movements
  FOR SELECT TO authenticated
  USING (is_profile_admin());

-- ---------------------------------------------------------------------------
-- NOT IN THIS FILE: store_settings
-- ---------------------------------------------------------------------------
-- "Anyone can read store settings" is also `USING (true)`, over a table that
-- holds the seller's GSTIN, registered legal name and registered address. Those
-- are null today, which is the only reason it is not already a leak — and they
-- cannot stay null, because a compliant invoice cannot be issued without them.
--
-- It is not fixed here because it cannot be fixed here alone. RLS is row-level
-- and has nothing to say about columns, so the fix is a column GRANT — and
-- `getStoreSettings()` reads `select('*')` with the ANON client, which a column
-- GRANT turns into a permission error. That error is swallowed by the function's
-- own fallback, so the failure mode is not a crash but something worse: the
-- homepage silently reverts to DEFAULT_HOME_CONFIG and every setting the shop
-- has configured disappears. The admin settings screen reads through the same
-- anon path, so it would also stop being able to see or set the GST details.
--
-- Fixing it means splitting the read in two — an explicit storefront column
-- list for the public path and a service-role read for the admin screen — and
-- that belongs in a change that ships the code with it. See the audit note.
