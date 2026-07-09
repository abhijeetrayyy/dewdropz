'use server'

import { createAdminSupabaseClient } from '@/lib/supabase'
import { requireAdmin } from './auth'

export interface CustomerRow {
  id: string; email: string; full_name: string | null; phone: string | null
  role: string; created_at: string; order_count: number; total_spent: number
}

export async function getCustomers(opts?: { search?: string; limit?: number; offset?: number }) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  let query = supabase.from('profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false })
  if (opts?.search) {
    const s = opts.search.replace(/[%_]/g, '')
    query = query.or(`full_name.ilike.%${s}%,email.ilike.%${s}%`)
  }
  if (opts?.limit != null && opts?.offset != null) {
    query = query.range(opts.offset, opts.offset + opts.limit - 1)
  } else if (opts?.limit) {
    query = query.limit(opts.limit)
  }
  const { data: profiles, count, error } = await query
  if (error) throw new Error(error.message)
  if (!profiles || profiles.length === 0) return { customers: [] as CustomerRow[], total: count ?? 0 }

  // Only load orders for the customers on this page — bounded regardless of total
  // customer count, instead of every order in the system or one query per customer.
  const { data: orders } = await supabase.from('orders').select('user_id, total_amount').in('user_id', profiles.map((p) => p.id))
  const totalsByUser = new Map<string, { count: number; total: number }>()
  for (const o of orders ?? []) {
    if (!o.user_id) continue
    const entry = totalsByUser.get(o.user_id) ?? { count: 0, total: 0 }
    entry.count += 1
    entry.total += o.total_amount
    totalsByUser.set(o.user_id, entry)
  }

  const customers = profiles.map((p) => {
    const entry = totalsByUser.get(p.id)
    return { ...p, order_count: entry?.count ?? 0, total_spent: entry?.total ?? 0 } as CustomerRow
  })
  return { customers, total: count ?? 0 }
}
