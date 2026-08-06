import type { ProductWithCollection } from '@/types/database'

/**
 * Returns a list of genuinely related products based on shared attributes.
 *
 * Logic:
 * 1. Matches the same collection (highest priority)
 * 2. Does not include the current product itself
 * 3. Fallbacks to items with similar price tiers or just other items if the collection is too small
 *
 * Takes the already-fetched product catalog as a parameter rather than reading
 * it itself — this stays pure client-safe logic, with the DB fetch living in
 * the caller (a server component or action).
 */
export function getRelatedProducts(
  allProducts: ProductWithCollection[],
  currentProductSlug: string,
  limit: number = 3
): ProductWithCollection[] {
  const currentProduct = allProducts.find((p) => p.slug === currentProductSlug)

  if (!currentProduct) {
    return allProducts.slice(0, limit)
  }

  // Primary criteria: Same collection
  let related = allProducts.filter(
    (p) => p.collection_id === currentProduct.collection_id && p.slug !== currentProductSlug
  )

  // Secondary criteria: If we don't have enough from the same collection, grab items from other collections
  // that have a similar price point (+/- 30%)
  if (related.length < limit) {
    const minPrice = currentProduct.price * 0.7
    const maxPrice = currentProduct.price * 1.3

    const similarPriced = allProducts.filter(
      (p) => p.slug !== currentProductSlug &&
             p.collection_id !== currentProduct.collection_id &&
             p.price >= minPrice && p.price <= maxPrice &&
             !related.find((r) => r.slug === p.slug)
    )

    related = [...related, ...similarPriced]
  }

  // Tertiary criteria: Just fill the rest with whatever is available, excluding the current product
  if (related.length < limit) {
    const others = allProducts.filter((p) => p.slug !== currentProductSlug && !related.find((r) => r.slug === p.slug))
    related = [...related, ...others]
  }

  return related.slice(0, limit)
}

/**
 * Returns genuine recommendations for a cart based on the items in it.
 */
export function getCartRecommendations(
  allProducts: ProductWithCollection[],
  cartItemSlugs: string[],
  limit: number = 3
): ProductWithCollection[] {
  if (cartItemSlugs.length === 0) {
    return allProducts.slice(0, limit)
  }

  // Find collections of items currently in the cart
  const cartProducts = allProducts.filter((p) => cartItemSlugs.includes(p.slug))
  const cartCollections = new Set(cartProducts.map((p) => p.collection_id))

  // Suggest items from the same collections that aren't already in the cart
  let related = allProducts.filter(
    (p) => cartCollections.has(p.collection_id) && !cartItemSlugs.includes(p.slug)
  )

  // Fallback to other items
  if (related.length < limit) {
    const others = allProducts.filter(
      (p) => !cartItemSlugs.includes(p.slug) && !related.find((r) => r.slug === p.slug)
    )
    related = [...related, ...others]
  }

  return related.slice(0, limit)
}
