import { NextResponse } from 'next/server'
import { runRentalReminders } from '@/actions/rentalOps'

/**
 * The daily reminder sweep.
 *
 * Three messages, each preventing a different problem: a rental starting
 * tomorrow that nobody turns up for, a rental due back tomorrow whose late fee
 * would otherwise start accruing in silence, and one that is already overdue.
 *
 * RUN IT ONCE A DAY, in the morning, IST. It is safe to run more often — each
 * booking is claimed by writing its own reminder timestamp in the same UPDATE
 * that selects it, so two overlapping runs cannot both send — but there is
 * nothing to gain: the windows are whole days.
 *
 * Bearer-token gated like every other cron route here, because the caller is a
 * scheduler hitting a public URL rather than an admin session. Without
 * CRON_SECRET set it refuses every request rather than running unauthenticated.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 })
  }

  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // REFUSE TO RUN IF MAIL IS NOT CONFIGURED.
  //
  // This sweep stamps `reminder_*_at` as it claims each booking, and those
  // claims are one-shot by design — nothing ever looks at a claimed booking
  // again. So a run with no mail provider does not "send nothing"; it
  // permanently consumes every pending reminder in the database and the
  // customers are never warned.
  //
  // `recover-abandoned-carts` already refuses for exactly this reason and this
  // route, which has the same stamp-before-send shape, did not.
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: 'RESEND_API_KEY is not configured — refusing to burn reminder claims on mail that cannot be sent.' },
      { status: 503 },
    )
  }

  const counts = await runRentalReminders()
  return NextResponse.json({ ok: true, ...counts })
}
