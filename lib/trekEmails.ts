import 'server-only'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://dewdropz.shop').replace(/\/$/, '')

/**
 * What Trek Buddy says to somebody who is not looking at the site.
 *
 * WHY THIS EXISTS
 *
 * Migration 052 names one message that must never be missed — the trip you were
 * confirmed on has been cancelled — and says so in the course of explaining why
 * `notification_preferences` gained a `trek_buddy` key with a default of true,
 * because "an existing customer would silently receive nothing, including the
 * one message that must never be missed."
 *
 * It then only ever wrote a row into `trek_notifications`. That row renders as
 * an unread count in the top bar of a site the person has to open. The whole
 * point of a cancellation is that it reaches somebody who is otherwise about to
 * set an alarm for 04:00 and drive to a meeting point where nobody is coming.
 * The one notification with a deadline was the one with no delivery.
 *
 * ON THE QUEUE, NOT INLINE
 *
 * Sent through `lib/jobs.ts` for the reason every other email here is: a mail
 * provider having a bad afternoon must not be able to fail the cancellation
 * itself. A host pressing Cancel must always succeed — if it does not, they will
 * assume the trip is still on, and so will everybody else.
 *
 * This does NOT breach the "no cron jobs at this stage" constraint. It adds no
 * schedule: `app/api/cron/run-jobs` already exists and already drains this
 * queue for the shop. Nothing new is swept, and no state is maintained by a
 * timer — the constraint is about deriving state rather than sweeping it, and
 * an outbound message is not state.
 *
 * ON THE PREFERENCE
 *
 * `lib/notifications.ts` checks `notification_preferences` before writing, and
 * that is right for an order update or a promotion. This one deliberately does
 * NOT check it. A cancellation is safety information about a plan the person
 * already committed to, not a message from the shop, and a toggle in a settings
 * screen should not be able to send somebody to a trailhead at dawn to meet
 * nobody. It looks like a bug, which is why it is written down here.
 */

/**
 * Email is the one place on this surface where member-supplied text is
 * interpolated into markup. `cancel_reason`, `place` and the host's display
 * name are all free text, and an unescaped `<a href>` in a cancellation notice
 * is a phishing message with the board's own name at the top of it.
 */
function esc(s: string | null | undefined): string {
  return (s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  )
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'Asia/Kolkata',
  })

/**
 * Tell everyone who was going that it is off.
 *
 * Reads the party at send time rather than taking a list from the caller: the
 * roster is the database's answer, and by the time this runs the cancellation
 * has already been committed by `trek_cancel_plan`.
 *
 * Safe to run twice — the queue is at-least-once, and a second copy of "your
 * trip is cancelled" is a far better failure than none.
 */
export async function sendTrekCancellationEmails(planId: string) {
  const db = createAdminSupabaseClient()

  const { data: plan } = await db
    .from('trek_plans')
    .select('id, host_id, host_name, place, activity, starts_at, status, cancel_reason')
    .eq('id', planId)
    .maybeSingle()

  if (!plan) return
  // Only ever sent for a plan that really is cancelled. Guards against a
  // mis-queued job telling a party their trip is off while it is still on.
  if (plan.status !== 'cancelled') return

  // The confirmed party, and the people still waiting on a decision — a
  // waitlisted member has also been holding the date, and dropping them from
  // this is how somebody ends up driving to a trailhead for a trip that was
  // called off a week ago.
  const { data: rows } = await db
    .from('trek_plan_requests')
    .select('user_id, status')
    .eq('plan_id', planId)
    .in('status', ['confirmed', 'waitlisted'])

  const ids = (rows ?? []).map((r) => r.user_id as string).filter((id) => id !== plan.host_id)
  if (ids.length === 0) return

  const { data: people } = await db
    .from('profiles')
    .select('id, email, trek_display_name')
    .in('id', ids)

  const reason = (plan.cancel_reason ?? '').trim()

  for (const person of people ?? []) {
    const email = (person as { email?: string }).email
    if (!email) continue

    await sendEmail({
      to: email,
      subject: `Cancelled — ${plan.place} on ${when(plan.starts_at as string)}`,
      // The trek surface keeps its own palette on purpose (council constraint
      // 3.9): forest #1F4A2E, not the shop's greens. This is the board writing,
      // not the shop.
      html: `
        <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px 20px;color:#0F1210;">
          <h1 style="font-size:24px;letter-spacing:-0.3px;margin:0 0 4px;">TrekBuddy</h1>
          <p style="margin:0;color:#1F4A2E;font-style:italic;">A trip you were going on has been cancelled.</p>
          <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;" />
          <p style="font-size:16px;margin:0 0 6px;"><strong>${esc(plan.place as string)}</strong></p>
          <p style="font-size:14px;color:#555;margin:0 0 18px;">
            ${esc(when(plan.starts_at as string))} · hosted by ${esc(plan.host_name as string)}
          </p>
          ${
            reason
              ? `<p style="font-size:14px;color:#555;margin:0 0 18px;">
                   The host gave a reason: &ldquo;${esc(reason)}&rdquo;
                 </p>`
              : `<p style="font-size:14px;color:#555;margin:0 0 18px;">
                   The host did not give a reason.
                 </p>`
          }
          <p style="font-size:14px;color:#555;margin:0 0 18px;">
            You do not need to do anything. Nobody will be at the meeting point.
          </p>
          <p style="margin:0 0 24px;">
            <a href="${SITE_URL}/trek-buddy/discover"
               style="display:inline-block;background:#1F4A2E;color:#FAFAF8;text-decoration:none;
                      padding:12px 20px;border-radius:8px;font-family:Helvetica,Arial,sans-serif;
                      font-size:14px;">See what else is going out</a>
          </p>
          <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;" />
          <p style="font-size:12px;color:#999;margin:0;">
            You are getting this because you were on this trip. Cancellations are
            always sent, whatever your notification settings say.
          </p>
        </div>
      `,
      text:
        `A trip you were going on has been cancelled.\n\n` +
        `${plan.place} — ${when(plan.starts_at as string)}, hosted by ${plan.host_name}\n\n` +
        (reason ? `The host gave a reason: "${reason}"\n\n` : `The host did not give a reason.\n\n`) +
        `You do not need to do anything. Nobody will be at the meeting point.\n\n` +
        `${SITE_URL}/trek-buddy/discover\n`,
    })
  }
}

/**
 * Is there a mailer at all?
 *
 * `RESEND_API_KEY` is not set in this environment yet. Everything below is
 * written to work the moment it is, and to fail QUIETLY and VISIBLY until then
 * rather than loudly and uselessly: a missing key is a configuration fact, not
 * a transient error, so retrying it five times with backoff would fill
 * /admin/jobs with identical failures and teach whoever reads that screen to
 * ignore it.
 *
 * The same shape `rental.invoice` already uses for a missing GSTIN: an expected
 * refusal, logged, deliberately not a retry.
 */
export const mailerConfigured = () => Boolean(process.env.RESEND_API_KEY)

/** Everyone who can actually work the queue. */
async function adminRecipients(): Promise<string[]> {
  // Read from `profiles.role` rather than an ADMIN_EMAILS environment variable.
  // `.env.example` declares one and nothing in the codebase has ever read it,
  // and an env var is a second list that goes stale the day somebody is made an
  // admin — the role is the thing the rest of the product already trusts.
  const { data } = await createAdminSupabaseClient()
    .from('profiles')
    .select('email')
    .eq('role', 'admin')
  return (data ?? []).map((r) => (r as { email?: string }).email).filter((e): e is string => !!e)
}

const REASON_LABEL: Record<string, string> = {
  unsafe: 'Unsafe',
  harassment: 'Harassment',
  spam: 'Spam',
  impersonation: 'Impersonation',
  not_real: 'Not a real trip',
  other: 'Other',
}

/**
 * Tell the admins a report is open.
 *
 * WHAT THIS EMAIL DELIBERATELY DOES NOT CONTAIN
 *
 * Not the reported text, not the reporter's name, and not the subject's name.
 * It carries the category, the source and a link. Two reasons, and the second
 * is the one that matters:
 *
 *   1. A moderation decision should be made on the screen that records it. An
 *      admin who has already formed a view from an email arrives at the queue
 *      to confirm it rather than to read it.
 *   2. Email is the least controlled surface this product touches — forwarded,
 *      synced to phones, sitting in an inbox on a shared laptop. The excerpt of
 *      a harassment report is exactly the content this board works hardest to
 *      contain, and copying it into a mailbox undoes that for no gain.
 *
 * The link does the work. The queue holds the evidence.
 */
export async function sendTrekReportAlert(reportId: string) {
  if (!mailerConfigured()) {
    console.info(
      `[trek.report_opened] RESEND_API_KEY is not set — no alert sent for report ${reportId}. ` +
      `The report itself is safe in the queue at ${SITE_URL}/admin/trek-buddy.`
    )
    return
  }

  const db = createAdminSupabaseClient()
  const { data: report } = await db
    .from('trek_reports')
    .select('id, reason, source, field, plan_id, created_at, resolved_at')
    .eq('id', reportId)
    .maybeSingle()

  if (!report) return
  // Somebody got there first. The queue is worked by people, and an email about
  // a report that is already dealt with trains its readers to ignore the next.
  if (report.resolved_at) return

  const to = await adminRecipients()
  if (to.length === 0) {
    console.warn(`[trek.report_opened] no profile has role='admin' — report ${reportId} will be seen by nobody.`)
    return
  }

  const auto = report.source === 'auto'
  const reason = REASON_LABEL[report.reason as string] ?? 'Report'
  const { count } = await db
    .from('trek_reports')
    .select('id', { count: 'exact', head: true })
    .is('resolved_at', null)

  const subject = auto
    ? `TrekBuddy — the scan flagged something (${reason})`
    : `TrekBuddy — a member reported something (${reason})`

  await sendEmail({
    to,
    subject,
    // Idempotent on the report, so the at-least-once queue cannot send the same
    // alert twice if a run is interrupted between sending and marking done.
    idempotencyKey: `trek-report-${reportId}`,
    html: `
      <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px 20px;color:#0F1210;">
        <h1 style="font-size:24px;letter-spacing:-0.3px;margin:0 0 4px;">TrekBuddy</h1>
        <p style="margin:0;color:#8A5A17;font-style:italic;">Something is waiting in the queue.</p>
        <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;" />
        <p style="font-size:15px;margin:0 0 6px;">
          <strong>${esc(reason)}</strong> — ${auto ? 'caught by the content scan' : 'reported by a member'}
        </p>
        ${report.field ? `<p style="font-size:14px;color:#555;margin:0 0 6px;">Field: ${esc(String(report.field))}</p>` : ''}
        <p style="font-size:14px;color:#555;margin:0 0 18px;">
          ${count ?? 1} ${(count ?? 1) === 1 ? 'report is' : 'reports are'} open.
        </p>
        <p style="font-size:14px;color:#555;margin:0 0 18px;">
          The details are not in this email on purpose. Open the queue to read it and decide.
        </p>
        <p style="margin:0 0 24px;">
          <a href="${SITE_URL}/admin/trek-buddy"
             style="display:inline-block;background:#1F4A2E;color:#FAFAF8;text-decoration:none;
                    padding:12px 20px;border-radius:8px;font-family:Helvetica,Arial,sans-serif;
                    font-size:14px;">Open the queue</a>
        </p>
        <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;" />
        <p style="font-size:12px;color:#999;margin:0;">
          You are getting this because your account is an admin. A report that nobody reads is
          the one thing this board promises not to do.
        </p>
      </div>
    `,
    text:
      `TrekBuddy — something is waiting in the queue.\n\n` +
      `${reason} — ${auto ? 'caught by the content scan' : 'reported by a member'}\n` +
      (report.field ? `Field: ${report.field}\n` : '') +
      `${count ?? 1} open.\n\n` +
      `The details are deliberately not in this email. Open the queue to read it and decide:\n` +
      `${SITE_URL}/admin/trek-buddy\n`,
  })
}
