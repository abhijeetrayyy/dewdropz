'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getSession } from './auth'
import { addressSchema } from '@/lib/validations'
import type { Address } from '@/types/database'

type AddressInput = {
  type?: 'shipping' | 'billing'
  full_name: string
  phone: string
  address_line1: string
  address_line2?: string
  city: string
  state: string
  postal_code: string
  country?: string
  is_default?: boolean
}

export async function createAddress(input: AddressInput) {
  const session = await getSession()
  if (!session?.user) return { error: 'Not authenticated' }

  const parsed = addressSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const supabase = await createServerSupabaseClient()

  // If this is the first address or marked as default, unset other defaults
  if (parsed.data.is_default) {
    const { error: updateErr } = await supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('user_id', session.user.id)
    if (updateErr) return { error: updateErr.message }
  }

  const { data, error } = await supabase
    .from('addresses')
    .insert({
      ...parsed.data,
      user_id: session.user.id,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/account/addresses')
  return { success: true, address: data }
}

export async function updateAddress(id: string, input: Partial<AddressInput>) {
  const session = await getSession()
  if (!session?.user) return { error: 'Not authenticated' }

  const supabase = await createServerSupabaseClient()

  // Verify ownership
  const { data: existing } = await supabase
    .from('addresses')
    .select('id')
    .eq('id', id)
    .eq('user_id', session.user.id)
    .single()

  if (!existing) return { error: 'Address not found' }

  // If setting as default, unset others
  if (input.is_default) {
    await supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('user_id', session.user.id)
  }

  const { error } = await supabase
    .from('addresses')
    .update(input)
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/account/addresses')
  return { success: true }
}

export async function deleteAddress(id: string) {
  const session = await getSession()
  if (!session?.user) return { error: 'Not authenticated' }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('addresses')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id)

  if (error) return { error: error.message }
  revalidatePath('/account/addresses')
  return { success: true }
}

export async function getAddresses(addressType?: 'shipping' | 'billing') {
  const session = await getSession()
  if (!session?.user) return []

  const supabase = await createServerSupabaseClient()
  let query = supabase
    .from('addresses')
    .select('*')
    .eq('user_id', session.user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (addressType) query = query.eq('type', addressType)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as Address[]
}

export async function getDefaultAddress(addrType: 'shipping' | 'billing' = 'shipping') {
  const session = await getSession()
  if (!session?.user) return null

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('type', addrType)
    .eq('is_default', true)
    .maybeSingle()

  if (error) return null
  return data as Address | null
}

export async function setDefaultAddress(id: string) {
  return updateAddress(id, { is_default: true })
}
