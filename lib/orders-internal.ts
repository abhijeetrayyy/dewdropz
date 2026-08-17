import { createAdminSupabaseClient } from '@/lib/supabase'
import { getStripe } from '@/lib/stripe'
import { sendSlackAlert } from '@/lib/slack'
import type { Order } from '@/types/database'

// System-trusted only. This file deliberately has no 'use server' directive —
// files that do get every exported async function auto-exposed as a
// client-callable server action, which would turn "set any order's payment
// status" into an unauthenticated RPC anyone could hit. Callers here must
// have already verified the request through a different mechanism (gateway
// signature verification, or a signed client-side payment confirmation), not
// a user session — never import this from a client component.
/**
 * Two identifiers, named separately, because conflating them broke refunds.
 *
 *   gatewayOrderId   the gateway's handle for the ATTEMPT — Razorpay `order_…`,
 *                    Stripe `cs_…`. Written when checkout starts.
 *   gatewayPaymentId the CAPTURED payment — Razorpay `pay_…`, Stripe `pi_…`.
 *                    Written when the money actually arrives.
 *
 * Both used to go into `payment_intent_id`, whichever wrote last. See migration
 * 043. Neither is touched unless supplied: this used to be called with two
 * arguments from the webhook paths, and `{ payment_intent_id: undefined }`
 * blanked the column on the very orders that had just been paid for.
 */
export async function setPaymentStatusInternal(
  orderId: string,
  paymentStatus: Order['payment_status'],
  ids?: { gatewayOrderId?: string; gatewayPaymentId?: string }
) {
  const supabase = createAdminSupabaseClient()
  const patch: Record<string, unknown> = { payment_status: paymentStatus }
  if (ids?.gatewayOrderId) patch.payment_intent_id = ids.gatewayOrderId
  if (ids?.gatewayPaymentId) patch.gateway_payment_id = ids.gatewayPaymentId

  const { error } = await supabase.from('orders').update(patch).eq('id', orderId)
  if (error) throw new Error(error.message)
}

// Shared by cancelOrder/refundOrder (actions/orders.ts) and
// releaseStaleOrdersForUser below — idempotency-guarded via
// inventory_movements so a duplicate call (retried webhook, cancel+refund on
// the same order) never double-restores.
export async function restoreOrderStock(orderId: string) {
  const admin = createAdminSupabaseClient()

  const { count: alreadyRestored } = await admin
    .from('inventory_movements')
    .select('*', { count: 'exact', head: true })
    .eq('reference_type', 'order')
    .eq('reference_id', orderId)
    .eq('reason', 'return')
  if (alreadyRestored && alreadyRestored > 0) return

  const { data: items } = await admin.from('order_items').select('product_id, variant_id, quantity').eq('order_id', orderId)
  const failures: string[] = []
  for (const item of items ?? []) {
    // The RPC's error was discarded. A stock restore that silently fails leaves
    // a cancelled order's units permanently unsellable, and the only symptom is
    // a number in the admin that is quietly too low forever.
    const { error } = await admin.rpc('adjust_stock_atomic', {
      p_product_id: item.product_id,
      p_variant_id: item.variant_id,
      p_quantity_change: item.quantity,
      p_reason: 'return',
      p_reference_type: 'order',
      p_reference_id: orderId,
      p_notes: 'Stock restored: order cancelled/refunded',
    })
    if (error) failures.push(`${item.product_id}${item.variant_id ? `/${item.variant_id}` : ''}: ${error.message}`)
  }
  if (failures.length) {
    await sendSlackAlert(
      `:warning: Stock restore FAILED on order ${orderId} — these units are still held: ${failures.join('; ')}`
    )
  }
}

const STALE_ORDER_TTL_MINUTES = 30

async function releaseStaleOrderBatch(query: PromiseLike<{ data: { id: string }[] | null }>) {
  const admin = createAdminSupabaseClient()
  const { data: staleOrders } = await query
  for (const order of staleOrders ?? []) {
    await restoreOrderStock(order.id)
    await releaseCouponUsage(order.id)
    await admin.from('orders').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', order.id)
  }
  return staleOrders?.length ?? 0
}

// createOrder() decrements stock at order-creation time, before payment —
// necessary since online-gateway checkout needs a real order to attach a
// payment intent to, but it means an abandoned checkout (closed tab,
// declined card, network drop) leaves that stock permanently locked with
// nothing to ever release it. This lazily releases the current user's own
// stale pending orders whenever they touch their cart again — covers the
// common case (retry checkout) instantly, with no wait for the next cron
// tick. releaseAllStaleOrders (below) is the real sweep that also catches
// guest checkouts and users who never come back.
export async function releaseStaleOrdersForUser(userId: string) {
  const admin = createAdminSupabaseClient()
  const cutoff = new Date(Date.now() - STALE_ORDER_TTL_MINUTES * 60 * 1000).toISOString()

  // COD orders are always payment_status 'pending' by design (paid on
  // delivery, not at checkout) — that's a real, confirmed order awaiting
  // fulfillment, not an abandoned one. Only stripe/razorpay orders can
  // actually be "stuck" this way, since those decrement stock before the
  // gateway ever confirms payment.
  await releaseStaleOrderBatch(
    admin
      .from('orders')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .in('payment_method', ['stripe', 'razorpay'])
      .in('payment_status', ['pending', 'failed'])
      .lt('created_at', cutoff)
  )
}

// The real sweep: every stale stripe/razorpay order, not just the current
// user's — this is what actually recovers stock from abandoned guest
// checkouts (no user_id to ever key an opportunistic release off) and from
// signed-in users who never come back to their cart. Meant to be called on a
// schedule (see app/api/cron/release-stale-orders/route.ts), not per-request.
export async function releaseAllStaleOrders() {
  const admin = createAdminSupabaseClient()
  const cutoff = new Date(Date.now() - STALE_ORDER_TTL_MINUTES * 60 * 1000).toISOString()

  return releaseStaleOrderBatch(
    admin
      .from('orders')
      .select('id')
      .eq('status', 'pending')
      .in('payment_method', ['stripe', 'razorpay'])
      .in('payment_status', ['pending', 'failed'])
      .lt('created_at', cutoff)
  )
}

// Issues a real refund at the payment gateway. Extracted so both an admin's
// manual refund and a customer's self-service cancellation of an already-paid
// order can trigger the same gateway call — cancelling an order used to only
// restore stock and never touch payment_status at all, leaving a captured
// charge with nothing anywhere flagging that it still needed refunding.
/** Razorpay's REST API, with the response actually checked.
 *  Every call here used to be `.then(r => r.json())` — a 404 or a 401 parsed
 *  happily into an object with no `items`, which then read as "no captured
 *  payment" and let the caller report success. */
async function razorpayCall(
  path: string,
  init?: { method?: string; body?: string }
): Promise<{ body: Record<string, unknown> } | { error: string }> {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) {
    return { error: 'Razorpay credentials are not configured on this deployment' }
  }
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: init?.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
    body: init?.body,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const described = (body as { error?: { description?: string } }).error?.description
    return { error: `Razorpay ${res.status}: ${described ?? res.statusText}` }
  }
  return { body: body as Record<string, unknown> }
}

/** Find the captured payment to refund against.
 *
 *  Handles all three shapes an order can be in, including the legacy rows the
 *  old code produced by overwriting `payment_intent_id` with a payment id. */
async function resolveRazorpayPaymentId(
  order: Pick<Order, 'payment_intent_id' | 'gateway_payment_id'>
): Promise<{ id: string } | { error: string }> {
  if (order.gateway_payment_id?.startsWith('pay_')) return { id: order.gateway_payment_id }
  // Written by the pre-043 code path, which clobbered the order id with it.
  if (order.payment_intent_id?.startsWith('pay_')) return { id: order.payment_intent_id }

  if (order.payment_intent_id?.startsWith('order_')) {
    const res = await razorpayCall(`/orders/${order.payment_intent_id}/payments`)
    if ('error' in res) return res
    const items = res.body.items as { id: string; status: string }[] | undefined
    const captured = items?.find((p) => p.status === 'captured')
    if (!captured) {
      return { error: 'Razorpay reports no captured payment on this order — nothing to refund' }
    }
    return { id: captured.id }
  }

  return { error: 'No Razorpay payment recorded on this order — refund it by hand in the dashboard' }
}

/**
 * Reverse a captured payment at the gateway.
 *
 * Returns the gateway's own refund id on success, so it can be written to
 * `refunds` and reconciled against a statement later. Every failure is an
 * ERROR — the previous version treated "I could not find a payment to refund"
 * as success, which is how an order came to be marked refunded, audited,
 * restocked and emailed to the customer while the money never moved.
 */
export async function issueGatewayRefund(
  order: Pick<Order, 'payment_method' | 'payment_intent_id' | 'gateway_payment_id'>,
  amount: number
): Promise<{ success: true; gatewayRefundId: string | null } | { error: string }> {
  if (amount <= 0) return { success: true, gatewayRefundId: null }

  // COD: nothing was charged through a gateway, so there is nothing to reverse.
  // The money is returned to the customer by hand, and the refunds row records
  // that this is what happened rather than implying a gateway was involved.
  if (order.payment_method === 'cod') return { success: true, gatewayRefundId: null }

  try {
    if (order.payment_method === 'stripe') {
      if (!order.payment_intent_id) {
        return { error: 'No Stripe session recorded on this order — refund it by hand in Stripe' }
      }
      const stripe = getStripe()
      const session = await stripe.checkout.sessions.retrieve(order.payment_intent_id)
      const paymentIntentId =
        typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
      if (!paymentIntentId) {
        return { error: 'That Stripe session never captured a payment — nothing to refund' }
      }
      const refund = await stripe.refunds.create({ payment_intent: paymentIntentId, amount })
      return { success: true, gatewayRefundId: refund.id }
    }

    if (order.payment_method === 'razorpay') {
      const payment = await resolveRazorpayPaymentId(order)
      if ('error' in payment) return payment

      const res = await razorpayCall(`/payments/${payment.id}/refund`, {
        method: 'POST',
        body: JSON.stringify({ amount }),
      })
      if ('error' in res) return res

      const refundId = typeof res.body.id === 'string' ? res.body.id : null
      if (!refundId) return { error: 'Razorpay accepted the refund but returned no refund id' }
      return { success: true, gatewayRefundId: refundId }
    }

    return { error: `No refund path for payment method "${order.payment_method}"` }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Refund failed at payment gateway' }
  }
}

/** Record what the gateway did — including, especially, when it refused.
 *  Never throws: a failed bookkeeping write must not undo a refund that
 *  actually went through, same rule as auditLog. */
export async function recordRefund(input: {
  orderId: string
  gateway: 'stripe' | 'razorpay' | 'cod' | 'manual'
  amount: number
  status: 'succeeded' | 'failed'
  gatewayRefundId?: string | null
  reason?: string | null
  error?: string | null
  actorEmail?: string | null
}) {
  try {
    await createAdminSupabaseClient().from('refunds').insert({
      order_id: input.orderId,
      gateway: input.gateway,
      amount: input.amount,
      status: input.status,
      gateway_refund_id: input.gatewayRefundId ?? null,
      reason: input.reason ?? null,
      error: input.error ?? null,
      actor_email: input.actorEmail ?? null,
    })
  } catch {
    // Swallowed deliberately — see above.
  }
}

// Undoes a coupon's effect on cancel/full-refund. Without this, the
// UNIQUE(coupon_id, user_id) constraint (021) permanently blocks the customer
// from ever using that code again, even though the order it was applied to
// never actually completed. Deleting the coupon_usages row makes this
// naturally idempotent — a second call for the same order finds nothing to do.
export async function releaseCouponUsage(orderId: string) {
  const admin = createAdminSupabaseClient()
  const { data: usage } = await admin
    .from('coupon_usages')
    .select('id, coupon_id')
    .eq('order_id', orderId)
    .maybeSingle()
  if (!usage) return

  await admin.from('coupon_usages').delete().eq('id', usage.id)
  await admin.rpc('decrement_coupon_usage', { coupon_id: usage.coupon_id })
}

// Shared core of "cancel this order" for both the customer self-service path
// and admin-initiated cancellation (single or bulk). Ownership/auth is the
// caller's responsibility — this trusts orderId once invoked. A failed
// gateway refund does NOT block the cancellation itself (a transient gateway
// error shouldn't trap a customer into an order they can't stop fulfilling);
// instead it's recorded via refund_needs_attention for admin follow-up.
export async function cancelOrderInternal(
  orderId: string,
  opts: { reason?: string; cancelledBy: 'customer' | 'admin' }
): Promise<{ error: string } | { success: true; refundIssued: boolean }> {
  const admin = createAdminSupabaseClient()
  const { data: order } = await admin.from('orders').select('*').eq('id', orderId).single()
  if (!order) return { error: 'Order not found' }
  if (order.status === 'cancelled') return { error: 'Order is already cancelled' }
  if (order.status === 'shipped' || order.status === 'delivered') {
    return { error: 'Cannot cancel an order that has been shipped' }
  }

  let paymentStatus = order.payment_status
  let refundedAmount = order.refunded_amount ?? 0
  let refundNeedsAttention = false
  let refundNote = ''
  const remaining = order.total_amount - refundedAmount
  const isRefundable = (order.payment_status === 'paid' || order.payment_status === 'partially_refunded') && remaining > 0

  if (isRefundable) {
    const result = await issueGatewayRefund(order, remaining)
    if ('error' in result) {
      refundNeedsAttention = true
      refundNote = `REFUND FAILED on cancellation — needs manual refund of ₹${(remaining / 100).toLocaleString('en-IN')}: ${result.error}`
      await recordRefund({
        orderId, gateway: order.payment_method ?? 'manual', amount: remaining,
        status: 'failed', reason: opts.reason ?? 'Order cancelled', error: result.error,
      })
      await sendSlackAlert(
        `:rotating_light: Refund failed on cancellation for order ${order.order_number} (₹${(remaining / 100).toLocaleString('en-IN')}). Gateway error: ${result.error}. Needs manual refund.`
      )
    } else {
      refundedAmount += remaining
      paymentStatus = 'refunded'
      refundNote = `Refund issued on cancellation: ₹${(remaining / 100).toLocaleString('en-IN')}`
      await recordRefund({
        orderId, gateway: order.payment_method ?? 'manual', amount: remaining,
        status: 'succeeded', gatewayRefundId: result.gatewayRefundId,
        reason: opts.reason ?? 'Order cancelled',
      })
    }
  }

  const label = opts.cancelledBy === 'admin' ? 'Cancelled by admin' : 'Cancelled by customer'
  const notesParts = [order.admin_notes, opts.reason ? `${label}: ${opts.reason}` : label, refundNote].filter(Boolean)

  const { error } = await admin
    .from('orders')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      payment_status: paymentStatus,
      refunded_amount: refundedAmount,
      refund_needs_attention: refundNeedsAttention,
      admin_notes: notesParts.join('\n'),
    })
    .eq('id', orderId)
  if (error) return { error: error.message }

  await restoreOrderStock(orderId)
  await releaseCouponUsage(orderId)

  return { success: true, refundIssued: isRefundable && !refundNeedsAttention }
}
