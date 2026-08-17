import Link from 'next/link'
import type { TrekPlanRow } from '@/actions/trekBuddy'
import { ACTIVITY_BY_KEY, EFFORT_LABEL, lightForTime, type TrekActivity } from '@/lib/trek'

/** IST, because the walk happens in India and the server does not. */
function istParts(iso: string) {
  const d = new Date(iso)
  const f = (o: Intl.DateTimeFormatOptions) =>
    d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', ...o })
  return { day: f({ day: '2-digit' }), month: f({ month: 'short' }), weekday: f({ weekday: 'short' }) }
}

const hhmm = (t: string) => t.slice(0, 5)

/** Initials for the people going. A face is a person; a number is a row. */
function Party({ count, capacity }: { count: number; capacity: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex">
        {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
          <span
            key={i}
            style={{ marginLeft: i === 0 ? 0 : -6 }}
            className="h-5 w-5 rounded-full border border-paper bg-forest/85"
            aria-hidden="true"
          />
        ))}
        {Array.from({ length: Math.max(0, Math.min(capacity - count, 4)) }).map((_, i) => (
          <span
            key={`o-${i}`}
            style={{ marginLeft: count === 0 && i === 0 ? 0 : -6 }}
            className="h-5 w-5 rounded-full border border-dashed border-mid/40 bg-transparent"
            aria-hidden="true"
          />
        ))}
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-mid tabular-nums">
        {count}/{capacity}
      </span>
    </div>
  )
}

// One plan.
//
// Built around the departure hour, because that is the fact that decides
// everything else about an outing. The rail down the left is coloured by it, so
// a board of these reads as a day: indigo before light, green through the
// middle, clay at dusk, ink after dark.
//
// Numbers are mono throughout and words are not. Times, altitude, capacity and
// the date are instrument readings off a logbook; the place is a name on a map.
// Keeping those two registers apart is what stops the card reading as a form.
export default function TrekPlanCard({ plan }: { plan: TrekPlanRow }) {
  const light = lightForTime(plan.start_time)
  const spec = ACTIVITY_BY_KEY[plan.activity as TrekActivity]
  const { day, month, weekday } = istParts(plan.starts_at)
  const full = plan.spots_left <= 0

  return (
    <Link
      href={`/trek-buddy/${plan.id}`}
      style={{ background: light.wash }}
      className="group relative flex overflow-hidden rounded-sm border border-rule transition-all duration-300 hover:-translate-y-0.5 hover:border-forest/50 hover:shadow-[0_10px_30px_-18px_rgba(12,16,13,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
    >
      {/* The hour rail. */}
      <span
        aria-hidden="true"
        style={{ background: light.bar }}
        className="w-1 shrink-0"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-4 p-5 sm:flex-row sm:items-start">
        {/* The date block — a torn calendar corner, not a sentence. */}
        <div className="flex shrink-0 flex-row items-baseline gap-2 sm:w-14 sm:flex-col sm:items-start sm:gap-0">
          <span className="font-display text-3xl leading-none text-text tabular-nums">{day}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-mid">
            {month} · {weekday}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span
              style={{ color: light.ink }}
              className="font-mono text-sm tabular-nums"
            >
              {hhmm(plan.start_time)}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-mid">
              {light.label}
            </span>
          </div>

          <h3 className="mt-1 font-display text-xl leading-tight text-text">{plan.place}</h3>

          <p className="mt-1 font-body text-xs text-mid">
            {spec?.label ?? plan.activity} · from {plan.meet_area} · back{' '}
            <span className="tabular-nums">{hhmm(plan.back_by)}</span>
            {plan.ends_on !== plan.starts_on ? ' next day' : ''}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <Party count={plan.going_count} capacity={plan.capacity} />
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-mid">
              {EFFORT_LABEL[plan.effort]}
            </span>
            {plan.day_part !== 'day' && (
              <span
                style={{ color: light.ink, borderColor: light.bar }}
                className="rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em]"
              >
                needs {plan.min_party}
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 self-end sm:self-center">
          <span
            className={`font-mono text-[10px] uppercase tracking-[0.14em] ${
              full ? 'text-clay' : 'text-forest'
            }`}
          >
            {full ? 'Full' : `${plan.spots_left} space${plan.spots_left === 1 ? '' : 's'}`}
          </span>
        </div>
      </div>
    </Link>
  )
}
