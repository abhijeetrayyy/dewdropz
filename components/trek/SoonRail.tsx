import Link from 'next/link'
import type { TrekPlanRow } from '@/actions/trekBuddy'
import { DIFFICULTY_LABEL, dotColor, lightForTime } from '@/lib/trek'
import Cover from './ui/Cover'
import Countdown from './Countdown'
import { LiveDot, Tag } from './ui/Bits'

// What you can still get to.
//
// The grid answers "what is on". This answers "what is leaving", which is the
// only question on the board with a deadline attached — so it gets its own
// shape: shorter cards, on ink, sitting on the seam where the dark control
// band gives way to paper. It bleeds off the right edge on purpose, because a
// row that stops neatly inside the container looks finished and one that runs
// under the edge is the only honest signal that there is more.
//
// It disappears entirely when nothing is leaving. A rail headed "within 48
// hours" holding a walk three weeks out is worse than no rail.
//
// AND THIS IS THE ONE PLACE ON THE BOARD WHERE AMBER IS CORRECT. Everywhere
// else it was spent on selected filters, focus rings and headings until it
// meant nothing; here a clock genuinely is running, so the pulse dot, the
// heading and the countdown take it — and nothing else in the rail does. The
// hour a walk leaves at used to be printed in the hour's own colour, which put
// a second amber on every dawn card and quietly competed with the countdown
// sitting two centimetres above it; the hour is now a 6px dot with the time in
// paper beside it, which is how the rest of the product draws it.
export default function SoonRail({ plans }: { plans: TrekPlanRow[] }) {
  if (plans.length === 0) return null

  // ONE CARD IS NOT A RAIL. A rail's whole argument is that it continues past
  // the edge — that is why the cards are a fixed 280px and why the row bleeds
  // off the right. With a single walk in it, a 280px card sat alone against a
  // band nearly a thousand pixels wide, floating over the hard seam where the
  // ink gradient hands over to paper. It read as a rendering fault rather than
  // as "one walk is leaving soon", which on a young board is the state this rail
  // will be in most of the time. So a lone card takes the width instead: the
  // same card, laid out as a strip, with nothing to scroll and nothing to
  // suggest there is more.
  const lone = plans.length === 1

  return (
    <section>
      <div className="flex items-center gap-3 pb-3.5 pt-5">
        <LiveDot />
        <h2 className="trek-label text-dawn-soft">Leaving within 48 hours</h2>
        <span aria-hidden="true" className="h-px flex-1 bg-paper/15" />
        <span className="font-mono text-[13px] text-paper/60 tabular-nums">{plans.length}</span>
      </div>

      <div className={lone ? '' : '-mr-6 md:-mr-10'}>
        <ul className={lone ? 'pb-4' : 'trek-rail pb-4 pr-6 md:pr-10'}>
          {plans.map((p) => {
            const light = lightForTime(p.start_time)
            const left = p.spots_left
            return (
              <li key={p.id} className={lone ? 'flex w-full' : 'flex w-[280px]'}>
                <Link
                  href={`/trek-buddy/${p.id}`}
                  className="trek-liftable group flex w-full flex-col overflow-hidden rounded-[var(--r-card)] bg-ink-raised shadow-[0_12px_32px_-16px_rgba(0,0,0,0.6)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
                >
                  <Cover
                    src={p.cover_urls?.[0] ?? null}
                    light={light}
                    place={p.place}
                    distanceKm={p.distance_km}
                    gainM={p.gain_m}
                    sizes={lone ? '(min-width: 768px) 900px, 92vw' : '280px'}
                    scrimFrom={20}
                    className={lone ? 'h-[150px] w-full sm:h-[190px]' : 'h-[120px] w-full'}
                  >
                    <Countdown
                      iso={p.starts_at}
                      endsIso={p.ends_at}
                      className="trek-glass absolute right-2.5 top-2.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-medium text-dawn-soft tabular-nums"
                    />
                  </Cover>

                  <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="h-[6px] w-[6px] shrink-0 rounded-full"
                        style={{ background: dotColor(light, 'dark') }}
                      />
                      <span className="font-mono text-[13px] leading-none text-paper tabular-nums">
                        {p.start_time ? p.start_time.slice(0, 5) : '—'}
                      </span>
                      <span className="trek-label-xs text-paper/55">
                        {p.start_time ? light.label : 'Multi-day'}
                      </span>
                    </div>

                    <p className="trek-h3 mt-1.5 truncate text-paper">{p.place}</p>

                    {/* How hard the day is belongs on the card that is trying
                        to make you hurry, not two clicks away. A rail that
                        says "leaves in 6h" and nothing about the walk is
                        pressure without information. */}
                    <p className="mt-1.5 truncate font-body text-[12px] text-paper/60">
                      From {p.meet_area} · {DIFFICULTY_LABEL[p.difficulty] ?? p.difficulty}
                      {p.distance_km ? ` · ${p.distance_km} km` : ''}
                    </p>

                    {/* Rendered whether or not there is a tag to put in it.
                        A rail is a row of identical modules, and letting this
                        block collapse on the walks that carry no constraint
                        made those cards shorter than their neighbours — the
                        row then read as ragged rather than as a row. */}
                    <span className="mt-2.5 flex h-[22px] flex-nowrap items-start gap-1.5 overflow-hidden">
                      {p.women_only && <Tag tone="clay">Women only</Tag>}
                      {p.senior_friendly && <Tag tone="sage">Senior friendly</Tag>}
                    </span>

                    <p className="mt-auto border-t border-paper/12 pt-2.5 font-body text-[12px] text-paper/70">
                      {left > 0 ? (
                        <>
                          <span className="font-mono text-[13px] text-paper tabular-nums">
                            {left}
                          </span>{' '}
                          {left === 1 ? 'place' : 'places'} left of{' '}
                          <span className="font-mono tabular-nums">{p.capacity}</span>
                        </>
                      ) : (
                        <span className="text-clay-wash">Full · waitlist open</span>
                      )}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
