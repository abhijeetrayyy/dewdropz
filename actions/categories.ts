'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase'
import { requireAdmin } from './auth'
import type { Category, ProductCategory, CategoryWithChildren } from '@/types/database'

// -- Public reads --

export async function getCategories(options?: { parentId?: string | null; activeOnly?: boolean }) {
  const supabase = await createServerSupabaseClient()
  let query = supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (options?.parentId !== undefined) {
    query = options.parentId
      ? query.eq('parent_id', options.parentId)
      : query.is('parent_id', null)
  }
  if (options?.activeOnly !== false) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as Category[]
}

export async function getCategoryTree() {
  const categories = await getCategories({ activeOnly: false })
  return buildTree(categories)
}

function buildTree(categories: Category[]): CategoryWithChildren[] {
  const map = new Map<string, CategoryWithChildren>()
  const roots: CategoryWithChildren[] = []

  for (const cat of categories) {
    map.set(cat.id, { ...cat, children: [] })
  }
  for (const cat of categories) {
    const node = map.get(cat.id)!
    if (cat.parent_id && map.has(cat.parent_id)) {
      map.get(cat.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

export async function getCategoryBySlug(slug: string) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .single()

  return data as Category | null
}

export async function getProductCategories(productId: string) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('product_categories')
    .select('*, category:categories(*)')
    .eq('product_id', productId)

  return data as (ProductCategory & { category: Category })[]
}

// -- Admin mutations --

export async function createCategory(input: {
  parent_id?: string | null
  slug: string
  name: string
  description?: string
  image_url?: string
  is_primary_eligible?: boolean
  sort_order?: number
  is_active?: boolean
}) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()

  // Enforce max 3 levels of nesting
  if (input.parent_id) {
    let depth = 0
    let currentId = input.parent_id
    while (currentId && depth < 5) {
      const resp = await supabase
        .from('categories')
        .select('parent_id')
        .eq('id', currentId)
        .maybeSingle()

      const row = resp.data
      if (!row?.parent_id) break
      currentId = row.parent_id
      depth++
    }
    // `depth` here is the parent's own depth from the root (0 for a top-level
    // Primary category, 1 for a Category). A new child sits one level deeper, so
    // only reject when the parent is already at depth 2 (a Subcategory) — that
    // would create a 4th level. Rejecting at depth >= 1 (the old check) blocked
    // the 3rd level entirely, contradicting the "3 levels" the UI promises.
    if (depth >= 2) {
      throw new Error('Categories are limited to 3 levels (Primary > Category > Subcategory)')
    }
  }

  const { data, error } = await supabase
    .from('categories')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/admin/categories')
  return data
}

export async function updateCategory(id: string, input: Partial<{
  parent_id: string | null
  slug: string
  name: string
  description: string
  image_url: string
  is_primary_eligible: boolean
  sort_order: number
  is_active: boolean
}>) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('categories')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/admin/categories')
  return data
}

export async function deleteCategory(id: string) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  // Reassign children to grandparent before deleting
  const { data: category } = await supabase
    .from('categories')
    .select('parent_id')
    .eq('id', id)
    .single()

  if (category) {
    await supabase
      .from('categories')
      .update({ parent_id: category.parent_id })
      .eq('parent_id', id)
  }

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/categories')
}

export async function setProductCategories(productId: string, categories: { category_id: string; is_primary: boolean }[]) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()

  // Validate exactly one primary
  const primaryCount = categories.filter((c) => c.is_primary).length
  if (primaryCount !== 1) throw new Error('Exactly one primary category is required')

  // Delete existing assignments
  await supabase.from('product_categories').delete().eq('product_id', productId)

  // Insert new assignments
  const { error } = await supabase
    .from('product_categories')
    .insert(
      categories.map((c) => ({
        product_id: productId,
        category_id: c.category_id,
        is_primary: c.is_primary,
      }))
    )

  if (error) throw new Error(error.message)
  revalidatePath('/admin/products')
}

export async function reorderCategories(orderedIds: string[]) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase
      .from('categories')
      .update({ sort_order: i })
      .eq('id', orderedIds[i])
  }
  revalidatePath('/admin/categories')
}
