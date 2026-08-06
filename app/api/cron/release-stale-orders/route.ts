import { NextResponse } from 'next/server'
import { releaseAllStaleOrders } from '@/lib/orders-internal'

// Recovers stock (and coupon usage) locked by abandoned stripe/razorpay
// checkouts — cart decrements stock at order-creation time, before payment
// confirms, and until now the only release path was opportunistic (a signed-
// in user's own next cart visit), which never covers guest checkouts or
// anyone who never comes back. This is the real sweep, meant to be hit on a
// schedule rather than per-request.
//
// Bearer-token gated rather than requireAdmin() since there's no admin
// session calling this — it's an external scheduler (Vercel Cron, an
// external cron service, GitHub Actions, etc.) hitting a public URL. Set
// CRON_SECRET in the environment and configure your scheduler to send
// `Authorization: Bearer <CRON_SECRET>`. Without CRON_SECRET set, this
// route refuses every request rather than silently running unauthenticated.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 })
  }

  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const released = await releaseAllStaleOrders()
  return NextResponse.json({ released })
}
