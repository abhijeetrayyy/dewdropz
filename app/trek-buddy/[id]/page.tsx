import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import { getTrekMembership, getTrekPlan } from '@/actions/trekBuddy'
import PlanActions from './PlanActions'
import PlanMasthead from '@/components/trek/PlanMasthead'
import SafetyNotes from '@/components/trek/SafetyNotes'
import { ACTIVITY_BY_KEY, DAY_PART_LABEL, lightForTime, type TrekActivity } from '@/lib/trek'

export const metadata: Metadata = {
  title: 'A walk — DEWDROPZ',
  robots: { index: false, follow: false },
}

/** One label map, shared with the board and the form. */
const activityLabel = (a: string) => ACTIVITY_BY_KEY[a as TrekActivity]?.label ?? a

function istDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}
const hhmm = (t: string) => t.slice(0, 5)

/** A section on this page. Ruled and labelled, so the page scans. */
function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-rule pt-6">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-mid">{label}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

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
  const light = lightForTime(plan.start_time)

  return (
    <>
      <NavBar />
      <main>
        <PlanMasthead plan={plan} />

        <div className="bg-paper px-6 pb-24 pt-10 md:px-10">
          <div className="mx-auto max-w-3xl space-y-8">
            {cancelled && (
              <div className="border-l-2 border-clay bg-clay/5 px-4 py-3">
                <p className="font-body text-sm text-text">
                  This walk was called off{plan.cancel_reason ? ` — ${plan.cancel_reason}` : '.'}
                </p>
              </div>
            )}

            {/* What happens next for THIS viewer, at the top, because it is the
                only thing they came to do. Host, joiner and stranger each get a
                different first thing to look at. */}
            <PlanActions
              planId={plan.id}
              isHost={isHost}
              myStatus={myStatus}
              full={full}
              cancelled={cancelled}
              roster={roster as { user_id: string; display_name: string; status: string; message: string | null }[]}
            />

            {/* The exact spot. Not conditional rendering hiding a value the page
                already has — `meetingPoint` is read through the viewer's own
                session, so RLS decides whether it arrives at all. */}
            <Block label="Exact meeting point">
              {meetingPoint ? (
                <div style={{ borderColor: light.bar }} className="border-l-2 pl-4">
                  <p className="font-body text-base text-text">{meetingPoint}</p>
                  {logistics && <p className="mt-1.5 font-body text-sm text-mid">{logistics}</p>}
                </div>
              ) : (
                <div className="rounded-sm border border-dashed border-rule px-4 py-5">
                  <p className="font-body text-sm leading-relaxed text-mid">
                    {confirmed
                      ? `Unlocks when ${plan.min_party} people are going. Right now there are ${plan.going_count}.`
                      : `Shown to walkers the host has confirmed, once ${plan.min_party} people are going.`}
                  </p>
                  {/* The wait, made countable. "Two more people" is something you
                      can act on; "not yet" is not. */}
                  <div className="mt-3 flex items-center gap-2" aria-hidden="true">
                    {Array.from({ length: plan.min_party }).map((_, i) => (
                      <span
                        key={i}
                        style={{ background: i < plan.going_count ? light.bar : 'transparent' }}
                        className="h-1.5 flex-1 rounded-full border border-rule"
                      />
                    ))}
                  </div>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-mid tabular-nums">
                    {plan.going_count} of {plan.min_party}
                  </p>
                </div>
              )}
            </Block>

            {plan.note && (
              <Block label="From the host">
                <p className="font-body text-sm leading-relaxed text-text">{plan.note}</p>
              </Block>
            )}

            {plan.night_note && (
              <Block label={`${DAY_PART_LABEL[plan.day_part]} · getting back`}>
                <p className="font-body text-sm leading-relaxed text-text">{plan.night_note}</p>
              </Block>
            )}

            {/* The loudest safety control on the page, and the one with no
                platform obligation attached: somebody off the platform knowing
                where you are beats anything this shop can enforce. */}
            {confirmed && (
              <Block label="Tell someone who is not coming">
                <p className="font-body text-sm text-mid">
                  Copy this to a friend or someone at home before you set off.
                </p>
                <p className="mt-3 rounded-sm bg-paper-warm px-4 py-3 font-body text-sm leading-relaxed text-text">
                  I&apos;m going {activityLabel(plan.activity).toLowerCase()} at {plan.place} on{' '}
                  {istDay(plan.starts_at)}. Meeting around {plan.meet_area} at{' '}
                  {hhmm(plan.start_time)}, back by {hhmm(plan.back_by)}
                  {plan.ends_on !== plan.starts_on ? ' the next day' : ''}. Organised through
                  DEWDROPZ Trek Buddy by {plan.host_name}.
                </p>
              </Block>
            )}

            <SafetyNotes variant="compact" />

            <p className="border-t border-rule pt-6 font-body text-xs leading-relaxed text-mid">
              DEWDROPZ does not organise, lead, vet or supervise this walk and has not checked who
              anyone on it is. Go at your own risk and turn back if conditions change. Emergency:{' '}
              <span className="text-text">112</span>. Something wrong with this walk?{' '}
              <Link href="/contact" className="text-forest underline underline-offset-4">Tell us</Link>.
            </p>
          </div>
        </div>
      </main>
      <FooterSection />
    </>
  )
}
