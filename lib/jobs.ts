import 'server-only'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { sendOrderCancellationEmail, sendRefundEmail, sendPaymentFailedEmail } from '@/lib/email'
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
  | 'payment.failed'
  | 'slack.alert'

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
    const { sendOrderConfirmationIfFirstTime } = await import('@/actions/orders')
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
  'payment.failed': async (p) => {
    await sendPaymentFailedEmail({ email: String(p.email), orderNumber: String(p.orderNumber) })
  },
  'slack.alert': async (p) => {
    await sendSlackAlert(String(p.text))
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
