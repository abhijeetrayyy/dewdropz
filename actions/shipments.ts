'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/actions/auth'
import { createAdminSupabaseClient, createServerSupabaseClient } from '@/lib/supabase'
import { enqueue } from '@/lib/jobs'

// Manual shipping.
//
// Deliberately raw: the team creates a shipment by hand, pastes the courier's
// AWB and tracking link, and moves it through its statuses. There is no provider
// adapter and no key-driven plumbing here on purpose — that gets built when a
// courier account actually exists, against its real API, rather than guessed at
// now and rewritten then.
//
// What this does earn its keep on is the part a human gets wrong: keeping the
// ORDER's status honest when an order has more than one parcel. An order is
// 'shipped' the moment the first parcel leaves, and only 'delivered' once every
// parcel has landed — worked out from the shipments themselves rather than left
// to whoever is clicking.

export type ShipmentStatus =
  | 'pending' | 'label_created' | 'picked_up' | 'in_transit'
  | 'out_for_delivery' | 'delivered' | 'failed' | 'rto' | 'cancelled'

/** Statuses that mean the parcel is with the courier or beyond. */
const DISPATCHED: ShipmentStatus[] = ['picked_up', 'in_transit', 'out_for_delivery', 'delivered']

export async function getShipmentsForOrder(orderId: string) {
  // Session-scoped on purpose: RLS (migration 031) restricts this to shipments
  // on the caller's own orders, so the same function serves the customer's
  // order page and the admin view without a separate query or a role check.
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('shipments')
    .select('*, events:shipment_events(*)')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
  return data ?? []
}

/** Admin view of a customer's parcels. getShipmentsForOrder() reads through RLS
 *  (auth.uid() must own the order), which is right for the storefront and wrong
 *  here — an admin would see an empty list on every order but their own. */
export async function getShipmentsForOrderAdmin(orderId: string) {
  await requireAdmin()
  const { data } = await createAdminSupabaseClient()
    .from('shipments')
    .select('*, events:shipment_events(*)')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
  return data ?? []
}

/**
 * What is still owed on this order, line by line.
 *
 * `shipment_items` has supported split parcels since day one but nothing ever
 * read it back, so the team had no way to know whether an order was fully
 * shipped — only whether *a* parcel existed. This is the number that answers
 * "is this order done?", and it deliberately ignores cancelled parcels: a box
 * that was cancelled never went out, so its contents are owed again.
 */
export async function getFulfillmentForOrder(orderId: string) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()

  const { data: items } = await supabase
    .from('order_items')
    .select('id, product_name, variant_name, quantity')
    .eq('order_id', orderId)

  const { data: packed } = await supabase
    .from('shipment_items')
    .select('order_item_id, quantity, shipment:shipments!inner(status, order_id)')
    .eq('shipment.order_id', orderId)
    .neq('shipment.status', 'cancelled')

  const shippedByItem = new Map<string, number>()
  for (const row of packed ?? []) {
    shippedByItem.set(row.order_item_id, (shippedByItem.get(row.order_item_id) ?? 0) + row.quantity)
  }

  // A parcel with no shipment_items rows means "the whole order" — that is the
  // documented default and the common case. Counting only itemised rows would
  // report every ordinary shipment as nothing shipped, which is exactly what it
  // did on first run: an order with a parcel already out for delivery still
  // claimed the item was owed.
  const { data: liveShipments } = await supabase
    .from('shipments')
    .select('id')
    .eq('order_id', orderId)
    .neq('status', 'cancelled')

  const itemised = (packed ?? []).length > 0
  const coversWholeOrder = !itemised && (liveShipments ?? []).length > 0

  const lines = (items ?? []).map((i) => {
    const shipped = coversWholeOrder ? i.quantity : shippedByItem.get(i.id) ?? 0
    return {
      orderItemId: i.id,
      name: i.variant_name ? `${i.product_name} — ${i.variant_name}` : i.product_name,
      ordered: i.quantity,
      shipped,
      remaining: Math.max(0, i.quantity - shipped),
    }
  })

  return {
    lines,
    itemised,
    fullyShipped: lines.every((l) => l.remaining === 0),
  }
}

export async function createShipment(input: {
  orderId: string
  courierName?: string
  awb?: string
  trackingUrl?: string
  weightGrams?: number
  shippingCost?: number
  items?: { orderItemId: string; quantity: number }[]
}) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()

  const { data: shipment, error } = await supabase
    .from('shipments')
    .insert({
      order_id: input.orderId,
      provider: 'manual',
      courier_name: input.courierName ?? null,
      awb: input.awb ?? null,
      tracking_url: input.trackingUrl ?? null,
      weight_grams: input.weightGrams ?? null,
      shipping_cost: input.shippingCost ?? null,
      status: input.awb ? 'label_created' : 'pending',
    })
    .select('id')
    .single()

  // The AWB index is UNIQUE per provider, so a pasted duplicate is caught by the
  // database rather than silently creating a second parcel with the same number.
  if (error) {
    if (error.code === '23505') return { error: 'That AWB is already on another shipment.' }
    return { error: error.message }
  }

  // Absent rows mean "the whole order", so only write them when the team has
  // actually split the parcel.
  if (input.items?.length) {
    const { error: itemsError } = await supabase.from('shipment_items').insert(
      input.items.map((i) => ({
        shipment_id: shipment.id,
        order_item_id: i.orderItemId,
        quantity: i.quantity,
      }))
    )
    if (itemsError) return { error: itemsError.message }
  }

  await syncOrderFromShipments(input.orderId)
  revalidatePath(`/admin/orders/${input.orderId}`)
  revalidatePath(`/orders/${input.orderId}`)
  return { id: shipment.id as string }
}

export async function updateShipment(
  shipmentId: string,
  input: { courierName?: string; awb?: string; trackingUrl?: string }
) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('shipments')
    .update({
      ...(input.courierName !== undefined && { courier_name: input.courierName }),
      ...(input.awb !== undefined && { awb: input.awb }),
      ...(input.trackingUrl !== undefined && { tracking_url: input.trackingUrl }),
    })
    .eq('id', shipmentId)
    .select('order_id')
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'That AWB is already on another shipment.' }
    return { error: error.message }
  }
  revalidatePath(`/admin/orders/${data.order_id}`)
  revalidatePath(`/orders/${data.order_id}`)
  return { ok: true as const }
}

/**
 * Move a parcel along, and record it.
 *
 * Every change appends a `shipment_events` row rather than only overwriting the
 * column, so the customer keeps the history — "where has it been since Tuesday?"
 * is the one question a bare status field can never answer.
 */
export async function updateShipmentStatus(
  shipmentId: string,
  status: ShipmentStatus,
  note?: { description?: string; location?: string; occurredAt?: string }
) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()

  const now = new Date().toISOString()
  const { data: shipment, error } = await supabase
    .from('shipments')
    .update({
      status,
      ...(DISPATCHED.includes(status) && { shipped_at: now }),
      ...(status === 'delivered' && { delivered_at: now }),
    })
    .eq('id', shipmentId)
    .select('order_id, shipped_at')
    .single()
  if (error) return { error: error.message }

  await supabase.from('shipment_events').insert({
    shipment_id: shipmentId,
    status,
    description: note?.description ?? null,
    location: note?.location ?? null,
    occurred_at: note?.occurredAt ?? now,
  })

  // Tell the customer their parcel is moving. sendShipmentNotificationEmail has
  // existed in lib/email.ts since shipping was built and had ZERO callers — so
  // a made-to-order garment could be printed, packed, handed to a courier and
  // delivered without the buyer ever being told it had left. Queued, not sent
  // inline: the parcel is already dispatched and an email provider having a bad
  // minute must not fail the status update that records it.
  if (DISPATCHED.includes(status)) {
    // The columns are `courier_name` and `awb`. This asked for `carrier` and
    // `tracking_number`, which do not exist on this table — PostgREST answers a
    // bad column with an error and no rows, so `full` was always null, the
    // guard below was always false, and the "your parcel is on its way" email
    // could never fire. It failed silently because the whole block is
    // best-effort by design. Verified against the live database: selecting
    // `carrier` returns 'column "carrier" does not exist'.
    const { data: full } = await supabase
      .from('shipments')
      .select('courier_name, awb, tracking_url, notified_at, order:orders(email, order_number)')
      .eq('id', shipmentId)
      .single()
    const order = full?.order as unknown as { email: string; order_number: string } | null
    // Only once per parcel: statuses can be stepped forward more than once and
    // DISPATCHED covers several of them.
    if (order?.email && full?.awb && !full.notified_at) {
      await enqueue('order.shipped', {
        email: order.email,
        orderNumber: order.order_number,
        carrier: full.courier_name ?? 'Courier',
        trackingNumber: full.awb,
        trackingUrl: full.tracking_url ?? undefined,
      })
      await supabase.from('shipments').update({ notified_at: now }).eq('id', shipmentId)
    }
  }

  await syncOrderFromShipments(shipment.order_id)
  revalidatePath(`/admin/orders/${shipment.order_id}`)
  revalidatePath(`/orders/${shipment.order_id}`)
  return { ok: true as const }
}

export async function deleteShipment(shipmentId: string) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { data } = await supabase.from('shipments').select('order_id').eq('id', shipmentId).single()
  const { error } = await supabase.from('shipments').delete().eq('id', shipmentId)
  if (error) return { error: error.message }
  if (data?.order_id) {
    await syncOrderFromShipments(data.order_id)
    revalidatePath(`/admin/orders/${data.order_id}`)
    revalidatePath(`/orders/${data.order_id}`)
  }
  return { ok: true as const }
}

/**
 * Derive the order's status from its parcels.
 *
 * This is the whole reason shipments are their own table. With one tracking
 * column on the order, a two-parcel order flips to 'delivered' the moment the
 * first box lands and the customer stops being told about the second.
 *
 * Deliberately narrow: it only ever moves an order forward into 'shipped' or
 * 'delivered'. Cancellation, refunds and stock reversal stay with
 * cancelOrderInternal — a parcel scan must never be able to cancel an order.
 */
async function syncOrderFromShipments(orderId: string) {
  const supabase = createAdminSupabaseClient()

  const { data: shipments } = await supabase
    .from('shipments')
    .select('status')
    .eq('order_id', orderId)
  if (!shipments?.length) return

  const live = shipments.filter((s) => s.status !== 'cancelled')
  if (!live.length) return

  const { data: order } = await supabase.from('orders').select('status').eq('id', orderId).single()
  // Never drag a finished or cancelled order backwards.
  if (!order || ['cancelled', 'refunded', 'delivered'].includes(order.status)) return

  const allDelivered = live.every((s) => s.status === 'delivered')
  const anyDispatched = live.some((s) => DISPATCHED.includes(s.status as ShipmentStatus))

  const next = allDelivered ? 'delivered' : anyDispatched ? 'shipped' : null
  if (!next || next === order.status) return

  const stamp = new Date().toISOString()
  await supabase
    .from('orders')
    .update({
      status: next,
      ...(next === 'shipped' && { shipped_at: stamp }),
      ...(next === 'delivered' && { delivered_at: stamp }),
    })
    .eq('id', orderId)

  // Dispatch is when the tax invoice is issued. s.31(1)(a) wants it before or at
  // the removal of the goods, and it is the only trigger that also works for
  // COD — that money arrives days later, and nothing here ever marks a COD order
  // paid, so waiting for payment would mean never invoicing half the shop.
  //
  // Also covers the order that goes straight to 'delivered' without passing
  // through 'shipped' (a single parcel marked delivered in one click), which is
  // why this is not inside the `next === 'shipped'` branch.
  //
  // Never throws and never blocks the status change: the shop has no GSTIN yet,
  // so today every one of these refuses, and a parcel must still be able to
  // leave. Repeat calls return the existing invoice rather than a second number,
  // which matters because this runs on every parcel update. Anything that slips
  // through shows up in the `uninvoiced_supplies` view.
  const { issueInvoiceForOrder } = await import('@/lib/invoicing')
  const result = await issueInvoiceForOrder(orderId, { supplyAt: stamp })
  if ('refused' in result) {
    console.warn(`[invoice] not issued for order ${orderId}: ${result.refused}`)
  }
}
