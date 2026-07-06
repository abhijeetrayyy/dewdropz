import { PRODUCTS } from '@/lib/constants'
import type { PRODUCTS as ProductsType } from '@/lib/constants'

type Product = (typeof ProductsType)[number]

/**
 * Returns a list of genuinely related products based on shared attributes.
 * 
 * Logic:
 * 1. Matches the same collection (highest priority)
 * 2. Does not include the current product itself
 * 3. Fallbacks to items with similar price tiers or just other items if the collection is too small
 * 
 * @param currentProductSlug The slug of the product currently being viewed
 * @param limit Max number of recommendations to return
 * @returns Array of recommended Product objects
 */
export function getRelatedProducts(currentProductSlug: string, limit: number = 3): Product[] {
  const currentProduct = PRODUCTS.find((p) => p.slug === currentProductSlug)
  
  if (!currentProduct) {
    // Fallback if product not found: just return featured/random
    return PRODUCTS.slice(0, limit)
  }

  // Primary criteria: Same collection
  let related = PRODUCTS.filter(
    (p) => p.collectionId === currentProduct.collectionId && p.slug !== currentProductSlug
  )

  // Secondary criteria: If we don't have enough from the same collection, grab items from other collections
  // that have a similar price point (+/- 30%)
  if (related.length < limit) {
    const minPrice = currentProduct.price * 0.7
    const maxPrice = currentProduct.price * 1.3
    
    const similarPriced = PRODUCTS.filter(
      (p) => p.slug !== currentProductSlug && 
             p.collectionId !== currentProduct.collectionId &&
             p.price >= minPrice && p.price <= maxPrice
    )
    
    related = [...related, ...similarPriced]
  }

  // Tertiary criteria: Just fill the rest with whatever is available, excluding the current product
  if (related.length < limit) {
    const others = PRODUCTS.filter((p) => p.slug !== currentProductSlug && !related.find((r) => r.slug === p.slug))
    related = [...related, ...others]
  }

  // Return exactly the limit requested
  return related.slice(0, limit)
}

/**
 * Returns genuine recommendations for a cart based on the items in it.
 */
export function getCartRecommendations(cartItemSlugs: string[], limit: number = 3): Product[] {
  if (cartItemSlugs.length === 0) {
    return PRODUCTS.slice(0, limit)
  }

  // Find collections of items currently in the cart
  const cartProducts = PRODUCTS.filter(p => cartItemSlugs.includes(p.slug))
  const cartCollections = new Set(cartProducts.map(p => p.collectionId))

  // Suggest items from the same collections that aren't already in the cart
  let related = PRODUCTS.filter(
    (p) => cartCollections.has(p.collectionId) && !cartItemSlugs.includes(p.slug)
  )

  // Fallback to other items
  if (related.length < limit) {
    const others = PRODUCTS.filter(
      (p) => !cartItemSlugs.includes(p.slug) && !related.find((r) => r.slug === p.slug)
    )
    related = [...related, ...others]
  }

  return related.slice(0, limit)
}
