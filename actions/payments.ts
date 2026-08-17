'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import crypto from 'crypto'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase'
import { getStripe } from '@/lib/stripe'
import { getCart } from './cart'
import { createOrder } from './orders'
import { setPaymentStatusInternal } from '@/lib/orders-internal'
import { enqueue } from '@/lib/jobs'
import { requireAdmin } from './auth'
import type Stripe from 'stripe'

// Not exported (see the same note on notifyCancellation in actions/orders.ts)
// — payment_intent.payment_failed and Razorpay's payment.failed both need
// the same "tell the customer, ping ops" follow-up.
async function notifyPaymentFailed(orderId: string) {
  const supabase = createAdminSupabaseClient()
  const { data: order } = await supabase.from('orders').select('email, order_number').eq('id', orderId).single()
  if (!order) return
  // Queued rather than sent here: this runs inside a webhook, and an email
  // provider having a bad minute must not decide whether the webhook succeeds.
  await enqueue('payment.failed', { email: order.email, orderNumber: order.order_number })
  await enqueue('slack.alert', { text: `:x: Payment failed for order ${order.order_number} (${order.email}).` })
}

export async function createStripeCheckoutSession(input: {
  userId?: string | null
  sessionId?: string | null
  email: string
  phone?: string
  shipping_address_id: string
  billing_address_id?: string
  coupon_code?: string
  notes?: string
  /** One per checkout attempt. Without it a retried "pay" creates a second
   *  order AND a second gateway intent — the customer can be charged twice. */
  idempotencyKey?: string
}) {
  const orderResult = await createOrder({
    ...input,
    payment_method: 'stripe',
  })

  if ('error' in orderResult) return { error: orderResult.error }

  const cart = await getCart(input.userId, input.sessionId)
  if (!cart?.items?.length) return { error: 'Cart is empty' }

  const headersList = await headers()
  const origin = headersList.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL!

  const lineItems = cart.items.map((item) => ({
    price_data: {
      currency: 'inr',
      product_data: {
        name: item.product.name,
        description: item.variant?.name ?? undefined,
        images: item.product.images?.length ? [item.product.images[0]] : undefined,
      },
      unit_amount: item.product.price + (item.variant?.price_adjustment ?? 0),
    },
    quantity: item.quantity,
  }))

  const session = await getStripe().checkout.sessions.create({
    customer_email: input.email,
    mode: 'payment',
    line_items: lineItems,
    metadata: {
      order_id: orderResult.orderId,
    },
    success_url: `${origin}/orders/${orderResult.orderId}?success=true`,
    cancel_url: `${origin}/checkout?cancelled=true`,
    shipping_address_collection: {
      allowed_countries: ['IN'],
    },
  })

  redirect(session.url!)
}

export async function createRazorpayOrder(input: {
  userId?: string | null
  sessionId?: string | null
  email: string
  phone?: string
  shipping_address_id: string
  billing_address_id?: string
  coupon_code?: string
  notes?: string
  /** See the Stripe entry point above — same reasoning. */
  idempotencyKey?: string
}) {
  const orderResult = await createOrder({
    ...input,
    payment_method: 'razorpay',
  })

  if ('error' in orderResult) return { error: orderResult.error }

  const supabase = await createServerSupabaseClient()
  const { data: order } = await supabase
    .from('orders')
    .select('total_amount, order_number')
    .eq('id', orderResult.orderId)
    .single()

  if (!order) return { error: 'Order not found' }

  const razorpayAuth = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  ).toString('base64')

  const razorpayOrder = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${razorpayAuth}`,
    },
    body: JSON.stringify({
      amount: order.total_amount,
      currency: 'INR',
      receipt: order.order_number,
      notes: {
        order_id: orderResult.orderId,
      },
    }),
  }).then((r) => r.json())

  if (razorpayOrder.error) return { error: razorpayOrder.error.description }

  await setPaymentStatusInternal(orderResult.orderId, 'pending', { gatewayOrderId: razorpayOrder.id })

  return {
    success: true,
    orderId: orderResult.orderId,
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
  }
}

export async function verifyStripeWebhook(payload: string, signature: string) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!
  const event = getStripe().webhooks.constructEvent(payload, signature, webhookSecret)

  const supabase = createAdminSupabaseClient()

  // Stripe retries webhook delivery on anything short of a prompt 200, so the same
  // event.id can arrive more than once. The unique index on (provider, event_type,
  // event_id) makes this insert fail with 23505 on a redelivery — that failure IS
  // the dedup check, not an error to surface; caught below, we just no-op and ack.
  const { data: eventRow, error: insertError } = await supabase
    .from('webhook_events')
    .insert({
      provider: 'stripe',
      event_type: event.type,
      event_id: event.id,
      payload: event.data.object as unknown as Record<string, unknown>,
    })
    .select('id')
    .single()

  if (insertError) {
    if (insertError.code === '23505') return { received: true }
    throw new Error(insertError.message)
  }

  async function markProcessed(error?: string) {
    if (!eventRow) return
    await supabase.from('webhook_events').update({
      processed: !error,
      error: error ?? null,
      processed_at: new Date().toISOString(),
    }).eq('id', eventRow.id)
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const orderId = session.metadata?.order_id
        if (orderId) {
          const { data: existing } = await supabase.from('orders').select('payment_status').eq('id', orderId).single()
          const alreadyPaid = existing?.payment_status === 'paid'
          await setPaymentStatusInternal(orderId, 'paid', { gatewayOrderId: session.id })
          await supabase
            .from('orders')
            .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
            .eq('id', orderId)
          if (!alreadyPaid) await enqueue('order.confirmation', { orderId })
        }
        break
      }
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const orderId = paymentIntent.metadata?.order_id
        if (orderId) {
          await setPaymentStatusInternal(orderId, 'failed')
          await notifyPaymentFailed(orderId)
        }
        break
      }
    }
    await markProcessed()
  } catch (e) {
    await markProcessed(e instanceof Error ? e.message : 'Unknown error handling webhook')
    throw e
  }

  return { received: true }
}

// Takes the *raw* request body text, not a parsed object — Razorpay signs the exact
// bytes it sent, and re-serializing a parsed object via JSON.stringify is not
// guaranteed to reproduce that byte sequence (key order, spacing, unicode escaping
// can all differ). Verifying against anything other than the raw body is a
// signature check that can pass or fail unpredictably rather than a real one.
export async function verifyRazorpayWebhook(rawBody: string, signature: string) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex')

  const signatureValid =
    signature.length === expectedSignature.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))

  if (!signatureValid) {
    return { error: 'Invalid signature' }
  }

  const event = JSON.parse(rawBody) as {
    event: string
    payload: {
      payment?: { entity: { id?: string; order_id?: string } }
      order?: { entity: { id?: string } }
      refund?: { entity: { id?: string } }
    }
  }
  const supabase = createAdminSupabaseClient()

  // Unlike Stripe, a Razorpay webhook body has no single top-level event id — the
  // identity that actually needs deduplicating is "this event type happened to this
  // payment/order/refund again", so the entity's own id stands in for it.
  const razorpayEventId =
    event.payload?.payment?.entity?.id ?? event.payload?.order?.entity?.id ?? event.payload?.refund?.entity?.id ?? null

  const { data: eventRow, error: insertError } = await supabase
    .from('webhook_events')
    .insert({
      provider: 'razorpay',
      event_type: event.event,
      event_id: razorpayEventId,
      payload: event as unknown as Record<string, unknown>,
    })
    .select('id')
    .single()

  if (insertError) {
    if (insertError.code === '23505') return { received: true }
    throw new Error(insertError.message)
  }

  async function markProcessed(error?: string) {
    if (!eventRow) return
    await supabase.from('webhook_events').update({
      processed: !error,
      error: error ?? null,
      processed_at: new Date().toISOString(),
    }).eq('id', eventRow.id)
  }

  try {
    switch (event.event) {
      case 'payment.captured': {
        const razorpayOrderId = event.payload?.payment?.entity?.order_id as string
        if (razorpayOrderId) {
          const { data: order } = await supabase
            .from('orders')
            .select('id, payment_status')
            .eq('payment_intent_id', razorpayOrderId)
            .single()

          if (order) {
            const alreadyPaid = order.payment_status === 'paid'
            await setPaymentStatusInternal(order.id, 'paid')
            await supabase
              .from('orders')
              .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
              .eq('id', order.id)
            if (!alreadyPaid) await enqueue('order.confirmation', { orderId: order.id })
          }
        }
        break
      }
      case 'payment.failed': {
        const failedOrderId = event.payload?.payment?.entity?.order_id as string
        if (failedOrderId) {
          const { data: order } = await supabase
            .from('orders')
            .select('id')
            .eq('payment_intent_id', failedOrderId)
            .single()

          if (order) {
            await setPaymentStatusInternal(order.id, 'failed')
            await notifyPaymentFailed(order.id)
          }
        }
        break
      }
    }
    await markProcessed()
  } catch (e) {
    await markProcessed(e instanceof Error ? e.message : 'Unknown error handling webhook')
    throw e
  }

  return { received: true }
}

// The webhook above is the durable source of truth (Razorpay retries it until
// acknowledged), but it can arrive seconds after the customer's browser gets a
// success callback from Checkout. This verifies that callback immediately so the
// order confirmation page doesn't sit on "pending" waiting for the webhook —
// using Razorpay's documented payment-success scheme, which is a *different*
// HMAC than the webhook's: hmac(order_id + "|" + payment_id, key_secret).
export async function verifyRazorpayPayment(input: {
  orderId: string
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
}) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET!

  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`)
    .digest('hex')

  const valid =
    input.razorpaySignature.length === expectedSignature.length &&
    crypto.timingSafeEqual(Buffer.from(input.razorpaySignature), Buffer.from(expectedSignature))

  if (!valid) return { error: 'Payment verification failed' }

  const supabase = createAdminSupabaseClient()
  const { data: order } = await supabase
    .from('orders')
    .select('id, payment_intent_id, payment_status')
    .eq('id', input.orderId)
    .single()

  if (!order || order.payment_intent_id !== input.razorpayOrderId) {
    return { error: 'Order does not match this payment' }
  }

  const alreadyPaid = order.payment_status === 'paid'
  await setPaymentStatusInternal(order.id, 'paid', { gatewayPaymentId: input.razorpayPaymentId })
  await supabase
    .from('orders')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', order.id)
  if (!alreadyPaid) await enqueue('order.confirmation', { orderId: order.id })

  return { success: true }
}

// Admin: a transaction ledger over orders — payment status has lived buried inside
// the Orders page with no dedicated reconciliation view, even though every field
// needed for one (method, gateway id, amount, refund notes) already exists on `orders`.
export async function getPaymentsLedger(options?: {
  paymentStatus?: string
  paymentMethod?: string
  search?: string
  limit?: number
  offset?: number
}) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()

  let query = supabase
    .from('orders')
    .select('id, order_number, email, payment_method, payment_status, payment_intent_id, total_amount, admin_notes, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (options?.paymentStatus) query = query.eq('payment_status', options.paymentStatus)
  if (options?.paymentMethod) query = query.eq('payment_method', options.paymentMethod)
  if (options?.search) {
    const s = options.search.replace(/[%_]/g, '')
    query = query.or(`order_number.ilike.%${s}%,email.ilike.%${s}%,payment_intent_id.ilike.%${s}%`)
  }
  if (options?.limit != null && options?.offset != null) {
    query = query.range(options.offset, options.offset + options.limit - 1)
  }

  const { data, error, count } = await query
  if (error) throw new Error(error.message)
  return { payments: data ?? [], total: count ?? 0 }
}

// The three reads the payments page opens with, started together.
//
// They were three separate server actions fired from a useEffect. They look
// concurrent — three `.then()` calls, no awaits between them — but Next runs a
// client's server actions one at a time, so in practice they queued into three
// sequential round-trips before anything appeared.
export async function getPaymentsOverview(
  ledger?: Parameters<typeof getPaymentsLedger>[0],
  range?: PaymentsRange
) {
  await requireAdmin()
  const [summary, events, page] = await Promise.all([
    getPaymentsSummary(range),
    getWebhookEvents({ limit: 30 }),
    getPaymentsLedger(ledger),
  ])
  return { summary, events: events.events, ledger: page }
}

// Summed in Postgres. This used to select every order ever placed — no filter,
// no limit — and reduce it in Node to produce four numbers and a short
// breakdown, so the cost grew with the orders table rather than with anything
// on screen. Same shape of fix as `promotion_spend()` in migration 037.
//
// The SQL is a literal translation of the arithmetic it replaces, checked
// against it on synthetic rows covering paid sums across several methods, a
// null payment_method reported as 'unknown', and both refund statuses — the
// cases the live table does not currently contain. See migration 041.
/** An IST calendar window, half-open: [from, to). `null` means "all time". */
export type PaymentsRange = { from: string | null; to: string | null }

export async function getPaymentsSummary(range?: PaymentsRange) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase.rpc('payments_summary', {
    p_from: range?.from ?? null,
    p_to: range?.to ?? null,
  })
  if (error) throw new Error(error.message)

  // Postgres BIGINT arrives as a string once it is JSON, so every figure is
  // coerced rather than trusted to already be a number — `"0" + 1` is `"01"`,
  // and that would surface as a wrong total rather than an error.
  const r = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined
  const n = (k: string) => Number(r?.[k] ?? 0)

  type MethodRow = { method: string; gross: number | string; net: number | string; refunded: number | string; orders: number | string }
  type GatewayRow = { gateway: string; succeeded: number | string; failed: number | string; failedCount: number | string }

  return {
    // The window that actually produced these numbers, echoed back from the
    // database. If the UI asks for the wrong month, that shows up as a wrong
    // label rather than as numbers nobody can place.
    rangeFrom: (r?.range_from_ist as string | null) ?? null,
    rangeTo: (r?.range_to_ist as string | null) ?? null,

    // Band A — gateway money, each side counted on its own date.
    grossCaptured: n('gross_captured'),
    refundsSucceeded: n('refunds_succeeded'),
    netCaptured: n('net_captured'),
    capturedOrderCount: n('captured_order_count'),
    refundedOrderCount: n('refunded_order_count'),
    refundsPriorPeriod: n('refunds_prior_period_amount'),

    // Band B — cash on delivery. Flow is ranged; the balances are as-of-now.
    codCollected: n('cod_collected'),
    codCollectedCount: n('cod_collected_count'),
    codOutstanding: n('cod_outstanding'),
    codOutstandingCount: n('cod_outstanding_count'),
    codRtoAmount: n('cod_rto_amount'),
    codRtoCount: n('cod_rto_count'),
    codReturnedUncredited: n('cod_returned_uncredited_amount'),
    codReturnedUncreditedCount: n('cod_returned_uncredited_count'),

    netInflow: n('net_inflow'),

    // Band C — counts.
    pendingPrepaidCount: n('pending_prepaid_count'),
    abandonedCount: n('abandoned_count'),
    failedPaymentCount: n('failed_payment_count'),
    refundAttemptsFailedCount: n('refund_attempts_failed_count'),

    // Band D — exceptions. Anything here means a figure above is incomplete.
    refundsUnresolvedAmount: n('refunds_unresolved_amount'),
    refundsUnresolvedCount: n('refunds_unresolved_count'),
    refundLedgerVariance: n('refund_ledger_variance'),
    refundLedgerVarianceInRange: n('refund_ledger_variance_in_range'),
    overRefundedCount: n('over_refunded_count'),
    capturedWithoutPaidAtCount: n('captured_without_paid_at_count'),
    nonInrOrderCount: n('non_inr_order_count'),
    uncreditedRefundCount: n('uncredited_refund_count'),
    unhandledRefundEvents: n('unhandled_refund_events'),
    disputeEventsSeen: n('dispute_events_seen'),

    // Both carry more than one figure per row — a method's gross and its net
    // differ by whatever was refunded against it, and that difference is the
    // interesting part. Mapped explicitly rather than through a shared helper,
    // because the two shapes are genuinely different and a generic mapper
    // silently produced NaN for every badge until a screenshot caught it.
    byMethod: ((r?.by_method ?? []) as MethodRow[]).map((m) => ({
      method: m.method,
      gross: Number(m.gross),
      net: Number(m.net),
      refunded: Number(m.refunded),
      orders: Number(m.orders),
    })),
    refundsByGateway: ((r?.refunds_by_gateway ?? []) as GatewayRow[]).map((g) => ({
      gateway: g.gateway,
      succeeded: Number(g.succeeded),
      failed: Number(g.failed),
      failedCount: Number(g.failedCount),
    })),
  }
}

export async function getWebhookEvents(options?: { provider?: string; limit?: number; offset?: number }) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()

  let query = supabase
    .from('webhook_events')
    .select('id, provider, event_type, processed, error, created_at, processed_at', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (options?.provider) query = query.eq('provider', options.provider)
  if (options?.limit != null && options?.offset != null) {
    query = query.range(options.offset, options.offset + options.limit - 1)
  } else if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error, count } = await query
  if (error) throw new Error(error.message)
  return { events: data ?? [], total: count ?? 0 }
}

// Split from getWebhookEvents() since the raw payload is a heavy JSONB blob that
// the list view has no use for — only fetched when an admin opens one event.
export async function getWebhookEventPayload(id: string) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase.from('webhook_events').select('payload').eq('id', id).single()
  if (error) throw new Error(error.message)
  return data.payload
}
