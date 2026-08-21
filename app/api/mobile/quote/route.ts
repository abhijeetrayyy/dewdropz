import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { mobileQuoteSchema } from '@/lib/validations'
import { priceCheckout, type PricedCartItem } from '@/lib/checkoutPricing'
import { stateForPincode } from '@/lib/pincode-zones'
import { matchVariantForSize } from '@/lib/variantMatch'

// What a mobile cart costs — answered by the same function that bills it.
//
// The app used to work this out on the device: `subtotal + FLAT_SHIPPING_RATE`,
// from two constants in mobile/lib/constants.ts. That is the exact mistake
// lib/checkoutPricing.ts was written to prevent, and its header says so:
// "Two implementations of the same pricing rules drift, and the day they drift
// the shop either quotes less than it charges or charges more than it quoted."
//
// It had drifted. Measured against the live tax_rates and store_settings, the
// app quoted ₹2,049 for a hoodie the server bills at ₹2,226.88 — GST is
// additive and was missing entirely, and the hardcoded ₹150 delivery is a
// server default of ₹100. Payment is cash on delivery, so the gap was not an
// accounting curiosity: a courier turned up asking for ₹178 more than the
// screen had shown.
//
// So this endpoint exists to have exactly one pricing engine again. It calls
// `priceCheckout` — the same call `createOrder` makes — and the app renders
// what comes back without doing arithmetic on it.
//
// NOTHING HERE TRUSTS THE CLIENT WITH A PRICE. The request carries slugs,
// quantities and ids; every rupee is resolved from the database. A tampered
// request can change what is being priced, never what it costs.
//
// UNAUTHENTICATED BY DESIGN, matching the rest of the mobile surface: a shopper
// can fill a cart before signing in and deserves to see the real total while
// deciding. A bearer token is read when present, because a coupon's usage
// limits are per-customer.

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = mobileQuoteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Could not read that cart.' }, { status: 400 })
  }
  const input = parsed.data

  // Optional identity, for coupon eligibility only. An invalid token is
  // treated as a guest rather than refused: a stale session should not stop
  // somebody seeing what their cart costs.
  let userId: string | undefined
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (token) {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data } = await anon.auth.getUser(token)
    userId = data?.user?.id
  }

  const admin = createAdminSupabaseClient()

  // Resolve the cart against the database. `slug` is the key the app has for
  // every line; `variantId` arrives on lines that know it and is matched from
  // the size only for older saved carts, exactly as syncLocalCartToDbCart does.
  const slugs = [...new Set(input.items.map((i) => i.slug))]
  const { data: products } = await admin
    .from('products')
    .select('id, slug, price, collection_id, weight, hsn_code, variants:product_variants(id, name, price_adjustment)')
    .in('slug', slugs)
    .eq('status', 'active')
    .is('deleted_at', null)

  type Row = {
    id: string
    slug: string
    price: number
    collection_id: string | null
    weight: number | null
    hsn_code: string | null
    variants: { id: string; name: string; price_adjustment: number | null }[] | null
  }
  const bySlug = new Map((products ?? []).map((p) => [(p as unknown as Row).slug, p as unknown as Row]))

  const items: PricedCartItem[] = []
  // Lines whose product no longer exists or is no longer for sale. Returned so
  // the app can say which, rather than quietly pricing a smaller cart than the
  // one on screen — the same failure M-03 fixes at checkout.
  const unavailable: string[] = []

  for (const [index, line] of input.items.entries()) {
    const p = bySlug.get(line.slug)
    if (!p) {
      unavailable.push(line.slug)
      continue
    }
    const variant =
      (line.variantId ? p.variants?.find((v) => v.id === line.variantId) : null) ??
      matchVariantForSize(p.variants, line.size ?? '') ??
      null

    items.push({
      // priceCheckout keys per-line tax by this id. The app has no cart-item
      // row ids, so the index is a stable key within one quote.
      id: `line-${index}`,
      quantity: line.quantity,
      product: {
        slug: p.slug,
        price: p.price,
        collection_id: p.collection_id,
        weight: p.weight,
        hsn_code: p.hsn_code,
      },
      variant: variant ? { price_adjustment: variant.price_adjustment ?? 0 } : null,
    })
  }

  if (items.length === 0) {
    return NextResponse.json({ error: 'Nothing in this cart is available any more.' }, { status: 400 })
  }

  // Shipping zone and GST place-of-supply both need a destination. A cart
  // screen has none yet — `known: false` tells the app to say so rather than
  // print a number that will change.
  const state = input.state ?? (input.postalCode ? stateForPincode(input.postalCode) : null)

  const priced = await priceCheckout({
    items,
    destination: { state, country: 'India' },
    couponCode: input.couponCode,
    userId,
    client: admin,
  })

  if ('error' in priced) {
    return NextResponse.json({ error: priced.error }, { status: 400 })
  }

  return NextResponse.json({
    // `taxByLine` is a Map and is for order_items, not for a customer — it is
    // deliberately not serialised here.
    subtotal: priced.subtotal,
    discountAmount: priced.discountAmount,
    promotions: priced.promotions,
    shippingCost: priced.shippingCost,
    effectiveShipping: priced.effectiveShipping,
    freeShipping: priced.freeShipping,
    taxAmount: priced.taxAmount,
    taxBreakdown: priced.taxBreakdown,
    taxIsIgst: priced.taxIsIgst,
    taxEnabled: priced.taxEnabled,
    totalAmount: priced.totalAmount,
    /** False until a destination is known: shipping and tax both depend on one. */
    destinationKnown: Boolean(state),
    unavailable,
  })
}
