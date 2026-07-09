'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase'
import { requireAdmin } from './auth'
import { getStoreSettings } from './settings'
import type { ShippingZone, ShippingRate, ShippingZoneWithRates } from '@/types/database'

// Real checkout-time shipping cost, driven by the zones/rates admins configure in
// /admin/settings — a zone matching the destination's state wins over one matching
// only its country, and a zone with no state/country restrictions acts as the
// catch-all. Falls back to the global flat rate when nothing is configured yet, so
// checkout never breaks just because no zones have been set up.
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

  const supabase = await createServerSupabaseClient()
  const { data: zones } = await supabase
    .from('shipping_zones')
    .select('*, rates:shipping_rates(*)')
    .eq('is_active', true)

  const allZones = (zones ?? []) as unknown as ShippingZoneWithRates[]
  const stateMatch = input.state
    ? allZones.find((z) => z.states?.length && z.states.includes(input.state!))
    : undefined
  const countryMatch = input.country
    ? allZones.find((z) => z.countries?.length && z.countries.includes(input.country!))
    : undefined
  const catchAll = allZones.find((z) => !z.states?.length && !z.countries?.length)
  const zone = stateMatch ?? countryMatch ?? catchAll

  if (zone) {
    const activeRates = (zone.rates ?? []).filter((r) => r.is_active)
    const priceRate = activeRates.find(
      (r) => r.type === 'price_based' && input.subtotal >= r.min_value && (r.max_value == null || input.subtotal <= r.max_value)
    )
    if (priceRate) return priceRate.price
    const weightRate = activeRates.find(
      (r) => r.type === 'weight_based' && input.weightGrams >= r.min_value && (r.max_value == null || input.weightGrams <= r.max_value)
    )
    if (weightRate) return weightRate.price
    const flatRate = activeRates.find((r) => r.type === 'flat')
    if (flatRate) return flatRate.price
  }

  return settings.flat_shipping_rate
}

export async function getShippingZones() {
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
  is_active: boolean
}>) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  
  // ensure we map max_value undefined to no-op, but if they pass explicit null, we set it to null
  const updatePayload: Record<string, any> = { ...input }
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
