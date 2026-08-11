'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase'
import { requireAdmin } from './auth'
import { checkoutSchema } from '@/lib/validations'
import { getCart, validateCoupon } from './cart'
import { getStoreSettings } from './settings'
import { calculateShippingCost } from './shipping'
import { sendOrderConfirmationEmail, sendShipmentNotificationEmail, sendOrderCancellationEmail, sendRefundEmail } from '@/lib/email'
import { sendSlackAlert } from '@/lib/slack'
import { setPaymentStatusInternal, restoreOrderStock, cancelOrderInternal, issueGatewayRefund, releaseCouponUsage } from '@/lib/orders-internal'
import { notifyUser } from '@/lib/notifications'
import type { OrderWithItems, Order } from '@/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'

// Not exported — a 'use server' file exposes every exported async function as
// a client-callable RPC, and this is only ever meant to run right after
// cancelOrderInternal succeeds, never invoked directly by a client.
async function notifyCancellation(orderId: string, refundIssued: boolean) {
  const admin = createAdminSupabaseClient()
  const { data: order } = await admin.from('orders').select('email, order_number, refunded_amount').eq('id', orderId).single()
  if (!order) return
  await sendOrderCancellationEmail({
    email: order.email,
    orderNumber: order.order_number,
    refunded: refundIssued,
    refundAmount: refundIssued ? order.refunded_amount : undefined,
  }).catch(() => {})
}

// Fires the order-confirmation email once a payment actually clears. Called from
// each payment-success path (Stripe webhook, Razorpay webhook, Razorpay's client
// callback) — those three can race for the same order, so callers are responsible
// for only invoking this the first time payment_status transitions to 'paid' (see
// the `alreadyPaid` checks at each call site). Best-effort: a failed email should
// never fail the payment confirmation itself, so callers should swallow errors.
export async function sendOrderConfirmationIfFirstTime(orderId: string) {
  const admin = createAdminSupabaseClient()
  const { data: order } = await admin
    .from('orders')
    .select('*, items:order_items(*)')
    .eq('id', orderId)
    .single()
  if (!order) return

  await sendOrderConfirmationEmail({
    email: order.email,
    orderNumber: order.order_number,
    orderDate: new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
    items: (order.items as { product_name: string; quantity: number; unit_price: number }[]).map((item) => ({
      name: item.product_name,
      quantity: item.quantity,
      price: item.unit_price,
    })),
    subtotal: order.subtotal,
    shipping: order.shipping_cost,
    total: order.total_amount,
    shippingAddress: order.shipping_address as Record<string, unknown>,
  })

  await sendSlackAlert(`:moneybag: New order ${order.order_number} — ₹${(order.total_amount / 100).toLocaleString('en-IN')} (${order.email})`)
}

// Best-effort — checked right after checkout decrements stock via the DB
// trigger, since that's the one moment stock is known to have just moved.
// A failure here should never affect an order that already succeeded.
async function checkLowStockAndAlert(items: { product_id: string; variant_id: string | null }[]) {
  const admin = createAdminSupabaseClient()
  const productIds = [...new Set(items.map((i) => i.product_id))]
  const variantIds = [...new Set(items.map((i) => i.variant_id).filter((v): v is string => Boolean(v)))]

  const { data: products } = await admin
    .from('products')
    .select('name, inventory_quantity, low_stock_threshold')
    .in('id', productIds)

  const { data: variants } = variantIds.length
    ? await admin.from('product_variants').select('name, inventory_quantity, low_stock_threshold, product:products!inner(name)').in('id', variantIds)
    : { data: [] as Record<string, unknown>[] }

  const lowItems = [
    ...(products ?? [])
      .filter((p) => p.inventory_quantity != null && p.inventory_quantity <= (p.low_stock_threshold ?? 5))
      .map((p) => `${p.name} (${p.inventory_quantity} left)`),
    ...(variants ?? []).flatMap((raw) => {
      const v = raw as { name: string; inventory_quantity: number | null; low_stock_threshold: number | null; product: { name: string } | null }
      if (v.inventory_quantity == null || v.inventory_quantity > (v.low_stock_threshold ?? 5)) return []
      return [`${v.product?.name ?? 'Unknown product'} — ${v.name} (${v.inventory_quantity} left)`]
    }),
  ]

  if (lowItems.length > 0) {
    await sendSlackAlert(`:warning: Low stock after checkout: ${lowItems.join(', ')}`)
  }
}

export async function createOrder(input: {
  userId?: string | null
  sessionId?: string | null
  email: string
  phone?: string
  shipping_address_id: string
  billing_address_id?: string
  coupon_code?: string
  notes?: string
  payment_method: 'stripe' | 'razorpay' | 'cod'
  // Only set by the mobile checkout route, which has no cookie session for
  // RLS to key off (auth.uid() would be null). It passes the admin client
  // here instead — safe because the address it references was just inserted
  // by that same route for this exact token-verified user, not supplied
  // by the caller as an arbitrary id.
  client?: SupabaseClient
}) {
  const parsed = checkoutSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  // Two clients, deliberately: `supabase` stays session-scoped so the address
  // lookups below stay RLS-restricted to addresses the caller actually owns
  // (auth.uid() = user_id) — using the admin client there would let anyone pass
  // someone else's address id. `admin` is used only for the writes that place
  // the order itself (orders/order_items/coupon_usages), since those tables'
  // INSERT policies are scoped to service_role — see migration 012.
  const supabase = input.client ?? await createServerSupabaseClient()
  const admin = createAdminSupabaseClient()

  const cart = await getCart(input.userId, input.sessionId, input.client)
  if (!cart?.items?.length) return { error: 'Cart is empty' }

  const { data: shippingAddress } = await supabase
    .from('addresses').select('*').eq('id', parsed.data.shipping_address_id).single()
  if (!shippingAddress) return { error: 'Shipping address not found' }

  const subtotal = cart.items.reduce((sum, item) => {
    const price = item.product.price + (item.variant?.price_adjustment ?? 0)
    return sum + price * item.quantity
  }, 0)
  const weightGrams = cart.items.reduce((sum, item) => sum + (item.product.weight ?? 0) * item.quantity, 0)

  const settings = await getStoreSettings()
  const shipping_cost = await calculateShippingCost({
    state: shippingAddress.state,
    country: shippingAddress.country,
    subtotal,
    weightGrams,
  })
  const tax_amount = settings.enable_tax ? Math.floor(subtotal * (settings.gst_percentage / 100)) : 0
  let discount_amount = 0

  if (parsed.data.coupon_code) {
    const couponResult = await validateCoupon(parsed.data.coupon_code, subtotal, input.userId ?? undefined, input.client)
    if ('error' in couponResult) return { error: couponResult.error }
    discount_amount = couponResult.discount
  }

  const total_amount = subtotal + shipping_cost + tax_amount - discount_amount

  let billingAddress = shippingAddress
  if (parsed.data.billing_address_id) {
    const { data: ba } = await supabase.from('addresses').select('*').eq('id', parsed.data.billing_address_id).single()
    if (ba) billingAddress = ba
  }

  const { data: order, error: orderError } = await admin.from('orders').insert({
    user_id: input.userId, email: parsed.data.email, phone: parsed.data.phone,
    subtotal, shipping_cost, tax_amount, discount_amount, total_amount,
    shipping_address: shippingAddress, billing_address: billingAddress,
    notes: parsed.data.notes, payment_method: parsed.data.payment_method,
  }).select().single()

  if (orderError) return { error: orderError.message }

  const orderItems = cart.items.map((item) => ({
    order_id: order.id, product_id: item.product_id, variant_id: item.variant_id,
    custom_design_id: item.custom_design_id,
    product_name: item.product.name, variant_name: item.variant?.name ?? null,
    sku: item.variant?.sku ?? item.product.sku,
    unit_price: item.product.price + (item.variant?.price_adjustment ?? 0),
    quantity: item.quantity,
    total_price: (item.product.price + (item.variant?.price_adjustment ?? 0)) * item.quantity,
  }))

  const { error: itemsError } = await admin.from('order_items').insert(orderItems)
  if (itemsError) {
    await admin.from('orders').delete().eq('id', order.id)
    // 23514 = check_violation — the products/product_variants inventory floor
    // constraint (021_stock_integrity.sql) rejected the order_items insert
    // trigger's decrement because an item sold out between add-to-cart and
    // checkout. The raw Postgres message ("violates check constraint...") is
    // not something to show a customer; this is the real out-of-stock path.
    if (itemsError.code === '23514') {
      return { error: 'One or more items in your cart just sold out — please update your cart and try again.' }
    }
    return { error: itemsError.message }
  }

  await checkLowStockAndAlert(orderItems.map((i) => ({ product_id: i.product_id, variant_id: i.variant_id }))).catch(() => {})

  if (parsed.data.coupon_code && discount_amount > 0) {
    const { data: coupon } = await supabase.from('coupons').select('id').eq('code', parsed.data.coupon_code.toUpperCase()).single()
    if (coupon) {
      await admin.from('coupon_usages').insert({ coupon_id: coupon.id, user_id: input.userId, order_id: order.id, discount_amount })
      await admin.rpc('increment_coupon_usage', { coupon_id: coupon.id })
    }
  }

  if (input.userId) {
    await supabase.from('cart_items').delete().eq('cart_id', cart.id)
  }

  revalidatePath('/orders')
  return { success: true, orderId: order.id }
}

// userId is required here — this is the customer-facing lookup (only caller
// is the /account/orders/[id] page), and without an ownership check any
// signed-in user who knows or guesses another order's UUID could read its
// shipping address and tracking info. Admin order lookups go through
// getAllOrders/the admin client instead, which don't need this.
export async function getOrder(orderId: string, userId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*, items:order_items(*, design:custom_designs(front_preview_url, back_preview_url), product:products(images))')
    .eq('id', orderId)
    .eq('user_id', userId)
    .single()
  if (error) return null
  return data as unknown as OrderWithItems
}

export async function getOrderByNumber(orderNumber: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.from('orders').select('*, items:order_items(*)').eq('order_number', orderNumber).single()
  if (error) return null
  return data as unknown as OrderWithItems
}

export async function getUserOrders(userId: string, limit = 10, offset = 0) {
  const supabase = await createServerSupabaseClient()
  const { data, error, count } = await supabase
    .from('orders')
    .select('*, items:order_items(*)', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw new Error(error.message)
  return { orders: (data ?? []) as unknown as OrderWithItems[], total: count ?? 0 }
}

export async function updateOrderStatus(orderId: string, status: Order['status']) {
  await requireAdmin()

  // Cancelling is never a bare status flip — it has to restore stock, release
  // any coupon usage, and refund the gateway charge if one was captured, so it
  // always routes through the same shared path bulk cancel and the customer's
  // own cancelOrder() use, rather than just writing `status` here and leaving
  // all of that undone (which is what this function used to do).
  if (status === 'cancelled') {
    const result = await cancelOrderInternal(orderId, { cancelledBy: 'admin' })
    if ('error' in result) throw new Error(result.error)
    await notifyCancellation(orderId, result.refundIssued)
    revalidatePath(`/admin/orders/${orderId}`)
    revalidatePath(`/orders/${orderId}`)
    return
  }

  const supabase = createAdminSupabaseClient()
  const updates: Partial<Order> = { status }
  if (status === 'confirmed') updates.confirmed_at = new Date().toISOString()
  if (status === 'shipped') updates.shipped_at = new Date().toISOString()
  if (status === 'delivered') updates.delivered_at = new Date().toISOString()
  const { data: order, error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', orderId)
    .select('user_id, order_number')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath(`/orders/${orderId}`)
  await notifyOrderStatus(orderId, order?.user_id, order?.order_number, status)
}

const ORDER_STATUS_NOTIFICATION: Partial<Record<Order['status'], string>> = {
  confirmed: 'has been confirmed',
  processing: 'is being processed',
  shipped: 'is on its way',
  delivered: 'has been delivered',
}

// Shared by updateOrderStatus and addTrackingInfo — both can independently
// transition an order to 'shipped', so the notification copy lives in one
// place rather than being duplicated (and drifting) at each call site.
async function notifyOrderStatus(orderId: string, userId: string | null | undefined, orderNumber: string | undefined, status: Order['status']) {
  const phrase = ORDER_STATUS_NOTIFICATION[status]
  if (!userId || !orderNumber || !phrase) return
  await notifyUser({
    userId,
    type: 'order_update',
    title: `Order ${orderNumber} ${phrase}`,
    orderId,
    data: { orderNumber },
  }).catch(() => {})
}

// Dedicated admin-facing cancel action (distinct from the generic
// updateOrderStatus) so a future per-order "Cancel" button in the admin UI
// can surface the gateway-refund result directly instead of just a toast.
export async function cancelOrderAsAdmin(orderId: string, reason?: string) {
  await requireAdmin()
  const result = await cancelOrderInternal(orderId, { reason, cancelledBy: 'admin' })
  if ('error' in result) return result
  await notifyCancellation(orderId, result.refundIssued)
  revalidatePath('/admin/orders')
  revalidatePath(`/orders/${orderId}`)
  return { success: true, refundIssued: result.refundIssued }
}

// Admin-facing manual override only (e.g. a future "mark as paid" button in
// the admin order view) — requires a real admin session. Webhooks and
// customer-side payment verification use setPaymentStatusInternal directly;
// they're trusted by gateway signature verification, not a user session, so
// gating them behind requireAdmin() here made every payment confirmation
// throw and silently leave every order stuck 'pending' forever.
export async function updatePaymentStatus(orderId: string, paymentStatus: Order['payment_status'], paymentIntentId?: string) {
  await requireAdmin()
  await setPaymentStatusInternal(orderId, paymentStatus, paymentIntentId)
}

export async function getAllOrders(options?: { status?: string; needsAttention?: boolean; search?: string; limit?: number; offset?: number }) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  let query = supabase
    .from('orders')
    .select('*, items:order_items(*, design:custom_designs(front_preview_url, back_preview_url, front_print_url, back_print_url))', { count: 'exact' })
    .order('created_at', { ascending: false })
  if (options?.needsAttention) query = query.eq('refund_needs_attention', true)
  else if (options?.status) query = query.eq('status', options.status)
  if (options?.search) {
    const s = options.search.replace(/[%_]/g, '')
    query = query.or(`order_number.ilike.%${s}%,email.ilike.%${s}%`)
  }
  if (options?.limit != null && options?.offset != null) {
    query = query.range(options.offset, options.offset + options.limit - 1)
  } else if (options?.limit) {
    query = query.limit(options.limit)
  }
  const { data, error, count } = await query
  if (error) throw new Error(error.message)
  return { orders: (data ?? []) as unknown as OrderWithItems[], total: count ?? 0 }
}

// Powers the "Needs Attention" banner in /admin/orders — a lightweight count
// so the page doesn't have to load a full order page just to know whether to
// show it.
export async function getRefundAttentionCount() {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { count } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('refund_needs_attention', true)
  return count ?? 0
}

export async function bulkUpdateOrderStatus(orderIds: string[], status: Order['status']) {
  await requireAdmin()

  // Same reasoning as updateOrderStatus: a bulk "mark cancelled" used to be a
  // single raw UPDATE that never restored stock, never released coupon usage,
  // and never refunded a captured charge — for a whole batch of orders at
  // once. Each one needs its own gateway refund call, so this can't stay a
  // single bulk UPDATE; run them individually and report how many failed
  // rather than letting one bad order silently swallow the rest.
  if (status === 'cancelled') {
    const outcomes = await Promise.all(
      orderIds.map(async (id) => {
        const result = await cancelOrderInternal(id, { cancelledBy: 'admin' })
        if ('success' in result) await notifyCancellation(id, result.refundIssued)
        return result
      })
    )
    revalidatePath('/admin/orders')
    const failedCount = outcomes.filter((r) => 'error' in r).length
    if (failedCount > 0) {
      throw new Error(`${failedCount} of ${orderIds.length} order${orderIds.length === 1 ? '' : 's'} could not be cancelled`)
    }
    return
  }

  const supabase = createAdminSupabaseClient()
  const updates: Partial<Order> = { status }
  if (status === 'confirmed') updates.confirmed_at = new Date().toISOString()
  if (status === 'delivered') updates.delivered_at = new Date().toISOString()
  const { error } = await supabase.from('orders').update(updates).in('id', orderIds)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/orders')
}

export async function addTrackingInfo(orderId: string, carrier: string, trackingNumber: string, trackingUrl?: string) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { data: order, error } = await supabase
    .from('orders')
    .update({ carrier, tracking_number: trackingNumber, tracking_url: trackingUrl ?? null, status: 'shipped', shipped_at: new Date().toISOString() })
    .eq('id', orderId)
    .select('email, order_number, user_id')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/orders/${orderId}`)

  if (order) {
    await sendShipmentNotificationEmail({
      email: order.email,
      orderNumber: order.order_number,
      carrier,
      trackingNumber,
      trackingUrl,
    }).catch(() => {})
    await notifyOrderStatus(orderId, order.user_id, order.order_number, 'shipped')
  }
}

// Shared by cancelOrder and refundOrder — both need to put sold stock back. Guards
// against restoring twice (e.g. a cancelled order that later also gets refunded) by
// checking for a prior 'return' movement tied to this exact order first.
// userId here is the caller's own id — verified against the order via the
// session-scoped client (so RLS's "Users can view own orders" policy does
// the real ownership check), then the actual status-change write goes
// through the admin client, matching createOrder's dual-client pattern
// elsewhere in this file (there's no customer-scoped UPDATE policy on
// orders, by design — writes to it are meant to go through app-level
// checks like this one, not raw RLS).
export async function cancelOrder(orderId: string, userId: string, reason?: string) {
  const supabase = await createServerSupabaseClient()
  const { data: owned } = await supabase.from('orders').select('id').eq('id', orderId).eq('user_id', userId).single()
  if (!owned) return { error: 'Order not found' }

  const result = await cancelOrderInternal(orderId, { reason, cancelledBy: 'customer' })
  if ('error' in result) return result

  await notifyCancellation(orderId, result.refundIssued)
  revalidatePath(`/account/orders/${orderId}`)
  revalidatePath('/admin/orders')
  return { success: true }
}

// Issues a real refund at the payment gateway (Stripe/Razorpay — COD orders skip
// straight to bookkeeping since there's no charge to reverse), then restores stock.
// Amount defaults to the full order total; a smaller amount marks the order
// partially_refunded instead of refunded.
export async function refundOrder(orderId: string, options?: { amount?: number; restock?: boolean; reason?: string }) {
  await requireAdmin()
  const admin = createAdminSupabaseClient()

  const { data: order } = await admin.from('orders').select('*').eq('id', orderId).single()
  if (!order) return { error: 'Order not found' }
  if (order.payment_status === 'refunded') return { error: 'Order is already fully refunded' }
  if (order.payment_status !== 'paid' && order.payment_status !== 'partially_refunded') {
    return { error: 'Only paid orders can be refunded' }
  }

  // Bounded by what's actually left to refund, not the order total — a
  // second partial refund on an already-partially-refunded order used to be
  // able to refund up to the full total again since nothing tracked how much
  // had already gone out.
  const alreadyRefunded = order.refunded_amount ?? 0
  const remaining = order.total_amount - alreadyRefunded
  const refundAmount = options?.amount ?? remaining
  if (refundAmount <= 0 || refundAmount > remaining) return { error: 'Invalid refund amount' }

  const gatewayResult = await issueGatewayRefund(order, refundAmount)
  if ('error' in gatewayResult) return { error: gatewayResult.error }

  const newRefundedAmount = alreadyRefunded + refundAmount
  const isFullyRefunded = newRefundedAmount >= order.total_amount
  const noteLine = `Refund issued: ₹${(refundAmount / 100).toLocaleString('en-IN')}${options?.reason ? ` — ${options.reason}` : ''}`
  const { error } = await admin.from('orders').update({
    payment_status: isFullyRefunded ? 'refunded' : 'partially_refunded',
    refunded_amount: newRefundedAmount,
    refund_needs_attention: false,
    admin_notes: [order.admin_notes, noteLine].filter(Boolean).join('\n'),
  }).eq('id', orderId)
  if (error) return { error: error.message }

  if (options?.restock !== false) {
    await restoreOrderStock(orderId)
  }
  // A fully-refunded order is, for the customer's coupon allowance, the same
  // as one that never completed — release it so the UNIQUE(coupon_id,
  // user_id) constraint (021) doesn't permanently lock them out of a code
  // they never actually got to use. Partial refunds leave the order
  // substantially standing, so the coupon usage stays counted.
  if (isFullyRefunded) {
    await releaseCouponUsage(orderId)
  }

  await sendRefundEmail({
    email: order.email,
    orderNumber: order.order_number,
    amount: refundAmount,
    partial: !isFullyRefunded,
  }).catch(() => {})

  revalidatePath(`/admin/orders`)
  revalidatePath(`/orders/${orderId}`)
  return { success: true }
}
