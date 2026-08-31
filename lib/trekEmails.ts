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
