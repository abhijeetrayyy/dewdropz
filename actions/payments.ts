'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import crypto from 'crypto'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase'
import { getStripe } from '@/lib/stripe'
import { getCart } from './cart'
import { createOrder, updatePaymentStatus } from './orders'
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

  await supabase.from('webhook_events').insert({
    provider: 'stripe',
    event_type: event.type,
    payload: event.data.object as unknown as Record<string, unknown>,
  })

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

  return { received: true }
}

export async function verifyRazorpayWebhook(payload: Record<string, unknown>, signature: string) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(JSON.stringify(payload))
    .digest('hex')

  if (signature !== expectedSignature) {
    return { error: 'Invalid signature' }
  }

  const supabase = createAdminSupabaseClient()
  const event = payload as { event: string; payload: { payment: { entity: Record<string, unknown> } } }

  await supabase.from('webhook_events').insert({
    provider: 'razorpay',
    event_type: event.event,
    payload: event as unknown as Record<string, unknown>,
  })

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

  return { received: true }
}
