'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase'
import { requireAdmin } from './auth'
import type { StoreSettings } from '@/types/database'

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
    } as StoreSettings
  }
  
  return data as StoreSettings
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
