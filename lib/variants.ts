import type { ProductVariant, ProductWithCollection } from '@/types/database'

/**
 * Which variant a one-click "add to cart" is allowed to choose.
 *
 * THE BUG THIS REPLACES
 *
 * SeasonKit and TheClimb each carried the same line, byte for byte:
 *
 *     size: p.variants?.[0]?.name ?? '', variantId: p.variants?.[0]?.id ?? null
 *
 * `[0]` is not "the smallest size" and not "the default". `actions/products.ts`
 * orders variants by `sort_order`; `001_initial_schema.sql:63` declares
 * `sort_order INT DEFAULT 0` and no migration has ever set it on
 * `product_variants`. Every row ties at zero, so the database returns them in
 * whatever order suits it — which can differ between two renders of the same
 * page. Neither handler looked at `inventory_quantity` either, so a sold-out
 * garment went into the cart happily. The one control on the homepage that
 * does check stock is the configurator, which is the one control that does not
 * take money.
 *
 * On an apparel store, in a cash-on-delivery market, where the wrong size is
 * not a return — it is a courier arriving with a parcel nobody will pay for.
 *
 * `firstAvailableVariant` gives a deterministic, in-stock answer, and returns
 * `null` when there is genuinely nothing to sell so the caller can say so.
 */

/** No inventory row at all means the product does not track stock, which is
 *  not the same as being out of it. Refusing to sell those would be a worse
 *  bug than the one being fixed. */
function isBuyable(v: ProductVariant): boolean {
  return v.inventory_quantity === null || v.inventory_quantity > 0
}

/** A stable order that does not depend on what the database felt like
 *  returning: the explicit `sort_order` first (for the day someone sets it),
 *  then a garment-size ladder, then the name. Without the ladder a picker
 *  renders "L XL M S". */
const SIZE_LADDER = ['xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl', '2xl', '3xl', '4xl']

export function orderVariants(variants: ProductVariant[]): ProductVariant[] {
  return [...variants].sort((a, b) => {
    const ao = a.sort_order ?? 0
    const bo = b.sort_order ?? 0
    if (ao !== bo) return ao - bo
    const an = a.name.trim().toLowerCase()
    const bn = b.name.trim().toLowerCase()
    const ai = SIZE_LADDER.indexOf(an)
    const bi = SIZE_LADDER.indexOf(bn)
    if (ai !== bi) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    return an.localeCompare(bn)
  })
}

/** The variant a one-click add should commit, or `null` if nothing is in
 *  stock. Deterministic across renders. */
export function firstAvailableVariant(product: ProductWithCollection): ProductVariant | null {
  const ordered = orderVariants(product.variants ?? [])
  return ordered.find(isBuyable) ?? null
}

/** True when the product has variants and none of them can be bought. */
export function isSoldOut(product: ProductWithCollection): boolean {
  const all = product.variants ?? []
  return all.length > 0 && !all.some(isBuyable)
}

/** The price actually payable for a chosen variant. */
export function priceFor(product: ProductWithCollection, variant: ProductVariant | null): number {
  return product.price + (variant?.price_adjustment ?? 0)
}
