'use server'

import { revalidatePath } from 'next/cache'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { requireAdmin } from './auth'
import type { Collection } from '@/types/database'

// Admin-facing reads/writes for the `collections` table. Distinct from the public
// getCollections()/getCollectionBySlug() in actions/products.ts, which only ever see
// active collections — admins need to see and manage inactive/draft ones too. Note:
// the live storefront currently reads collection data from lib/constants.ts, not this
// table, so changes here are backend groundwork rather than an immediate storefront change.
export async function getAllCollectionsAdmin(opts?: { search?: string; limit?: number; offset?: number }) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  let query = supabase.from('collections').select('*, products:products(count)', { count: 'exact' }).order('sort_order', { ascending: true })
  if (opts?.search) {
    const s = opts.search.replace(/[%_]/g, '')
    query = query.or(`name.ilike.%${s}%,slug.ilike.%${s}%`)
  }
  if (opts?.limit != null && opts?.offset != null) {
    query = query.range(opts.offset, opts.offset + opts.limit - 1)
  } else if (opts?.limit) {
    query = query.limit(opts.limit)
  }
  const { data, error, count } = await query
  if (error) throw new Error(error.message)
  return {
    collections: (data ?? []) as unknown as (Collection & { products: { count: number }[] })[],
    total: count ?? 0,
  }
}

export async function createCollection(input: {
  slug: string; name: string; tagline?: string; description?: string
  gradient?: string; image_url?: string; sort_order?: number; is_active?: boolean
}) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase.from('collections').insert(input).select().single()
  if (error) throw new Error(error.message)
  revalidatePath('/admin/collections')
  return data
}

export async function updateCollection(id: string, input: Partial<{
  slug: string; name: string; tagline: string; description: string
  gradient: string; image_url: string; sort_order: number; is_active: boolean
}>) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase.from('collections').update(input).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  revalidatePath('/admin/collections')
  return data
}

export async function deleteCollection(id: string) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  // products.collection_id is ON DELETE SET NULL, so this is safe — affected
  // products just become uncategorized rather than failing or cascading.
  const { error } = await supabase.from('collections').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/collections')
}
