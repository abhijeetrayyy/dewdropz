import Link from 'next/link'
import Image from 'next/image'
import type { TrekPlanRow } from '@/actions/trekBuddy'
import { ACTIVITY_BY_KEY, DIFFICULTY_LABEL, lightForTime, type TrekActivity } from '@/lib/trek'
import { formatPrice } from '@/lib/utils'
import { BLUR_DATA_URL } from '@/lib/constants'

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '—')

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
  const light = lightForTime(plan.start_time ?? '06:00')
  const overnight = plan.ends_on !== plan.starts_on

  const nights = Math.round(
    (new Date(plan.ends_on).getTime() - new Date(plan.starts_on).getTime()) / 86400000
  )

  // On a multi-day trek the span is the headline number, not a departure time.
  const facts: [string, string][] = [
    nights > 0
      ? ['Days', String(nights + 1)]
      : ['Leaves', plan.start_time ? hhmm(plan.start_time) : '—'],
    nights > 0
      ? ['Ends', new Date(plan.ends_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' })]
      : ['Back', plan.back_by ? `${hhmm(plan.back_by)}${overnight ? ' +1' : ''}` : '—'],
    ['Going', `${plan.going_count}/${plan.capacity}`],
    ['Difficulty', DIFFICULTY_LABEL[plan.difficulty] ?? plan.difficulty],
  ]

  // Optional, and only shown when the host actually knows. A blank is more use
  // than a number somebody invented, because a stranger will plan their day
  // around whatever this says.
  if (plan.distance_km != null) facts.push(['Distance', `${plan.distance_km} km`])
  if (plan.gain_m != null) facts.push(['Climb', `${plan.gain_m.toLocaleString('en-IN')} m`])
  // "Shared", not "price". The board never takes money and this is a split of
  // fuel and permits — calling it a cost would make it a ticket.
  if (plan.cost_paise != null) {
    facts.push(['Cost share', plan.cost_paise === 0 ? 'Nothing' : `${formatPrice(plan.cost_paise)} each`])
  }

  const cover = plan.cover_urls?.[0] ?? null

  return (
    <header
      style={{ background: light.bar }}
      className="relative isolate overflow-hidden"
    >
      {/* The design's event hero is a photograph, full bleed. Ours was the hour
          colour and nothing else — on a walk that HAS a cover, the picture the
          host chose was showing on the board and then vanishing the moment
          somebody opened the walk it belonged to.
          
          The hour colour stays as the ground beneath it, which is what a walk
          with no photograph still gets. */}
      {cover && (
        <Image
          src={cover}
          alt=""
          fill
          priority
          sizes="100vw"
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          className="object-cover"
        />
      )}

      {/* Shaped to the type rather than flat: heavier at the foot where the
          facts row sits, light through the middle where the picture should be
          allowed to be a picture. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: cover
            ? 'linear-gradient(180deg, rgba(12,16,13,0.72) 0%, rgba(12,16,13,0.34) 42%, rgba(12,16,13,0.88) 100%)'
            : 'linear-gradient(180deg, rgba(12,16,13,0.45) 0%, rgba(12,16,13,0.15) 50%, rgba(12,16,13,0.55) 100%)',
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6 pb-8 pt-32 md:px-10 md:pt-36">
        <Link
          href="/trek-buddy"
          className="trek-label font-mono text-paper/60 transition-colors hover:text-paper"
        >
          ← The board
        </Link>

        <p className="mt-7 trek-label font-mono text-paper/70">
          {plan.activity_label} · {plan.start_time ? light.label : `${nights + 1} days out`} · {istLong(plan.starts_at)}
        </p>

        <h1 className="mt-3 font-display text-[clamp(34px,6vw,60px)] font-light leading-[0.95] text-paper">
          {plan.place}
        </h1>

        <p className="mt-3 font-body text-sm text-paper/70">
          Meeting around {plan.meet_area} · hosted by{' '}
          <Link
            href={`/trek-buddy/people/${plan.host_id}`}
            className="text-paper underline decoration-paper/40 underline-offset-4 transition-colors hover:decoration-paper"
          >
            {plan.host_name}
          </Link>
        </p>

        <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4 border-t border-paper/20 pt-5">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="trek-label-xs font-mono text-paper/50">{k}</dt>
              <dd className="mt-1 font-mono text-xl text-paper tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  )
}
