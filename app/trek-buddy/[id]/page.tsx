import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import { getTrekMembership, getTrekPlan } from '@/actions/trekBuddy'
import PlanActions from './PlanActions'
import SafetyNotes from '@/components/trek/SafetyNotes'
import { DAY_PART_LABEL, ACTIVITY_BY_KEY, EFFORT_LABEL, type TrekActivity } from '@/lib/trek'

export const metadata: Metadata = {
  title: 'A walk — DEWDROPZ',
  robots: { index: false, follow: false },
}

/** One label map, shared with the board and the form — a local copy here is how
 *  camping ended up rendering as "camping". */
const activityLabel = (a: string) => ACTIVITY_BY_KEY[a as TrekActivity]?.label ?? a

function istDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}
const hhmm = (t: string) => t.slice(0, 5)

export default async function TrekPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const membership = await getTrekMembership()
  if (!membership.signedIn) redirect(`/auth/login?redirect=/trek-buddy/${id}`)
  if (!membership.onboarded) redirect('/trek-buddy/setup')

  const data = await getTrekPlan(id)
  if (!data) notFound()

  const { plan, isHost, myStatus, meetingPoint, logistics, roster } = data
  const full = plan.spots_left <= 0
  const cancelled = plan.status === 'cancelled'
  const confirmed = myStatus === 'confirmed'

  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-paper px-6 pb-24 pt-32 md:px-10">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/trek-buddy"
            className="font-body text-[10px] uppercase tracking-[0.14em] text-mid transition-colors hover:text-text"
          >
            ← All walks
          </Link>

          {cancelled && (
            <div className="mt-6 border-l-2 border-clay bg-clay/5 px-4 py-3">
              <p className="font-body text-sm text-text">
                This walk was cancelled{plan.cancel_reason ? ` — ${plan.cancel_reason}` : '.'}
              </p>
            </div>
          )}

          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-forest">
            {activityLabel(plan.activity)} · {EFFORT_LABEL[plan.effort]}
          </p>
          <h1 className="mt-3 font-display text-[clamp(30px,5vw,46px)] leading-tight text-text">
            {plan.place}
          </h1>

          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-y border-rule py-6 sm:grid-cols-3">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-mid">Date</dt>
              <dd className="mt-1 font-body text-sm text-text">{istDay(plan.starts_at)}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-mid">Start</dt>
              <dd className="mt-1 font-body text-sm text-text tabular-nums">{hhmm(plan.start_time)}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-mid">Back by</dt>
              <dd className="mt-1 font-body text-sm text-text tabular-nums">{hhmm(plan.back_by)}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-mid">Meet around</dt>
              <dd className="mt-1 font-body text-sm text-text">{plan.meet_area}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-mid">Going</dt>
              <dd className="mt-1 font-body text-sm text-text tabular-nums">
                {plan.going_count} of {plan.capacity}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-mid">Host</dt>
              <dd className="mt-1 font-body text-sm text-text">{plan.host_name}</dd>
            </div>
          </dl>

          {plan.note && (
            <p className="mt-6 font-body text-sm leading-relaxed text-mid">{plan.note}</p>
          )}

          {/* What the host wrote about getting back in the dark. Shown to
              everyone looking at the plan, not just to confirmed walkers: it is
              the single most useful thing for deciding whether to ask at all,
              and hiding it behind a join would be exactly backwards. */}
          {plan.night_note && (
            <div className="mt-6 border-l-2 border-clay pl-4">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-clay">
                {DAY_PART_LABEL[plan.day_part]} · how everyone gets back
              </h2>
              <p className="mt-2 font-body text-sm leading-relaxed text-text">{plan.night_note}</p>
            </div>
          )}

          {/* The exact spot.
              This is not conditional rendering hiding a value the page already
              fetched — `meetingPoint` is read through the viewer's own session,
              so RLS decides whether it arrives at all. A stranger, or a walker
              the host has not confirmed, gets null from the database. */}
          <div className="mt-8 rounded-sm border border-rule bg-white p-5">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest">
              Exact meeting point
            </h2>
            {meetingPoint ? (
              <>
                <p className="mt-2 font-body text-sm text-text">{meetingPoint}</p>
                {logistics && <p className="mt-2 font-body text-sm text-mid">{logistics}</p>}
              </>
            ) : (
              <p className="mt-2 font-body text-sm leading-relaxed text-mid">
                {confirmed
                  ? `Shown once ${plan.min_party} people are going. Right now this walk has ${plan.going_count}.`
                  : `Only shown to walkers the host has confirmed, and only once ${plan.min_party} people are going.`}
              </p>
            )}
          </div>

          <PlanActions
            planId={plan.id}
            isHost={isHost}
            myStatus={myStatus}
            full={full}
            cancelled={cancelled}
            roster={roster as { user_id: string; display_name: string; status: string; message: string | null }[]}
          />

          {/* The loudest safety control on the page, and the one with no platform
              obligation attached: somebody off the platform knowing where you
              are is worth more than anything this shop can enforce. */}
          {confirmed && (
            <div className="mt-8 border-l-2 border-forest pl-4">
              <h2 className="font-body text-xs uppercase tracking-[0.12em] text-text">
                Tell someone where you are going
              </h2>
              <p className="mt-2 font-body text-sm leading-relaxed text-mid">
                Send this to a friend or someone at home before you set off.
              </p>
              <p className="mt-3 rounded-sm bg-paper-warm p-3 font-body text-xs leading-relaxed text-text">
                I&apos;m going {activityLabel(plan.activity).toLowerCase()} at{' '}
                {plan.place} on {istDay(plan.starts_at)}. Meeting around {plan.meet_area} at{' '}
                {hhmm(plan.start_time)}, expecting to be back by {hhmm(plan.back_by)}. Organised
                through DEWDROPZ Trek Buddy by {plan.host_name}.
              </p>
            </div>
          )}

          <SafetyNotes variant="compact" className="mt-10" />

          <p className="mt-6 border-t border-rule pt-6 font-body text-xs leading-relaxed text-mid">
            DEWDROPZ does not organise, lead, vet or supervise this walk and has not checked who
            anyone on it is. Go at your own risk and turn back if conditions change. Emergency:{' '}
            <span className="text-text">112</span>. Something wrong with this walk?{' '}
            <Link href="/contact" className="text-forest underline underline-offset-4">
              Tell us
            </Link>
            .
          </p>
        </div>
      </main>
      <FooterSection />
    </>
  )
}
