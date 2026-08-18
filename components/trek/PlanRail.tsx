import Link from 'next/link'
import type { TrekPlanRow } from '@/actions/trekBuddy'
import Countdown from './Countdown'
import { lightForTime } from '@/lib/trek'
import { formatPrice } from '@/lib/utils'

/**
 * The action rail, from the design's event screen.
 *
 * The old page ran everything down one column, so the departure time, the
 * progress toward releasing the meeting point, and the button that gets you on
 * the walk were separated by a screen and a half of reading. In the design they
 * are one card that stays with you — and that is the actual difference between
 * a page and a screen: a page puts things in reading order, a screen keeps the
 * thing you act on within reach.
 *
 * Dark, on a paper column, because it is the one element here that is a control
 * panel rather than prose.
 *
 * It holds facts and the decision. It does NOT hold the meeting point itself:
 * that arrives through RLS on the viewer's own session, and putting it in a
 * component that also renders for people who cannot see it is how a leak gets
 * written by accident. The rail says whether it has been released; the page
 * shows it.
 */
export default function PlanRail({
  plan,
  children,
  hasPoint,
}: {
  plan: TrekPlanRow
  /** PlanActions — the ask, withdraw, or host controls. */
  children: React.ReactNode
  /** Whether the exact point has reached this viewer, decided by the database. */
  hasPoint: boolean
}) {
  const light = lightForTime(plan.start_time ?? '06:00')
  const day = new Date(plan.starts_at).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short',
  })
  const short = plan.going_count >= plan.min_party ? 0 : plan.min_party - plan.going_count

  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <div className="trek-card bg-ink p-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-mono text-3xl leading-none tabular-nums" style={{ color: light.onDark }}>
            {plan.start_time ? plan.start_time.slice(0, 5) : '—'}
          </span>
          <span className="trek-label-xs font-mono text-paper/60">{day}</span>
        </div>

        <p className="trek-label-xs mt-2 font-mono text-paper/70 tabular-nums">
          <span aria-hidden="true" className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-dawn align-middle" />
          <Countdown iso={plan.starts_at} prefix="leaves in" />
        </p>

        {/* The wait, made countable. "Two more people" is something you can act
            on; "not yet" is not. */}
        <div className="mt-5">
          <div className="flex items-center gap-1" aria-hidden="true">
            {Array.from({ length: plan.min_party }).map((_, i) => (
              <span
                key={i}
                className="h-1 flex-1 rounded-full"
                style={{ background: i < plan.going_count ? light.onDark : 'rgba(248,245,237,0.18)' }}
              />
            ))}
          </div>
          <p className="trek-label-xs mt-2 font-mono text-paper/70 tabular-nums">
            {plan.going_count} of {plan.capacity} going
            {hasPoint
              ? ' · the exact spot is open to you'
              : short > 0
                ? ` · unlocks the exact spot at ${plan.min_party}`
                : ' · the exact spot goes to confirmed walkers'}
          </p>
        </div>

        {plan.cost_paise != null && plan.cost_paise > 0 && (
          <div className="mt-5 border-t border-paper/15 pt-4">
            <p className="trek-label-xs font-mono text-paper/55">Cost share</p>
            <p className="mt-1 font-body text-sm text-paper">
              {formatPrice(plan.cost_paise)} each
            </p>
            <p className="mt-1 font-body text-xs leading-relaxed text-paper/55">
              Split on the day. Nothing is paid through this site.
            </p>
          </div>
        )}

        {/* The decision. Whatever PlanActions decides you are — asking,
            waitlisted, going, or the host — it lands here rather than at the
            bottom of the page. */}
        <div className="mt-5 border-t border-paper/15 pt-4 [&_a]:text-paper [&_button]:text-paper/80">
          {children}
        </div>
      </div>

      <p className="mt-3 px-1 font-body text-xs leading-relaxed text-mid">
        The host decides who comes. The exact meeting point reaches confirmed walkers only, and
        only once {plan.min_party} are going.
      </p>

      <Link
        href="/trek-buddy/discover"
        className="trek-label-xs mt-4 inline-block px-1 font-mono text-mid underline-offset-4 hover:text-text hover:underline"
      >
        ← Back to discover
      </Link>
    </aside>
  )
}
