'use server'

import { revalidatePath } from 'next/cache'
import { auditLog } from '@/lib/audit'
import { createAdminSupabaseClient, createPublicSupabaseClient } from '@/lib/supabase'
import { requireAdmin } from './auth'
import type { Product, ProductVariant, Collection, ProductWithCollection } from '@/types/database'

// -- Public reads --

export async function getProducts(options?: {
  collection?: string; featured?: boolean; limit?: number; offset?: number
}) {
  const supabase = createPublicSupabaseClient()
  let query = supabase.from('products')
    .select('*, collection:collections(*), variants:product_variants(*), categories:product_categories(*), attributes:product_attribute_values(*, attribute:attributes(*), value:attribute_values(*))')
    .eq('is_active', true).order('created_at', { ascending: false })
    // Without this, embedded variants come back in arbitrary order and size
    // pickers render as e.g. "L XL M S". `sort_order` exists for exactly this.
    .order('sort_order', { referencedTable: 'product_variants', ascending: true })
  if (options?.collection) query = query.eq('collection_id', options.collection)
  if (options?.featured) query = query.eq('is_featured', true)
  if (options?.limit) query = query.limit(options.limit)
  if (options?.offset) query = query.range(options.offset, options.offset + (options.limit ?? 12) - 1)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as unknown as ProductWithCollection[]
}

export async function getProductBySlug(slug: string) {
  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase.from('products')
    .select('*, collection:collections(*), variants:product_variants(*), categories:product_categories(*), attributes:product_attribute_values(*, attribute:attributes(*), value:attribute_values(*))')
    .eq('slug', slug).eq('is_active', true)
    .order('sort_order', { referencedTable: 'product_variants', ascending: true })
    .single()
  if (error) return null
  return data as unknown as ProductWithCollection
}

// Batch-hydrates a list of product slugs into real product records — used by
// RecentlyViewed and the wishlist, both of which only ever persist slugs.
export async function getProductsBySlugs(slugs: string[]) {
  if (slugs.length === 0) return []
  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase.from('products')
    .select('*, collection:collections(*), variants:product_variants(*), categories:product_categories(*), attributes:product_attribute_values(*, attribute:attributes(*), value:attribute_values(*))')
    .in('slug', slugs).eq('is_active', true)
  if (error) throw new Error(error.message)
  return data as unknown as ProductWithCollection[]
}

export async function getProductById(id: string) {
  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase.from('products')
    .select('*, collection:collections(*), variants:product_variants(*), categories:product_categories(*), attributes:product_attribute_values(*, attribute:attributes(*), value:attribute_values(*))')
    .eq('id', id).eq('is_active', true).maybeSingle()
  if (error) return null
  return data as unknown as ProductWithCollection
}

// Admin: get any product by ID (bypasses active-only RLS)
export async function getProductByIdAdmin(id: string) {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase.from('products')
    .select('*, collection:collections(*), variants:product_variants(*), categories:product_categories(*), attributes:product_attribute_values(*, attribute:attributes(*), value:attribute_values(*))')
    .eq('id', id).maybeSingle()
  if (error) return null
  return data as unknown as ProductWithCollection
}

export async function getCollections() {
  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase.from('collections')
    .select('*, products:products(*)').eq('is_active', true).order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return data as unknown as (Collection & { products: Product[] })[]
}

export async function getCollectionBySlug(slug: string) {
  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase.from('collections')
    .select('*, products:products(*)').eq('slug', slug).eq('is_active', true).single()
  if (error) return null
  return data as unknown as Collection & { products: Product[] }
}

export async function getFeaturedProducts() {
  return getProducts({ featured: true, limit: 8 })
}

// -- Admin mutations --

export async function createProduct(input: {
  collection_id?: string | null; slug: string; name: string; description?: string
  short_description?: string; price: number; compare_at_price?: number; sku?: string
  inventory_quantity?: number; weight?: number; images?: string[]
  highlights?: string[]; care_instructions?: string | null
  story_blocks?: { images: string[]; heading: string; body: string }[]
  is_featured?: boolean; is_active?: boolean
}) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase.from('products').insert(input).select().single()
  if (error) throw new Error(error.message)
  revalidatePath('/admin/products')
  return data
}

// Fields where "who changed this, and from what" is a question someone will
// actually ask. Logging the whole row on every edit would bury those in noise.
const AUDITED_PRODUCT_FIELDS = ['price', 'compare_at_price', 'inventory_quantity', 'is_active', 'status', 'sku'] as const

export async function updateProduct(id: string, input: Record<string, unknown>) {
  const actor = await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { data: prior } = await supabase
    .from('products')
    .select(AUDITED_PRODUCT_FIELDS.join(','))
    .eq('id', id)
    .single<Record<string, unknown>>()
  const payload: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) payload[k] = v
    else payload[k] = null // Explicit null for cleared fields
  }
  const { data, error } = await supabase.from('products').update(payload).eq('id', id).select().single()
  if (error) throw new Error(error.message)

  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}
  for (const f of AUDITED_PRODUCT_FIELDS) {
    if (f in payload && prior?.[f] !== data[f]) {
      before[f] = prior?.[f]
      after[f] = data[f]
    }
  }
  if (Object.keys(after).length) {
    await auditLog({
      actorId: actor.id, actorEmail: actor.email, action: 'product.updated',
      entityType: 'product', entityId: id, before, after,
    })
  }

  revalidatePath('/admin/products')
  revalidatePath(`/products/${data.slug}`)
  return data
}

export async function deleteProduct(id: string) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/products')
}

export async function archiveProduct(id: string) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('products')
    .update({ is_active: false, deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/products')
}

export async function getProductVariants(productId: string) {
  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase.from('product_variants').select('*')
    .eq('product_id', productId).order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return data as ProductVariant[]
}

export async function createProductVariant(input: {
  product_id: string; name: string; sku?: string
  price_adjustment?: number; inventory_quantity?: number; sort_order?: number
}) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase.from('product_variants').insert(input).select().single()
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/products/${input.product_id}`)
  return data
}

export async function updateProductVariant(id: string, input: Partial<{
  name: string; sku: string; price_adjustment: number; inventory_quantity: number; sort_order: number
}>) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  // A variant price/stock edit changes what a customer can actually buy, but
  // this only ever revalidated the admin list — the public PDP kept serving
  // whatever it had cached until something else happened to touch it.
  const { data, error } = await supabase
    .from('product_variants')
    .update(input)
    .eq('id', id)
    .select('product:products(slug)')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/admin/products', 'layout')
  const slug = (data?.product as { slug?: string } | null)?.slug
  if (slug) revalidatePath(`/products/${slug}`)
}

export async function getAllProducts(opts?: { search?: string; limit?: number; offset?: number }) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  // archiveProduct() sets deleted_at as a distinct concept from deleteProduct()'s
  // is_active toggle — without this filter, archived products still show in the list.
  let query = supabase.from('products').select('*', { count: 'exact' }).is('deleted_at', null).order('created_at', { ascending: false })
  if (opts?.search) {
    const s = opts.search.replace(/[%_]/g, '')
    query = query.or(`name.ilike.%${s}%,slug.ilike.%${s}%,sku.ilike.%${s}%`)
  }
  if (opts?.limit != null && opts?.offset != null) {
    query = query.range(opts.offset, opts.offset + opts.limit - 1)
  } else if (opts?.limit) {
    query = query.limit(opts.limit)
  }
  const { data, error, count } = await query
  if (error) throw new Error(error.message)
  return { products: (data ?? []) as Product[], total: count ?? 0 }
}

export async function toggleProductActive(id: string, active: boolean) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  await supabase.from('products').update({ is_active: active }).eq('id', id)
  revalidatePath('/admin/products')
}

export async function bulkSetProductsActive(ids: string[], active: boolean) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('products').update({ is_active: active }).in('id', ids)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/products')
}

export async function bulkArchiveProducts(ids: string[]) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('products')
    .update({ is_active: false, deleted_at: new Date().toISOString() }).in('id', ids)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/products')
}
