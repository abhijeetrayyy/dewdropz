/**
 * The storefront's local cart tracks a bare size ("S") while variants in the DB
 * are compound ("S / Sage"). This is the single rule that bridges them.
 *
 * It lives here, outside any 'use server' file, so the checkout sync and the
 * promotion preview resolve a line the same way — two copies of this rule would
 * eventually disagree, and the disagreement would show up as a preview that
 * doesn't match the amount charged.
 */
export function matchVariantForSize<T extends { name: string }>(variants: T[] | null | undefined, size: string): T | null {
  if (!variants?.length) return null
  const prefix = `${size.toLowerCase()} /`
  return variants.find((v) => v.name.toLowerCase().startsWith(prefix)) ?? variants[0]
}
