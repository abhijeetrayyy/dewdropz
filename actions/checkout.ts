'use server'

import { clearCart, addToCart } from './cart'
import { getProductBySlug } from './products'

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
  lines: { slug: string; size: string; quantity: number }[],
  userId: string
) {
  // Start from a clean DB cart for this user so re-running checkout (after a
  // cancelled payment, say) doesn't pile duplicate quantities on top of last time.
  await clearCart(userId, null)

  const skipped: string[] = []

  for (const line of lines) {
    const product = await getProductBySlug(line.slug)
    if (!product) { skipped.push(line.slug); continue }

    let variantId: string | null = null
    if (product.variants?.length) {
      const prefix = `${line.size.toLowerCase()} /`
      const match = product.variants.find((v) => v.name.toLowerCase().startsWith(prefix))
      variantId = (match ?? product.variants[0]).id
    }

    const result = await addToCart({ product_id: product.id, variant_id: variantId, quantity: line.quantity, userId })
    if (result && 'error' in result) skipped.push(line.slug)
  }

  return { skipped }
}
