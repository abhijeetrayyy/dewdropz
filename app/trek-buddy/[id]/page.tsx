import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import { getGuidance, getTrekMembership, getTrekPlan } from '@/actions/trekBuddy'
import { formatPrice } from '@/lib/utils'
import PlanActions from './PlanActions'
import PlanMasthead from '@/components/trek/PlanMasthead'
import SafetyNotes from '@/components/trek/SafetyNotes'
import PlanChat from '@/components/trek/PlanChat'
import { getMessages } from '@/actions/trekChat'
import RecapPanel from '@/components/trek/RecapPanel'
import { getRecap } from '@/actions/trekRecap'
import SafetyActions from '@/components/trek/SafetyActions'
import Guidance from '@/components/trek/Guidance'
import { DAY_PART_LABEL, lightForTime } from '@/lib/trek'

export const metadata: Metadata = {
  title: 'A walk — DEWDROPZ',
  robots: { index: false, follow: false },
}

function istDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '—')

/** A section on this page. Ruled and labelled, so the page scans. */
function Block({ label, children, id }: { label: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-rule pt-6">
      <h2 className="trek-label font-mono text-mid">{label}</h2>
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

  const { plan, isHost, myStatus, meetingPoint, logistics, roster, waitlistPosition, walkIsOver, myCostState } = data

  // Fetched through the viewer's own session inside the action, so a caller who
  // is not on the walk gets an empty list from the policy rather than a refusal
  // this page would have to handle.
  const messages = await getMessages(id)

  const recap = walkIsOver ? await getRecap(id) : null
  const full = plan.spots_left <= 0
  const cancelled = plan.status === 'cancelled'
  const confirmed = myStatus === 'confirmed'
  const light = lightForTime(plan.start_time ?? '06:00')
  const multiDay = plan.ends_on !== plan.starts_on

  // What applies to THIS outing. Host notes are for the host; the women notes
  // ride along on a women-only walk because that is where they are load-bearing.
  const notes = await getGuidance({
    activity: plan.activity,
    audiences: isHost
      ? ['all', 'host']
      : plan.women_only
        ? ['all', 'first_time', 'women']
        : ['all', 'first_time'],
    limit: 12,
  })

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
            {/* The way in to the console. Only the host sees it, and the page
                itself 404s for anybody else rather than explaining who owns
                the walk. */}
            {isHost && plan.status === 'open' && (
              <Link
                href={`/trek-buddy/${plan.id}/console`}
                className="trek-pill trek-pill-act font-body"
              >
                Manage this walk →
              </Link>
            )}

            <PlanActions
              planId={plan.id}
              isHost={isHost}
              myStatus={myStatus}
              full={full}
              cancelled={cancelled}
              roster={roster as { user_id: string; display_name: string; status: string; message: string | null }[]}
              waitlistPosition={waitlistPosition}
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
                <div className="rounded-[6px] border border-dashed border-rule px-4 py-5">
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
                  <p className="mt-2 trek-label font-mono text-mid tabular-nums">
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

            {/* The day, hour by hour. Optional, and the thing that most changes
                whether a stranger feels able to say yes: "moderate, 21 km" is a
                statistic, and "05:10 meet, 09:30 summit, back at the cars by 2"
                is a day somebody can picture themselves inside.

                The hour rail runs down it, the same colour language the board
                and the masthead already use. */}
            {plan.itinerary.length > 0 && (
              <Block label="The day, hour by hour">
                <ol className="space-y-0">
                  {plan.itinerary.map((m, i) => (
                    <li key={`${m.at}-${i}`} className="flex gap-4 pb-4 last:pb-0">
                      <div className="flex flex-col items-center">
                        <span
                          aria-hidden="true"
                          style={{ background: light.bar }}
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                        />
                        {i < plan.itinerary.length - 1 && (
                          <span aria-hidden="true" className="mt-1 w-px flex-1 bg-rule" />
                        )}
                      </div>
                      <div className="min-w-0 pb-1">
                        <span
                          style={{ color: light.ink }}
                          className="font-mono text-xs tabular-nums"
                        >
                          {m.at}
                        </span>
                        <p className="font-body text-sm leading-snug text-text">{m.label}</p>
                        {m.detail && (
                          <p className="mt-0.5 font-body text-xs leading-relaxed text-mid">
                            {m.detail}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="mt-1 font-body text-xs leading-relaxed text-mid">
                  The host&apos;s plan for the day, not a timetable. Hills and weather do what
                  they like.
                </p>
              </Block>
            )}

            {/* Set as a list of things, not a paragraph about things, because
                this is read standing over a rucksack the night before. */}
            {plan.bring.length > 0 && (
              <Block label="Bring">
                <ul className="flex flex-wrap gap-2">
                  {plan.bring.map((b) => (
                    <li
                      key={b}
                      className="rounded-full border border-rule px-3 py-1 font-body text-xs text-text"
                    >
                      {b}
                    </li>
                  ))}
                </ul>
              </Block>
            )}

            {plan.night_note && (
              <Block label={`${DAY_PART_LABEL[plan.day_part]} · getting back`}>
                <p className="font-body text-sm leading-relaxed text-text">{plan.night_note}</p>
              </Block>
            )}

            {/* What happened. Shown to everyone once it exists, because a walk
                that demonstrably took place is the only argument this board can
                make that is not a promise. The composer appears for the host
                alone, and only after the walk — RLS and the trigger enforce
                both, so this condition governs a button, not access. */}
            {(recap || (isHost && walkIsOver)) && (
              <Block label={recap ? 'How it went' : 'Write the recap'}>
                <RecapPanel
                  planId={plan.id}
                  userId={membership.userId!}
                  recap={recap}
                  canWrite={isHost && walkIsOver}
                  hostName={plan.host_name}
                />
              </Block>
            )}

            {/* What the host has you down as for the cost share.
                
                Shown to the walker on purpose. A note a host keeps about you
                that you cannot see is the version of this worth objecting to;
                reading it is what makes it correctable, and the line below is
                careful that this is two people and a cab fare, not a bill. */}
            {confirmed && plan.cost_paise != null && plan.cost_paise > 0 && (
              <Block label="The cost share">
                <p className="font-body text-sm text-text">
                  {formatPrice(plan.cost_paise)} each
                  {myCostState === 'settled' && ' — the host has you down as squared up.'}
                  {myCostState === 'on_the_day' && ' — the host has you down as paying on the day.'}
                  {(myCostState === 'owed' || myCostState === null) && ' — not settled yet.'}
                </p>
                <p className="mt-1.5 font-body text-xs leading-relaxed text-mid">
                  Split at face value between the people going. Nothing is paid through this site
                  and DEWDROPZ never sees the money — this is the host&apos;s own note, so sort it
                  out with them directly.
                </p>
              </Block>
            )}

            {/* The party's conversation. Shown to the confirmed party and the
                host, which is exactly who RLS lets read it — the condition here
                decides whether a box appears, not whether anybody can see the
                messages. Getting it wrong would render an empty box, not leak a
                word. */}
            {(confirmed || isHost) && (
              <Block label="Group chat" id="chat">
                <PlanChat planId={plan.id} messages={messages} meId={membership.userId!} />
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
                {/* Written out rather than templated with dashes: a trek with
                    no stated hour must not produce "at —, back by —" in the one
                    message somebody sends home before walking into the hills. */}
                <p className="mt-3 rounded-[6px] bg-paper-warm px-4 py-3 font-body text-sm leading-relaxed text-text">
                  I&apos;m going {plan.activity_label.toLowerCase()} at {plan.place} on{' '}
                  {istDay(plan.starts_at)}
                  {multiDay
                    ? `, back on ${istDay(plan.ends_at)}`
                    : plan.back_by
                      ? `, back by ${hhmm(plan.back_by)}`
                      : ''}
                  . Meeting around {plan.meet_area}
                  {plan.start_time ? ` at ${hhmm(plan.start_time)}` : ''}. Organised through
                  DEWDROPZ Trek Buddy by {plan.host_name}.
                </p>
              </Block>
            )}

            {notes.length > 0 && (
              <div className="border-t border-rule pt-6">
                <Guidance
                  notes={notes}
                  title={`Before you go ${plan.activity_label.toLowerCase()}`}
                  intro="From people who have done this around here. Not rules — the things that are only obvious afterwards."
                />
              </div>
            )}

            <SafetyNotes variant="compact" />

            <div className="space-y-4 border-t border-rule pt-6">
              <p className="font-body text-xs leading-relaxed text-mid">
                DEWDROPZ does not organise, lead, vet or supervise this walk and has not checked
                who anyone on it is. Go at your own risk and turn back if conditions change.
                Emergency: <span className="text-text">112</span>.
              </p>
              {/* A host cannot report their own walk — there is a Cancel button
                  for that, and a self-report is only ever a mistake. */}
              {!isHost && <SafetyActions planId={plan.id} />}
            </div>
          </div>
        </div>
      </main>
      <FooterSection />
    </>
  )
}
