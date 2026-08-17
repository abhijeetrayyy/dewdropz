import Link from 'next/link'
import type { TrekPlanRow } from '@/actions/trekBuddy'
import { ACTIVITY_BY_KEY, EFFORT_LABEL, lightForTime, type TrekActivity } from '@/lib/trek'

const hhmm = (t: string) => t.slice(0, 5)

function istLong(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long',
  })
}

// The masthead for one walk.
//
// It takes the colour of its own departure hour, so a 05:20 birding page and a
// 21:40 stargazing page do not look like the same page with different words in
// it — the page is lit the way the outing is. That is the board's hour rail
// scaled up to fill a screen, which is what makes the two feel like one product
// rather than a list and a detail view that happen to share a nav.
//
// The numbers along the bottom are the decision: when you leave, when you are
// back, how many are going, how hard. Everything else on the page is detail
// underneath that.
export default function PlanMasthead({ plan }: { plan: TrekPlanRow }) {
  const light = lightForTime(plan.start_time)
  const spec = ACTIVITY_BY_KEY[plan.activity as TrekActivity]
  const overnight = plan.ends_on !== plan.starts_on

  const facts: [string, string][] = [
    ['Leaves', hhmm(plan.start_time)],
    ['Back', `${hhmm(plan.back_by)}${overnight ? ' +1' : ''}`],
    ['Going', `${plan.going_count}/${plan.capacity}`],
    ['Effort', EFFORT_LABEL[plan.effort]],
  ]

  return (
    <header
      style={{ background: light.bar }}
      className="relative isolate overflow-hidden"
    >
      {/* A single wash so the darker hours stay readable and the paler ones do
          not glare. One layer, because the colour is doing the work. */}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-ink/45 via-ink/15 to-ink/55" />

      <div className="relative mx-auto max-w-3xl px-6 pb-8 pt-32 md:px-10 md:pt-36">
        <Link
          href="/trek-buddy"
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-paper/60 transition-colors hover:text-paper"
        >
          ← The board
        </Link>

        <p className="mt-7 font-mono text-[10px] uppercase tracking-[0.22em] text-paper/70">
          {spec?.label ?? plan.activity} · {light.label} · {istLong(plan.starts_at)}
        </p>

        <h1 className="mt-3 font-display text-[clamp(34px,6vw,60px)] font-light leading-[0.95] text-paper">
          {plan.place}
        </h1>

        <p className="mt-3 font-body text-sm text-paper/70">
          Meeting around {plan.meet_area} · hosted by {plan.host_name}
        </p>

        <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4 border-t border-paper/20 pt-5">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper/50">{k}</dt>
              <dd className="mt-1 font-mono text-xl text-paper tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  )
}
