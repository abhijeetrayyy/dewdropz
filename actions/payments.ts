'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import crypto from 'crypto'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase'
import { getStripe } from '@/lib/stripe'
import { getCart } from './cart'
import { createOrder, updatePaymentStatus } from './orders'
import { requireAdmin } from './auth'
import type Stripe from 'stripe'

export async function createStripeCheckoutSession(input: {
  userId?: string | null
  sessionId?: string | null
  email: string
  phone?: string
  shipping_address_id: string
  billing_address_id?: string
  coupon_code?: string
  notes?: string
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

  await updatePaymentStatus(orderResult.orderId, 'pending', razorpayOrder.id)

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

  const { data: eventRow } = await supabase
    .from('webhook_events')
    .insert({
      provider: 'stripe',
      event_type: event.type,
      payload: event.data.object as unknown as Record<string, unknown>,
    })
    .select('id')
    .single()

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
          await updatePaymentStatus(orderId, 'paid', session.id)
          await supabase
            .from('orders')
            .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
            .eq('id', orderId)
        }
        break
      }
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const orderId = paymentIntent.metadata?.order_id
        if (orderId) {
          await updatePaymentStatus(orderId, 'failed')
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

  const event = JSON.parse(rawBody) as { event: string; payload: { payment: { entity: Record<string, unknown> } } }
  const supabase = createAdminSupabaseClient()

  const { data: eventRow } = await supabase
    .from('webhook_events')
    .insert({
      provider: 'razorpay',
      event_type: event.event,
      payload: event as unknown as Record<string, unknown>,
    })
    .select('id')
    .single()

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
            .select('id')
            .eq('payment_intent_id', razorpayOrderId)
            .single()

          if (order) {
            await updatePaymentStatus(order.id, 'paid')
            await supabase
              .from('orders')
              .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
              .eq('id', order.id)
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
            await updatePaymentStatus(order.id, 'failed')
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
    .select('id, payment_intent_id')
    .eq('id', input.orderId)
    .single()

  if (!order || order.payment_intent_id !== input.razorpayOrderId) {
    return { error: 'Order does not match this payment' }
  }

  await updatePaymentStatus(order.id, 'paid', input.razorpayPaymentId)
  await supabase
    .from('orders')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', order.id)

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

export async function getPaymentsSummary() {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { data } = await supabase.from('orders').select('payment_status, total_amount, payment_method')

  const rows = data ?? []
  const paid = rows.filter((r) => r.payment_status === 'paid')
  const refunded = rows.filter((r) => r.payment_status === 'refunded' || r.payment_status === 'partially_refunded')
  const byMethod = new Map<string, number>()
  for (const r of paid) {
    const method = r.payment_method ?? 'unknown'
    byMethod.set(method, (byMethod.get(method) ?? 0) + r.total_amount)
  }

  return {
    totalCaptured: paid.reduce((sum, r) => sum + r.total_amount, 0),
    pendingCount: rows.filter((r) => r.payment_status === 'pending').length,
    failedCount: rows.filter((r) => r.payment_status === 'failed').length,
    refundedCount: refunded.length,
    byMethod: Array.from(byMethod.entries()).map(([method, amount]) => ({ method, amount })),
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
