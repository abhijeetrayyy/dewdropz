import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import EmptyState from '@/components/trek/ui/EmptyState'
import { Datum, Eyebrow, ShelfHead, Tag } from '@/components/trek/ui/Bits'
import { getMyPastTreks, getTrekMembership, type PastTrek } from '@/actions/trekBuddy'
import { durationDays } from '@/lib/trek-lifecycle'
import { lightForTime, dotColor } from '@/lib/trek'

export const metadata: Metadata = {
  title: 'What you have done — DEWDROPZ',
  robots: { index: false, follow: false },
}

/**
 * The trips you have already been on.
 *
 * This screen did not exist, and its absence was the last live consequence of
 * the interval-read-as-an-instant fault that TREKBUDDY-TIME-AUDIT.md closed
 * everywhere else. The day after a walk, the walk was gone: the board only
 * carries what is current, Basecamp ends at `ends_at`, and a profile counted
 * your outings without letting you open one. The roster, the chat, the
 * announcements and the meeting point were all still in the database and
 * unreachable by every single person who had been there.
 *
 * 052 kept them on purpose — a plan is hidden at most, never deleted, because
 * "the roster is the answer to who was supposed to be there". That question is
 * only ever asked afterwards. This is the door to it.
 *
 * WHY A LEDGER AND NOT A GRID OF CARDS
 *
 * The board's card is built to sell a decision that has not been made yet:
 * cover photograph, seat meter, countdown, the act. None of that means anything
 * about a trip that is over — there is nothing to decide, no seat to take, and
 * a countdown to a date in the past is the bug `Countdown` was rewritten to
 * stop. What a record wants is one line per trip, scannable by date, with the
 * hour it left still readable as colour, and the one thing that IS still
 * actionable pulled out: whether it has a recap.
 *
 * WHO CAN SEE THIS
 *
 * Only your own. `getMyPastTreks` filters to trips you hosted or were confirmed
 * on, which is the same boundary `trek_plans`' "Participants read their own
 * plans" policy draws. Whether a finished trip ever becomes browsable by people
 * who were not on it is a separate decision with a real privacy cost — it would
 * publish, after the fact, who went into the hills with whom — and it is not
 * one this page takes. Council §7 Q4.
 */

function PastRow({ item }: { item: PastTrek }) {
  const { plan, role, hasRecap } = item
  const light = lightForTime(plan.start_time)
  const days = durationDays(plan)
  const ended = new Date(plan.ends_at)

  return (
    <li className="border-b border-rule-soft last:border-b-0">
      <div className="grid grid-cols-1 items-baseline gap-x-6 gap-y-2.5 py-4.5 sm:grid-cols-[104px_minmax(0,1fr)_auto]">
        {/* The date, as a fixed mono column — this is the axis the page is read
            down, and a proportional face makes a date column ragged. */}
        <p className="font-mono text-[13px] tabular-nums text-mid">
          {ended.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
        </p>

        <div className="min-w-0">
          <Link
            href={`/trek-buddy/${plan.id}`}
            className="group inline-flex max-w-full items-center gap-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
          >
            {/* The hour it left, expressed small — a dot, per the design
                system. Decorative here: the time is stated in words alongside. */}
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={{ background: dotColor(light, 'light') }}
            />
            <span className="truncate font-display text-[19px] font-medium text-text group-hover:underline">
              {plan.place}
            </span>
          </Link>

          <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-body text-[13px] text-mid">
            <span>{plan.activity_label}</span>
            <span aria-hidden="true">·</span>
            <span>{role === 'hosted' ? 'You ran it' : `Hosted by ${plan.host_name}`}</span>
            {days > 1 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{days} days</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5 sm:justify-end">
          {plan.status === 'cancelled' ? (
            <Tag tone="clay">Called off</Tag>
          ) : hasRecap ? (
            <Link
              href={`/trek-buddy/${plan.id}`}
              className="font-body text-[13px] text-forest underline underline-offset-4 hover:no-underline"
            >
              Read the recap
            </Link>
          ) : (
            // The only thing still worth doing about a finished trip. Only the
            // host is offered it, because saveRecap is host-only in 078 and an
            // action that will be refused is worse than no action at all.
            role === 'hosted' && (
              <Link
                href={`/trek-buddy/${plan.id}`}
                className="font-body text-[13px] text-ember underline underline-offset-4 hover:no-underline"
              >
                Write the recap
              </Link>
            )
          )}
        </div>
      </div>
    </li>
  )
}

export default async function PastPage() {
  const membership = await getTrekMembership()
  if (!membership.signedIn) redirect('/auth/login?redirect=/trek-buddy/past')
  if (!membership.onboarded) redirect('/trek-buddy/setup')

  const past = await getMyPastTreks()

  const hosted = past.filter((p) => p.role === 'hosted').length
  const went = past.length - hosted
  const days = past.reduce((n, p) => n + durationDays(p.plan), 0)
  const missingRecaps = past.filter((p) => p.role === 'hosted' && !p.hasRecap && p.plan.status !== 'cancelled').length

  return (
    <>
      <section className="trek-band bg-ink pb-9 pt-28 md:pt-32">
        <div className="trek-measure">
          <Eyebrow tone="ondark">Your record</Eyebrow>
          <h1 className="trek-h1 mt-4 max-w-2xl text-paper">What you have done.</h1>
          <p className="mt-3.5 max-w-xl font-body text-[15px] leading-relaxed text-paper/70">
            Every trip you ran or went on, newest first. Nothing here is deleted when it
            ends — the roster, the messages and the announcements stay where they were, and
            this is the way back to them.
          </p>

          {past.length > 0 && (
            <div className="mt-8 flex flex-wrap items-end gap-x-10 gap-y-5 border-t border-paper/15 pt-6">
              <Datum k="trips" v={past.length} tone="dark" size="lg" />
              <Datum k="you ran" v={hosted} tone="dark" />
              <Datum k="you joined" v={went} tone="dark" />
              <Datum k={days === 1 ? 'day out' : 'days out'} v={days} tone="dark" />
            </div>
          )}
        </div>
      </section>

      <section className="trek-band bg-paper pb-24 pt-10">
        <div className="trek-measure">
          {past.length === 0 ? (
            <EmptyState
              title="Nothing behind you yet."
              body={
                <>
                  This fills in on its own. Once a trip you are on finishes it moves here,
                  with everyone who was there and everything that was said.
                </>
              }
              action={{ label: 'See what is going out', href: '/trek-buddy/discover' }}
            />
          ) : (
            <>
              <ShelfHead
                title="Finished"
                count={past.length}
                action={
                  <Link
                    href="/trek-buddy/basecamp"
                    className="font-body text-[13px] text-forest underline underline-offset-4 hover:no-underline"
                  >
                    What is still ahead
                  </Link>
                }
              />

              {missingRecaps > 0 && (
                <p className="trek-provisional mb-6 px-4 py-3 font-body text-[13px] leading-relaxed text-text">
                  {missingRecaps === 1
                    ? 'One trip you ran has no recap yet.'
                    : `${missingRecaps} trips you ran have no recap yet.`}{' '}
                  A recap is how the people who came get vouched for, so it is worth the two
                  minutes.
                </p>
              )}

              <ul className="trek-card px-5 py-1 sm:px-7">
                {past.map((item) => (
                  <PastRow key={item.plan.id} item={item} />
                ))}
              </ul>
            </>
          )}
        </div>
      </section>
    </>
  )
}
