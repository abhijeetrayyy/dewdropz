'use server'

import { revalidatePath } from 'next/cache'
import { createAdminSupabaseClient, createServerSupabaseClient } from '@/lib/supabase'
import { requireAdmin, getUser } from './auth'
import { auditLog } from '@/lib/audit'
import { resolvePromotions, type Promotion } from '@/lib/promotions'
import { cartLinesForPromotions, getLivePromotions } from '@/lib/promotions.server'
import { getCart, validateCoupon } from './cart'
import { getProductsBySlugs } from './products'
import { matchVariantForSize } from '@/lib/variantMatch'

/** A cart line as the browser holds it. `variantId` is what makes the preview
 *  price the same variant createOrder charges for — without it the preview
 *  resolved by size, which picked the first variant for every line. */
type PreviewLine = { slug: string; size: string; quantity: number; variantId?: string | null }

/** One resolution rule for both preview functions, so they cannot drift from
 *  each other or from the checkout sync. */
function resolveLineVariant<T extends { id: string; name: string }>(
  variants: T[] | null | undefined,
  line: PreviewLine,
): T | null {
  if (line.variantId) return variants?.find((v) => v.id === line.variantId) ?? null
  return matchVariantForSize(variants, line.size)
}

export type PromotionRow = Promotion & {
  name: string
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  created_at: string
  /** What this campaign has actually cost, in paise, across all orders. */
  spend: number
  orders: number
}

export async function getPromotions(): Promise<PromotionRow[]> {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  // Campaign cost is the number that decides whether an offer stays on, so it
  // is shown next to the offer rather than hidden in analytics.
  //
  // Summed in Postgres. This used to select every order_promotions row and
  // reduce it in Node — one row per promotion per order, forever — which
  // measured at 5,000 rows crossing the wire to produce eight numbers.
  const [{ data: promos }, { data: spend }] = await Promise.all([
    supabase.from('promotions').select('*').order('priority').order('created_at', { ascending: false }),
    supabase.rpc('promotion_spend'),
  ])

  const tally = new Map<string, { spend: number; orders: number }>(
    ((spend ?? []) as { promotion_id: string; spend: number; orders: number }[])
      .map((r) => [r.promotion_id, { spend: Number(r.spend), orders: Number(r.orders) }])
  )

  return (promos ?? []).map((p) => ({
    ...p,
    spend: tally.get(p.id)?.spend ?? 0,
    orders: tally.get(p.id)?.orders ?? 0,
  })) as PromotionRow[]
}

type PromotionInput = {
  name: string
  label: string
  action_type: 'percentage' | 'fixed' | 'free_shipping' | 'bogo'
  action_value: number
  max_discount: number | null
  conditions: Record<string, unknown>
  priority: number
  stackable: boolean
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
}

export async function createPromotion(input: PromotionInput) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase.from('promotions').insert(input).select('id').single()
  if (error) throw new Error(error.message)
  await auditLog({ action: 'promotion.create', entityType: 'promotion', entityId: data.id, after: input })
  revalidatePath('/admin/promotions')
}

export async function updatePromotion(id: string, input: Partial<PromotionInput>) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('promotions').update(input).eq('id', id)
  if (error) throw new Error(error.message)
  await auditLog({ action: 'promotion.update', entityType: 'promotion', entityId: id, after: input })
  revalidatePath('/admin/promotions')
}

export async function deletePromotion(id: string) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  // order_promotions holds ON DELETE RESTRICT for exactly this reason: once a
  // promotion has discounted a real order, deleting it would erase what that
  // order was charged. Retire it instead.
  const { count } = await supabase
    .from('order_promotions')
    .select('promotion_id', { count: 'exact', head: true })
    .eq('promotion_id', id)
  if (count && count > 0) {
    throw new Error(`This promotion has already been applied to ${count} order${count === 1 ? '' : 's'}. Deactivate it instead of deleting it.`)
  }
  const { error } = await supabase.from('promotions').delete().eq('id', id)
  if (error) throw new Error(error.message)
  await auditLog({ action: 'promotion.delete', entityType: 'promotion', entityId: id })
  revalidatePath('/admin/promotions')
}

/** What fired on one order, for the customer's own order page. RLS-scoped. */
// Read by two different people about two different things: an admin looking at
// any order, and a customer looking at their own. It cannot simply require
// admin, and it must not stay as it was — the service-role client bypasses RLS,
// so with no auth check at all, anyone who could POST this action with an order
// id got back that order's discount labels and amounts.
//
// So the client is chosen by who is asking. A customer goes through RLS, where
// "Users read own order promotions" already scopes the read to their own orders
// and returns nothing for anyone else's. Only a verified admin gets the
// service-role client that can see across customers.
export async function getOrderPromotions(orderId: string) {
  const user = await getUser()
  if (!user) return []

  const rls = await createServerSupabaseClient()
  const { data: profile } = await rls.from('profiles').select('role').eq('id', user.id).single()

  const db = profile?.role === 'admin' ? createAdminSupabaseClient() : rls
  const { data } = await db
    .from('order_promotions')
    .select('label, amount')
    .eq('order_id', orderId)
  return (data ?? []) as { label: string; amount: number }[]
}

/**
 * What the current cart would earn at checkout. Runs the same resolver against
 * the same server-priced cart that createOrder uses, so the number a customer
 * is shown is the number they are charged — a preview computed a second way is
 * a preview that eventually disagrees.
 */
export async function previewCartPromotions(userId?: string | null, sessionId?: string | null) {
  const cart = await getCart(userId, sessionId)
  if (!cart?.items?.length) return { applied: [], discount: 0, freeShipping: false }
  const live = await getLivePromotions()
  if (!live.length) return { applied: [], discount: 0, freeShipping: false }
  const { applied, discount, freeShipping } = resolvePromotions(live, await cartLinesForPromotions(cart.items))
  return { applied, discount, freeShipping }
}

/**
 * Preview for the checkout summary, before the local cart has been written to
 * the database. Prices come from the product rows — never from the browser —
 * and lines resolve through the same variant rule the checkout sync uses, so
 * the preview matches what createOrder goes on to charge.
 */
export async function previewPromotionsForLines(lines: PreviewLine[]) {
  const empty = { applied: [] as { label: string; amount: number; freeShipping: boolean }[], discount: 0, freeShipping: false }
  if (!lines.length) return empty
  const live = await getLivePromotions()
  if (!live.length) return empty

  const products = await getProductsBySlugs([...new Set(lines.map((l) => l.slug))])
  const bySlug = new Map(products.map((p) => [p.slug, p]))

  const cartLines = lines.flatMap((line) => {
    const product = bySlug.get(line.slug)
    if (!product) return []
    const variant = resolveLineVariant(product.variants, line)
    return [{
      productSlug: product.slug,
      collectionSlug: product.collection?.slug ?? null,
      unitPrice: product.price + (variant?.price_adjustment ?? 0),
      quantity: line.quantity,
    }]
  })

  const { applied, discount, freeShipping } = resolvePromotions(live, cartLines)
  return { applied, discount, freeShipping }
}

/**
 * The whole money picture for a cart, before an order exists.
 *
 * One call rather than one per mechanism, because promotions and coupons are
 * not independent: `createOrder` applies the coupon to the subtotal that
 * promotions have already reduced, and a preview that computed them separately
 * would show a bigger discount than the customer is actually charged.
 *
 * Prices come from the product rows, never the browser.
 */
export async function previewCheckoutTotals(
  lines: PreviewLine[],
  couponCode?: string,
  userId?: string | null
) {
  const promo = await previewPromotionsForLines(lines)

  const products = await getProductsBySlugs([...new Set(lines.map((l) => l.slug))])
  const bySlug = new Map(products.map((p) => [p.slug, p]))
  const subtotal = lines.reduce((sum, line) => {
    const product = bySlug.get(line.slug)
    if (!product) return sum
    const variant = resolveLineVariant(product.variants, line)
    return sum + (product.price + (variant?.price_adjustment ?? 0)) * line.quantity
  }, 0)

  let couponDiscount = 0
  let couponError: string | undefined
  if (couponCode) {
    // Against the post-promotion subtotal — the same base createOrder uses, so
    // a percentage code cannot be taken off money already discounted away.
    const result = await validateCoupon(couponCode, subtotal - promo.discount, userId ?? undefined)
    if ('error' in result) couponError = result.error
    else couponDiscount = result.discount
  }

  return {
    subtotal,
    promotions: promo.applied,
    promoDiscount: promo.discount,
    freeShipping: promo.freeShipping,
    couponDiscount,
    couponError,
    // Clamped the same way createOrder clamps it: a cart cannot cost less than
    // nothing however many offers stack.
    totalDiscount: Math.min(promo.discount + couponDiscount, subtotal),
  }
}

/**
 * Live automatic offers that would apply to one product, for its detail page.
 *
 * Scope-only: it answers "is this product eligible", not "what would it save
 * you", because the answer depends on the whole cart (a spend threshold, a
 * quantity, what else is in the basket). Quoting a number here that checkout
 * then declines to honour is worse than describing the offer honestly.
 */
export async function getOffersForProduct(productSlug: string, collectionSlug: string | null) {
  const live = await getLivePromotions()

  return live
    .filter((p) => {
      const { collectionSlugs, productSlugs } = p.conditions ?? {}
      if (!collectionSlugs?.length && !productSlugs?.length) return true
      if (productSlugs?.length && productSlugs.includes(productSlug)) return true
      if (collectionSlugs?.length && collectionSlug && collectionSlugs.includes(collectionSlug)) return true
      return false
    })
    .map((p) => {
      const c = p.conditions ?? {}
      const qualifiers = [
        c.minSubtotal ? `on orders over ₹${(c.minSubtotal / 100).toLocaleString('en-IN')}` : null,
        c.minQuantity ? `on ${c.minQuantity}+ items` : null,
      ].filter(Boolean).join(' · ')

      const offer =
        p.action_type === 'percentage' ? `${p.action_value}% off`
        : p.action_type === 'fixed' ? `₹${(p.action_value / 100).toLocaleString('en-IN')} off`
        : p.action_type === 'free_shipping' ? 'Free shipping'
        : 'Buy one, get one'

      return {
        label: p.label,
        description: qualifiers ? `${offer} ${qualifiers}` : `${offer} at checkout`,
      }
    })
}
