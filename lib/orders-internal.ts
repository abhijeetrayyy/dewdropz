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
export async function setPaymentStatusInternal(
  orderId: string,
  paymentStatus: Order['payment_status'],
  paymentIntentId?: string
) {
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase
    .from('orders')
    .update({ payment_status: paymentStatus, payment_intent_id: paymentIntentId })
    .eq('id', orderId)
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
  for (const item of items ?? []) {
    await admin.rpc('adjust_stock_atomic', {
      p_product_id: item.product_id,
      p_variant_id: item.variant_id,
      p_quantity_change: item.quantity,
      p_reason: 'return',
      p_reference_type: 'order',
      p_reference_id: orderId,
      p_notes: 'Stock restored: order cancelled/refunded',
    })
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
export async function issueGatewayRefund(
  order: Pick<Order, 'payment_method' | 'payment_intent_id'>,
  amount: number
): Promise<{ success: true } | { error: string }> {
  if (amount <= 0) return { success: true }
  try {
    if (order.payment_method === 'stripe' && order.payment_intent_id) {
      const stripe = getStripe()
      const session = await stripe.checkout.sessions.retrieve(order.payment_intent_id)
      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
      if (paymentIntentId) {
        await stripe.refunds.create({ payment_intent: paymentIntentId, amount })
      }
    } else if (order.payment_method === 'razorpay' && order.payment_intent_id) {
      const razorpayAuth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')
      const paymentsRes = await fetch(`https://api.razorpay.com/v1/orders/${order.payment_intent_id}/payments`, {
        headers: { Authorization: `Basic ${razorpayAuth}` },
      }).then((r) => r.json())
      const capturedPayment = (paymentsRes.items as { id: string; status: string }[] | undefined)?.find((p) => p.status === 'captured')
      if (capturedPayment) {
        await fetch(`https://api.razorpay.com/v1/payments/${capturedPayment.id}/refund`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Basic ${razorpayAuth}` },
          body: JSON.stringify({ amount }),
        })
      }
    }
    // COD: nothing was charged through a gateway, so there's nothing to reverse there.
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Refund failed at payment gateway' }
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
      await sendSlackAlert(
        `:rotating_light: Refund failed on cancellation for order ${order.order_number} (₹${(remaining / 100).toLocaleString('en-IN')}). Gateway error: ${result.error}. Needs manual refund.`
      )
    } else {
      refundedAmount += remaining
      paymentStatus = 'refunded'
      refundNote = `Refund issued on cancellation: ₹${(remaining / 100).toLocaleString('en-IN')}`
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
