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

  // Without a mail transport this sweep is destructive, not merely useless.
  // Each cart is stamped with `recovery_sent_at` *before* its email goes out
  // (see lib/abandonedCarts.ts — stamping afterwards would risk a mail loop),
  // and the query only ever looks at carts where that stamp is NULL. So a run
  // with RESEND_API_KEY unset marks every abandoned cart as reminded, sends
  // nothing, and no future run will ever pick those customers up again.
  //
  // Scheduling this hourly made that reachable without anybody deciding to,
  // which is why the refusal lives here rather than in the workflow: the
  // workflow cannot see the server's environment, and this endpoint should be
  // just as safe to curl by hand.
  //
  // Dry runs are exempt. They neither send nor stamp, and previewing the list
  // is exactly what an operator wants before wiring up Resend.
  if (!dryRun && !process.env.RESEND_API_KEY) {
    return NextResponse.json(
      {
        error: 'RESEND_API_KEY is not configured',
        detail:
          'Refusing to run: carts are stamped before sending, so this would consume the recovery list without mailing anyone.',
        hint: 'Add ?dryRun=1 to preview who would be emailed.',
      },
      { status: 503 }
    )
  }

  const result = await recoverAbandonedCarts({ dryRun })
  return NextResponse.json({ dryRun, ...result })
}
