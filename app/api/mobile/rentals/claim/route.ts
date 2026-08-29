import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { claimGuestRentalBookings } from '@/actions/rentals'

/**
 * The app's version of the same claim the web sign-in form makes.
 *
 * The email is taken from the VERIFIED token, never from the request body —
 * otherwise this would hand any signed-in person every guest booking made under
 * an address they simply typed.
 */
export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data, error } = await anon.auth.getUser(token)
  if (error || !data?.user?.email) {
    return NextResponse.json({ error: 'That session has expired.' }, { status: 401 })
  }

  const { claimed } = await claimGuestRentalBookings(data.user.id, data.user.email)
  return NextResponse.json({ claimed })
}
