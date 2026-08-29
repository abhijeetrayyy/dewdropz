import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { adoptLocalCart } from '@/actions/cartAdoption'

/**
 * The app's guest cart, taken over by the account that just signed in.
 *
 * The same `adoptLocalCart` the web sign-in form calls, so both surfaces merge
 * by one rule: the union wins, identical lines add their quantities, and the
 * merged cart comes back for the client to adopt. Two implementations of "what
 * happens to my cart when I sign in" would drift, and the drift would be
 * somebody's order.
 *
 * AUTHENTICATED, unlike the rest of the mobile surface. Everything else here is
 * open because it only reads a catalogue; this writes to a named person's cart,
 * so the bearer token is the whole point — the user id comes from the verified
 * token and never from the request body.
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
  if (error || !data?.user) {
    return NextResponse.json({ error: 'That session has expired.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const lines = Array.isArray(body?.lines) ? body.lines : []

  const { items } = await adoptLocalCart(lines, data.user.id)
  return NextResponse.json({ items })
}
