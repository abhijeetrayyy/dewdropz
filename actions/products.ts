'use server'

import { revalidatePath } from 'next/cache'
import { auditLog } from '@/lib/audit'
import { createAdminSupabaseClient, createPublicSupabaseClient } from '@/lib/supabase'
import { requireAdmin } from './auth'
import type { Product, ProductVariant, Collection, ProductWithCollection } from '@/types/database'
import { ensureAdmin } from '@/lib/adminAuth'
import { getCategoryTree, getProductCategories } from './categories'
import { getTags, getProductTags } from './tags'
import { getAttributes, getProductAttributes } from './attributes'
import { getProductVariantsAdmin, getInventoryMovements } from './variants'

// -- Public reads --

// No `attributes` embed here, unlike getProductBySlug.
//
// Resolving it is a three-level join per product — product_attribute_values,
// then attributes and attribute_values — and nothing that calls this reads it.
// The only place attributes are rendered is the specifications panel on the
// product page, which loads its own product through getProductBySlug and keeps
// the embed. Every other caller (the homepage, shop, cart, wishlist, customize,
// collection pages, related products) was paying that join to throw the result
// away.
const PRODUCT_LIST_EMBEDS =
  '*, collection:collections(*), variants:product_variants(*), categories:product_categories(*)'

export async function getProducts(options?: {
  collection?: string; featured?: boolean; limit?: number; offset?: number
}) {
  const supabase = createPublicSupabaseClient()
  let query = supabase.from('products')
    .select(PRODUCT_LIST_EMBEDS)
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

// Just the two fields a sitemap entry has. It used to call getProducts(), which
// meant loading every product with its collection, variants and categories — a
// few kilobytes per product — to read a slug and a timestamp.
export async function getProductsForSitemap() {
  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase
    .from('products')
    .select('slug, updated_at')
    .eq('is_active', true)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
  return (data ?? []) as { slug: string; updated_at: string }[]
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
// Cards, so no attributes embed — same reasoning as getProducts.
export async function getProductsBySlugs(slugs: string[]) {
  if (slugs.length === 0) return []
  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase.from('products')
    .select(PRODUCT_LIST_EMBEDS)
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
  await ensureAdmin()
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase.from('products')
    .select('*, collection:collections(*), variants:product_variants(*), categories:product_categories(*), attributes:product_attribute_values(*, attribute:attributes(*), value:attribute_values(*))')
    .eq('id', id).maybeSingle()
  if (error) return null
  return data as unknown as ProductWithCollection
}

// Everything the product editor opens with, in one call.
//
// The editor used to `await` nine separate actions one after another. Each is a
// POST from the browser, and Next runs server actions from a client one at a
// time, so they could not even overlap: measured against the real database that
// was 2,348ms of query time to do 706ms of work, before counting nine
// round-trips and nine auth checks.
//
// Note what this does NOT do: reimplement any of those queries. Calling a
// server action from server code is an ordinary function call, so these are the
// same functions the rest of the admin uses, just started together instead of
// in single file. There is one definition of each query, and it stays that way.
// `ensureAdmin` is request-memoised, so the nine inner guards cost one check.
export type ProductEditorData = Awaited<ReturnType<typeof getProductEditorData>>

export async function getProductEditorData(productId: string) {
  await ensureAdmin()

  const [
    product, categories, productCategories, tags, productTags,
    attributes, productAttributes, variants, movements,
  ] = await Promise.all([
    getProductByIdAdmin(productId),
    getCategoryTree(),
    getProductCategories(productId),
    getTags(),
    getProductTags(productId),
    getAttributes(),
    getProductAttributes(productId),
    getProductVariantsAdmin(productId),
    getInventoryMovements(productId),
  ])

  return {
    product, categories, productCategories, tags, productTags,
    attributes, productAttributes, variants, movements,
  }
}

export async function getCollections() {
  const supabase = createPublicSupabaseClient()
  // `products:products(id)`, not `(*)`. The embedded array has exactly one
  // consumer — the collections index, which renders `products?.length` as a
  // count — so every other column on every product in every collection was
  // being fetched to be counted and discarded. Ids keep `.length` identical,
  // including the fact that it counts inactive products too.
  const { data, error } = await supabase.from('collections')
    .select('*, products:products(id)').eq('is_active', true).order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return data as unknown as (Collection & { products: Product[] })[]
}

/**
 * Just enough of each collection for the header menu.
 *
 * Four columns rather than `*` with an embedded product array: this is fetched
 * from the navigation, which sits on every page, so it has no business pulling
 * a row's worth of copy and a list of product ids to render a name and a
 * thumbnail. Called lazily — nothing runs until somebody actually opens the
 * menu — so the cost is paid by the people who want it.
 */
export async function getNavCollections() {
  const supabase = createPublicSupabaseClient()
  const { data } = await supabase
    .from('collections')
    .select('slug, name, tagline, image_url')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(6)
  return (data ?? []) as { slug: string; name: string; tagline: string | null; image_url: string | null }[]
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

/** A soft archive, despite being labelled Delete. The row and every variant,
 *  order line and design attached to it survive — which is right, since an
 *  order must keep pointing at what was bought. See restoreProduct. */
export async function archiveProduct(id: string) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('products')
    .update({ is_active: false, deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/products')
}

/** Bring an archived product back.
 *
 *  Archiving was reachable and reversal was not: the list filters
 *  `deleted_at IS NULL`, so an archived product vanished from the only screen
 *  that could act on it, and getting it back meant a SQL client. It comes back
 *  as a DRAFT rather than live — restoring something into the storefront
 *  unannounced is not a decision this button should make for you. */
export async function restoreProduct(id: string) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('products')
    .update({ deleted_at: null, is_active: false }).eq('id', id)
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

// The columns the list actually renders. `select('*')` was pulling description,
// story_blocks, meta fields and the whole customization_config JSONB to draw a
// name, a price and a thumbnail — 4.4KB per 20 rows against 0.9KB for this.
const PRODUCT_LIST_COLUMNS =
  'id, name, slug, sku, price, compare_at_price, inventory_quantity, low_stock_threshold, status, is_active, is_featured, images, created_at'

/** Exactly what PRODUCT_LIST_COLUMNS returns — so the table cannot quietly
 *  start reading a field the query no longer fetches. */
export type ProductListRow = Pick<
  Product,
  | 'id' | 'name' | 'slug' | 'sku' | 'price' | 'compare_at_price'
  | 'inventory_quantity' | 'low_stock_threshold' | 'status'
  | 'is_active' | 'is_featured' | 'images' | 'created_at'
>

export type ProductListSort = 'name' | 'price' | 'stock' | 'created'

// Sorting belongs in the database. It used to happen in the browser over the
// twenty rows already on screen, so "sort by price" reordered a page rather
// than the catalogue — the answer looked right and was wrong as soon as there
// was a second page.
const SORT_COLUMNS: Record<ProductListSort, string> = {
  name: 'name',
  price: 'price',
  stock: 'inventory_quantity',
  created: 'created_at',
}

export async function getAllProducts(opts?: {
  search?: string; limit?: number; offset?: number
  sort?: ProductListSort; dir?: 'asc' | 'desc'
  /** 'live' hides archived products (the default, and what the team wants 99%
   *  of the time); 'archived' is what makes restore reachable at all. */
  view?: 'live' | 'archived'
}) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  // archiveProduct() sets deleted_at as a distinct concept from deleteProduct()'s
  // is_active toggle — without this filter, archived products still show in the list.
  const sortColumn = SORT_COLUMNS[opts?.sort ?? 'created']
  let query = supabase
    .from('products')
    .select(PRODUCT_LIST_COLUMNS, { count: 'exact' })
    .order(sortColumn, { ascending: (opts?.dir ?? 'desc') === 'asc' })
  query = opts?.view === 'archived'
    ? query.not('deleted_at', 'is', null)
    : query.is('deleted_at', null)
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
  return { products: (data ?? []) as unknown as ProductListRow[], total: count ?? 0 }
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
