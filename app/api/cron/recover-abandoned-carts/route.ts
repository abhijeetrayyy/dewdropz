import { NextResponse } from 'next/server'
import { recoverAbandonedCarts } from '@/lib/abandonedCarts'

// Emails customers whose carts have sat untouched past the abandonment window.
// Same shape and same gate as release-stale-orders: there is no admin session
// behind a scheduled job, so it is Bearer-token gated on CRON_SECRET and
// refuses everything when that is unset rather than running open to the world.
//
// Safe to run repeatedly — a cart is stamped before its email goes out and the
// sweep only ever looks at carts with no stamp, so a double-fired schedule
// cannot mail the same person twice.
//
// `?dryRun=1` reports who would be mailed without sending, which is the only
// sane way to point this at a real customer list the first time.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 })
  }

  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1'
  const result = await recoverAbandonedCarts({ dryRun })
  return NextResponse.json({ dryRun, ...result })
}
