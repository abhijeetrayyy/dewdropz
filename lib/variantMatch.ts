/**
 * Resolve a cart line's size to a real variant row.
 *
 * It lives here, outside any 'use server' file, so the checkout sync and the
 * promotion preview resolve a line the same way — two copies of this rule would
 * eventually disagree, and the disagreement would show up as a preview that
 * doesn't match the amount charged.
 *
 * ## What was wrong
 *
 * The rule only ever looked for a COMPOUND name: it built the prefix `"m / "`
 * and searched for a variant starting with it, on the assumption that variants
 * are named "M / Sage". This catalogue names them "S", "M", "L", "XL". So the
 * prefix never matched anything, and an unconditional `?? variants[0]` returned
 * the FIRST variant every single time:
 *
 *     picked S  → resolved S     (right, by luck — S is first)
 *     picked M  → resolved S     wrong
 *     picked L  → resolved S     wrong
 *     picked XL → resolved S     wrong
 *
 * That is not a pricing edge case, it is a fulfilment bug: `createOrder` writes
 * `variant_name` from whatever this returns, so an order for XL was recorded,
 * picked and printed as S. It was invisible because every price_adjustment in
 * the catalogue is currently 0, so the money came out the same and only the
 * garment was wrong.
 *
 * ## What it does now
 *
 * Exact match, then the compound form, then NULL. The silent fallback is gone:
 * a size that cannot be resolved must be visible to the caller, because every
 * caller has something better to do with that than quietly ship the wrong item.
 *
 * Best of all is not to need this at all — carry `variantId` on the cart line.
 * Callers do that now; this remains for lines saved before they did, and for
 * anything that only knows a size.
 */
export function matchVariantForSize<T extends { name: string }>(
  variants: T[] | null | undefined,
  size: string,
): T | null {
  if (!variants?.length || !size) return null
  const wanted = size.trim().toLowerCase()

  // "M" — how this catalogue actually names them.
  const exact = variants.find((v) => v.name.trim().toLowerCase() === wanted)
  if (exact) return exact

  // "M / Sage" — a compound name whose first segment is the size. Split on the
  // separator rather than matching a prefix string, so "M" cannot match "ML".
  const compound = variants.find((v) => v.name.split('/')[0]?.trim().toLowerCase() === wanted)
  if (compound) return compound

  return null
}
