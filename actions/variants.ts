'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase'
import { requireAdmin } from './auth'
import type { VariantWithOptions, InventoryMovement, InventoryMovementWithDetails } from '@/types/database'

// -- Public reads --

export async function getProductVariantsAdmin(productId: string) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('product_variants')
    .select('*, options:variant_option_values(*, attribute:attributes(*), value:attribute_values(*))')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })

  return data as unknown as VariantWithOptions[]
}

// -- Admin: variant management --

export async function generateVariants(
  productId: string,
  variantAttributeIds: string[]
) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()

  // Collect existing variant IDs (don't delete yet — create first, then delete old)
  const { data: existingVariants } = await supabase
    .from('product_variants')
    .select('id')
    .eq('product_id', productId)
  const existingIds = existingVariants?.map((v) => v.id) ?? []

  // Fetch attribute values
  const valuesPerAttribute: { attribute_id: string; values: { id: string; value: string; slug: string }[] }[] = []

  for (const attrId of variantAttributeIds) {
    const { data: values } = await supabase
      .from('attribute_values')
      .select('id, value, slug')
      .eq('attribute_id', attrId)
      .order('sort_order', { ascending: true })

    if (!values || values.length === 0) throw new Error(`No values found for attribute ${attrId}`)
    valuesPerAttribute.push({ attribute_id: attrId, values })
  }

  // Generate combinations and insert new variants first
  const combinations = cartesianProduct(valuesPerAttribute.map((a) => a.values))
  const newVariantIds: string[] = []

  for (const combo of combinations) {
    const name = combo.map((v: { value: string }) => v.value).join(' / ')

    const { data: variant } = await supabase
      .from('product_variants')
      .insert({ product_id: productId, name, price_adjustment: 0, inventory_quantity: 0 })
      .select()
      .single()

    if (!variant) continue
    newVariantIds.push(variant.id)

    const optionValues = valuesPerAttribute.map((attr, idx) => ({
      variant_id: variant.id,
      attribute_id: attr.attribute_id,
      attribute_value_id: combo[idx].id,
    }))
    await supabase.from('variant_option_values').insert(optionValues)
  }

  // Now delete old variants (only if new ones were created successfully)
  if (existingIds.length > 0) {
    await supabase.from('product_variants').delete().in('id', existingIds)
  }

  revalidatePath('/admin/products', 'layout')
}

function cartesianProduct<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>(
    (acc, curr) => acc.flatMap((a) => curr.map((c) => [...a, c])),
    [[]]
  )
}

export async function updateVariant(id: string, input: Partial<{
  name: string
  sku: string
  price_adjustment: number
  inventory_quantity: number
  low_stock_threshold: number
  sort_order: number
}>) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase
    .from('product_variants')
    .update(input)
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/products')
}

export async function deleteVariant(id: string) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('product_variants').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/products')
}

export async function deleteAllVariantsForProduct(productId: string) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('product_variants').delete().eq('product_id', productId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/products')
}

// -- Inventory --

export async function getInventoryMovements(productId: string, variantId?: string | null) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  let query = supabase
    .from('inventory_movements')
    .select('*, product:products(name, sku), variant:product_variants(name, sku), admin:profiles(full_name)')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })

  if (variantId) {
    query = query.eq('variant_id', variantId)
  } else if (variantId === null) {
    query = query.is('variant_id', null)
  }

  const { data } = await query
  return data as unknown as InventoryMovementWithDetails[]
}

export async function adjustStock(input: {
  product_id: string
  variant_id?: string | null
  quantity_change: number
  reason: 'restock' | 'adjustment' | 'damaged'
  notes?: string
}) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()

  await supabase.rpc('adjust_stock_atomic', {
    p_product_id: input.product_id,
    p_variant_id: input.variant_id ?? null,
    p_quantity_change: input.quantity_change,
    p_reason: input.reason,
    p_notes: input.notes ?? null,
  })

  revalidatePath('/admin/products')
}

export async function getLowStockReport() {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()

  const { data: prodData } = await supabase
    .from('products')
    .select('id, name, sku, inventory_quantity, low_stock_threshold, status')
    .neq('status', 'archived')
    .order('inventory_quantity', { ascending: true })

  const { data: varData } = await supabase
    .from('product_variants')
    .select('id, name, sku, inventory_quantity, low_stock_threshold, product:products!inner(name, status)')
    .order('inventory_quantity', { ascending: true })

  const filteredProducts = (prodData ?? []).filter(
    (p) => p.inventory_quantity != null && p.inventory_quantity <= (p.low_stock_threshold ?? 5)
  )
  const filteredVariants = (varData ?? []).filter((v: Record<string, unknown>) => {
    const qty = v.inventory_quantity as number
    const threshold = (v.low_stock_threshold as number) ?? 5
    const product = v.product as { name: string; status: string } | null
    return qty != null && qty <= threshold && product?.status !== 'archived'
  })

  return { products: filteredProducts, variants: filteredVariants as Record<string, unknown>[] }
}
