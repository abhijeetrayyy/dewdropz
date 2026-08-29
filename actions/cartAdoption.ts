'use server'

import { createAdminSupabaseClient } from '@/lib/supabase'

/**
 * The cart a guest built, taken over by the account they just signed into.
 *
 * WHY THIS EXISTS. Checkout requires an account, so every customer meets a
 * sign-in screen while holding a full cart. Until now that cart lived only in
 * the browser's localStorage (or the app's AsyncStorage) and reached the
 * database once, at checkout. Two consequences, both bad:
 *
 *   1. The cart did not follow the account. Add three things on a phone, sign
 *      in on a laptop, and the laptop's cart was empty — the items were sitting
 *      in a different device's local storage with no way to reach them.
 *   2. Signing in was a moment where a cart could be silently lost or doubled,
 *      because nothing defined what should happen when a guest cart and a saved
 *      cart both exist.
 *
 * THE RULE, stated once so both platforms behave identically:
 *
 *   • The union of the two carts wins. Nothing a person put in a cart is thrown
 *     away by the act of signing in — that is the one outcome nobody expects.
 *   • Identical lines (same product, same variant, same custom design) have
 *     their quantities ADDED, because two of a thing in two places is two of it.
 *   • The merged cart is written to the account and handed back, so the client
 *     replaces its local copy rather than keeping a second, diverging one.
 *
 * Deliberately NOT `clearCart` + re-add, which is what the checkout sync does:
 * that is right for checkout (re-running it must not pile up duplicates) and
 * wrong here, where the saved cart is data we are joining, not replacing.
 */

export type AdoptedLine = {
  slug: string
  name: string
  price: number
  image: string
  size: string
  quantity: number
  productId: string
  variantId: string | null
  customDesignId?: string
}

type IncomingLine = {
  slug: string
  size?: string | null
  quantity: number
  productId?: string | null
  variantId?: string | null
  customDesignId?: string | null
}

/** Same line? Product, variant and custom design together — the same identity
 *  the mobile cart store uses, and `''`/null are one value, not two. */
const key = (productId: string, variantId?: string | null, designId?: string | null) =>
  `${productId}::${variantId || ''}::${designId || ''}`

export async function adoptLocalCart(
  lines: IncomingLine[],
  userId: string,
): Promise<{ items: AdoptedLine[] }> {
  const supabase = createAdminSupabaseClient()

  // The account's own cart, created on demand.
  const { data: existingCart } = await supabase
    .from('carts').select('id').eq('user_id', userId).maybeSingle()
  let cartId = existingCart?.id as string | undefined
  if (!cartId) {
    const { data: made } = await supabase
      .from('carts').insert({ user_id: userId }).select('id').single()
    cartId = made?.id as string | undefined
  }
  if (!cartId) return { items: [] }

  // What is already saved to the account.
  const { data: saved } = await supabase
    .from('cart_items')
    .select('id, product_id, variant_id, custom_design_id, quantity')
    .eq('cart_id', cartId)

  const merged = new Map<string, { product_id: string; variant_id: string | null; custom_design_id: string | null; quantity: number }>()
  for (const row of saved ?? []) {
    merged.set(key(row.product_id, row.variant_id, row.custom_design_id), {
      product_id: row.product_id,
      variant_id: row.variant_id,
      custom_design_id: row.custom_design_id,
      quantity: row.quantity,
    })
  }

  // Resolve incoming lines that only know a slug. A line whose product no
  // longer exists is dropped rather than guessed at.
  const slugs = [...new Set(lines.map((l) => l.slug).filter(Boolean))]
  const { data: products } = slugs.length
    ? await supabase.from('products').select('id, slug').in('slug', slugs).eq('status', 'active')
    : { data: [] as { id: string; slug: string }[] }
  const idBySlug = new Map((products ?? []).map((p) => [p.slug, p.id]))

  for (const line of lines) {
    const productId = line.productId || idBySlug.get(line.slug)
    if (!productId || line.quantity <= 0) continue
    const k = key(productId, line.variantId, line.customDesignId)
    const at = merged.get(k)
    // Added, not replaced: two of a thing in two places is two of it.
    if (at) at.quantity += line.quantity
    else merged.set(k, {
      product_id: productId,
      variant_id: line.variantId || null,
      custom_design_id: line.customDesignId || null,
      quantity: line.quantity,
    })
  }

  // Rewrite the account's cart as the merged set.
  await supabase.from('cart_items').delete().eq('cart_id', cartId)
  const rows = [...merged.values()].map((m) => ({ cart_id: cartId, ...m }))
  if (rows.length) await supabase.from('cart_items').insert(rows)
  await supabase.from('carts').update({ last_activity_at: new Date().toISOString() }).eq('id', cartId)

  // Hand the merged cart back in the client's own shape, so it can replace its
  // local copy instead of keeping a second one that immediately diverges.
  const { data: full } = await supabase
    .from('cart_items')
    .select('quantity, product_id, variant_id, custom_design_id, product:products(slug,name,price,images), variant:product_variants(id,name,price_adjustment)')
    .eq('cart_id', cartId)

  const items: AdoptedLine[] = []
  for (const row of (full ?? []) as unknown as {
    quantity: number; product_id: string; variant_id: string | null; custom_design_id: string | null
    product: { slug: string; name: string; price: number; images: string[] } | null
    variant: { id: string; name: string; price_adjustment: number } | null
  }[]) {
    if (!row.product) continue
    items.push({
      slug: row.product.slug,
      name: row.product.name,
      price: row.product.price + (row.variant?.price_adjustment ?? 0),
      image: row.product.images?.[0] ?? '',
      // Variant names are compound ("S / Sage"); the carts only ever track size.
      size: row.variant?.name?.split('/')[0]?.trim() ?? '',
      quantity: row.quantity,
      productId: row.product_id,
      variantId: row.variant_id,
      ...(row.custom_design_id ? { customDesignId: row.custom_design_id } : {}),
    })
  }
  return { items }
}
