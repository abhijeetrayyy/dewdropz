'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase'
import { cartItemSchema, updateCartItemSchema } from '@/lib/validations'
import type { CartWithItems } from '@/types/database'

async function getOrCreateCart(userId?: string | null, sessionId?: string | null) {
  const supabase = await createServerSupabaseClient()

  // Try to find existing cart
  let query = supabase
    .from('carts')
    .select('id')

  if (userId) {
    query = query.eq('user_id', userId)
  } else if (sessionId) {
    query = query.eq('session_id', sessionId)
  } else {
    return null
  }

  const { data: existing } = await query.single()

  if (existing) return existing

  // Create new cart
  const { data: newCart, error } = await supabase
    .from('carts')
    .insert({ user_id: userId, session_id: sessionId })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return newCart
}

export async function addToCart(input: {
  product_id: string
  variant_id?: string | null
  quantity?: number
  userId?: string | null
  sessionId?: string | null
}) {
  const parsed = cartItemSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const cart = await getOrCreateCart(input.userId, input.sessionId)
  if (!cart) return { error: 'Could not create cart' }

  const supabase = await createServerSupabaseClient()

  // Check if item already in cart
  const { data: existing } = await supabase
    .from('cart_items')
    .select('id, quantity')
    .eq('cart_id', cart.id)
    .eq('product_id', parsed.data.product_id)
    .eq('variant_id', parsed.data.variant_id ?? 'null')
    .single()

  if (existing) {
    const { error } = await supabase
      .from('cart_items')
      .update({ quantity: existing.quantity + parsed.data.quantity })
      .eq('id', existing.id)

    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('cart_items')
      .insert({
        cart_id: cart.id,
        product_id: parsed.data.product_id,
        variant_id: parsed.data.variant_id ?? null,
        quantity: parsed.data.quantity,
      })

    if (error) return { error: error.message }
  }

  revalidatePath('/cart')
  return { success: true }
}

export async function updateCartItemQuantity(input: { item_id: string; quantity: number }) {
  const parsed = updateCartItemSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const supabase = await createServerSupabaseClient()

  if (parsed.data.quantity === 0) {
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', parsed.data.item_id)

    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('cart_items')
      .update({ quantity: parsed.data.quantity })
      .eq('id', parsed.data.item_id)

    if (error) return { error: error.message }
  }

  revalidatePath('/cart')
  return { success: true }
}

export async function removeFromCart(itemId: string) {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('id', itemId)

  if (error) return { error: error.message }
  revalidatePath('/cart')
  return { success: true }
}

export async function getCart(userId?: string | null, sessionId?: string | null) {
  if (!userId && !sessionId) return null

  const supabase = await createServerSupabaseClient()
  let query = supabase
    .from('carts')
    .select(`
      *,
      items:cart_items(
        *,
        product:products(*),
        variant:product_variants(*)
      )
    `)

  if (userId) {
    query = query.eq('user_id', userId)
  } else {
    query = query.eq('session_id', sessionId)
  }

  const { data, error } = await query.single()

  if (error || !data) return null
  return data as unknown as CartWithItems
}

export async function clearCart(userId?: string | null, sessionId?: string | null) {
  const cart = await getOrCreateCart(userId, sessionId)
  if (!cart) return { error: 'Cart not found' }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('cart_id', cart.id)

  if (error) return { error: error.message }
  revalidatePath('/cart')
  return { success: true }
}

export async function mergeGuestCart(sessionId: string, userId: string) {
  const supabase = await createServerSupabaseClient()

  // Get guest cart
  const { data: guestCart } = await supabase
    .from('carts')
    .select('id')
    .eq('session_id', sessionId)
    .single()

  if (!guestCart) return

  // Get user cart
  const { data: userCart } = await supabase
    .from('carts')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (userCart) {
    // Move guest items to user cart
    const { data: guestItems } = await supabase
      .from('cart_items')
      .select('*')
      .eq('cart_id', guestCart.id)

    if (guestItems) {
      for (const item of guestItems) {
        const { data: existing } = await supabase
          .from('cart_items')
          .select('id, quantity')
          .eq('cart_id', userCart.id)
          .eq('product_id', item.product_id)
          .eq('variant_id', item.variant_id)
          .single()

        if (existing) {
          await supabase
            .from('cart_items')
            .update({ quantity: existing.quantity + item.quantity })
            .eq('id', existing.id)
        } else {
          await supabase
            .from('cart_items')
            .insert({
              cart_id: userCart.id,
              product_id: item.product_id,
              variant_id: item.variant_id,
              quantity: item.quantity,
            })
        }
      }
    }

    // Delete guest cart
    await supabase.from('carts').delete().eq('id', guestCart.id)
  } else {
    // Reassign guest cart to user
    await supabase
      .from('carts')
      .update({ user_id: userId, session_id: null })
      .eq('id', guestCart.id)
  }

  revalidatePath('/cart')
}

export async function getCartTotal(userId?: string | null, sessionId?: string | null) {
  const cart = await getCart(userId, sessionId)
  if (!cart?.items) return { subtotal: 0, item_count: 0 }

  const subtotal = cart.items.reduce((sum, item) => {
    const price = item.product.price + (item.variant?.price_adjustment ?? 0)
    return sum + price * item.quantity
  }, 0)

  return {
    subtotal,
    item_count: cart.items.reduce((sum, item) => sum + item.quantity, 0),
    items: cart.items,
  }
}

export async function validateCoupon(code: string, subtotal: number, userId?: string) {
  const supabase = await createServerSupabaseClient()

  const { data: coupon, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .or(`starts_at.lte.${new Date().toISOString()},starts_at.is.null`)
    .maybeSingle()

  if (error || !coupon) return { error: 'Invalid coupon code' }

  // Check expiry
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return { error: 'Coupon has expired' }
  }

  // Check min order
  if (coupon.min_order_amount && subtotal < coupon.min_order_amount) {
    return { error: `Minimum order amount is ₹${coupon.min_order_amount / 100}` }
  }

  // Check usage limit
  if (coupon.usage_limit && (coupon.usage_count ?? 0) >= coupon.usage_limit) {
    return { error: 'Coupon usage limit reached' }
  }

  // Check user limit
  if (coupon.user_limit && userId) {
    const { count } = await supabase
      .from('coupon_usages')
      .select('*', { count: 'exact', head: true })
      .eq('coupon_id', coupon.id)
      .eq('user_id', userId)

    if (count && count >= coupon.user_limit) {
      return { error: 'You have already used this coupon' }
    }
  }

  // Calculate discount
  let discount = 0
  if (coupon.type === 'percentage') {
    discount = Math.floor(subtotal * coupon.value / 100)
    if (coupon.max_discount_amount) {
      discount = Math.min(discount, coupon.max_discount_amount)
    }
  } else {
    discount = coupon.value
  }

  return { coupon, discount }
}
