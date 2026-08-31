-- ---------------------------------------------------------------------------
-- 102 — the shop's registration details stop being public
-- ---------------------------------------------------------------------------
--
-- Found in the platform audit of 26 August and documented there as the one
-- finding left open, because it could not be fixed safely by a migration alone.
--
-- THE DEFECT
--
-- `store_settings` carries a policy called "Anyone can read store settings",
-- USING (true), over a table that also holds:
--
--     gstin, seller_legal_name, seller_address_line1, seller_address_line2,
--     seller_city, seller_postal_code, seller_state_code,
--     invoice_signatory_name
--
-- Those are the shop's tax registration and its registered premises. They are
-- NULL today, and that is the only reason this is not already a live leak —
-- **and they cannot stay null**, because `issue_invoice` refuses without them
-- and a GST-compliant invoice cannot be issued without them. The day the shop
-- becomes able to invoice is the day its registration details are published in
-- every page load, to anyone holding the anon key, which ships in the browser.
--
-- WHY RLS CANNOT FIX IT
--
-- Row-level security is row-level. It has nothing to say about columns. There
-- is exactly one row in this table and the storefront legitimately needs most
-- of it, so there is no predicate that keeps the shipping threshold public and
-- the GSTIN private. The instrument for that is a column-level GRANT.
--
-- WHY THIS MIGRATION COULD NOT SHIP ALONE
--
-- `getStoreSettings()` did `select('*')` on the ANON client. A column grant
-- turns that into a permission error — and that function's own fallback
-- swallows the error and returns defaults. The failure mode was therefore not a
-- crash but silence: every configured setting would quietly disappear, the
-- homepage would revert to DEFAULT_HOME_CONFIG, and nothing would say why.
--
-- So the code changed first, in the same commit as this file:
--
--   1. `getStoreSettings()` now names its columns — the list below, exactly.
--   2. `getAdminStoreSettings()` is new: requireAdmin() plus the service-role
--      client plus select('*'), for the screens that edit the seller block.
--   3. The three admin screens and the packing-slip route were switched to it.
--   4. Only then does this run.
--
-- `service_role` bypasses grants as well as RLS, so `issue_invoice` and
-- `issue_rental_invoice` — which read the whole row to freeze the supplier
-- snapshot onto a document — are unaffected.
--
-- WHY `authenticated` LOSES THE COLUMNS TOO
--
-- Signing in is not joining the company. An ordinary customer with an account
-- is `authenticated`, and there is no reading of "logged in" that should also
-- mean "may read the shop's tax registration". Staff reach these columns by
-- being an admin, through a server action, which is a different thing entirely.
-- ---------------------------------------------------------------------------

-- Postgres has no "grant these columns and revoke the rest" in one statement:
-- a column grant only ADDS to a table-level grant, it does not narrow it. So the
-- table-level SELECT has to go first, and then the columns come back one by one.
REVOKE SELECT ON store_settings FROM anon;
REVOKE SELECT ON store_settings FROM authenticated;

-- Exactly the list in `STOREFRONT_COLUMNS` in actions/settings.ts. If one moves,
-- both move — a column granted here and not selected there is dead permission,
-- and a column selected there and not granted here is a 42501 the fallback eats.
GRANT SELECT (
  id,
  store_name,
  support_email,
  flat_shipping_rate,
  free_shipping_threshold,
  enable_tax,
  gst_percentage,
  origin_state,
  shipping_is_taxable,
  currency,
  timezone,
  home_config,
  updated_at
) ON store_settings TO anon, authenticated;

COMMENT ON TABLE store_settings IS
  'Shop-wide configuration. The seller block (gstin, seller_*, invoice_signatory_name) is NOT readable by anon or authenticated — it is granted per-column, and staff read it through getAdminStoreSettings() on the service-role client. See migration 102.';

-- The UPDATE policy from 007 stays exactly as it was: admins only, and every
-- write in the application goes through a server action holding the service key
-- regardless. Nothing here widens what anybody may write.

-- ── A note on what is deliberately still public ────────────────────────────
--
-- `origin_state` remains readable. It is the name of a state, it is on the
-- contact page, and the storefront needs it to decide CGST+SGST against IGST
-- when it quotes. Treating a place name as a secret while publishing the shop's
-- address in the footer would be security theatre.
--
-- `gst_percentage` remains readable for the same reason: it is a tax rate, it is
-- printed on every quote, and it is public information by law.
