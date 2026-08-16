import 'server-only'
import { createAdminSupabaseClient, createPublicSupabaseClient } from '@/lib/supabase'
import type { CartLine, Promotion } from '@/lib/promotions'

// The I/O half of the promotion engine. The arithmetic lives in
// `lib/promotions.ts` with no server imports, so it can be exercised directly
// and so the storefront can preview an offer before checkout.

/** Build resolver input from a server-loaded cart.
 *  The cart query doesn't join collections (it has no other reason to), so the
 *  slugs a promotion is scoped by are fetched here — once, and only when a
 *  promotion is actually live. */
export async function cartLinesForPromotions(
  items: {
    quantity: number
    product: { slug: string; price: number; collection_id: string | null }
    variant?: { price_adjustment: number | null } | null
  }[]
): Promise<CartLine[]> {
  const collectionIds = [...new Set(items.map((i) => i.product.collection_id).filter(Boolean))] as string[]
  const slugById = new Map<string, string>()
  if (collectionIds.length) {
    const { data } = await createAdminSupabaseClient()
      .from('collections')
      .select('id, slug')
      .in('id', collectionIds)
    for (const c of data ?? []) slugById.set(c.id, c.slug)
  }
  return items.map((i) => ({
    productSlug: i.product.slug,
    collectionSlug: i.product.collection_id ? slugById.get(i.product.collection_id) ?? null : null,
    unitPrice: i.product.price + (i.variant?.price_adjustment ?? 0),
    quantity: i.quantity,
  }))
}

// Read with the ANON key, not the service role.
//
// A live promotion is public by definition — the product page and the cart both
// print it — and `promotions` has carried a "Anyone reads active promotions"
// policy since 034, so RLS already returns exactly the rows this filters for.
// The service role bought nothing here and cost a great deal: it made a public
// product page depend on a server-only secret, so the day SUPABASE_SERVICE_ROLE_KEY
// was absent from the deployment, `createClient` threw `supabaseKey is required`
// and every /products/[slug] returned a 500 — while the homepage, shop and cart,
// which read through the anon key, carried on fine.
//
// The row set is unchanged: RLS applies `is_active = true` and this query
// already asked for it, so nothing about which promotions apply, or what an
// order is charged, moves.
export async function getLivePromotions(): Promise<Promotion[]> {
  const now = new Date().toISOString()
  const { data } = await createPublicSupabaseClient()
    .from('promotions')
    .select('id, label, action_type, action_value, max_discount, conditions, priority, stackable')
    .eq('is_active', true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order('priority', { ascending: true })
  return (data ?? []) as Promotion[]
}
