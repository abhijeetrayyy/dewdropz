'use server'

import { createAdminSupabaseClient } from '@/lib/supabase'
import { requireAdmin } from './auth'
import { ABANDONED_AFTER_HOURS } from '@/lib/abandonedCarts'

export type AbandonedCartRow = {
  id: string
  email: string
  name: string | null
  updatedAt: string
  value: number
  itemCount: number
  items: { name: string; quantity: number }[]
  recoverySentAt: string | null
  recoveredAt: string | null
  /** Hours since the customer last touched the cart, measured once server-side
   *  so every row on the page agrees about what "now" is. */
  hoursIdle: number
  hoursSinceReminder: number | null
}

/**
 * Carts that are sitting untouched, for the admin list. Read straight through
 * the admin client — there is no customer-facing view of this, and it crosses
 * users by definition.
 */
export async function getAbandonedCarts(opts?: { limit?: number; offset?: number }): Promise<{ carts: AbandonedCartRow[]; total: number }> {
  await requireAdmin()
  const admin = createAdminSupabaseClient()
  const cutoff = new Date(Date.now() - ABANDONED_AFTER_HOURS * 3600_000).toISOString()

  // Was a flat .limit(200), which silently hid everything past the two
  // hundredth cart — a cap that lies is worse than a page number.
  const limit = opts?.limit ?? 50
  const offset = opts?.offset ?? 0
  const { data, count } = await admin
    .from('carts')
    .select(`
      id, last_activity_at, recovery_sent_at, recovered_at,
      profile:profiles!inner(email, full_name),
      items:cart_items(quantity, product:products(name, price))
    `, { count: 'exact' })
    .not('user_id', 'is', null)
    .lt('last_activity_at', cutoff)
    .order('last_activity_at', { ascending: false })
    .range(offset, offset + limit - 1)

  type Row = {
    id: string
    last_activity_at: string
    recovery_sent_at: string | null
    recovered_at: string | null
    profile: { email: string; full_name: string | null } | null
    items: { quantity: number; product: { name: string; price: number } | null }[]
  }

  const now = Date.now()

  const carts = ((data ?? []) as unknown as Row[])
    // An empty cart is a converted or cleared one — it is not abandoned, and
    // listing it would bury the real ones.
    .filter((c) => (c.items ?? []).some((i) => i.product))
    .map((c) => {
      const items = (c.items ?? []).filter((i) => i.product)
      return {
        id: c.id,
        email: c.profile?.email ?? '—',
        name: c.profile?.full_name ?? null,
        updatedAt: c.last_activity_at,
        value: items.reduce((sum, i) => sum + i.product!.price * i.quantity, 0),
        itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
        items: items.map((i) => ({ name: i.product!.name, quantity: i.quantity })),
        recoverySentAt: c.recovery_sent_at,
        recoveredAt: c.recovered_at,
        hoursIdle: Math.floor((now - new Date(c.last_activity_at).getTime()) / 3600_000),
        hoursSinceReminder: c.recovery_sent_at
          ? Math.floor((now - new Date(c.recovery_sent_at).getTime()) / 3600_000)
          : null,
      }
    })

  return { carts, total: count ?? 0 }
}

/**
 * The header numbers, which describe the whole set rather than the page on
 * screen — so they are summed in Postgres instead of by loading every cart.
 */
export async function getAbandonedCartSummary() {
  await requireAdmin()
  const cutoff = new Date(Date.now() - ABANDONED_AFTER_HOURS * 3600_000).toISOString()
  const { data } = await createAdminSupabaseClient().rpc('abandoned_cart_summary', { cutoff })
  const row = (data as { carts: number; value: number; emailed: number; recovered: number }[] | null)?.[0]
  return {
    carts: Number(row?.carts ?? 0),
    value: Number(row?.value ?? 0),
    emailed: Number(row?.emailed ?? 0),
    recovered: Number(row?.recovered ?? 0),
  }
}
