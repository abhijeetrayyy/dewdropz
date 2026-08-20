import type { TrekPlanRow } from '@/actions/trekBuddy'
import Countdown from './Countdown'
import { costLabel, lightForTime } from '@/lib/trek'
import SeatMeter, { QuorumMeter } from './ui/SeatMeter'
import JourneyRail, { type JourneyStage } from './ui/JourneyRail'
import { LiveDot, MoreLink, SectionLabel, Tag } from './ui/Bits'

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
 * Four cards, in the order a decision is made: what this costs you and the act
 * itself; where you are actually going; how to bring somebody; and where you
 * stand in the loop.
 *
 * WHY THE MEETING POINT IS NOW HERE, having been deliberately excluded before.
 * The old comment argued that a component rendering for people who cannot see
 * the point should never be handed it. That reasoning protected the wrong
 * thing: `meetingPoint` arrives from `getTrekPlan` through the VIEWER'S OWN
 * session against `trek_plan_details`, so RLS has already decided — a caller
 * who is not entitled gets null, and there is no branch here that could hand
 * out a value the database did not release. Keeping it a floor below meant the
 * best mechanic in the product (an address that unlocks at quorum) was a
 * sentence in a paragraph while the rail showed a button. It is a meter now.
 *
 * WHERE THE AMBER WENT. This rail used to be the loudest amber surface on the
 * product: an amber departure figure, an amber countdown, an amber 2px edge
 * around the released meeting point, and amber section stamps on three of the
 * four cards. Amber means one thing now — a clock is running — so it survives
 * on the "leaves in" line and nowhere else. The released meeting point takes
 * forest and sage instead, which is the palette's colour for a thing that has
 * been confirmed, and the departure figure is simply paper: it is the largest
 * thing in the panel, and size was already saying everything colour was.
 */
export default function PlanRail({
  plan,
  children,
  meetingPoint,
  logistics,
  isHost,
  myStatus,
  walkIsOver,
  myCostState,
}: {
  plan: TrekPlanRow
  /** PlanActions — the ask, withdraw, or host controls. */
  children: React.ReactNode
  /** The exact spot, or null. Which of the two the database decided, not this. */
  meetingPoint: string | null
  logistics: string | null
  isHost: boolean
  myStatus: string | null
  walkIsOver: boolean
  /** What the host has this viewer down as for the split. Confirmed people only. */
  myCostState?: 'owed' | 'settled' | 'on_the_day' | null
}) {
  const light = lightForTime(plan.start_time ?? '06:00')
  const cancelled = plan.status === 'cancelled'
  const confirmed = myStatus === 'confirmed'
  const day = new Date(plan.starts_at).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short',
  })
  const nights = Math.round(
    (new Date(plan.ends_on).getTime() - new Date(plan.starts_on).getTime()) / 86400000
  )

  // The rail's headline figure is whatever the walk is measured in. A day walk
  // is measured in the hour it leaves; a four-day trek is measured in days, and
  // rendering "06:00" for it would be inventing a departure the host never set.
  const headline = plan.start_time ? plan.start_time.slice(0, 5) : `${nights + 1} days`

  // Mono is for a figure. "Nothing to split" and "Cost not stated" are answers,
  // not amounts, and setting them in a tabular face made the panel claim a
  // precision it did not have. The wording itself is `costLabel`'s now — this
  // panel was the only one of three surfaces telling the truth about a null,
  // and three components each reading the same column their own way is how a
  // walk came to be "Free" on the board and "Not stated" on its own page.
  const cost = costLabel(plan.cost_paise)

  // The ladder, for this viewer, on this walk. Highest rung actually reached —
  // and the point being released outranks being confirmed because it is the
  // thing that happens after it.
  const stage: JourneyStage = walkIsOver
    ? 'walked'
    : meetingPoint
      ? 'released'
      : confirmed
        ? 'confirmed'
        : myStatus === 'requested' || myStatus === 'waitlisted'
          ? 'asked'
          : 'none'

  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-[88px] lg:self-start">
      {/* ── The act ────────────────────────────────────────────────────────
          Dark, on a paper column, because it is the one element on this page
          that is a control panel rather than prose. */}
      <div className="rounded-[var(--r-panel)] bg-ink p-6 shadow-[var(--shadow-panel)]">
        <div className="flex items-baseline justify-between gap-3">
          <p className="trek-figure-lg text-paper">{headline}</p>
          {/* A date in a fixed column is one of the four things mono is still
              for. The uppercase and the 0.14em tracking are gone: this is a
              reading, not a stamp. */}
          <p className="font-mono text-[13px] text-paper/65 tabular-nums">{day}</p>
        </div>

        {cancelled ? (
          <p className="mt-3">
            <Tag tone="clay">Called off by the host</Tag>
          </p>
        ) : walkIsOver ? (
          <p className="mt-2.5 font-body text-[13px] text-sage">
            <span aria-hidden="true">✓</span> This one has happened
          </p>
        ) : (
          // The one amber on the whole screen, and the only thing on the board
          // amber is still allowed to mean: a clock is running. Dawn-soft
          // rather than dawn, because #A76F1E on ink is a colour you can see
          // and not a colour you can read.
          <p className="mt-2.5 flex items-center gap-2">
            <LiveDot color="var(--dawn-soft)" />
            <span className="font-body text-[13px] text-dawn-soft">Leaves in</span>
            <Countdown
              iso={plan.starts_at}
              prefix=""
              className="font-mono text-[13px] font-medium text-dawn-soft tabular-nums"
            />
          </p>
        )}

        <SeatMeter
          taken={plan.going_count}
          capacity={plan.capacity}
          light={light}
          ground="dark"
          className="mt-5"
        />

        <div className="mt-[18px] border-t border-paper/12 pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="trek-label text-paper/55">Cost share</span>
            <span
              className={
                cost.isFigure
                  ? 'font-mono text-sm text-paper tabular-nums'
                  : `font-body text-sm ${cost.stated ? 'text-paper' : 'text-paper/60'}`
              }
            >
              {cost.text}
            </span>
          </div>
          {/* Shown to the walker on purpose. A note a host keeps about you that
              you cannot see is the version of this worth objecting to; reading
              it is what makes it correctable. It states a state, so it is
              sentence case: uppercase at 0.12em is a stamp, and a stamp cannot
              be argued with. */}
          {confirmed && plan.cost_paise != null && plan.cost_paise > 0 && (
            <p
              className={`mt-2 font-body text-[12.5px] leading-relaxed ${
                myCostState === 'settled' ? 'text-sage' : 'text-paper/60'
              }`}
            >
              {myCostState === 'settled'
                ? '✓ the host has you down as squared up'
                : myCostState === 'on_the_day'
                  ? 'You are down as paying on the day'
                  : 'Not settled yet'}
            </p>
          )}
        </div>

        {/* The decision. Whatever PlanActions decides you are — asking,
            waitlisted, going, or the host — it lands here rather than at the
            bottom of the page. */}
        <div className="mt-[18px] border-t border-paper/12 pt-4">{children}</div>
      </div>

      {/* ── Where you are actually going ───────────────────────────────────
          Two cards, and which one you get is the whole mechanic. This is the
          single most safety-relevant fact on the screen for a person deciding
          whether to meet strangers at dawn, so both states say plainly what is
          being withheld and what would release it — the withheld version is
          not an empty slot with a lock on it. */}
      {meetingPoint ? (
        <div className="rounded-[var(--r-panel)] border-2 border-forest bg-sage-soft p-5">
          <h2 className="trek-label text-forest">Exact meeting point</h2>
          <p className="mt-2.5 font-body text-base leading-relaxed text-text">{meetingPoint}</p>
          {logistics && (
            <p className="mt-2 font-body text-sm leading-relaxed text-mid">{logistics}</p>
          )}
          <p className="mt-3 border-t border-forest/20 pt-3 font-body text-xs leading-relaxed text-mid">
            This was never on the public page. It reached you because the host confirmed you and
            the walk has {plan.min_party} people going.
          </p>
        </div>
      ) : (
        <div className="trek-provisional rounded-[var(--r-panel)] p-5">
          <h2 className="trek-label text-text">Exact meeting point · withheld</h2>
          <QuorumMeter
            going={plan.going_count}
            minParty={plan.min_party}
            light={light}
            className="mt-3"
          />
          <p className="mt-3 font-body text-[13px] leading-relaxed text-mid">
            {confirmed
              ? `It is never on the public page. It reaches you here once ${plan.min_party} people are going.`
              : `Shown to walkers the host has confirmed, once ${plan.min_party} people are going. A walk nobody joins hands its address to nobody.`}
          </p>
        </div>
      )}

      {/* ── Bringing somebody ──────────────────────────────────────────────
          The invite card is minted by the host and can be revoked, so the link
          only exists for the person who can actually do it. Everyone else gets
          the same card stating what sharing this walk would and would not
          expose, which is the part worth reading either way. */}
      <div className="rounded-[var(--r-panel)] border border-rule bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>Bring a friend</SectionLabel>
          {isHost && <MoreLink href={`/trek-buddy/${plan.id}/console`}>Invite card</MoreLink>}
        </div>
        <p className="mt-2.5 font-body text-[13px] leading-relaxed text-mid">
          {isHost
            ? 'Turn on a share link for somebody who is not on the board. They see the page — the where stays hidden until you confirm them.'
            : 'Only the host can hand out a link to this one. Anybody they send it to sees the page, and the where stays hidden until the host confirms them.'}
        </p>
      </div>

      {/* ── The loop, and where this viewer is on it ───────────────────────
          Ask → confirmed → point → walked → vouched was described in four
          different paragraphs on four different screens and drawn nowhere. */}
      <div className="rounded-[var(--r-panel)] border border-rule bg-surface p-5">
        <SectionLabel>Where you stand</SectionLabel>
        <JourneyRail stage={stage} layout="stack" className="mt-4" />
      </div>
    </aside>
  )
}
