'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase'
import { requireAdmin } from './auth'
import { reviewSchema, newsletterSchema } from '@/lib/validations'
import { getSession } from './auth'
import type { Review } from '@/types/database'

export async function createReview(input: {
  product_id: string
  rating: number
  title?: string
  content?: string
}) {
  const session = await getSession()
  if (!session?.user) return { error: 'Not authenticated' }

  const parsed = reviewSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const supabase = await createServerSupabaseClient()

  // Check for verified purchase
  const { data: userOrders } = await supabase
    .from('orders')
    .select('id')
    .eq('user_id', session.user.id)
    .in('status', ['delivered', 'shipped'])

  const orderIds = userOrders?.map((o) => o.id) ?? []
  let isVerifiedPurchase = false

  if (orderIds.length > 0) {
    const { data: purchase } = await supabase
      .from('order_items')
      .select('id')
      .eq('product_id', parsed.data.product_id)
      .in('order_id', orderIds)
      .limit(1)
      .maybeSingle()

    isVerifiedPurchase = !!purchase
  }

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      product_id: parsed.data.product_id,
      user_id: session.user.id,
      rating: parsed.data.rating,
      title: parsed.data.title ?? null,
      content: parsed.data.content ?? null,
      is_verified: isVerifiedPurchase,
      is_approved: false,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/products/${parsed.data.product_id}`)
  return { success: true, review: data }
}

export async function getProductReviews(productId: string, approvedOnly = true) {
  const supabase = await createServerSupabaseClient()
  let query = supabase
    .from('reviews')
    .select('*, user:profiles(full_name, avatar_url)')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })

  if (approvedOnly) query = query.eq('is_approved', true)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as (Review & { user: { full_name: string | null; avatar_url: string | null } })[]
}

export async function getProductRating(productId: string) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('reviews')
    .select('rating')
    .eq('product_id', productId)
    .eq('is_approved', true)

  if (!data?.length) return { average: 0, count: 0 }

  const total = data.reduce((sum, r) => sum + r.rating, 0)
  return {
    average: Math.round((total / data.length) * 10) / 10,
    count: data.length,
  }
}

// Newsletter
export async function subscribeToNewsletter(input: { email: string; source?: string }) {
  const parsed = newsletterSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('newsletter_subscribers')
    .insert({
      email: parsed.data.email,
      source: input.source ?? 'footer',
    })

  if (error) {
    if (error.code === '23505') return { success: true, message: 'Already subscribed' }
    return { error: error.message }
  }

  return { success: true, message: 'Welcome to the trail!' }
}

export async function confirmNewsletter(email: string) {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('newsletter_subscribers')
    .update({ is_confirmed: true, confirmed_at: new Date().toISOString() })
    .eq('email', email)

  if (error) throw new Error(error.message)
}

export async function unsubscribeFromNewsletter(email: string) {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('newsletter_subscribers')
    .delete()
    .eq('email', email)

  if (error) throw new Error(error.message)
}

export async function getAllReviews(options?: { approved?: boolean; limit?: number; offset?: number }) {
  const supabase = await createServerSupabaseClient()
  let query = supabase
    .from('reviews')
    .select('*, user:profiles(full_name, avatar_url), product:products(name, slug)')
    .order('created_at', { ascending: false })

  if (options?.approved !== undefined) query = query.eq('is_approved', options.approved)
  if (options?.limit) query = query.limit(options.limit)
  if (options?.offset) query = query.range(options.offset, options.offset + (options.limit ?? 20) - 1)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

export async function approveReview(reviewId: string) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { data: review } = await supabase.from('reviews').select('product_id').eq('id', reviewId).single()
  const { error } = await supabase.from('reviews').update({ is_approved: true }).eq('id', reviewId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/reviews')
  if (review?.product_id) revalidatePath(`/products/${review.product_id}`)
}

export async function deleteReview(reviewId: string) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', reviewId)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/reviews')
}
