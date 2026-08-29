import { NextRequest, NextResponse } from 'next/server'
import { quoteRental, getRentalAvailability } from '@/actions/rentals'

/**
 * What a hire costs, and whether the gear is actually free — both answered here.
 *
 * The phone asks; it never works either out. This is the same rule the cart
 * quote endpoint next door was written to restore after the app spent months
 * quoting `subtotal + FLAT_SHIPPING_RATE` and a courier turned up asking for
 * ₹178 more than the screen had shown. Rentals have more moving parts than a
 * cart — inclusive day counting, a long-hire discount, return postage charged
 * both ways, and a deposit that must stay outside the taxable base — so the
 * chance of two implementations drifting is higher, not lower.
 *
 * `quoteRental` calls `priceRental`, which is the same function
 * `createRentalBooking` bills against. Availability comes from
 * `rental_available_units`, the same database function the booking write uses.
 * So the price shown on the phone and the shelf shown on the phone cannot
 * disagree with the ones the booking is made against.
 *
 * Availability is folded into this response rather than left to a second
 * request because the two are read together on one screen and must describe
 * the SAME dates — fetched separately they can straddle somebody else's
 * booking and show a price for gear that is no longer there.
 *
 * Unauthenticated by design, like the rest of the mobile read surface: someone
 * deciding whether to hire a tent should see the real figure before signing in.
 * Nothing is written, and no rupee in the response comes from the request.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Could not read that request.' }, { status: 400 })
  }

  const quote = await quoteRental(body)
  if (!quote.ok) return NextResponse.json({ error: quote.error }, { status: 400 })

  // One availability count per distinct item, for the dates just priced.
  const lines = Array.isArray(body.lines) ? body.lines : []
  const availability: Record<string, number> = {}
  for (const line of quote.price.lines) {
    const source = lines.find((l: { slug?: string }) => l?.slug === line.slug)
    if (!source?.startsOn || !source?.endsOn) continue
    const a = await getRentalAvailability(line.itemId, source.startsOn, source.endsOn)
    availability[line.slug] = a.available
  }

  return NextResponse.json({ price: quote.price, availability })
}
