'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminSupabaseClient, createPublicSupabaseClient } from '@/lib/supabase'
import { requireAdmin } from './auth'
import type { StoreSettings, HomeConfig } from '@/types/database'

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
// RLS already publishes it: "Anyone can read store settings" USING (true),
// verified against the live database with the anon key.
export async function getStoreSettings() {
  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase.from('store_settings').select('*').eq('id', 1).single()

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

  return { ...data, home_config: normalizeHomeConfig(data.home_config) } as StoreSettings
}

export async function updateStoreSettings(input: Partial<Omit<StoreSettings, 'id' | 'updated_at'>>) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()

  const { data, error } = await supabase
    .from('store_settings')
    .update(input)
    .eq('id', 1)
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/', 'layout') // Revalidate everything as settings affect global state
  return data as StoreSettings
}
