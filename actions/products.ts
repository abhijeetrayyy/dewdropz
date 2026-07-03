'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase'
import type { Product, ProductVariant, Collection, ProductWithCollection } from '@/types/database'

export async function getProducts(options?: {
  collection?: string
  featured?: boolean
  limit?: number
  offset?: number
}) {
  const supabase = await createServerSupabaseClient()
  let query = supabase
    .from('products')
    .select(`
      *,
      collection:collections(*),
      variants:product_variants(*)
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (options?.collection) {
    query = query.eq('collection_id', options.collection)
  }
  if (options?.featured) {
    query = query.eq('is_featured', true)
  }
  if (options?.limit) {
    query = query.limit(options.limit)
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit ?? 12) - 1)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)
  return data as unknown as ProductWithCollection[]
}

export async function getProductBySlug(slug: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      collection:collections(*),
      variants:product_variants(*)
    `)
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (error) return null
  return data as unknown as ProductWithCollection
}

export async function getProductById(id: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      collection:collections(*),
      variants:product_variants(*)
    `)
    .eq('id', id)
    .single()

  if (error) return null
  return data as unknown as ProductWithCollection
}

export async function getCollections() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('collections')
    .select(`
      *,
      products:products(*)
    `)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) throw new Error(error.message)
  return data as unknown as (Collection & { products: Product[] })[]
}

export async function getCollectionBySlug(slug: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('collections')
    .select(`
      *,
      products:products(*)
    `)
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (error) return null
  return data as unknown as Collection & { products: Product[] }
}

// Admin actions
export async function createProduct(input: {
  collection_id?: string | null
  slug: string
  name: string
  description?: string
  short_description?: string
  price: number
  compare_at_price?: number
  sku?: string
  inventory_quantity?: number
  images?: string[]
  is_featured?: boolean
  is_active?: boolean
}) {
  const supabase = await createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('products')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/admin/products')
  return data
}

export async function updateProduct(id: string, input: Partial<{
  collection_id: string | null
  slug: string
  name: string
  description: string
  short_description: string
  price: number
  compare_at_price: number
  sku: string
  inventory_quantity: number
  weight: number
  dimensions: object
  images: string[]
  is_featured: boolean
  is_active: boolean
  meta_title: string
  meta_description: string
}>) {
  const supabase = await createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('products')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/admin/products')
  revalidatePath(`/products/${data.slug}`)
  return data
}

export async function deleteProduct(id: string) {
  const supabase = await createAdminSupabaseClient()
  const { error } = await supabase
    .from('products')
    .update({ is_active: false })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/products')
}

export async function getProductVariants(productId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })

  if (error) throw new Error(error.message)
  return data as ProductVariant[]
}

export async function createProductVariant(input: {
  product_id: string
  name: string
  sku?: string
  price_adjustment?: number
  inventory_quantity?: number
  sort_order?: number
}) {
  const supabase = await createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('product_variants')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath(`/admin/products/${input.product_id}`)
  return data
}

export async function updateProductVariant(id: string, input: Partial<{
  name: string
  sku: string
  price_adjustment: number
  inventory_quantity: number
  sort_order: number
}>) {
  const supabase = await createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('product_variants')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/admin/products/*')
  return data
}

export async function getFeaturedProducts() {
  return getProducts({ featured: true, limit: 8 })
}
