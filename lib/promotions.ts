// The promotion resolver.
//
// This decides money, so two rules govern it:
//
//   1. It is PURE given its inputs. `resolvePromotions` does the arithmetic and
//      `getLivePromotions` does the I/O, so the maths can be reasoned about (and
//      tested) without a database.
//   2. It never trusts the caller for prices. It is handed cart lines that the
//      server already priced — the same ones createOrder computes its subtotal
//      from — so a promotion can never be applied to a number a browser sent.

export type CartLine = {
  productSlug: string
  collectionSlug: string | null
  unitPrice: number // paise, server-priced
  quantity: number
}

export type Promotion = {
  id: string
  label: string
  action_type: 'percentage' | 'fixed' | 'free_shipping' | 'bogo'
  action_value: number
  max_discount: number | null
  conditions: {
    minSubtotal?: number
    collectionSlugs?: string[]
    productSlugs?: string[]
    minQuantity?: number
  }
  priority: number
  stackable: boolean
}

export type AppliedPromotion = {
  promotionId: string
  label: string
  /** Paise off the subtotal. Zero for free_shipping, which moves shipping. */
  amount: number
  freeShipping: boolean
}

/** Only the lines a promotion targets. An offer scoped to a collection must
 *  discount that collection's lines, not the whole basket. */
function targetedLines(promo: Promotion, lines: CartLine[]): CartLine[] {
  const { collectionSlugs, productSlugs } = promo.conditions
  if (!collectionSlugs?.length && !productSlugs?.length) return lines
  return lines.filter(
    (l) =>
      (productSlugs?.length ? productSlugs.includes(l.productSlug) : false) ||
      (collectionSlugs?.length && l.collectionSlug ? collectionSlugs.includes(l.collectionSlug) : false)
  )
}

const sum = (lines: CartLine[]) => lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0)
const count = (lines: CartLine[]) => lines.reduce((n, l) => n + l.quantity, 0)

/**
 * Work out which promotions apply and what they are worth.
 *
 * Evaluated in priority order against a subtotal that SHRINKS as discounts
 * land, so a percentage after a fixed discount is taken on the reduced amount —
 * the alternative (every promotion computed off the original subtotal) can
 * discount past zero on a stacked cart.
 *
 * The first non-stackable promotion that applies ends evaluation. Without that,
 * "best offer" quietly becomes "every offer at once".
 */
export function resolvePromotions(promotions: Promotion[], lines: CartLine[]) {
  const applied: AppliedPromotion[] = []
  let running = sum(lines)
  let freeShipping = false

  for (const promo of promotions) {
    const targets = targetedLines(promo, lines)
    if (targets.length === 0) continue

    const targetSubtotal = sum(targets)
    const { minSubtotal, minQuantity } = promo.conditions
    // minSubtotal is checked against the WHOLE cart — "spend ₹3,000" means the
    // basket, not the eligible slice of it.
    if (minSubtotal != null && sum(lines) < minSubtotal) continue
    if (minQuantity != null && count(targets) < minQuantity) continue

    const isFreeShipping = promo.action_type === 'free_shipping'
    let amount = 0
    if (promo.action_type === 'percentage') {
      amount = Math.floor((Math.min(targetSubtotal, running) * promo.action_value) / 100)
      if (promo.max_discount != null) amount = Math.min(amount, promo.max_discount)
    } else if (promo.action_type === 'fixed') {
      amount = Math.min(promo.action_value, running)
    } else if (isFreeShipping) {
      freeShipping = true
    } else if (promo.action_type === 'bogo') {
      // Cheapest-free, which is the honest reading of "buy N get M" and the one
      // that cannot be gamed by adding an expensive item to a qualifying cart.
      const unitPrices = targets
        .flatMap((l) => Array<number>(l.quantity).fill(l.unitPrice))
        .sort((a, b) => a - b)
      const freeCount = Math.min(promo.action_value, Math.floor(unitPrices.length / 2))
      amount = unitPrices.slice(0, freeCount).reduce((n, p) => n + p, 0)
    }

    amount = Math.max(0, Math.min(amount, running))
    if (amount === 0 && !isFreeShipping) continue

    applied.push({ promotionId: promo.id, label: promo.label, amount, freeShipping: isFreeShipping })
    running -= amount

    if (!promo.stackable) break
  }

  return {
    applied,
    discount: applied.reduce((n, a) => n + a.amount, 0),
    freeShipping,
  }
}
