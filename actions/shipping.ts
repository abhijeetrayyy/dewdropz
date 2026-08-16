'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase'
import { requireAdmin } from './auth'
import { getStoreSettings } from './settings'
import { stateForPincode } from '@/lib/pincode-zones'
import type { ShippingZone, ShippingRate, ShippingZoneWithRates } from '@/types/database'
import { ensureAdmin } from '@/lib/adminAuth'

// Shared zone-matching: a zone matching the destination's state wins over one
// matching only its country, and a zone with no state/country restrictions acts as
// the catch-all. Used by both checkout's cost calculation and the storefront's
// pincode delivery estimate so they never disagree about which zone applies.
function matchZone(zones: ShippingZoneWithRates[], state?: string | null, country?: string | null) {
  const stateMatch = state ? zones.find((z) => z.states?.length && z.states.includes(state)) : undefined
  const countryMatch = country ? zones.find((z) => z.countries?.length && z.countries.includes(country)) : undefined
  const catchAll = zones.find((z) => !z.states?.length && !z.countries?.length)
  return stateMatch ?? countryMatch ?? catchAll
}

// Shared rate-matching within a resolved zone: price-based wins over weight-based
// over flat, matching the order checkout has always used.
function matchRate(zone: ShippingZoneWithRates | undefined, subtotal: number, weightGrams: number): ShippingRate | null {
  if (!zone) return null
  const activeRates = (zone.rates ?? []).filter((r) => r.is_active)
  const priceRate = activeRates.find(
    (r) => r.type === 'price_based' && subtotal >= r.min_value && (r.max_value == null || subtotal <= r.max_value)
  )
  if (priceRate) return priceRate
  const weightRate = activeRates.find(
    (r) => r.type === 'weight_based' && weightGrams >= r.min_value && (r.max_value == null || weightGrams <= r.max_value)
  )
  if (weightRate) return weightRate
  const flatRate = activeRates.find((r) => r.type === 'flat')
  return flatRate ?? null
}

async function getActiveZones(): Promise<ShippingZoneWithRates[]> {
  const supabase = await createServerSupabaseClient()
  const { data: zones } = await supabase
    .from('shipping_zones')
    .select('*, rates:shipping_rates(*)')
    .eq('is_active', true)
  return (zones ?? []) as unknown as ShippingZoneWithRates[]
}

// Real checkout-time shipping cost, driven by the zones/rates admins configure in
// /admin/settings. Falls back to the global flat rate when nothing is configured
// yet, so checkout never breaks just because no zones have been set up.
export async function calculateShippingCost(input: {
  state?: string | null
  country?: string | null
  subtotal: number
  weightGrams: number
}): Promise<number> {
  const settings = await getStoreSettings()
  if (settings.free_shipping_threshold > 0 && input.subtotal >= settings.free_shipping_threshold) {
    return 0
  }

  const allZones = await getActiveZones()
  const zone = matchZone(allZones, input.state, input.country)
  const rate = matchRate(zone, input.subtotal, input.weightGrams)

  return rate?.price ?? settings.flat_shipping_rate
}

// Storefront pincode delivery checker: resolves a 6-digit Indian pincode to its
// state via India Post's stable PIN-prefix mapping, then reuses the exact same
// zone/rate matching checkout uses — so the estimate shown on the product page is
// never out of sync with what the customer will actually be charged at checkout.
export async function getDeliveryEstimate(input: {
  pincode: string
  subtotal: number
  weightGrams: number
}): Promise<
  | { serviceable: true; state: string; cost: number; minDays: number | null; maxDays: number | null }
  | { serviceable: false; error: string }
> {
  const pincode = input.pincode.trim()
  if (!/^[1-9][0-9]{5}$/.test(pincode)) {
    return { serviceable: false, error: 'Enter a valid 6-digit pincode.' }
  }

  const state = stateForPincode(pincode)
  if (!state) {
    return { serviceable: false, error: "We couldn't recognize that pincode." }
  }

  const settings = await getStoreSettings()
  const allZones = await getActiveZones()
  const zone = matchZone(allZones, state, 'India')
  const rate = matchRate(zone, input.subtotal, input.weightGrams)

  const cost =
    settings.free_shipping_threshold > 0 && input.subtotal >= settings.free_shipping_threshold
      ? 0
      : rate?.price ?? settings.flat_shipping_rate

  return {
    serviceable: true,
    state,
    cost,
    minDays: rate?.estimated_min_days ?? null,
    maxDays: rate?.estimated_max_days ?? null,
  }
}

export async function getShippingZones() {
  await ensureAdmin()
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('shipping_zones')
    .select('*, rates:shipping_rates(*)')
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return data as unknown as ShippingZoneWithRates[]
}

export async function createShippingZone(input: {
  name: string
  countries?: string[]
  states?: string[]
  is_active?: boolean
}) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  
  const { data, error } = await supabase
    .from('shipping_zones')
    .insert({
      name: input.name,
      countries: input.countries || [],
      states: input.states || [],
      is_active: input.is_active ?? true,
    })
    .select()
    .single()
    
  if (error) throw new Error(error.message)
  revalidatePath('/admin/settings')
  return data as ShippingZone
}

export async function updateShippingZone(id: string, input: Partial<{
  name: string
  countries: string[]
  states: string[]
  is_active: boolean
}>) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  
  const { data, error } = await supabase
    .from('shipping_zones')
    .update(input)
    .eq('id', id)
    .select()
    .single()
    
  if (error) throw new Error(error.message)
  revalidatePath('/admin/settings')
  return data as ShippingZone
}

export async function deleteShippingZone(id: string) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('shipping_zones').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/settings')
}

export async function createShippingRate(input: {
  zone_id: string
  name: string
  type: 'flat' | 'weight_based' | 'price_based'
  price: number
  min_value?: number
  max_value?: number | null
  estimated_min_days?: number | null
  estimated_max_days?: number | null
  is_active?: boolean
}) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()

  const { data, error } = await supabase
    .from('shipping_rates')
    .insert({
      zone_id: input.zone_id,
      name: input.name,
      type: input.type,
      price: input.price,
      min_value: input.min_value || 0,
      max_value: input.max_value ?? null,
      estimated_min_days: input.estimated_min_days ?? null,
      estimated_max_days: input.estimated_max_days ?? null,
      is_active: input.is_active ?? true,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/admin/settings')
  return data as ShippingRate
}

export async function updateShippingRate(id: string, input: Partial<{
  name: string
  type: 'flat' | 'weight_based' | 'price_based'
  price: number
  min_value: number
  max_value: number | null
  estimated_min_days: number | null
  estimated_max_days: number | null
  is_active: boolean
}>) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  
  // ensure we map max_value undefined to no-op, but if they pass explicit null, we set it to null
  const updatePayload: Record<string, unknown> = { ...input }
  if (input.max_value === null) {
    updatePayload.max_value = null
  }
  
  const { data, error } = await supabase
    .from('shipping_rates')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()
    
  if (error) throw new Error(error.message)
  revalidatePath('/admin/settings')
  return data as ShippingRate
}

export async function deleteShippingRate(id: string) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('shipping_rates').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/settings')
}
