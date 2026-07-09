'use server'

import { revalidatePath } from 'next/cache'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { requireAdmin } from './auth'
import type { Coupon } from '@/types/database'

export async function getCoupons() {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false })
  return (data ?? []) as Coupon[]
}

export async function createCoupon(input: {
  code: string; type: 'percentage' | 'fixed'; value: number
  min_order_amount?: number; max_discount_amount?: number
  usage_limit?: number; starts_at?: string; expires_at?: string; is_active?: boolean
}) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('coupons').insert(input)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/coupons')
}

export async function updateCoupon(id: string, input: Partial<{
  code: string; type: 'percentage' | 'fixed'; value: number
  min_order_amount: number; max_discount_amount: number
  usage_limit: number; starts_at: string; expires_at: string; is_active: boolean
}>) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('coupons').update(input).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/coupons')
}

export async function deleteCoupon(id: string) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('coupons').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/coupons')
}
