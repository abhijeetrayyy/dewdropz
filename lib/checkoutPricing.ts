import 'server-only'
import { resolvePromotions } from '@/lib/promotions'
import { calculateTax, isInterState } from '@/lib/tax'
import { getTaxRates } from '@/lib/tax.server'
import { cartLinesForPromotions, getLivePromotions } from '@/lib/promotions.server'
import { ASSUMED_PRODUCT_WEIGHT_GRAMS } from '@/lib/constants'
import { getStoreSettings } from '@/actions/settings'
import { calculateShippingCost } from '@/actions/shipping'
import { validateCoupon } from '@/actions/cart'
import type { SupabaseClient } from '@supabase/supabase-js'

// What a cart costs — computed once, in one place.
//
// This arithmetic used to live only inside createOrder, which meant the
// checkout screen had no way to reach it. So the screen showed a subtotal, the
// words "Shipping & tax: calculated after address", and a "Place Order" button:
// the customer committed to a number nobody had shown them, and for COD a
// courier later turned up asking for it.
//
// The obvious fix — compute a display total in the checkout component — is the
// wrong one. Two implementations of the same pricing rules drift, and the day
// they drift the shop either quotes less than it charges or charges more than
// it quoted. So there is exactly one function, and both the quote the customer
// approves and the order that bills them call it.
//
// Everything is in paise. Nothing here trusts the browser: prices, promotions,
// coupons, shipping and tax are all resolved server-side from the stored cart.

/** The minimum shape this needs from a cart line. Matches what getCart returns.
 *  `slug` and `collection_id` are here only because the promotion resolver
 *  matches campaigns on them. */
export type PricedCartItem = {
  id: string
  quantity: number
  product: {
    slug: string
    price: number
    collection_id: string | null
    weight?: number | null
    hsn_code?: string | null
  }
  variant?: { price_adjustment: number | null } | null
}

export type CheckoutPrice = {
  subtotal: number
  /** Automatic campaign discounts, itemised so the customer sees why. */
  promotions: { promotionId: string; label: string; amount: number }[]
  promotionDiscount: number
  couponDiscount: number
  /** promotions + coupon, clamped so a cart can never cost less than nothing. */
  discountAmount: number
  /** What delivery would cost before any free-shipping offer. */
  shippingCost: number
  /** What delivery actually costs on this order. */
  effectiveShipping: number
  freeShipping: boolean
  taxAmount: number
  taxBreakdown: { rate: number; taxable: number; tax: number }[]
  taxIsIgst: boolean
  taxEnabled: boolean
  totalAmount: number
  /** Per-line tax, keyed by cart item id — order_items needs this at insert. */
  taxByLine: Map<string, { hsnCode: string | null; rate: number; taxableValue: number; taxAmount: number }>
}

/**
 * Price a cart for a specific destination.
 *
 * Returns `{ error }` for the one thing that can legitimately fail from the
 * customer's side — a coupon that no longer qualifies — so the caller can show
 * it rather than guess. Everything else either resolves or falls back.
 */
export async function priceCheckout(params: {
  items: PricedCartItem[]
  /** Decides shipping zone AND the GST place of supply. */
  destination: { state: string | null; country: string | null }
  couponCode?: string
  userId?: string
  client?: SupabaseClient
}): Promise<{ error: string } | CheckoutPrice> {
  const { items, destination, couponCode, userId, client } = params

  const subtotal = items.reduce((sum, item) => {
    const price = item.product.price + (item.variant?.price_adjustment ?? 0)
    return sum + price * item.quantity
  }, 0)

  const weightGrams = items.reduce(
    (sum, item) => sum + (item.product.weight ?? ASSUMED_PRODUCT_WEIGHT_GRAMS) * item.quantity,
    0,
  )

  const settings = await getStoreSettings()
  const shippingCost = await calculateShippingCost({
    state: destination.state,
    country: destination.country,
    subtotal,
    weightGrams,
  })

  // Automatic promotions, resolved from the same server-priced lines the
  // subtotal came from — never from anything the browser sent. Coupons are a
  // separate mechanism and still apply on top; a shop that runs a sale AND
  // honours a code is normal, and the resolver's own stacking rules already
  // stop promotions from compounding with each other.
  const livePromotions = await getLivePromotions()
  const promoResult = livePromotions.length
    ? resolvePromotions(livePromotions, await cartLinesForPromotions(items))
    : { applied: [], discount: 0, freeShipping: false }

  let couponDiscount = 0
  if (couponCode) {
    // The coupon sees the post-promotion subtotal, so a percentage code cannot
    // be taken off money already discounted away.
    const couponResult = await validateCoupon(couponCode, subtotal - promoResult.discount, userId, client)
    // validateCoupon types its error as optional; a coupon rejected without a
    // reason still has to say something a customer can act on.
    if ('error' in couponResult) return { error: couponResult.error ?? 'That code cannot be used on this order' }
    couponDiscount = couponResult.discount
  }

  // A cart cannot cost less than nothing, however many offers stack.
  const discountAmount = Math.min(promoResult.discount + couponDiscount, subtotal)

  // Free shipping is a shipping change, not a discount — folding it into
  // discountAmount would double-count it against a total that still charged
  // for delivery.
  const effectiveShipping = promoResult.freeShipping ? 0 : shippingCost

  // GST, per line.
  //
  // Charged on what the customer actually pays for the goods, not the list
  // price: under s.15(3)(a) CGST a discount given at the time of supply and
  // shown on the invoice is excluded from the taxable value, so the order's
  // discount is apportioned across the lines before the rate is applied.
  //
  // Per line rather than per order because rates differ by product, and for
  // apparel by the price of the piece — a single store-wide percentage cannot
  // express either. Unmapped products fall back to gst_percentage so nothing
  // becomes untaxed by accident.
  const taxIsIgst = isInterState(settings.origin_state ?? 'Uttarakhand', destination.state)
  const taxResult = calculateTax({
    lines: items.map((item) => ({
      key: item.id,
      hsnCode: item.product.hsn_code ?? null,
      unitPrice: item.product.price + (item.variant?.price_adjustment ?? 0),
      quantity: item.quantity,
    })),
    rates: await getTaxRates(),
    fallbackRate: Number(settings.gst_percentage),
    discount: discountAmount,
    enabled: settings.enable_tax,
  })

  return {
    subtotal,
    promotions: promoResult.applied.map((p) => ({
      promotionId: p.promotionId, label: p.label, amount: p.amount,
    })),
    promotionDiscount: promoResult.discount,
    couponDiscount,
    discountAmount,
    shippingCost,
    effectiveShipping,
    freeShipping: promoResult.freeShipping,
    taxAmount: taxResult.totalTax,
    taxBreakdown: taxResult.breakdown,
    taxIsIgst,
    taxEnabled: settings.enable_tax,
    totalAmount: subtotal + effectiveShipping + taxResult.totalTax - discountAmount,
    taxByLine: new Map(
      taxResult.lines.map((l) => [l.key, {
        hsnCode: l.hsnCode, rate: l.rate, taxableValue: l.taxableValue, taxAmount: l.taxAmount,
      }])
    ),
  }
}
