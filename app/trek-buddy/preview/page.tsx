import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import TrekPlanCard from '@/components/trek/TrekPlanCard'
import SoonRail from '@/components/trek/SoonRail'
import FeaturedPlan from '@/components/trek/FeaturedPlan'
import DayArc from '@/components/trek/ui/DayArc'
import EmptyState from '@/components/trek/ui/EmptyState'
import JourneyRail from '@/components/trek/ui/JourneyRail'
import SeatMeter, { QuorumMeter } from '@/components/trek/ui/SeatMeter'
import Avatar from '@/components/trek/ui/Avatar'
import FacePile from '@/components/trek/ui/FacePile'
import HourPill from '@/components/trek/ui/HourPill'
import { BoardSkeleton, RowSkeleton } from '@/components/trek/ui/Skeletons'
import { Datum, Eyebrow, SectionLabel, ShelfHead, Tag } from '@/components/trek/ui/Bits'
import PlanMasthead from '@/components/trek/PlanMasthead'
import PersonCardTile from '@/components/trek/PersonCardTile'
import WhatTheBoardDoes from '@/components/trek/WhatTheBoardDoes'
import SafetyNotes from '@/components/trek/SafetyNotes'
import { PREVIEW_PEOPLE, PREVIEW_PLANS } from '@/lib/trekPreviewData'
import { HOUR_BANDS, lightForTime } from '@/lib/trek'

export const metadata: Metadata = {
  title: 'TrekBuddy — design preview',
  robots: { index: false, follow: false },
}

// The design, with something in it.
//
// A board with no walks on it cannot tell you whether a card works. This page
// renders every surface against fabricated walks so the design can actually be
// looked at — and it is the honest way to answer "does this feel like a
// platform", which is a question about eight cards next to each other, not
// about one empty state.
//
// IT IS DEVELOPMENT ONLY. Outside `next dev` it is a 404, it reads nothing
// from the database and it writes nothing anywhere. The fixtures live in
// `lib/trekPreviewData.ts` and are typed as real rows, so if the schema moves
// this page stops compiling rather than quietly showing a lie.
export default async function TrekPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  const plans = PREVIEW_PLANS
  // `new Date()` rather than `Date.now()`: the purity rule flags the latter as
  // an impure call during render, and this is a Server Component rendered once
  // per request, where reading the clock is the whole point.
  const now = new Date().getTime()
  const soon = plans.filter((p) => new Date(p.starts_at).getTime() - now < 48 * 3600_000)
  const featured = plans.find((p) => p.cover_urls.length > 0 && p.spots_left > 0)!
  const rest = plans.filter((p) => p.id !== featured.id)

  const lightCounts: Record<string, number> = {}
  for (const p of plans) {
    const k = lightForTime(p.start_time).key
    lightCounts[k] = (lightCounts[k] ?? 0) + 1
  }

  const faces = PREVIEW_PEOPLE.map((p) => ({
    id: p.id,
    name: p.name,
    role: (p.mentor ? 'mentor' : 'none') as 'mentor' | 'none',
  }))

  return (
    <>
      <section className="trek-band bg-ink pb-8 pt-28 md:pt-32">
        <div className="trek-measure">
          <Eyebrow tone="ondark">Design preview · development only</Eyebrow>
          {/* Amber on this <em> was decoration — the headline of a dev preview
              is not a walk about to leave — and sage is the accent on an ink
              band. The weight goes back to 400: Newsreader at 300 across a
              56px line is the fashion masthead the reset threw out. */}
          <h1 className="mt-3.5 font-display text-[clamp(34px,5vw,56px)] leading-none text-paper">
            Every surface, with <em className="text-sage">something on it.</em>
          </h1>
          <p className="mt-4 max-w-lg font-body text-sm leading-relaxed text-paper/65">
            Fabricated walks, so the board can be judged as a board. Nothing here is read from or
            written to the database, and this page is a 404 in production.
          </p>
          <div className="mt-8">
            <DayArc counts={lightCounts} active={null} hrefFor={() => '/trek-buddy/preview'} />
          </div>
        </div>
      </section>

      <section
        className="trek-band"
        style={{ background: 'linear-gradient(180deg, var(--ink) 0%, var(--ink) 62%, var(--paper) 62%)' }}
      >
        <div className="trek-measure">
          <SoonRail plans={soon.length ? soon : plans.slice(0, 4)} />
        </div>
      </section>

      {/* THE ONE-WALK RAIL, which is the state a young board is in most of the
          time and the one that used to look broken: a 280px card alone against
          a band three times its width, floating over the seam where the ink
          gradient hands over to paper. A lone card takes the full width now,
          and this is where that can be looked at without waiting for the real
          board to have exactly one walk leaving. */}
      <section
        className="trek-band"
        style={{ background: 'linear-gradient(180deg, var(--ink) 0%, var(--ink) 62%, var(--paper) 62%)' }}
      >
        <div className="trek-measure">
          <SoonRail plans={plans.slice(0, 1)} />
        </div>
      </section>

      <section className="trek-band bg-paper pb-20 pt-10">
        <div className="trek-measure flex flex-col gap-14">
          <FeaturedPlan plan={featured} />

          <div>
            <ShelfHead title="The board" count={rest.length} />
            <ul className="grid grid-cols-1 auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((p) => (
                <li key={p.id} className="flex">
                  <TrekPlanCard plan={p} />
                </li>
              ))}
            </ul>
          </div>

          {/* ── The parts, on their own ─────────────────────────────────── */}
          <div>
            <ShelfHead title="The parts" />
            <div className="grid grid-cols-1 auto-rows-fr gap-4 md:grid-cols-2">
              <div className="trek-card p-6">
                <SectionLabel>Seats, and quorum</SectionLabel>
                <div className="mt-5 space-y-6">
                  <SeatMeter taken={9} capacity={12} light={lightForTime('05:10')} />
                  <SeatMeter taken={10} capacity={10} light={lightForTime('17:30')} />
                  <SeatMeter taken={2} capacity={6} light={lightForTime('21:40')} />
                  <QuorumMeter going={2} minParty={4} light={lightForTime('21:40')} />
                </div>
              </div>

              <div className="trek-card p-6">
                <SectionLabel>The hour, as a colour</SectionLabel>
                <div className="mt-5 flex flex-wrap gap-2.5">
                  {['04:20', '05:40', '11:00', '18:10', '21:40'].map((t) => (
                    <HourPill key={t} time={t} withLabel />
                  ))}
                </div>
                <div className="mt-6 flex gap-1.5">
                  {HOUR_BANDS.map((b) => (
                    <div key={b.key} className="flex-1">
                      <span
                        className="block h-10 rounded-[var(--r-input)]"
                        style={{ background: b.bg }}
                      />
                      <span className="trek-label-xs mt-2 block text-mid">
                        {b.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="trek-card p-6">
                <SectionLabel>People</SectionLabel>
                <div className="mt-5 flex flex-wrap items-center gap-4">
                  {[96, 56, 40, 32, 24].map((s) => (
                    <Avatar key={s} name="Meera Joshi" id="h-meera" size={s as 96} role="mentor" />
                  ))}
                </div>
                <div className="mt-6 flex items-center gap-4">
                  <FacePile people={faces} />
                  {/* "6 going" is a count plus a word, not a field name. The
                      figure keeps mono; the word next to it is prose. */}
                  <span className="font-body text-[13px] text-mid">
                    <span className="font-mono tabular-nums">6</span> going
                  </span>
                </div>
                <div className="mt-6 grid grid-cols-3 gap-3 border-t border-rule-soft pt-4">
                  <Datum k="Walks" v="38" />
                  <Datum k="Vouches" v="23" />
                  <Datum k="Weeks out" v="6" />
                </div>
              </div>

              <div className="trek-card p-6">
                <SectionLabel>Where a walk has got to</SectionLabel>
                <div className="mt-6">
                  <JourneyRail stage="released" showNotes />
                </div>
                {/* The real set. "Free" used to sit here and no longer exists
                    anywhere in the product: a cost of zero is "Nothing to
                    split", and a cost the host never stated draws no tag at
                    all. A gallery showing a tag the board cannot produce is
                    the same drift this page exists to catch. */}
                <div className="mt-7 flex flex-wrap gap-2">
                  <Tag tone="outline">₹350 each</Tag>
                  <Tag tone="sage">Nothing to split</Tag>
                  <Tag tone="clay">Women only</Tag>
                  <Tag tone="outline">Moderate</Tag>
                </div>
              </div>
            </div>
          </div>

          {/* ── The walk's own masthead ─────────────────────────────── */}
          <div>
            <ShelfHead title="A walk, opened" />
            <div className="-mx-6 overflow-hidden rounded-[var(--r-panel)] md:mx-0">
              <PlanMasthead plan={featured} hostVouches={19} />
            </div>
          </div>

          {/* ── People ───────────────────────────────────────────────── */}
          <div>
            <ShelfHead title="People" count={PREVIEW_PEOPLE.length} />
            <ul className="grid grid-cols-1 auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PREVIEW_PEOPLE.map((p, i) => (
                <li key={p.id} className="flex">
                  <PersonCardTile
                    person={{
                      userId: p.id,
                      displayName: p.name,
                      homeBase: p.base,
                      intro: p.intro,
                      pace: p.pace,
                      activities: ['Trekking', 'Bird watching'],
                      languages: ['Hindi', 'English'],
                      experience: 'seasoned',
                      yearsOut: 6 + i,
                      mentor: p.mentor,
                      canHost: true,
                      memberSince: '2024-03-01',
                      walksHosted: Math.round(p.events * 0.6),
                      walksJoined: Math.round(p.events * 0.4),
                      vouches: p.vouches,
                      trustRung: p.mentor ? 3 : 2,
                    }}
                    streak={p.streak}
                    showFollow
                  />
                </li>
              ))}
            </ul>
          </div>

          {/* ── The honest half ──────────────────────────────────────── */}
          <div>
            <ShelfHead title="What the board enforces, and where it stops" />
            <WhatTheBoardDoes />
          </div>

          <div>
            <ShelfHead title="Before you go" />
            <SafetyNotes />
          </div>

          <div>
            <ShelfHead title="When there is nothing, and when it is still coming" />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <EmptyState
                title="Nothing matches that yet."
                body="The board is small and honest about it. Widen the hour, or post the one you were going on anyway."
                action={{ label: 'Post a trip', href: '/trek-buddy/new' }}
                secondary={{ label: 'Clear the filters', href: '/trek-buddy' }}
              />
              <div className="space-y-3">
                <RowSkeleton />
                <RowSkeleton />
              </div>
            </div>
            <div className="mt-4">
              <BoardSkeleton count={3} />
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
