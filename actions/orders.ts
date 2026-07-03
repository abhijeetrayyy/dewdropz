'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase'
import { checkoutSchema } from '@/lib/validations'
import { getCart, validateCoupon } from './cart'
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

  // Get cart
  const cart = await getCart(input.userId, input.sessionId)
  if (!cart?.items?.length) return { error: 'Cart is empty' }

  // Get shipping address
  const { data: shippingAddress } = await supabase
    .from('addresses')
    .select('*')
    .eq('id', parsed.data.shipping_address_id)
    .single()

  if (!shippingAddress) return { error: 'Shipping address not found' }

  // Calculate totals
  const subtotal = cart.items.reduce((sum, item) => {
    const price = item.product.price + (item.variant?.price_adjustment ?? 0)
    return sum + price * item.quantity
  }, 0)

  const shipping_cost = subtotal >= 200000 ? 0 : 10000 // Free shipping above ₹2000
  const tax_amount = Math.floor(subtotal * 0.05) // 5% GST
  let discount_amount = 0

  // Apply coupon
  if (parsed.data.coupon_code) {
    const couponResult = await validateCoupon(
      parsed.data.coupon_code,
      subtotal,
      input.userId ?? undefined
    )
    if ('error' in couponResult) return { error: couponResult.error }
    discount_amount = couponResult.discount
  }

  const total_amount = subtotal + shipping_cost + tax_amount - discount_amount

  // Get billing address
  let billingAddress = shippingAddress
  if (parsed.data.billing_address_id) {
    const { data: ba } = await supabase
      .from('addresses')
      .select('*')
      .eq('id', parsed.data.billing_address_id)
      .single()
    if (ba) billingAddress = ba
  }

  // Create order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: input.userId,
      email: parsed.data.email,
      phone: parsed.data.phone,
      subtotal,
      shipping_cost,
      tax_amount,
      discount_amount,
      total_amount,
      shipping_address: shippingAddress,
      billing_address: billingAddress,
      notes: parsed.data.notes,
      payment_method: parsed.data.payment_method,
    })
    .select()
    .single()

  if (orderError) return { error: orderError.message }

  // Create order items
  const orderItems = cart.items.map((item) => ({
    order_id: order.id,
    product_id: item.product_id,
    variant_id: item.variant_id,
    product_name: item.product.name,
    variant_name: item.variant?.name ?? null,
    sku: item.variant?.sku ?? item.product.sku,
    unit_price: item.product.price + (item.variant?.price_adjustment ?? 0),
    quantity: item.quantity,
    total_price: (item.product.price + (item.variant?.price_adjustment ?? 0)) * item.quantity,
  }))

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems)

  if (itemsError) {
    // Rollback order
    await supabase.from('orders').delete().eq('id', order.id)
    return { error: itemsError.message }
  }

  // Record coupon usage
  if (parsed.data.coupon_code && discount_amount > 0) {
    const { data: coupon } = await supabase
      .from('coupons')
      .select('id')
      .eq('code', parsed.data.coupon_code.toUpperCase())
      .single()

    if (coupon) {
      await supabase.from('coupon_usages').insert({
        coupon_id: coupon.id,
        user_id: input.userId,
        order_id: order.id,
        discount_amount,
      })

      await supabase.rpc('increment_coupon_usage', { coupon_id: coupon.id })
    }
  }

  // Clear cart
  if (input.userId) {
    await supabase.from('cart_items').delete().eq('cart_id', cart.id)
  }

  revalidatePath('/orders')
  return { success: true, orderId: order.id }
}

export async function getOrder(orderId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*, items:order_items(*)')
    .eq('id', orderId)
    .single()

  if (error) return null
  return data as unknown as OrderWithItems
}

export async function getOrderByNumber(orderNumber: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*, items:order_items(*)')
    .eq('order_number', orderNumber)
    .single()

  if (error) return null
  return data as unknown as OrderWithItems
}

export async function getUserOrders(userId: string, limit = 10) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*, items:order_items(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return data as unknown as OrderWithItems[]
}

export async function updateOrderStatus(orderId: string, status: Order['status']) {
  const supabase = await createAdminSupabaseClient()
  const updates: Partial<Order> = { status }

  // Set timestamp based on status
  if (status === 'confirmed') updates.confirmed_at = new Date().toISOString()
  if (status === 'shipped') updates.shipped_at = new Date().toISOString()
  if (status === 'delivered') updates.delivered_at = new Date().toISOString()
  if (status === 'cancelled') updates.cancelled_at = new Date().toISOString()

  const { error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', orderId)

  if (error) throw new Error(error.message)
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath(`/orders/${orderId}`)
}

export async function updatePaymentStatus(orderId: string, paymentStatus: Order['payment_status'], paymentIntentId?: string) {
  const supabase = await createAdminSupabaseClient()
  const { error } = await supabase
    .from('orders')
    .update({
      payment_status: paymentStatus,
      payment_intent_id: paymentIntentId,
    })
    .eq('id', orderId)

  if (error) throw new Error(error.message)
}

export async function getAllOrders(options?: {
  status?: string
  limit?: number
  offset?: number
}) {
  const supabase = await createAdminSupabaseClient()
  let query = supabase
    .from('orders')
    .select('*, items:order_items(*)')
    .order('created_at', { ascending: false })

  if (options?.status) {
    query = query.eq('status', options.status)
  }
  if (options?.limit) {
    query = query.limit(options.limit)
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit ?? 20) - 1)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as unknown as OrderWithItems[]
}

export async function addTrackingInfo(orderId: string, carrier: string, trackingNumber: string, trackingUrl?: string) {
  const supabase = await createAdminSupabaseClient()
  const { error } = await supabase
    .from('orders')
    .update({
      carrier,
      tracking_number: trackingNumber,
      tracking_url: trackingUrl ?? null,
      status: 'shipped',
      shipped_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  if (error) throw new Error(error.message)
  revalidatePath(`/admin/orders/${orderId}`)
}

export async function cancelOrder(orderId: string, reason?: string) {
  const supabase = await createServerSupabaseClient()
  const { data: order } = await supabase
    .from('orders')
    .select('status, payment_status')
    .eq('id', orderId)
    .single()

  if (!order) return { error: 'Order not found' }
  if (order.status === 'shipped' || order.status === 'delivered') {
    return { error: 'Cannot cancel an order that has been shipped' }
  }

  const { error } = await supabase
    .from('orders')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      admin_notes: reason ? `Cancellation: ${reason}` : 'Cancelled by user',
    })
    .eq('id', orderId)

  if (error) return { error: error.message }
  revalidatePath(`/orders/${orderId}`)
  return { success: true }
}
