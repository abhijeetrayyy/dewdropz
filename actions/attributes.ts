'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase'
import { requireAdmin } from './auth'
import type { Attribute, AttributeValue, AttributeWithValues, ProductAttributeValue } from '@/types/database'

// -- Public reads --

export async function getAttributes(options?: { variantOnly?: boolean; filterableOnly?: boolean }) {
  const supabase = await createServerSupabaseClient()
  let query = supabase
    .from('attributes')
    .select('*, values:attribute_values(*)')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (options?.variantOnly) query = query.eq('is_variant_attribute', true)
  if (options?.filterableOnly) query = query.eq('is_filterable', true)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as unknown as AttributeWithValues[]
}

export async function getAttributeById(id: string) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('attributes')
    .select('*, values:attribute_values(*)')
    .eq('id', id)
    .order('sort_order', { ascending: true })
    .single()

  return data as unknown as AttributeWithValues | null
}

export async function getProductAttributes(productId: string) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('product_attribute_values')
    .select('*, attribute:attributes(*), value:attribute_values(*)')
    .eq('product_id', productId)

  return data as (ProductAttributeValue & { attribute: Attribute; value: AttributeValue | null })[]
}

// -- Admin mutations --

export async function createAttribute(input: {
  name: string
  slug: string
  input_type: 'text' | 'select' | 'multiselect' | 'boolean' | 'number'
  is_variant_attribute?: boolean
  is_filterable?: boolean
  sort_order?: number
  values?: { value: string; slug: string; sort_order?: number }[]
}) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()

  const { values, ...attrInput } = input

  const { data: attr, error } = await supabase
    .from('attributes')
    .insert(attrInput)
    .select()
    .single()

  if (error) throw new Error(error.message)

  if (values && values.length > 0 && ['select', 'multiselect'].includes(input.input_type)) {
    const { error: valError } = await supabase
      .from('attribute_values')
      .insert(values.map((v) => ({ attribute_id: attr.id, value: v.value, slug: v.slug, sort_order: v.sort_order ?? 0 })))

    if (valError) throw new Error(valError.message)
  }

  revalidatePath('/admin/attributes')
  return await getAttributeById(attr.id)
}

export async function updateAttribute(id: string, input: Partial<{
  name: string
  slug: string
  input_type: string
  is_variant_attribute: boolean
  is_filterable: boolean
  sort_order: number
}>) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase
    .from('attributes')
    .update(input)
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/attributes')
}

export async function deleteAttribute(id: string) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('attributes').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/attributes')
}

export async function createAttributeValue(input: {
  attribute_id: string
  value: string
  slug: string
  sort_order?: number
}) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('attribute_values')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/admin/attributes')
  return data
}

export async function updateAttributeValue(id: string, input: Partial<{
  value: string
  slug: string
  sort_order: number
}>) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase
    .from('attribute_values')
    .update(input)
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/attributes')
}

export async function deleteAttributeValue(id: string) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('attribute_values').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/attributes')
}

export async function reorderAttributeValues(orderedIds: string[]) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase
      .from('attribute_values')
      .update({ sort_order: i })
      .eq('id', orderedIds[i])
  }
}

export async function setProductAttributes(productId: string, attributes: {
  attribute_id: string
  attribute_value_id?: string | null
  text_value?: string | null
}[]) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()

  await supabase.from('product_attribute_values').delete().eq('product_id', productId)

  if (attributes.length > 0) {
    const { error } = await supabase
      .from('product_attribute_values')
      .insert(attributes.map((a) => ({
        product_id: productId,
        attribute_id: a.attribute_id,
        attribute_value_id: a.attribute_value_id ?? null,
        text_value: a.text_value ?? null,
      })))

    if (error) throw new Error(error.message)
  }
  revalidatePath('/admin/products')
}
