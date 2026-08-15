export function formatPrice(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString("en-IN")}`;
}

/**
 * The size to use when adding a product to the cart without asking — the first
 * one that is actually orderable, falling back to the first listed so a
 * product whose stock isn't tracked still adds.
 *
 * Bulk actions ("Add all to pack", "Take all N") used to reach for
 * `variants[0]` directly, which happily picked a sold-out size.
 */
export function pickVariant<T extends { id: string; name: string; inventory_quantity?: number | null }>(
  variants: T[] | null | undefined,
): T | undefined {
  if (!variants?.length) return undefined;
  return variants.find((v) => v.inventory_quantity == null || v.inventory_quantity > 0) ?? variants[0];
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

// "2 HOURS AGO" / "YESTERDAY" / "3 DAYS AGO" style relative time — matches
// the copy the notifications screen used with its mock data, so real rows
// read the same way.
export function formatTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
