import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cancellationQuoteFor, cancelBookingFor } from '@/lib/rentalCancel'

/**
 * Cancelling a rental from the phone — and, first, being told what it costs.
 *
 * TWO METHODS ON ONE ROUTE, DELIBERATELY. `GET` prices the cancellation and
 * `POST` performs it, against the same booking, through the same library the
 * web account screen calls. The app must be able to show the figure BEFORE the
 * button is pressed, for exactly the reason the web dialog does: the person
 * pressing it has paid, and finding out what came back from a bank statement
 * four days later is how a cancellation becomes a chargeback.
 *
 * Separating them into two routes would have let the two drift — one pricing
 * with the grace window and the other without — which is the failure the shared
 * library exists to prevent in the first place.
 *
 * IDENTITY COMES FROM THE VERIFIED TOKEN, NEVER THE BODY. `cancelBookingFor`
 * takes a user id as a parameter, which is the same shape as the
 * `claimGuestRentalBookings` defect; what makes it safe is that the only thing
 * that ever reaches it is a subject id this route just verified against the
 * auth server. The booking id in the URL is a claim and is checked against that
 * id inside the library, so a valid token for one account cannot cancel
 * another's booking.
 */
async function userFrom(request: NextRequest): Promise<{ id: string } | null> {
  const auth = request.headers.get('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data, error } = await anon.auth.getUser(token)
  if (error || !data?.user?.id) return null
  return { id: data.user.id }
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await userFrom(request)
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })

  const { id } = await ctx.params
  const quote = await cancellationQuoteFor(id, user.id)
  // 404 for "not yours" as well as "not there". The two must be
  // indistinguishable or this becomes a way to test whether a booking id exists.
  if (!quote) return NextResponse.json({ error: 'That booking could not be found.' }, { status: 404 })
  return NextResponse.json(quote)
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await userFrom(request)
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })

  const { id } = await ctx.params
  const res = await cancelBookingFor(id, user.id)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
  return NextResponse.json({ ok: true, refunded: res.refunded })
}
