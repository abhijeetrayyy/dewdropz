import 'server-only'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { sendShipmentNotificationEmail, sendOrderCancellationEmail, sendRefundEmail, sendPaymentFailedEmail } from '@/lib/email'
import { sendSlackAlert } from '@/lib/slack'

// The job runner.
//
// One table, one claim function, one cron route. It exists because everything
// outbound used to be inline and fire-and-forget — a failed order-confirmation
// email vanished with no record and no retry, on a path where the customer had
// already paid.
//
// **Every handler must be safe to run twice.** Retries are the point, so the
// contract is at-least-once, not exactly-once. A duplicate confirmation email
// is a far better failure than a missing one.

export type JobType =
  | 'order.confirmation'
  | 'order.cancellation'
  | 'order.refund'
  | 'order.shipped'
  | 'payment.failed'
  | 'slack.alert'
  // Rentals. Queued rather than done inline for the same reason the order ones
  // are: none of them may be allowed to fail the thing that triggered them. A
  // customer's payment must not be rolled back because a confirmation email
  // bounced, and — the sharper case — `rental.invoice` SPENDS A GST SERIAL
  // NUMBER, so it must run somewhere that retries rather than inside a request
  // that might not.
  | 'rental.paid'
  | 'rental.invoice'
  | 'rental.extended'
  | 'rental.reminder'
  | 'rental.dispatched'
  | 'rental.return_booked'
  | 'rental.deposit_settled'
  // Trek Buddy. Queued for the same reason, with a sharper edge: a host
  // pressing Cancel must always succeed. If the mail provider could fail it,
  // the host would believe the trip was still on — and so would the party.
  | 'trek.plan_cancelled'
  // Enqueued by a trigger on trek_reports (108), not by an action, so it covers
  // the scanner's own reports as well as the Report button — and those are the
  // ones that most need somebody to look.
  | 'trek.report_opened'

/** Longer each time, so a provider outage is waited out rather than hammered. */
const BACKOFF_MINUTES = [1, 5, 15, 60, 240]

/**
 * Queue a job.
 *
 * Never throws. A caller enqueuing an email must not be able to fail the
 * payment that triggered it — which was the whole problem with doing the work
 * inline in the first place.
 */
export async function enqueue(type: JobType, payload: Record<string, unknown> = {}, opts?: { runAt?: Date }) {
  try {
    const { error } = await createAdminSupabaseClient().from('jobs').insert({
      type,
      payload,
      run_at: (opts?.runAt ?? new Date()).toISOString(),
    })
    if (error) {
      // Falling back to a Slack alert rather than silence: if the queue itself
      // is unavailable, that is worth someone knowing about.
      await sendSlackAlert(`:rotating_light: Could not enqueue ${type}: ${error.message}`).catch(() => {})
      return { queued: false }
    }
    return { queued: true }
  } catch {
    return { queued: false }
  }
}

type Handler = (payload: Record<string, unknown>) => Promise<void>

/**
 * Handlers are resolved lazily inside the runner rather than imported at module
 * scope, because `order.confirmation` lives in a 'use server' file that imports
 * this one — importing it back at the top level would be a cycle.
 */
const HANDLERS: Record<JobType, Handler> = {
  'order.confirmation': async (p) => {
    const { sendOrderConfirmationIfFirstTime } = await import('@/lib/orderEmails')
    await sendOrderConfirmationIfFirstTime(String(p.orderId))
  },
  'order.cancellation': async (p) => {
    await sendOrderCancellationEmail({
      email: String(p.email),
      orderNumber: String(p.orderNumber),
      refunded: Boolean(p.refunded),
      refundAmount: p.refundAmount == null ? undefined : Number(p.refundAmount),
    })
  },
  'order.refund': async (p) => {
    await sendRefundEmail({
      email: String(p.email),
      orderNumber: String(p.orderNumber),
      amount: Number(p.amount),
      partial: Boolean(p.partial),
    })
  },
  'order.shipped': async (p) => {
    await sendShipmentNotificationEmail({
      email: String(p.email),
      orderNumber: String(p.orderNumber),
      carrier: String(p.carrier),
      trackingNumber: String(p.trackingNumber),
      trackingUrl: p.trackingUrl ? String(p.trackingUrl) : undefined,
    })
  },
  'payment.failed': async (p) => {
    await sendPaymentFailedEmail({ email: String(p.email), orderNumber: String(p.orderNumber) })
  },
  'slack.alert': async (p) => {
    await sendSlackAlert(String(p.text))
  },

  // ── Rentals ──────────────────────────────────────────────────────────────
  //
  // Imported lazily, like the order handlers above and for the same reason:
  // these live in 'use server' modules that import this one, so a top-level
  // import would be a cycle.

  'rental.paid': async (p) => {
    const { sendRentalPaidEmail } = await import('@/lib/rentalEmails')
    await sendRentalPaidEmail(String(p.bookingId))
  },

  // Spends a GST serial number. On the queue precisely so a failure retries
  // with backoff instead of taking a customer's payment down with it.
  'rental.invoice': async (p) => {
    const { issueInvoiceForRental } = await import('@/lib/invoicing')
    const result = await issueInvoiceForRental(String(p.bookingId))
    if ('refused' in result) {
      // A refusal is an expected outcome — the shop has no GSTIN yet, and every
      // call refuses until it does. Not an error, and deliberately not a retry:
      // retrying will refuse identically until a human changes something.
      console.info(`[rental.invoice] refused for ${p.bookingId}: ${result.refused}`)
    }
  },

  'rental.extended': async (p) => {
    const { sendRentalExtendedEmail } = await import('@/lib/rentalEmails')
    await sendRentalExtendedEmail(String(p.bookingId))
  },

  'rental.reminder': async (p) => {
    const { sendRentalReminderEmail } = await import('@/lib/rentalEmails')
    await sendRentalReminderEmail(String(p.bookingId), p.kind as 'starting' | 'due' | 'overdue')
  },

  'rental.dispatched': async (p) => {
    const { sendRentalDispatchEmail } = await import('@/lib/rentalEmails')
    await sendRentalDispatchEmail(String(p.bookingId))
  },

  'rental.return_booked': async (p) => {
    const { sendRentalReturnLegEmail } = await import('@/lib/rentalEmails')
    await sendRentalReturnLegEmail(String(p.bookingId))
  },

  'rental.deposit_settled': async (p) => {
    const { sendRentalDepositSettledEmail } = await import('@/lib/rentalEmails')
    await sendRentalDepositSettledEmail(String(p.bookingId))
  },

  // ── Trek Buddy ───────────────────────────────────────────────────────────

  'trek.plan_cancelled': async (p) => {
    const { sendTrekCancellationEmails } = await import('@/lib/trekEmails')
    await sendTrekCancellationEmails(String(p.planId))
  },

  // Returns without sending when RESEND_API_KEY is unset, and says so on the
  // console. Deliberately not a throw: a missing key is a configuration fact,
  // not a transient failure, and retrying it five times with backoff would fill
  // /admin/jobs with identical errors until somebody stopped reading it. The
  // report is safe in the queue either way — the email is a nudge toward it,
  // never the record of it.
  'trek.report_opened': async (p) => {
    const { sendTrekReportAlert } = await import('@/lib/trekEmails')
    await sendTrekReportAlert(String(p.reportId))
  },
}

type JobRow = {
  id: string
  type: JobType
  payload: Record<string, unknown>
  attempts: number
  max_attempts: number
}

/**
 * Run one batch of due jobs.
 *
 * Claiming is done by `claim_jobs`, which uses FOR UPDATE SKIP LOCKED so two
 * overlapping runs cannot pick up the same job and send the same email twice.
 */
export async function runDueJobs({ batchSize = 20 }: { batchSize?: number } = {}) {
  const admin = createAdminSupabaseClient()

  // Anything a dead process left mid-flight goes back in the queue first,
  // otherwise it sits in 'running' forever: not pending so nothing retries it,
  // not failed so nothing reports it.
  const { data: released } = await admin.rpc('release_stuck_jobs', { timeout_minutes: 15 })

  const { data, error } = await admin.rpc('claim_jobs', { batch_size: batchSize })
  if (error) return { error: error.message, claimed: 0, done: 0, failed: 0, retrying: 0, released: Number(released ?? 0) }

  const jobs = (data ?? []) as JobRow[]
  let done = 0, failed = 0, retrying = 0

  for (const job of jobs) {
    const handler = HANDLERS[job.type]
    if (!handler) {
      // An unknown type is a deploy problem, not a transient one — retrying it
      // every minute forever would just bury the real failures.
      await admin.from('jobs').update({
        status: 'failed', last_error: `No handler registered for "${job.type}"`, completed_at: new Date().toISOString(),
      }).eq('id', job.id)
      failed++
      continue
    }

    try {
      await handler(job.payload)
      await admin.from('jobs').update({
        status: 'done', last_error: null, locked_at: null, completed_at: new Date().toISOString(),
      }).eq('id', job.id)
      done++
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      const exhausted = job.attempts >= job.max_attempts
      const backoff = BACKOFF_MINUTES[Math.min(job.attempts - 1, BACKOFF_MINUTES.length - 1)] ?? 60
      await admin.from('jobs').update({
        status: exhausted ? 'failed' : 'pending',
        last_error: message.slice(0, 500),
        locked_at: null,
        run_at: new Date(Date.now() + backoff * 60_000).toISOString(),
        ...(exhausted ? { completed_at: new Date().toISOString() } : {}),
      }).eq('id', job.id)

      if (exhausted) {
        failed++
        // A job that has run out of attempts is a thing a human now has to do
        // by hand, so it has to be said out loud rather than left in a table.
        await sendSlackAlert(`:x: Job ${job.type} failed permanently after ${job.attempts} attempts: ${message}`).catch(() => {})
      } else {
        retrying++
      }
    }
  }

  return { claimed: jobs.length, done, failed, retrying, released: Number(released ?? 0) }
}
