'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase'
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
    line: 'Three heavyweight blanks, printed to order in Dehradun. Pick a colour, add your artwork, and it ships in 8-10 days.',
    collection_slug: null,
    product_slugs: ['custom-hoodie', 'custom-sweatshirt', 'custom-print-tee'],
  },
  climb: {
    enabled: true,
    headline: 'Every blank, made to order.',
    intro: 'No stock sitting in a warehouse — each piece is cut and printed only once someone actually wants it.',
    stations: [
      { product_slug: 'custom-hoodie', label: '01', line: '380 GSM French terry, your design front and back.' },
      { product_slug: 'custom-sweatshirt', label: '02', line: 'Heavyweight and boxy, built for a full-chest print.' },
      { product_slug: 'custom-print-tee', label: '03', line: 'The one you reach for when the idea cannot wait.' },
    ],
  },
  featured_collection_slugs: [],
}

export async function getStoreSettings() {
  const supabase = await createServerSupabaseClient()
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
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      home_config: DEFAULT_HOME_CONFIG,
    } as StoreSettings
  }

  return { ...data, home_config: data.home_config ?? DEFAULT_HOME_CONFIG } as StoreSettings
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
