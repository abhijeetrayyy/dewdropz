'use server'

import { revalidatePath } from 'next/cache'
import { createAdminSupabaseClient, createPublicSupabaseClient } from '@/lib/supabase'
import { requireAdmin } from './auth'
import type { StoreSettings, HomeConfig } from '@/types/database'
import { validateGstin } from '@/lib/gstin'

// Matches migration 025_home_config.sql's column default — needed here too
// because the *row* already exists (store_settings has been a singleton since
// migration 007), so a plain `select('*')` on a DB that hasn't had 025 applied
// yet succeeds and just omits the column entirely rather than erroring. The
// homepage would otherwise crash on `settings.home_config.season_kit` the
// moment this code ships ahead of that migration being run.
const DEFAULT_HOME_CONFIG: HomeConfig = {
  season_kit: {
    enabled: true,
    eyebrow: 'Now shipping',
    headline: 'Made once. Made yours.',
    line: 'Pick a colour, add your artwork, and it ships in 8-10 days.',
    collection_slug: null,
    product_slugs: [],
  },
  climb: {
    enabled: true,
    headline: 'Every blank, made to order.',
    intro: 'No stock sitting in a warehouse — each piece is cut and printed only once someone actually wants it.',
    stations: [],
  },
  featured_collection_slugs: [],
  featured_category_slugs: [],
  stats: [],
  showcase: [
    { id: 'recent', kind: 'recent', title: 'Just added', category_slug: null, collection_slug: null, limit: 8, enabled: true },
    { id: 'best', kind: 'best_sellers', title: 'Most ordered', category_slug: null, collection_slug: null, limit: 8, enabled: true },
  ],
}

// A row written before migration 027 has home_config without the newer keys.
// Reading those as `undefined` would crash `.map()` in the sections, so every
// read is normalised against the defaults rather than trusted wholesale.
function normalizeHomeConfig(raw: Partial<HomeConfig> | null | undefined): HomeConfig {
  if (!raw) return DEFAULT_HOME_CONFIG
  return {
    season_kit: raw.season_kit ?? DEFAULT_HOME_CONFIG.season_kit,
    climb: raw.climb ?? DEFAULT_HOME_CONFIG.climb,
    featured_collection_slugs: raw.featured_collection_slugs ?? [],
    featured_category_slugs: raw.featured_category_slugs ?? [],
    stats: raw.stats ?? [],
    showcase: raw.showcase ?? DEFAULT_HOME_CONFIG.showcase,
    // `trails` was missing from this list, and that is the whole bug: this
    // function does not patch the row, it REBUILDS it from an explicit set of
    // keys, so any key not named here is dropped on every read. The homepage
    // then did `home_config.trails ?? DEFAULT_HOME_TRAILS` and got the fallback
    // forever — so the Trails section shipped the same four hardcoded routes no
    // matter what anybody saved at /admin/homepage. The editor wrote to the
    // database correctly and the storefront could never see it.
    //
    // Anything added to HomeConfig from here on has to be added here too, or it
    // will fail exactly this way: silently, with the admin UI still working.
    trails: raw.trails ?? undefined,
  }
}

// Read with the cookie-free public client.
//
// Store settings are shop-wide configuration — the free-shipping threshold, the
// GST fallback, the homepage layout. Nothing here is per-customer, so the
// cookie-based client bought nothing, and it cost more than it looks: reading
// cookies makes the calling page dynamic. This one call was the only reason
// /products/[slug], / and /about could not be cached, which on production
// measured a 5.35s product page against 0.88s for a static one.
//
// AN EXPLICIT COLUMN LIST, AND WHY IT IS NOT A STYLE CHOICE.
//
// This used to be `select('*')` against a table whose read policy is
// USING (true) — and that table also holds `gstin`, `seller_legal_name` and the
// shop's full registered address. Those columns are null today, which is the
// only reason it has not already been a live leak, and they CANNOT STAY NULL:
// a GST-compliant invoice cannot be issued without them, so the day the shop
// can invoice is the day its registration details ship in every page load.
//
// RLS cannot fix that. RLS is row-level and has nothing to say about columns,
// so the fix is a column-level GRANT (migration 102) — and a column grant turns
// `select('*')` on the anon client into a permission error, which the fallback
// below would silently swallow. The failure mode would not be a crash; it would
// be every configured setting quietly disappearing and the homepage reverting
// to defaults.
//
// So the list comes first, the grant follows it, and the two are kept in step
// by 102 naming exactly these columns.
const STOREFRONT_COLUMNS = [
  'id',
  'store_name',
  'support_email',
  'flat_shipping_rate',
  'free_shipping_threshold',
  'enable_tax',
  'gst_percentage',
  // A state name, not a registration detail — and the storefront genuinely
  // needs it, because it is what decides CGST+SGST against IGST on a quote.
  'origin_state',
  'shipping_is_taxable',
  'currency',
  'timezone',
  'home_config',
  'updated_at',
].join(',')

export async function getStoreSettings() {
  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase
    .from('store_settings')
    .select(STOREFRONT_COLUMNS)
    .eq('id', 1)
    .single()

  if (error) {
    // If it doesn't exist, we fallback to defaults so UI doesn't crash before migration runs
    return {
      store_name: 'DewDropz',
      support_email: 'hello@dewdropz.com',
      flat_shipping_rate: 10000,
      free_shipping_threshold: 200000,
      enable_tax: true,
      gst_percentage: 5.0,
      origin_state: 'Uttarakhand',
      gstin: null,
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      home_config: DEFAULT_HOME_CONFIG,
    } as StoreSettings
  }

  const row = data as unknown as Partial<StoreSettings>
  return { ...row, home_config: normalizeHomeConfig(row.home_config) } as StoreSettings
}

/**
 * Every column, including the ones the storefront may not see.
 *
 * The counterpart to the list above. `getStoreSettings` deliberately cannot
 * return the GSTIN or the registered address any more, so the admin screens
 * that EDIT those fields need a way in that is gated on being an admin rather
 * than on a table policy — and reads through the service-role client, because
 * migration 102 revokes the columns from `authenticated` as well as `anon`.
 *
 * Revoking from `authenticated` too is deliberate: an ordinary signed-in
 * customer is not a member of staff, and "logged in" has never been the same
 * thing as "may read the company's tax registration".
 */
export async function getAdminStoreSettings(): Promise<StoreSettings> {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase.from('store_settings').select('*').eq('id', 1).single()

  // No silent fallback here, unlike the public read. A storefront that loses its
  // settings should still render; an admin screen that cannot read them must not
  // present empty fields as though they were the saved values and invite
  // somebody to overwrite a GSTIN with a blank.
  if (error || !data) {
    throw new Error(`Could not read store settings: ${error?.message ?? 'no row'}`)
  }

  return { ...data, home_config: normalizeHomeConfig(data.home_config) } as StoreSettings
}

/**
 * Result of a settings write.
 *
 * Returned rather than thrown because Next.js masks Server Action error
 * messages in production builds — a thrown "your GSTIN check character is
 * wrong" reaches the browser as a generic failure, which is precisely the
 * detail the person retyping a 15-character legal identifier needs. `kind`
 * lets the caller distinguish a refusal it may offer to override from one it
 * must not.
 */
export type SettingsResult =
  | { ok: true; settings: StoreSettings }
  | { ok: false; error: string; kind: 'checksum' | 'invalid' }

export async function updateStoreSettings(
  input: Partial<Omit<StoreSettings, 'id' | 'updated_at'>>,
  opts?: { acceptGstinChecksum?: boolean }
): Promise<SettingsResult> {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()

  // Checked here rather than only in the form: this is a server action, so the
  // form is not the only way in, and a bad GSTIN is not a bad form field — it
  // is a defective tax invoice with a spent serial number behind it.
  if (input.gstin != null && input.gstin !== '') {
    const check = validateGstin(input.gstin)
    if (!check.ok) {
      if (check.kind !== 'checksum') {
        return { ok: false, kind: 'invalid', error: `That GSTIN is not valid. ${check.reason}` }
      }
      if (!opts?.acceptGstinChecksum) {
        return { ok: false, kind: 'checksum', error: check.reason }
      }
    }
    input = { ...input, gstin: check.ok ? check.value : input.gstin.trim().toUpperCase() }
  }

  // issue_invoice refuses when these two disagree, and it refuses at dispatch —
  // long after whoever typed them has left the screen. Catching it at the point
  // of entry turns a silently uninvoiceable shop into a visible typo.
  if (input.gstin && input.seller_state_code && input.gstin.slice(0, 2) !== input.seller_state_code) {
    return {
      ok: false,
      kind: 'invalid',
      error: `The GSTIN starts with ${input.gstin.slice(0, 2)} but the seller state code is ${input.seller_state_code}. One of the two is wrong, and both are printed on every invoice.`,
    }
  }

  const { data, error } = await supabase
    .from('store_settings')
    .update(input)
    .eq('id', 1)
    .select()
    .single()

  if (error) return { ok: false, kind: 'invalid', error: error.message }

  revalidatePath('/', 'layout') // Revalidate everything as settings affect global state
  return { ok: true, settings: data as StoreSettings }
}
