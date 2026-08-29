'use server'

import { createAdminSupabaseClient, createPublicSupabaseClient } from '@/lib/supabase'
import { requireAdmin } from './auth'
import type { LibraryDesign, Product } from '@/types/database'

/**
 * The custom range — finished garments that came out of the studio.
 *
 * A *blank* is a product with `is_customizable` and print zones; it opens the
 * studio. A *range product* is an ordinary product row — its own photographs,
 * its own SKU, its own price — that an admin has ticked as belonging to the
 * custom range (`is_custom_range`, migration 095).
 *
 * THE TICK IS THE SWITCH, THE PARENT IS OPTIONAL. `custom_blank_id` may name
 * the blank the garment was printed on, and when it does the storefront can
 * send a shopper straight into the studio on that exact garment. When it is
 * null — because the blank is not stocked, or the print was a one-off on
 * something the studio does not carry — the product is still in the range. The
 * page then says so plainly and offers the blanks that do exist, which is a
 * better answer than either hiding the offer or opening a studio on the wrong
 * shirt.
 *
 * READS ARE PUBLIC. This is a shop window. Writes are admin-only and live in
 * actions/products.ts, which already owns product edits and their audit trail.
 */

/** A blank a shopper can actually open the studio on. */
export type StudioBlank = Pick<Product, 'id' | 'slug' | 'name' | 'price' | 'images'>

const BLANK_SELECT = 'id,slug,name,price,images,customization_config'

function withZones<T extends { customization_config: unknown }>(rows: T[]): T[] {
  return rows.filter((b) => {
    const cfg = b.customization_config as { colors?: unknown[] } | null
    return (cfg?.colors?.length ?? 0) > 0
  })
}

/**
 * Every blank the studio can open on.
 *
 * The same filter `/customize` uses — customizable AND actually configured with
 * colourways, because a blank with no print zones opens a studio with nothing
 * in it. Public: this is the fallback list a range product offers when its own
 * garment is not stocked.
 */
export async function getStudioBlanks(): Promise<StudioBlank[]> {
  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase
    .from('products')
    .select(BLANK_SELECT)
    .eq('is_customizable', true)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('price', { ascending: true })

  if (error) return []
  return withZones((data ?? []) as never[]).map(
    ({ id, slug, name, price, images }) => ({ id, slug, name, price, images }),
  ) as StudioBlank[]
}

/** The blanks an admin can name as a parent. Admin-only. */
export async function getCustomRangeOptions(): Promise<{ blanks: { id: string; slug: string; name: string }[] }> {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { data } = await supabase
    .from('products')
    .select(BLANK_SELECT)
    .eq('is_customizable', true)
    .is('deleted_at', null)
    .order('name')

  return {
    blanks: withZones((data ?? []) as never[]).map(({ id, slug, name }) => ({ id, slug, name })),
  }
}

/** Other range products printed on the same blank — "more on this garment". */
export async function getSiblingPrints(
  blankId: string,
  excludeProductId: string,
): Promise<Pick<Product, 'id' | 'slug' | 'name' | 'price' | 'images'>[]> {
  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase
    .from('products')
    .select('id,slug,name,price,images')
    .eq('custom_blank_id', blankId)
    .neq('id', excludeProductId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(12)

  // A rail that cannot load simply does not render; the page still sells.
  if (error) return []
  return (data ?? []) as Pick<Product, 'id' | 'slug' | 'name' | 'price' | 'images'>[]
}

/** Library artwork offered on a given blank. Empty `blank_ids` means all. */
export async function getDesignsForBlank(blankId: string): Promise<LibraryDesign[]> {
  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase
    .from('design_library')
    .select('*')
    .eq('active', true)
    .or(`blank_ids.eq.{},blank_ids.cs.{${blankId}}`)
    .order('sort', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) return []
  return (data ?? []) as LibraryDesign[]
}

/**
 * What the product page needs to render the custom-range card.
 *
 * Returns null for an ordinary product — the page then renders nothing at all,
 * because a product that is not in the range must not claim it is.
 *
 * `blank` is null when the garment is not stocked in the studio. That is not a
 * failure: `alternatives` is then the honest offer, and the card changes its
 * wording rather than its presence.
 */
export async function getCustomRangeContext(product: {
  id: string
  is_custom_range?: boolean | null
  custom_blank_id?: string | null
}): Promise<{
  blank: { id: string; slug: string; name: string } | null
  siblings: Pick<Product, 'id' | 'slug' | 'name' | 'price' | 'images'>[]
  alternatives: StudioBlank[]
} | null> {
  if (!product.is_custom_range) return null
  const supabase = createPublicSupabaseClient()

  // No parent named: the garment is not in the studio. Offer what is.
  if (!product.custom_blank_id) {
    return { blank: null, siblings: [], alternatives: await getStudioBlanks() }
  }

  const [{ data: blank }, siblings] = await Promise.all([
    supabase
      .from('products')
      .select('id,slug,name,is_customizable,is_active')
      .eq('id', product.custom_blank_id)
      .maybeSingle(),
    getSiblingPrints(product.custom_blank_id, product.id),
  ])

  // The link is stored but the blank has since been archived, deactivated or
  // had its customization switched off. Treat it exactly like "not stocked"
  // rather than offering a studio that will 404 — a stale foreign key must not
  // become a broken promise on the product page.
  const usable =
    blank && (blank as { is_customizable: boolean; is_active: boolean }).is_customizable &&
    (blank as { is_active: boolean }).is_active

  if (!usable) {
    return { blank: null, siblings, alternatives: await getStudioBlanks() }
  }

  return {
    blank: blank as { id: string; slug: string; name: string },
    siblings,
    alternatives: [],
  }
}
