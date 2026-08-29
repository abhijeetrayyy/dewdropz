import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createRentalBooking } from '@/actions/rentals'

/**
 * Reserving gear from the phone.
 *
 * The write itself is `createRentalBooking` — the same server action the web
 * booking form calls — so the exclusion constraint, the unit assignment, the
 * cleaning buffer and the deposit-outside-tax rule are enforced once, in one
 * place, for both surfaces. If this endpoint re-implemented any of that, the
 * two would eventually disagree about who has the last tent.
 *
 * The bearer token is OPTIONAL and is used only to attach the booking to an
 * account, so it appears under "Your rentals" and the RLS policy on
 * `rental_bookings` lets that person read it back. A guest can still book with
 * an email, exactly as on the web; an expired token degrades to a guest
 * booking rather than refusing one.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Could not read that request.' }, { status: 400 })
  }

  let userId: string | null = null
  const auth = request.headers.get('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (token) {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data } = await anon.auth.getUser(token)
    userId = data?.user?.id ?? null
  }

  const res = await createRentalBooking({ ...body, userId })
  if (!res.ok) {
    // 409, not 400, when somebody else took the last one between the quote and
    // the tap — the request was well formed, the world moved. The action says
    // so with a `code`; an earlier version of this line matched the message
    // text instead and got it wrong, answering 400 for a sold-out hire because
    // the real sentence ("… is not free between …") matched none of its
    // patterns. Prose is for people, not for control flow.
    const status = res.code === 'unavailable' ? 409 : 400
    return NextResponse.json({ error: res.error, code: res.code }, { status })
  }
  return NextResponse.json({ bookingId: res.bookingId, bookingNumber: res.bookingNumber })
}
