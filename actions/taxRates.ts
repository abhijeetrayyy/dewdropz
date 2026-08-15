'use server'

import { revalidatePath } from 'next/cache'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { requireAdmin } from './auth'
import { auditLog } from '@/lib/audit'

export type TaxRateRow = {
  id: string
  name: string
  hsn_code: string
  min_price: number
  max_price: number | null
  rate: number
  is_active: boolean
  /** How many active products carry this HSN — the answer to "is this row doing anything". */
  productCount: number
}

export async function getTaxRates(): Promise<TaxRateRow[]> {
  await requireAdmin()
  const admin = createAdminSupabaseClient()
  const [{ data: rates }, { data: products }] = await Promise.all([
    admin.from('tax_rates').select('*').order('hsn_code').order('min_price'),
    admin.from('products').select('hsn_code').eq('is_active', true).not('hsn_code', 'is', null),
  ])

  const counts = new Map<string, number>()
  for (const p of products ?? []) counts.set(p.hsn_code, (counts.get(p.hsn_code) ?? 0) + 1)

  return (rates ?? []).map((r) => ({
    ...r,
    rate: Number(r.rate),
    productCount: counts.get(r.hsn_code) ?? 0,
  })) as TaxRateRow[]
}

type TaxRateInput = {
  name: string
  hsn_code: string
  min_price: number
  max_price: number | null
  rate: number
  is_active: boolean
}

/**
 * Two active rows for one HSN must not cover the same price, or the rate a
 * product gets depends on row order. The database enforces it for identical
 * bands; this catches the subtler case of bands that overlap without matching.
 */
async function assertNoOverlap(input: TaxRateInput, excludeId?: string) {
  const admin = createAdminSupabaseClient()
  const { data } = await admin
    .from('tax_rates')
    .select('id, name, min_price, max_price')
    .eq('hsn_code', input.hsn_code)
    .eq('is_active', true)

  const newMax = input.max_price ?? Number.MAX_SAFE_INTEGER
  for (const row of data ?? []) {
    if (row.id === excludeId) continue
    const rowMax = row.max_price ?? Number.MAX_SAFE_INTEGER
    if (input.min_price < rowMax && row.min_price < newMax) {
      throw new Error(`That price band overlaps "${row.name}" on the same HSN code. Adjust the bands so they do not cover the same price.`)
    }
  }
}

export async function createTaxRate(input: TaxRateInput) {
  await requireAdmin()
  if (input.is_active) await assertNoOverlap(input)
  const { data, error } = await createAdminSupabaseClient().from('tax_rates').insert(input).select('id').single()
  if (error) throw new Error(error.message)
  await auditLog({ action: 'tax_rate.create', entityType: 'tax_rate', entityId: data.id, after: input })
  revalidatePath('/admin/tax')
}

export async function updateTaxRate(id: string, input: TaxRateInput) {
  await requireAdmin()
  if (input.is_active) await assertNoOverlap(input, id)
  const { error } = await createAdminSupabaseClient().from('tax_rates').update(input).eq('id', id)
  if (error) throw new Error(error.message)
  await auditLog({ action: 'tax_rate.update', entityType: 'tax_rate', entityId: id, after: input })
  revalidatePath('/admin/tax')
}

export async function deleteTaxRate(id: string) {
  await requireAdmin()
  // Rates are not referenced by orders — the rate is snapshotted onto each line
  // at checkout — so deleting one cannot rewrite history.
  const { error } = await createAdminSupabaseClient().from('tax_rates').delete().eq('id', id)
  if (error) throw new Error(error.message)
  await auditLog({ action: 'tax_rate.delete', entityType: 'tax_rate', entityId: id })
  revalidatePath('/admin/tax')
}

/** Products with no HSN — they fall back to the store rate, which is usually wrong. */
export async function getUnclassifiedProducts() {
  await requireAdmin()
  const { data } = await createAdminSupabaseClient()
    .from('products')
    .select('id, name, slug, price')
    .eq('is_active', true)
    .is('hsn_code', null)
    .order('name')
  return (data ?? []) as { id: string; name: string; slug: string; price: number }[]
}

export async function setProductHsn(productId: string, hsnCode: string | null) {
  await requireAdmin()
  const { error } = await createAdminSupabaseClient()
    .from('products')
    .update({ hsn_code: hsnCode })
    .eq('id', productId)
  if (error) throw new Error(error.message)
  await auditLog({ action: 'product.hsn_changed', entityType: 'product', entityId: productId, after: { hsn_code: hsnCode } })
  revalidatePath('/admin/tax')
}
