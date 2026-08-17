'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, requireAuth } from '@/actions/auth'
import { createAdminSupabaseClient, createServerSupabaseClient } from '@/lib/supabase'
import { auditLog } from '@/lib/audit'
import { refundOrder } from '@/actions/orders'
import { RETURN_WINDOW_DAYS } from '@/lib/constants'
import { sendSlackAlert } from '@/lib/slack'

// Returns / RMA.
//
// The rule this is built around: money and stock move on RECEIPT, never on
// approval. Agreeing to a return costs nothing; refunding for a parcel that
// never arrives is the expensive mistake, so `received_at` gates both.

export type ReturnStatus =
  | 'requested' | 'approved' | 'rejected' | 'in_transit' | 'received' | 'refunded' | 'cancelled'

function rmaNumber() {
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return `RMA-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`
}

/**
 * Whether this order can still be returned, and what is left to return.
 *
 * Quantities already covered by an open or completed return are subtracted, so
 * a customer cannot return the same shirt twice by opening two requests.
 */
export async function getReturnEligibility(orderId: string) {
  const user = await requireAuth()
  const supabase = await createServerSupabaseClient()

  const { data: order } = await supabase
    .from('orders')
    .select('id, status, delivered_at, items:order_items(id, product_name, variant_name, quantity, unit_price)')
    .eq('id', orderId)
    .eq('user_id', user.id)
    .single()

  if (!order) return { eligible: false as const, reason: 'Order not found', lines: [] }
  if (order.status !== 'delivered') {
    return { eligible: false as const, reason: 'This order has not been delivered yet.', lines: [] }
  }

  const deliveredAt = order.delivered_at ? new Date(order.delivered_at) : null
  const daysSince = deliveredAt ? (Date.now() - deliveredAt.getTime()) / 86_400_000 : Infinity
  if (daysSince > RETURN_WINDOW_DAYS) {
    return {
      eligible: false as const,
      reason: `Returns close ${RETURN_WINDOW_DAYS} days after delivery.`,
      lines: [],
    }
  }

  // Anything already spoken for by a return that has not been rejected or
  // cancelled is no longer available to return again.
  const { data: claimed } = await supabase
    .from('return_items')
    .select('order_item_id, quantity, ret:returns!inner(order_id, status)')
    .eq('ret.order_id', orderId)
    .not('ret.status', 'in', '(rejected,cancelled)')

  const used = new Map<string, number>()
  for (const r of claimed ?? []) used.set(r.order_item_id, (used.get(r.order_item_id) ?? 0) + r.quantity)

  const lines = (order.items ?? []).map((i) => ({
    orderItemId: i.id,
    name: i.variant_name ? `${i.product_name} — ${i.variant_name}` : i.product_name,
    unitPrice: i.unit_price,
    returnable: Math.max(0, i.quantity - (used.get(i.id) ?? 0)),
  }))

  return {
    eligible: lines.some((l) => l.returnable > 0),
    reason: lines.some((l) => l.returnable > 0) ? null : 'Everything on this order has already been returned.',
    lines,
  }
}

export async function requestReturn(input: {
  orderId: string
  reason: string
  note?: string
  items: { orderItemId: string; quantity: number }[]
}) {
  const user = await requireAuth()

  // Re-checked server-side rather than trusted from the form: the eligibility
  // call above also runs in the browser, and a closed window is exactly the
  // thing someone would try to post around.
  const eligibility = await getReturnEligibility(input.orderId)
  if (!eligibility.eligible) return { error: eligibility.reason ?? 'This order cannot be returned.' }

  const wanted = input.items.filter((i) => i.quantity > 0)
  if (!wanted.length) return { error: 'Select at least one item to return.' }
  for (const w of wanted) {
    const line = eligibility.lines.find((l) => l.orderItemId === w.orderItemId)
    if (!line || w.quantity > line.returnable) return { error: 'That quantity is not available to return.' }
  }

  const admin = createAdminSupabaseClient()
  const { data: ret, error } = await admin
    .from('returns')
    .insert({
      order_id: input.orderId,
      user_id: user.id,
      rma_number: rmaNumber(),
      reason: input.reason,
      customer_note: input.note ?? null,
      status: 'requested',
    })
    .select('id, rma_number')
    .single()
  if (error) return { error: error.message }

  const { error: itemsError } = await admin.from('return_items').insert(
    wanted.map((w) => ({ return_id: ret.id, order_item_id: w.orderItemId, quantity: w.quantity }))
  )
  if (itemsError) return { error: itemsError.message }

  revalidatePath(`/account/orders/${input.orderId}`)
  return { id: ret.id as string, rmaNumber: ret.rma_number as string }
}

export async function getReturnsForOrder(orderId: string) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('returns')
    .select('*, items:return_items(*)')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getAllReturns(status?: ReturnStatus, opts?: { limit?: number; offset?: number }) {
  await requireAdmin()
  // Previously unbounded: every return ever filed, with its items and its
  // order joined, on every visit to the queue. Fine at 500 rows, not at
  // 50,000 — and an RMA queue is exactly the list that only ever grows.
  let q = createAdminSupabaseClient()
    .from('returns')
    .select('*, items:return_items(*), order:orders(order_number, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
  if (status) q = q.eq('status', status)
  if (opts?.limit != null && opts?.offset != null) {
    q = q.range(opts.offset, opts.offset + opts.limit - 1)
  }
  const { data, count } = await q
  return { returns: data ?? [], total: count ?? 0 }
}

/** Approve or reject. Deliberately moves nothing but the status — see the note
 *  at the top of this file. */
export async function decideReturn(returnId: string, decision: 'approved' | 'rejected', adminNote?: string) {
  const actor = await requireAdmin()
  const admin = createAdminSupabaseClient()

  const { data: ret, error } = await admin
    .from('returns')
    .update({ status: decision, admin_note: adminNote ?? null })
    .eq('id', returnId)
    .in('status', ['requested'])
    .select('order_id, rma_number')
    .single()
  if (error || !ret) return { error: 'Only a requested return can be approved or rejected.' }

  await auditLog({
    actorId: actor.id, actorEmail: actor.email, action: `return.${decision}`,
    entityType: 'return', entityId: returnId, after: { status: decision }, note: adminNote,
  })
  revalidatePath('/admin/returns')
  revalidatePath(`/admin/orders/${ret.order_id}`)
  return { ok: true as const }
}

/**
 * The parcel came back. This is where money and stock actually move.
 *
 * Restock is per line, because a return that arrives damaged should be refunded
 * without putting an unsellable item back on the shelf. Refund reuses
 * refundOrder() so gateway handling, coupon release and the refund email stay in
 * one place rather than being reimplemented here and drifting.
 */
export async function receiveReturn(input: {
  returnId: string
  refundAmount?: number
  restock?: Record<string, boolean>
  adminNote?: string
}) {
  const actor = await requireAdmin()
  const admin = createAdminSupabaseClient()

  const { data: ret } = await admin
    .from('returns')
    .select('id, order_id, status, rma_number, items:return_items(order_item_id, quantity)')
    .eq('id', input.returnId)
    .single()
  if (!ret) return { error: 'Return not found' }
  if (!['approved', 'in_transit'].includes(ret.status)) {
    return { error: 'Only an approved return can be received.' }
  }

  if (input.restock) {
    for (const [orderItemId, restock] of Object.entries(input.restock)) {
      await admin.from('return_items').update({ restock }).eq('return_id', ret.id).eq('order_item_id', orderItemId)
    }
  }

  // Put the resellable stock back. This is the half that `restock: false` on
  // the refund below deliberately leaves to us: refundOrder() would restock the
  // WHOLE order, which for a one-of-three-items return puts back two things
  // that never came back. Done per line, and only for lines marked resellable.
  const { data: lines } = await admin
    .from('return_items')
    .select('order_item_id, quantity, restock, item:order_items(product_id, variant_id)')
    .eq('return_id', ret.id)

  for (const line of lines ?? []) {
    if (!line.restock) continue
    const item = line.item as unknown as { product_id: string; variant_id: string | null } | null
    if (!item?.product_id) continue
    // Checked, because "received and restocked" is recorded on the return
    // whether or not the stock actually moved.
    const { error: stockError } = await admin.rpc('adjust_stock_atomic', {
      p_product_id: item.product_id,
      p_variant_id: item.variant_id ?? null,
      p_quantity_change: line.quantity,
      p_reason: 'restock',
      p_notes: `Return ${ret.rma_number}`,
    })
    if (stockError) {
      await sendSlackAlert(
        `:warning: Restock FAILED for return ${ret.rma_number} (product ${item.product_id}): ${stockError.message}`
      )
    }
  }

  const now = new Date().toISOString()
  await admin.from('returns').update({
    status: 'received', received_at: now, admin_note: input.adminNote ?? null,
  }).eq('id', ret.id)

  // Refund last, and only if an amount was set — a return can legitimately be
  // received and refunded separately (inspection first), so this is not forced.
  if (input.refundAmount && input.refundAmount > 0) {
    const result = await refundOrder(ret.order_id, {
      amount: input.refundAmount,
      // Stock is handled per line below, so refundOrder must not also restock
      // the whole order — that would double-count every returned item.
      restock: false,
      reason: `Return ${ret.rma_number}`,
    })
    if ('error' in result) return { error: result.error }
    await admin.from('returns').update({
      status: 'refunded', refunded_at: now, refund_amount: input.refundAmount,
    }).eq('id', ret.id)
  }

  await auditLog({
    actorId: actor.id, actorEmail: actor.email, action: 'return.received',
    entityType: 'return', entityId: ret.id,
    after: { refund_amount: input.refundAmount ?? 0 }, note: input.adminNote,
  })

  revalidatePath('/admin/returns')
  revalidatePath(`/admin/orders/${ret.order_id}`)
  return { ok: true as const }
}

/**
 * Counts per status for the queue's tabs.
 *
 * Separate from the list because the list is now one page of rows — counting
 * the rows on screen would show "requested 20" forever. Each of these is an
 * index-only count on idx_returns_status, not a fetch.
 */
export async function getReturnCounts(): Promise<Record<string, number>> {
  await requireAdmin()
  const admin = createAdminSupabaseClient()
  const statuses: ReturnStatus[] = ['requested', 'approved', 'received', 'refunded', 'rejected']
  const results = await Promise.all(
    statuses.map((s) =>
      admin.from('returns').select('id', { count: 'exact', head: true }).eq('status', s)
    )
  )
  return Object.fromEntries(statuses.map((s, i) => [s, results[i].count ?? 0]))
}
