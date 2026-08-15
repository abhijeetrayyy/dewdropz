'use server'

import { clearCart, addToCart } from './cart'
import { getProductBySlug } from './products'
import { getUser } from './auth'
import { matchVariantForSize } from '@/lib/variantMatch'
import type { SupabaseClient } from '@supabase/supabase-js'

// Bridges the storefront's local cart (slug + plain size string, no DB identity)
// to the real cart the order/payment system needs (product_id + variant_id). The
// two have no shared key today, so this resolves each line as best it can and
// reports anything it couldn't place rather than silently dropping it.
//
// Variant names in the DB are compound ("S / Sage") while the storefront only
// ever tracks a bare size ("S") — there's no color concept on this side at all —
// so a line matches the first variant whose name starts with "<size> /", falling
// back to the first variant on the product if nothing starts with that prefix.
export async function syncLocalCartToDbCart(
  lines: { slug: string; size: string; quantity: number; productId?: string; variantId?: string | null; customDesignId?: string }[],
  userId: string,
  client?: SupabaseClient
) {
  // Start from a clean DB cart for this user so re-running checkout (after a
  // cancelled payment, say) doesn't pile duplicate quantities on top of last time.
  await clearCart(userId, null, client)

  const skipped: string[] = []

  for (const line of lines) {
    // A customized line already knows its exact product/variant from the
    // studio — no need for (and no risk from) the fuzzy size match below.
    if (line.customDesignId && line.productId) {
      const result = await addToCart({
        product_id: line.productId,
        variant_id: line.variantId ?? null,
        custom_design_id: line.customDesignId,
        quantity: line.quantity,
        userId,
        client,
      })
      if (result && 'error' in result) skipped.push(line.slug)
      continue
    }

    const product = await getProductBySlug(line.slug)
    if (!product) { skipped.push(line.slug); continue }

    const variantId = matchVariantForSize(product.variants, line.size)?.id ?? null

    const result = await addToCart({ product_id: product.id, variant_id: variantId, quantity: line.quantity, userId, client })
    if (result && 'error' in result) skipped.push(line.slug)
  }

  return { skipped }
}

/**
 * Mirror a signed-in customer's local cart into the database so it can be
 * recovered if they leave.
 *
 * The storefront cart lives in localStorage, which means that until this
 * existed the server only ever saw a cart at the moment someone pressed Place
 * Order — recovery would have covered failed payments and nothing else.
 *
 * Two deliberate properties:
 *  - It derives the user from the session rather than taking a userId, so a
 *    client cannot write into somebody else's cart.
 *  - It is called only when the cart actually CHANGES, never on mount. Mirroring
 *    on every page load would keep bumping `carts.updated_at` and the sweep
 *    would never consider any cart abandoned.
 */
export async function mirrorCartForRecovery(
  lines: { slug: string; size: string; quantity: number; productId?: string; variantId?: string | null; customDesignId?: string }[]
) {
  const user = await getUser()
  if (!user) return { mirrored: false }
  await syncLocalCartToDbCart(lines, user.id)
  return { mirrored: true }
}
