'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase'
import { requireAdmin } from './auth'
import type { Tag } from '@/types/database'

export async function getTags() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return data as Tag[]
}

export async function getProductTags(productId: string) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('product_tags')
    .select('*, tag:tags(*)')
    .eq('product_id', productId)

  return data
}

export async function createTag(input: { name: string; slug: string }) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('tags')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/admin/tags')
  return data
}

export async function updateTag(id: string, input: { name?: string; slug?: string }) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('tags')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/admin/tags')
  return data
}

export async function deleteTag(id: string) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  // Cascade will handle product_tags refs
  const { error } = await supabase.from('tags').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/tags')
}

export async function setProductTags(productId: string, tagIds: string[]) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()

  await supabase.from('product_tags').delete().eq('product_id', productId)

  if (tagIds.length > 0) {
    const { error } = await supabase
      .from('product_tags')
      .insert(tagIds.map((tagId) => ({ product_id: productId, tag_id: tagId })))

    if (error) throw new Error(error.message)
  }
  revalidatePath('/admin/products')
}
