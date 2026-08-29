/**
 * What makes two cart lines the same line. No imports, so it can be tested.
 *
 * "No size" has three spellings and they must all mean one line: quick-add
 * sends `undefined`, the product screen sends `""`, and older persisted carts
 * hold `null`. Comparing them with `===` split one line into two — two rows of
 * quantity 1, neither showing a size, because `""` is falsy and the row's
 * "SIZE …" label rendered for neither.
 *
 * Lives apart from `stores/cart.ts` because that file imports zustand, and the
 * rule is worth pinning with tests on its own.
 */
export type LineKey = {
  productId: string;
  size?: string | null;
  customDesignId?: string | null;
};

/** One spelling of "absent", so the three cannot disagree. */
export const noSize = (v?: string | null): string | null => (v ?? "").trim() || null;

export function sameLine(a: LineKey, b: LineKey): boolean {
  return (
    a.productId === b.productId &&
    noSize(a.size) === noSize(b.size) &&
    noSize(a.customDesignId) === noSize(b.customDesignId)
  );
}
