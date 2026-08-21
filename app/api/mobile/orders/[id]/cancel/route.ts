import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { cancelOrderInternal } from '@/lib/orders-internal'

// Cancelling your own order, from the app.
//
// The app could not do this at all: `lib/queries.ts` had five mutations —
// notifications, preferences, a review and checkout — and nothing that could
// change an order after it was placed. A customer who ordered the wrong size at
// 2am had to email.
//
// `actions/orders.ts:cancelOrder` already does this for the web, but it checks
// ownership through `createServerSupabaseClient()`, which on a token-authed
// request has no cookie session and so finds nothing — it would return "Order
// not found" for every order that exists. So ownership is checked here against
// the token-verified user, and the shared reversal (`cancelOrderInternal`,
// which restores stock, releases any coupon and refunds a captured charge) is
// reused rather than reimplemented.
//
// WHAT MAY BE CANCELLED is not this route's decision. `cancelOrderInternal`
// owns the status rules; anything it refuses comes back in its own words.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user }, error: authError } = await anon.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const reason = typeof body?.reason === 'string' ? body.reason.slice(0, 300) : undefined

  const admin = createAdminSupabaseClient()

  // Ownership, against the token's user. This runs on the admin client where
  // RLS is not enforced, so the `eq('user_id', ...)` is the only thing standing
  // between a request and somebody else's order.
  const { data: owned } = await admin
    .from('orders')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!owned) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const result = await cancelOrderInternal(id, { reason, cancelledBy: 'customer' })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })

  return NextResponse.json({ success: true, refundIssued: result.refundIssued })
}
