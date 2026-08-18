import type { TrekPlanRow } from '@/actions/trekBuddy'
import TrekPlanCard from './TrekPlanCard'
import Countdown from './Countdown'

// The "leaving soon" rail.
//
// The prototype carries BOTH a sideways shelf and a grid, and that is the part
// worth copying: the shelf is not a different way of showing the board, it is a
// different QUESTION. The grid answers "what is on"; the shelf answers "what
// can I still get to", which is the only question with a deadline attached.
//
// So it holds walks leaving within 48 hours and nothing else, and it disappears
// entirely when there are none — a rail headed "leaving soon" with one walk
// three weeks out is worse than no rail.
//
// It bleeds off the right edge on purpose. A row that stops neatly inside the
// container looks finished; one that runs under the edge is the only honest
// signal that there is more of it, and it costs no chevron nobody presses.
export default function TrekShelf({ plans }: { plans: TrekPlanRow[] }) {
  if (plans.length === 0) return null

  return (
    <section className="mb-10">
      <div className="flex items-baseline gap-3 pb-3">
        <h3 className="trek-label font-mono text-ember">
          <span aria-hidden="true" className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-dawn align-middle" />
          Leaving within 48 hours
        </h3>
        <span aria-hidden="true" className="h-px flex-1 bg-rule" />
        <span className="font-mono text-[10px] text-mid tabular-nums">{plans.length}</span>
      </div>

      {/* -mr negative margin plus matching padding: the row runs to the edge of
          the viewport rather than stopping at the container, and the last card
          is deliberately half-visible. */}
      <div className="-mr-6 md:-mr-10">
        <ul className="trek-shelf pr-6 md:pr-10">
          {plans.map((p) => (
            <li key={p.id} className="relative">
              <TrekPlanCard plan={p} />
              {/* The countdown again, in the open. On the card it is one fact
                  among eight; here it is the reason the row exists. */}
              <p className="trek-label-xs mt-2 font-mono text-ember tabular-nums">
                <Countdown iso={p.starts_at} prefix="leaves in" />
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
