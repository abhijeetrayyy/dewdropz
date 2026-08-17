import Link from 'next/link'
import type { TrekPlanRow } from '@/actions/trekBuddy'
import { ACTIVITY_BY_KEY, EFFORT_LABEL, DAY_PART_LABEL, type TrekActivity } from '@/lib/trek'

/** IST, because the walk happens in India and the server does not. */
function istDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short',
  })
}

/** 'HH:MM:SS' from Postgres TIME — the wall-clock the host chose, printed as-is. */
function hhmm(t: string) {
  return t.slice(0, 5)
}

// One row on the board.
//
// It shows the town-level rendezvous ("Dehradun ISBT"), never the exact meeting
// point — that lives in a separate table behind an RLS floor and is not fetched
// here at all, so there is nothing on this page to leak.
export default function TrekPlanCard({ plan }: { plan: TrekPlanRow }) {
  const full = plan.spots_left <= 0

  return (
    <Link
      href={`/trek-buddy/${plan.id}`}
      className="group flex flex-wrap items-baseline gap-x-6 gap-y-2 py-5 transition-opacity hover:opacity-80"
    >
      <div className="w-16 shrink-0">
        <div className="font-mono text-sm text-text tabular-nums">{hhmm(plan.start_time)}</div>
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-mid">
          {istDay(plan.starts_at)}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="font-display text-lg leading-tight text-text">
          {ACTIVITY_BY_KEY[plan.activity as TrekActivity]?.label ?? plan.activity}
          <span className="text-mid"> · {plan.place}</span>
        </h3>
        <p className="mt-0.5 font-body text-xs text-mid">
          Meet around {plan.meet_area} · back by {hhmm(plan.back_by)}
          {plan.ends_on !== plan.starts_on ? ' next day' : ''} · {EFFORT_LABEL[plan.effort]}
        </p>
        {plan.day_part !== 'day' && (
          // Flagged on the card, not buried on the plan page: an outing that
          // runs in the dark is a different decision from one that does not.
          <span className="mt-1.5 inline-block rounded-full border border-clay/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-clay">
            {DAY_PART_LABEL[plan.day_part]} · needs {plan.min_party}
          </span>
        )}
        <p className="mt-0.5 font-body text-xs text-mid/70">Posted by {plan.host_name}</p>
      </div>

      <div className="shrink-0 text-right">
        <div className="font-mono text-sm text-text tabular-nums">
          {plan.going_count}/{plan.capacity}
        </div>
        <div
          className={`font-mono text-[10px] uppercase tracking-[0.14em] ${
            full ? 'text-clay' : 'text-forest'
          }`}
        >
          {full ? 'Full' : `${plan.spots_left} space${plan.spots_left === 1 ? '' : 's'}`}
        </div>
      </div>
    </Link>
  )
}
