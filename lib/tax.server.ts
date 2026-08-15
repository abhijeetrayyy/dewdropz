import 'server-only'
import { createAdminSupabaseClient } from '@/lib/supabase'
import type { TaxRate } from '@/lib/tax'

// The I/O half of the tax engine. The arithmetic is in `lib/tax.ts`, which has
// no server imports so it can be tested directly.

export async function getTaxRates(): Promise<TaxRate[]> {
  const { data } = await createAdminSupabaseClient()
    .from('tax_rates')
    .select('hsn_code, min_price, max_price, rate')
    .eq('is_active', true)
    // Narrowest band first, so the more specific row is the one resolveRate
    // finds. Two rows cannot overlap (the unique index sees to that), but
    // ordering keeps the result stable regardless of insertion order.
    .order('hsn_code')
    .order('min_price', { ascending: false })
  // PostgREST returns DECIMAL as a string; the arithmetic downstream must not
  // silently concatenate rates.
  return (data ?? []).map((r) => ({ ...r, rate: Number(r.rate) })) as TaxRate[]
}
