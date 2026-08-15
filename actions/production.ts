'use server'

import { revalidatePath } from 'next/cache'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { requireAdmin } from './auth'
import { auditLog } from '@/lib/audit'

type QueueRow = {
  id: string
  quantity: number
  product_name: string
  variant_name: string | null
  printed_at: string | null
  printed_by: string | null
  production_note: string | null
  design: PrintJob['design']
  order: { id: string; order_number: string; status: string; created_at: string } | null
}

export type PrintJob = {
  itemId: string
  orderId: string
  orderNumber: string
  orderStatus: string
  placedAt: string
  productName: string
  variantName: string | null
  quantity: number
  printedAt: string | null
  printedBy: string | null
  productionNote: string | null
  design: {
    id: string
    front_preview_url: string | null
    back_preview_url: string | null
    front_print_url: string | null
    back_print_url: string | null
    front_print_dpi: number | null
    back_print_dpi: number | null
    front_design: unknown
    back_design: unknown
  } | null
}

/**
 * The print queue: every customised line across every live order.
 *
 * Cancelled and refunded orders are excluded — printing a shirt for an order
 * that no longer exists is the one mistake this screen has to prevent.
 */
export async function getPrintQueue(opts?: { printed?: boolean; limit?: number; offset?: number }) {
  await requireAdmin()
  const limit = opts?.limit ?? 50
  const offset = opts?.offset ?? 0

  const filtered = createAdminSupabaseClient()
    .from('order_items')
    .select(`
      id, quantity, product_name, variant_name, printed_at, printed_by, production_note, created_at,
      design:custom_designs!inner(*),
      order:orders!inner(id, order_number, status, created_at)
    `, { count: 'exact' })
    .not('custom_design_id', 'is', null)
    // Printing a shirt for an order that no longer exists is the one mistake
    // this screen has to prevent.
    .not('order.status', 'in', '(cancelled,refunded)')

  // One `.filter()` rather than a ternary between `.not()` and `.is()`: the
  // ternary produces a union of two PostgREST builder types and tsc gives up
  // trying to collapse it through the two !inner joins above.
  const { data, count } = await filtered
    .filter('printed_at', opts?.printed ? 'not.is' : 'is', null)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1)
    .returns<QueueRow[]>()

  const jobs: PrintJob[] = (data ?? []).map((r) => ({
    itemId: r.id,
    orderId: r.order?.id ?? '',
    orderNumber: r.order?.order_number ?? '—',
    orderStatus: r.order?.status ?? '—',
    placedAt: r.order?.created_at ?? '',
    productName: r.product_name,
    variantName: r.variant_name,
    quantity: r.quantity,
    printedAt: r.printed_at,
    printedBy: r.printed_by,
    productionNote: r.production_note,
    design: r.design,
  }))

  return { jobs, total: count ?? 0 }
}

export async function getPrintQueueCounts() {
  await requireAdmin()
  const admin = createAdminSupabaseClient()
  const base = () => admin
    .from('order_items')
    .select('id, order:orders!inner(status)', { count: 'exact', head: true })
    .not('custom_design_id', 'is', null)
    .not('order.status', 'in', '(cancelled,refunded)')

  const [queued, printed] = await Promise.all([
    base().is('printed_at', null),
    base().not('printed_at', 'is', null),
  ])
  return { queued: queued.count ?? 0, printed: printed.count ?? 0 }
}

export async function markPrinted(itemId: string, printed: boolean, note?: string) {
  const actor = await requireAdmin()
  const { error } = await createAdminSupabaseClient()
    .from('order_items')
    .update({
      printed_at: printed ? new Date().toISOString() : null,
      printed_by: printed ? (actor.email ?? actor.id) : null,
      ...(note !== undefined ? { production_note: note || null } : {}),
    })
    .eq('id', itemId)
  if (error) throw new Error(error.message)

  await auditLog({
    actorId: actor.id, actorEmail: actor.email,
    action: printed ? 'production.printed' : 'production.unprinted',
    entityType: 'order_item', entityId: itemId, note,
  })
  revalidatePath('/admin/production')
}
