'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase'
import { requireAdmin } from './auth'
import { checkoutSchema } from '@/lib/validations'
import { getCart, validateCoupon } from './cart'
import { getStoreSettings } from './settings'
import { calculateShippingCost } from './shipping'
import { getStripe } from '@/lib/stripe'
import type { OrderWithItems, Order } from '@/types/database'

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
}) {
  const parsed = checkoutSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const supabase = await createServerSupabaseClient()

  const cart = await getCart(input.userId, input.sessionId)
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
    const couponResult = await validateCoupon(parsed.data.coupon_code, subtotal, input.userId ?? undefined)
    if ('error' in couponResult) return { error: couponResult.error }
    discount_amount = couponResult.discount
  }

  const total_amount = subtotal + shipping_cost + tax_amount - discount_amount

  let billingAddress = shippingAddress
  if (parsed.data.billing_address_id) {
    const { data: ba } = await supabase.from('addresses').select('*').eq('id', parsed.data.billing_address_id).single()
    if (ba) billingAddress = ba
  }

  const { data: order, error: orderError } = await supabase.from('orders').insert({
    user_id: input.userId, email: parsed.data.email, phone: parsed.data.phone,
    subtotal, shipping_cost, tax_amount, discount_amount, total_amount,
    shipping_address: shippingAddress, billing_address: billingAddress,
    notes: parsed.data.notes, payment_method: parsed.data.payment_method,
  }).select().single()

  if (orderError) return { error: orderError.message }

  const orderItems = cart.items.map((item) => ({
    order_id: order.id, product_id: item.product_id, variant_id: item.variant_id,
    product_name: item.product.name, variant_name: item.variant?.name ?? null,
    sku: item.variant?.sku ?? item.product.sku,
    unit_price: item.product.price + (item.variant?.price_adjustment ?? 0),
    quantity: item.quantity,
    total_price: (item.product.price + (item.variant?.price_adjustment ?? 0)) * item.quantity,
  }))

  const { error: itemsError } = await supabase.from('order_items').insert(orderItems)
  if (itemsError) {
    await supabase.from('orders').delete().eq('id', order.id)
    return { error: itemsError.message }
  }

  if (parsed.data.coupon_code && discount_amount > 0) {
    const { data: coupon } = await supabase.from('coupons').select('id').eq('code', parsed.data.coupon_code.toUpperCase()).single()
    if (coupon) {
      await supabase.from('coupon_usages').insert({ coupon_id: coupon.id, user_id: input.userId, order_id: order.id, discount_amount })
      await supabase.rpc('increment_coupon_usage', { coupon_id: coupon.id })
    }
  }

  if (input.userId) {
    await supabase.from('cart_items').delete().eq('cart_id', cart.id)
  }

  revalidatePath('/orders')
  return { success: true, orderId: order.id }
}

export async function getOrder(orderId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.from('orders').select('*, items:order_items(*)').eq('id', orderId).single()
  if (error) return null
  return data as unknown as OrderWithItems
}

export async function getOrderByNumber(orderNumber: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.from('orders').select('*, items:order_items(*)').eq('order_number', orderNumber).single()
  if (error) return null
  return data as unknown as OrderWithItems
}

export async function getUserOrders(userId: string, limit = 10) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.from('orders').select('*, items:order_items(*)').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit)
  if (error) throw new Error(error.message)
  return data as unknown as OrderWithItems[]
}

export async function updateOrderStatus(orderId: string, status: Order['status']) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const updates: Partial<Order> = { status }
  if (status === 'confirmed') updates.confirmed_at = new Date().toISOString()
  if (status === 'shipped') updates.shipped_at = new Date().toISOString()
  if (status === 'delivered') updates.delivered_at = new Date().toISOString()
  if (status === 'cancelled') updates.cancelled_at = new Date().toISOString()
  const { error } = await supabase.from('orders').update(updates).eq('id', orderId)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath(`/orders/${orderId}`)
}

export async function updatePaymentStatus(orderId: string, paymentStatus: Order['payment_status'], paymentIntentId?: string) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('orders').update({ payment_status: paymentStatus, payment_intent_id: paymentIntentId }).eq('id', orderId)
  if (error) throw new Error(error.message)
}

export async function getAllOrders(options?: { status?: string; search?: string; limit?: number; offset?: number }) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  let query = supabase.from('orders').select('*, items:order_items(*)', { count: 'exact' }).order('created_at', { ascending: false })
  if (options?.status) query = query.eq('status', options.status)
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

export async function bulkUpdateOrderStatus(orderIds: string[], status: Order['status']) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const updates: Partial<Order> = { status }
  if (status === 'confirmed') updates.confirmed_at = new Date().toISOString()
  if (status === 'delivered') updates.delivered_at = new Date().toISOString()
  if (status === 'cancelled') updates.cancelled_at = new Date().toISOString()
  const { error } = await supabase.from('orders').update(updates).in('id', orderIds)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/orders')
}

export async function addTrackingInfo(orderId: string, carrier: string, trackingNumber: string, trackingUrl?: string) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('orders').update({ carrier, tracking_number: trackingNumber, tracking_url: trackingUrl ?? null, status: 'shipped', shipped_at: new Date().toISOString() }).eq('id', orderId)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/orders/${orderId}`)
}

// Shared by cancelOrder and refundOrder — both need to put sold stock back. Guards
// against restoring twice (e.g. a cancelled order that later also gets refunded) by
// checking for a prior 'return' movement tied to this exact order first.
async function restoreOrderStock(orderId: string) {
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

export async function cancelOrder(orderId: string, reason?: string) {
  const supabase = await createServerSupabaseClient()
  const { data: order } = await supabase.from('orders').select('status, payment_status').eq('id', orderId).single()
  if (!order) return { error: 'Order not found' }
  if (order.status === 'cancelled') return { error: 'Order is already cancelled' }
  if (order.status === 'shipped' || order.status === 'delivered') {
    return { error: 'Cannot cancel an order that has been shipped' }
  }
  const { error } = await supabase.from('orders').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), admin_notes: reason ? `Cancellation: ${reason}` : 'Cancelled by user' }).eq('id', orderId)
  if (error) return { error: error.message }
  await restoreOrderStock(orderId)
  revalidatePath(`/orders/${orderId}`)
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

  const refundAmount = options?.amount ?? order.total_amount
  if (refundAmount <= 0 || refundAmount > order.total_amount) return { error: 'Invalid refund amount' }

  try {
    if (order.payment_method === 'stripe' && order.payment_intent_id) {
      const stripe = getStripe()
      const session = await stripe.checkout.sessions.retrieve(order.payment_intent_id)
      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
      if (paymentIntentId) {
        await stripe.refunds.create({ payment_intent: paymentIntentId, amount: refundAmount })
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
          body: JSON.stringify({ amount: refundAmount }),
        })
      }
    }
    // COD: nothing was charged through a gateway, so there's nothing to reverse there.
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Refund failed at payment gateway' }
  }

  const isPartial = refundAmount < order.total_amount
  const noteLine = `Refund issued: ₹${(refundAmount / 100).toLocaleString('en-IN')}${options?.reason ? ` — ${options.reason}` : ''}`
  const { error } = await admin.from('orders').update({
    payment_status: isPartial ? 'partially_refunded' : 'refunded',
    admin_notes: [order.admin_notes, noteLine].filter(Boolean).join('\n'),
  }).eq('id', orderId)
  if (error) return { error: error.message }

  if (options?.restock !== false) {
    await restoreOrderStock(orderId)
  }

  revalidatePath(`/admin/orders`)
  revalidatePath(`/orders/${orderId}`)
  return { success: true }
}
