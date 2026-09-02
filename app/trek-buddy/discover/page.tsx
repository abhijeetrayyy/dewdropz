import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import TrekPlanCard from '@/components/trek/TrekPlanCard'
import SoonRail from '@/components/trek/SoonRail'
import FeaturedPlan from '@/components/trek/FeaturedPlan'
import BoardFilters from '@/components/trek/BoardFilters'
import DayArc from '@/components/trek/ui/DayArc'
import EmptyState from '@/components/trek/ui/EmptyState'
import QuickStart from '@/components/trek/QuickStart'
import HostAccess from '@/components/trek/HostAccess'
import RecentRecaps from '@/components/trek/RecentRecaps'
import WhatTheBoardDoes from '@/components/trek/WhatTheBoardDoes'
import { Eyebrow, ShelfHead } from '@/components/trek/ui/Bits'
import {
  getLeavingSoon, getMyHostRequest, getTrekBoard, getTrekMembership, type TrekPlanRow,
} from '@/actions/trekBuddy'
import { getRecentRecaps } from '@/actions/trekRecap'
import { bucketPlans } from '@/lib/trekBuckets'
import { ACTIVITIES, lightForTime } from '@/lib/trek'

export const metadata: Metadata = {
  title: 'Discover — TrekBuddy',
  robots: { index: false, follow: false },
}

/** The search params this page reads, so the stat filters can rebuild the URL. */
type BoardParams = Record<string, string | undefined>

/**
 * A headline count that is also the filter for it.
 *
 * Toggles one boolean parameter and carries every other one through unchanged,
 * so pressing "senior friendly" while looking at Sunday keeps you on Sunday.
 * It is a link rather than a button because the board's whole filter state
 * lives in the URL and is meant to be sendable — the same reason the chips are
 * links on the People page.
 */
function StatFilter({
  k,
  v,
  param,
  on,
  sp,
}: {
  k: string
  v: number
  param: string
  on: boolean
  sp: BoardParams
}) {
  const q = new URLSearchParams()
  for (const [key, val] of Object.entries(sp)) if (val && key !== param) q.set(key, String(val))
  if (!on) q.set(param, '1')
  const s = q.toString()

  return (
    <Link
      href={s ? `/trek-buddy/discover?${s}` : '/trek-buddy/discover'}
      aria-pressed={on}
      className={`group rounded-[var(--r-input)] transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sage ${
        on ? '' : 'opacity-90 hover:opacity-100'
      }`}
    >
      <p className={`trek-figure ${on ? 'text-sage' : 'text-paper'}`}>{v}</p>
      <p
        className={`trek-datum-key inline-flex items-center gap-1.5 border-b pb-0.5 transition-colors ${
          on
            ? 'border-sage text-sage'
            : 'border-paper/25 text-paper/60 group-hover:border-paper/60 group-hover:text-paper/85'
        }`}
      >
        {k}
        {on && <span aria-hidden="true">×</span>}
      </p>
    </Link>
  )
}

// The board: everything that is on, and every way to cut it.
//
// This WAS /trek-buddy, and making it the front door was the mistake. Landing a
// member on a search surface answers a question they have not asked yet — it
// says "here is a filterable index of 11 things" to somebody who wanted to know
// what is going on and whether anybody is waiting on them. A board is a
// destination you go to once you know what you are after; it is not an
// orientation. So /trek-buddy is now Today, and this is the place you come when
// you want to look properly.
//
// Three bands, and the banding is the point — a page that changes ground under
// your feet is telling you the job changed:
//
//   INK · the control surface. What is on, which part of the day, how to narrow
//     it. All of it once, before a single walk appears.
//   INK → PAPER · what is leaving inside 48 hours, on the seam.
//   PAPER · one walk given the width, then the buckets people think in.
export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{
    activity?: string; when?: string; q?: string; light?: string
    difficulty?: string; language?: string
    womenOnly?: string; senior?: string; spots?: string
  }>
}) {
  const sp = await searchParams
  const membership = await getTrekMembership()
  if (!membership.signedIn) redirect('/auth/login?redirect=/trek-buddy/discover')

  // A page whose only content is a button to another page is a wasted click.
  if (!membership.onboarded) redirect('/trek-buddy/setup')

  const [plans, all, soon, recaps, hostRequest] = await Promise.all([
    getTrekBoard({
      activity: sp.activity,
      when: sp.when as 'all' | 'week' | 'weekend',
      q: sp.q,
      difficulty: sp.difficulty,
      language: sp.language,
      womenOnly: sp.womenOnly === '1',
      seniorFriendly: sp.senior === '1',
      hasSpots: sp.spots === '1',
    }),
    getTrekBoard(),
    getLeavingSoon(),
    getRecentRecaps(4),
    getMyHostRequest(),
  ])

  // The chips carry honest counts off the UNFILTERED board — a filter that
  // says "Camping 0" is more useful than one that hides itself.
  const counts: Record<string, number> = { all: all.length }
  for (const a of ACTIVITIES) counts[a.key] = all.filter((p) => p.activity === a.key).length

  // The day arc counts the same way, and then filters the board by band.
  const lightCounts: Record<string, number> = {}
  for (const p of all) {
    const k = lightForTime(p.start_time).key
    lightCounts[k] = (lightCounts[k] ?? 0) + 1
  }

  const activeLight = sp.light ?? null
  const shown = activeLight
    ? plans.filter((p) => lightForTime(p.start_time).key === activeLight)
    : plans

  const hrefForLight = (key: string | null) => {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(sp)) if (v && k !== 'light') q.set(k, String(v))
    if (key) q.set('light', key)
    const s = q.toString()
    return s ? `/trek-buddy/discover?${s}` : '/trek-buddy/discover'
  }

  // One walk given the whole width. Chosen, not curated: the soonest one that
  // still has room, preferring one with a photograph to give.
  const inRail = new Set(soon.map((p) => p.id))
  const candidates = shown.filter((p) => !inRail.has(p.id))
  const featured: TrekPlanRow | undefined =
    candidates.find((p) => p.spots_left > 0 && p.cover_urls?.length > 0) ??
    candidates.find((p) => p.spots_left > 0)
  // From `candidates`, not from `shown`. `inRail` was built to keep the rail's
  // walks out of the featured slot and then not used again, so anything leaving
  // inside 48 hours was drawn twice on one screen — once in the rail and once
  // in a bucket below it. Today already does this correctly (`fresh` is the
  // board minus `soon`); the board, which is the screen people actually browse,
  // did not, and a board that prints the same walk twice reads as a board with
  // more on it than there is.
  const rest = featured ? candidates.filter((p) => p.id !== featured.id) : candidates
  const buckets = bucketPlans(rest)

  const filtered =
    Boolean(sp.q || sp.activity || sp.when || sp.difficulty || sp.language ||
      sp.womenOnly || sp.senior || sp.spots || sp.light)

  // Counted off the UNFILTERED board, like the chip counts, so the header
  // describes the board rather than describing the cut of it you happen to be
  // looking at. The last two are here because they are the two facts a person
  // is most likely to be looking for and least likely to guess exist: a walk
  // only women may join, and a walk whose host has said outright that it is
  // paced for somebody who does not want to be chased up a hill.
  const withRoom = all.filter((p) => p.spots_left > 0).length
  const womenOnlyCount = all.filter((p) => p.women_only).length
  const seniorCount = all.filter((p) => p.senior_friendly).length

  return (
    <>
      {/* ── Band one · the control surface ──────────────────────────────── */}
      <section className="trek-band bg-ink pb-7 pt-28 md:pt-32">
        <div className="trek-measure">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
            {/* The masthead was "What is <em>on.</em>" — 60px Newsreader at
                weight 300 with the last word in italic amber. Three problems in
                one line: it is a slogan rather than a name, so a member landing
                here could not tell what screen they were on; hairline serif at
                60px is a fashion masthead; and amber on this board means a
                clock is running, which is not what a full stop means. So the
                headline says what the screen is, and the line under it says
                what is on it — in the actual numbers, which is also the most
                honest thing a young board can do. */}
            <div className="max-w-2xl">
              <Eyebrow tone="ondark">A members’ noticeboard · around Dehradun</Eyebrow>
              <h1 className="trek-h1 mt-3.5 text-paper">The board</h1>
              <p className="mt-4 font-body text-[15px] leading-[1.65] text-paper/70">
                {all.length === 0 ? (
                  'Nothing is on the board right now. The first walk posted is the one that makes it a board.'
                ) : (
                  <>
                    <span className="font-mono text-paper tabular-nums">{all.length}</span>{' '}
                    {all.length === 1 ? 'walk is' : 'walks are'} on the board, and{' '}
                    {soon.length === 0 ? (
                      'none of them leaves inside the next 48 hours'
                    ) : (
                      <>
                        <span className="font-mono text-paper tabular-nums">{soon.length}</span>{' '}
                        {soon.length === 1 ? 'leaves' : 'leave'} inside 48 hours
                      </>
                    )}
                    . Every one of them states its distance, its climb and how hard it is before
                    you ask to join.
                  </>
                )}
              </p>
            </div>
            {/* THE COUNTS ARE THE CONTROLS.
                These three were static figures sitting directly above a
                disclosure you had to open to act on any of them — the board
                advertised that it has walks only women may join and walks paced
                for somebody older, and then made you go looking for the switch.
                Each one is now the filter it describes, and it shows whether it
                is the cut you are currently looking at.

                "With room" only appears when it is not the whole board. A
                statistic that reads "10 walks are on the board" beside "10 with
                room" is telling you nothing twice. */}
            <dl className="flex flex-wrap gap-x-8 gap-y-4 pb-1">
              {withRoom !== all.length && (
                <StatFilter k="with room" v={withRoom} param="spots" on={sp.spots === '1'} sp={sp} />
              )}
              <StatFilter
                k="women only"
                v={womenOnlyCount}
                param="womenOnly"
                on={sp.womenOnly === '1'}
                sp={sp}
              />
              <StatFilter
                k="senior friendly"
                v={seniorCount}
                param="senior"
                on={sp.senior === '1'}
                sp={sp}
              />
            </dl>
          </div>

          <form action="/trek-buddy/discover" className="mt-7">
            <label htmlFor="q" className="sr-only">Search walks by place</label>
            <input
              id="q"
              name="q"
              defaultValue={sp.q ?? ''}
              placeholder="Search a place or a peak — Nag Tibba, Benog, Mussoorie…"
              className="w-full rounded-[var(--r-input)] border border-paper/25 bg-paper/[0.06] px-4 py-3.5 font-body text-sm text-paper backdrop-blur-[8px] placeholder:text-paper/55 focus:border-sage focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
            />
          </form>

          {/* The day, as an index. The fastest possible answer to "is there
              anything early this week?", which is the question people arrive
              with — and it is also the control that answers it. */}
          <div className="mt-6">
            <DayArc counts={lightCounts} active={activeLight as never} hrefFor={hrefForLight as never} />
          </div>

          <div className="mt-6">
            <BoardFilters counts={counts} tone="dark" withSearch={false} />
          </div>
        </div>
      </section>

      {/* ── Band two · what you can still get to ────────────────────────── */}
      {soon.length > 0 && (
        <section
          className="trek-band"
          style={{ background: 'linear-gradient(180deg, var(--ink) 0%, var(--ink) 62%, var(--paper) 62%)' }}
        >
          <div className="trek-measure">
            <SoonRail plans={soon} />
          </div>
        </section>
      )}

      {/* ── Band three · the board ──────────────────────────────────────── */}
      <section className="trek-band bg-paper pb-24 pt-10">
        <div className="trek-measure flex flex-col gap-12">
          {shown.length === 0 ? (
            <EmptyState
              title={
                filtered
                  ? 'Nothing matches that yet.'
                  : 'Nothing is on the board right now.'
              }
              body={
                filtered ? (
                  <>
                    The board is small and honest about it — {all.length} walk
                    {all.length === 1 ? '' : 's'} live in total. Widen the hour, or post the one
                    you were going to go on anyway.
                  </>
                ) : (
                  <>
                    Nobody has posted a trip yet. The first one on a board is the one that makes it
                    a board, and it is usually somebody going somewhere they were going anyway.
                  </>
                )
              }
              // Nothing for a non-host here any more. "Finish your profile"
              // was a dead end dressed as a next step: completing a profile
              // grants no hosting rights and never has. The honest offer is
              // below, in HostAccess, and it is the one that actually moves
              // somebody.
              action={
                membership.canHost ? { label: 'Post a trip', href: '/trek-buddy/new' } : undefined
              }
              secondary={filtered ? { label: 'Clear the filters', href: '/trek-buddy/discover' } : undefined}
            />
          ) : (
            <>
              {featured && <FeaturedPlan plan={featured} />}

              {buckets.map((b) => (
                <div key={b.key}>
                  <ShelfHead title={b.label} count={b.plans.length} />
                  <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {b.plans.map((p) => (
                      <li key={p.id} className="flex">
                        <TrekPlanCard plan={p} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {/* The one act, at the foot, for somebody who read the whole
                  board and did not find their walk on it. */}
              {membership.canHost && (
                <div className="trek-provisional flex flex-wrap items-center justify-between gap-5 px-6 py-7">
                  <p className="max-w-md font-body text-sm leading-relaxed text-mid">
                    Nothing here is the trip you had in mind? Post it — a plan with an hour on it
                    finds company far more often than a message asking whether anyone is going.
                  </p>
                  <Link href="/trek-buddy/new" className="trek-pill trek-pill-act font-body">
                    Post a trip
                  </Link>
                </div>
              )}
            </>
          )}

          {/* The six ways to start one. On an empty board this is the most
              useful thing on the screen, and on a full one it is still the
              fastest route from "I was going anyway" to a posted walk — the
              component existed and was mounted nowhere. */}
          {membership.canHost && shown.length === 0 && <QuickStart canHost />}

          {/* And for everybody else, the thing that was missing entirely: a way
              to become one of the people who can put something here. */}
          {!membership.canHost && <HostAccess state={hostRequest} />}
        </div>
      </section>

      {/* ── Band four · what already happened ───────────────────────────
          Everything above this line is a promise. A trip with photographs and
          a paragraph written after the fact is the only thing on the board
          that could not have been posted by somebody who never left the
          house — which makes it the most persuasive section here, and it was
          rendering nowhere. */}
      {recaps.length > 0 && (
        <section className="trek-band border-t border-rule bg-paper py-16 md:py-20">
          <div className="trek-measure">
            <RecentRecaps recaps={recaps} />
          </div>
        </section>
      )}

      {/* ── Band four · what this board enforces, and where that stops ────
          The signed-out landing page argues the safety model in full, and a
          member never sees that page again after the day they join. So from
          the moment they are signed in, the only account of what the board
          actually enforces lived on a plan page they might never scroll to —
          which meant the honest half of the product was, in practice, shown
          once to strangers and never again to the people relying on it.

          It goes at the foot of the board because that is where the argument
          belongs: above it are two dozen invitations from people nobody has
          checked, and the last thing under them should be the plain account of
          what asking to join one does and does not get you. It renders whether
          or not there are walks — an empty board is if anything the better
          moment to read it. */}
      <section className="trek-band border-t border-rule-warm bg-paper-warm py-16 md:py-20">
        <div className="trek-measure">
          <h2 className="trek-h2 max-w-3xl text-text">
            What this board enforces, and where that enforcement stops.
          </h2>
          <p className="mt-4 max-w-2xl font-body text-[15px] leading-relaxed text-mid">
            Both halves, in the same type at the same weight — because only one of them is
            reassuring and you need the other one more.
          </p>
          <WhatTheBoardDoes className="mt-10" />
        </div>
      </section>
    </>
  )
}
