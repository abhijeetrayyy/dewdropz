import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import BoardFilters from '@/components/trek/BoardFilters'
import TrekShelf from '@/components/trek/TrekShelf'
import TrekPlanCard from '@/components/trek/TrekPlanCard'
import Countdown from '@/components/trek/Countdown'
import {
  getTrekBoard, getTrekMembership, getLeavingSoon, getTrekKinds,
  type TrekPlanRow,
} from '@/actions/trekBuddy'
import { bucketPlans } from '@/lib/trekBuckets'
import { ACTIVITIES, DIFFICULTY_LABEL, lightForTime } from '@/lib/trek'
import { formatPrice } from '@/lib/utils'
import { BLUR_DATA_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Discover — Trek Buddy — DEWDROPZ',
  robots: { index: false, follow: false },
}

/**
 * Discover, built to the layout in the design file.
 *
 * The shell stays DEWDROPZ's — this sits inside the shop, under the same
 * NavBar, because Trek Buddy is part of it rather than a separate product. The
 * LAYOUT is the prototype's, and structurally rather than cosmetically:
 *
 *   BAND 1, on ink: an eyebrow, one large display line, the counts set against
 *     it, then search, then the filters. The whole "what am I looking at and
 *     how do I narrow it" job happens once, on a dark ground, before any walk
 *     appears. The board does this with a photograph and tabs, which is a
 *     magazine cover; this is a control surface.
 *   BAND 2, on paper: what is leaving inside 48 hours, as a row that runs off
 *     the edge.
 *   BAND 3, on paper: one walk given the whole width, then everything cut into
 *     the buckets people actually think in.
 *
 * The banding is the point. A page that changes ground under your feet tells
 * you the job changed; one flat column tells you nothing, which is exactly
 * what the old board was doing.
 */
export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ activity?: string; when?: string; q?: string }>
}) {
  const sp = await searchParams
  const membership = await getTrekMembership()
  if (!membership.signedIn) redirect('/auth/login?redirect=/trek-buddy/discover')
  if (!membership.onboarded) redirect('/trek-buddy/setup')

  const [plans, all, soon, kinds] = await Promise.all([
    getTrekBoard({ activity: sp.activity, when: sp.when as 'all' | 'week' | 'weekend', q: sp.q }),
    getTrekBoard(),
    getLeavingSoon(),
    getTrekKinds(),
  ])

  const counts: Record<string, number> = { all: all.length }
  for (const a of ACTIVITIES) counts[a.key] = all.filter((p: TrekPlanRow) => p.activity === a.key).length

  // "This weekend" is a real count off the same board, not a decoration.
  const weekend = await getTrekBoard({ when: 'weekend' })

  // One walk given the whole width. Chosen, not curated: the soonest one that
  // still has room and has a photograph to give. Nothing here is editorially
  // promoted, because there is no editor — and a "featured" slot that quietly
  // meant "we picked this" would be the first untrue thing on the board.
  const inShelf = new Set(soon.map((p) => p.id))
  const candidates = plans.filter((p: TrekPlanRow) => !inShelf.has(p.id))
  const featured: TrekPlanRow | undefined =
    candidates.find((p: TrekPlanRow) => p.spots_left > 0 && p.cover_urls?.length > 0) ??
    candidates.find((p: TrekPlanRow) => p.spots_left > 0)
  const rest = featured ? plans.filter((p: TrekPlanRow) => p.id !== featured.id) : plans

  const stats: [number, string][] = [
    [all.length, all.length === 1 ? 'walk live' : 'walks live'],
    [weekend.length, 'this weekend'],
    [kinds.length, 'kinds of outing'],
  ]

  return (
    <>
      <NavBar />
      <main>
        {/* ── Band one: the control surface, on ink ───────────────────────── */}
        <section className="bg-ink px-6 pb-8 pt-28 md:px-10 md:pt-32">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
              <div>
                <p className="trek-label font-mono text-dawn">
                  Discover · around Dehradun
                </p>
                <h1 className="mt-3 font-display text-[clamp(38px,7vw,72px)] font-light leading-[0.95] text-paper">
                  What is <span className="italic text-dawn">on.</span>
                </h1>
              </div>

              {/* The counts, set against the headline rather than under it —
                  the prototype's one piece of asymmetry, and what stops the
                  band reading as a title card. */}
              <dl className="flex gap-8">
                {stats.map(([n, label]) => (
                  <div key={label}>
                    <dt className="sr-only">{label}</dt>
                    <dd>
                      <span className="block font-mono text-3xl leading-none text-paper tabular-nums">
                        {n}
                      </span>
                      <span className="trek-label-xs mt-1.5 block font-mono text-paper/55">
                        {label}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <form action="/trek-buddy/discover" className="mt-8">
              <label htmlFor="q" className="sr-only">Search walks by place</label>
              <input
                id="q"
                name="q"
                defaultValue={sp.q ?? ''}
                placeholder="Search a place or a peak — Nag Tibba, Benog, Mussoorie…"
                className="w-full rounded-full border border-paper/25 bg-paper/[0.06] px-5 py-3.5 font-body text-sm text-paper backdrop-blur-sm placeholder:text-paper/45 focus:border-dawn focus:outline-none"
              />
            </form>

            <div className="mt-5">
              <BoardFilters counts={counts} tone="dark" withSearch={false} />
            </div>
          </div>
        </section>

        {/* ── Band two: what you can still get to ─────────────────────────── */}
        {soon.length > 0 && (
          <section className="bg-paper px-6 pt-10 md:px-10">
            <div className="mx-auto max-w-6xl">
              <TrekShelf plans={soon} />
            </div>
          </section>
        )}

        {/* ── Band three: one walk large, then everything ─────────────────── */}
        <section className="bg-paper px-6 pb-24 pt-2 md:px-10">
          <div className="mx-auto max-w-6xl">
            {featured && <Featured plan={featured} />}

            {rest.length === 0 && !featured ? (
              <div className="rounded-[6px] border border-dashed border-rule px-6 py-12 text-center">
                <p className="font-body text-sm text-text">Nothing matches that.</p>
                <p className="mt-1.5 font-body text-sm text-mid">
                  Nothing here is invented, so an empty result means an empty board rather than a
                  bad search.
                </p>
                <Link href="/trek-buddy/discover" className="trek-pill trek-pill-quiet font-body mt-5 inline-flex">
                  Clear the filters
                </Link>
              </div>
            ) : (
              <div className="mt-12 space-y-10">
                {bucketPlans(rest).map((bucket) => (
                  <div key={bucket.key}>
                    <div className="flex items-baseline gap-3 pb-3">
                      <h2 className="trek-label font-mono text-text">{bucket.label}</h2>
                      <span aria-hidden="true" className="h-px flex-1 bg-rule" />
                      <span className="font-mono text-[10px] text-mid tabular-nums">
                        {bucket.plans.length}
                      </span>
                    </div>
                    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {bucket.plans.map((p) => (
                        <li key={p.id}><TrekPlanCard plan={p} /></li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <FooterSection />
    </>
  )
}

/**
 * One walk at full width.
 *
 * Not the card scaled up — a different arrangement. The picture takes half, the
 * words take half, and the facts sit in a row beneath them, because at this
 * size a card's stacked layout leaves a column of text beside a lot of nothing.
 */
function Featured({ plan }: { plan: TrekPlanRow }) {
  const light = lightForTime(plan.start_time ?? '06:00')
  const when = new Date(plan.starts_at).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short',
  })
  const facts: [string, string][] = [
    ['Going', `${plan.going_count}/${plan.capacity}`],
    ['How hard', DIFFICULTY_LABEL[plan.difficulty] ?? plan.difficulty],
  ]
  if (plan.distance_km != null) facts.push(['Distance', `${plan.distance_km} km`])
  if (plan.gain_m != null) facts.push(['Climb', `${plan.gain_m.toLocaleString('en-IN')} m`])
  if (plan.cost_paise != null) {
    facts.push(['Cost share', plan.cost_paise === 0 ? 'Nothing' : `${formatPrice(plan.cost_paise)} each`])
  }

  return (
    <section className="mt-10">
      <p className="trek-label font-mono text-ember">Featured</p>
      <Link
        href={`/trek-buddy/${plan.id}`}
        className="trek-card group mt-3 grid overflow-hidden bg-paper-warm/50 md:grid-cols-2"
      >
        <div className="relative aspect-[16/10] md:aspect-auto md:min-h-[320px]">
          {plan.cover_urls?.[0] ? (
            <Image
              src={plan.cover_urls[0]}
              alt=""
              fill
              sizes="(min-width: 768px) 50vw, 92vw"
              placeholder="blur"
              blurDataURL={BLUR_DATA_URL}
              className="object-cover transition-transform duration-[900ms] group-hover:scale-[1.03]"
            />
          ) : (
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{ background: `linear-gradient(155deg, ${light.bar} 0%, #0C100D 82%)` }}
            />
          )}
        </div>

        <div className="flex flex-col justify-center p-6 md:p-10">
          <p className="trek-label font-mono text-mid">
            {when}
            {plan.start_time ? ` · ${plan.start_time.slice(0, 5)}` : ''}
            {' · '}
            <span style={{ color: light.ink }}>{light.label}</span>
          </p>
          <h3 className="mt-2 font-display text-[clamp(24px,3.4vw,38px)] leading-tight text-text">
            {plan.place}
          </h3>
          {plan.note && (
            <p className="mt-3 max-w-md font-body text-sm leading-relaxed text-mid">{plan.note}</p>
          )}

          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="trek-label-xs font-mono text-mid">{k}</dt>
                <dd className="mt-0.5 font-body text-sm text-text">{v}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-6 flex items-center gap-3 font-body text-xs text-mid">
            <span
              aria-hidden="true"
              className="grid h-6 w-6 place-items-center rounded-full bg-forest/12 font-mono text-[9px] text-forest"
            >
              {plan.host_name.trim().charAt(0).toUpperCase()}
            </span>
            {plan.host_name}
            <span className="text-rule">·</span>
            <Countdown iso={plan.starts_at} prefix="leaves in" className="font-mono tabular-nums text-ember" />
          </p>
        </div>
      </Link>
    </section>
  )
}
