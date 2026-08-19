import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getGuidance, getPerson, getTrekMembership, getTrekPlan } from '@/actions/trekBuddy'
import { getFollowState } from '@/actions/trekSocial'
import { getMyTrust } from '@/actions/trekTrust'
import { formatPrice } from '@/lib/utils'
import PlanActions from './PlanActions'
import PlanMasthead from '@/components/trek/PlanMasthead'
import PlanRail from '@/components/trek/PlanRail'
import SafetyNotes from '@/components/trek/SafetyNotes'
import PlanChat from '@/components/trek/PlanChat'
import { getMessages } from '@/actions/trekChat'
import RecapPanel from '@/components/trek/RecapPanel'
import { getRecap } from '@/actions/trekRecap'
import SafetyActions from '@/components/trek/SafetyActions'
import Guidance from '@/components/trek/Guidance'
import Evidence from '@/components/trek/Evidence'
import TrustCard from '@/components/trek/TrustCard'
import FollowButton from '@/components/trek/FollowButton'
import Avatar from '@/components/trek/ui/Avatar'
import SeatMeter from '@/components/trek/ui/SeatMeter'
import { MoreLink, SectionLabel } from '@/components/trek/ui/Bits'
import { DAY_PART_LABEL, DIFFICULTY_LABEL, dotColor, hourInk, lightForTime } from '@/lib/trek'

export const metadata: Metadata = {
  title: 'A walk — DEWDROPZ',
  robots: { index: false, follow: false },
}

type RosterRow = { user_id: string; display_name: string; status: string; message: string | null }

/**
 * How a host describes the speed they walk at.
 *
 * The same four words the profile offers and the directory prints, written out
 * here rather than imported from `PersonCardTile` because that file's copy is
 * private to it — but deliberately identical, since a member who reads "Brisk"
 * on somebody's profile has to find the same word on their walk or the two
 * screens are describing two different people.
 */
const PACE_LABEL: Record<string, string> = {
  slow: 'Slow', steady: 'Steady', brisk: 'Brisk', fast: 'Fast',
}

function istDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '—')

/** A card, the page's second-loudest surface. Header ruled off from the body. */
function Card({
  children,
  className = '',
  id,
}: {
  children: React.ReactNode
  className?: string
  id?: string
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-24 overflow-hidden rounded-[var(--r-card)] border border-rule bg-surface ${className}`}
    >
      {children}
    </section>
  )
}

/**
 * One folded group at the foot of the page.
 *
 * This is what replaced eleven identical `<Block>`s. The guidance, the safety
 * notes, the evidence about the host, the trust ladder and the report controls
 * were all rendered at exactly the volume of the thing a visitor came here to
 * do, which meant the page had no loudest element and the act of asking to come
 * was somewhere in the middle of a wall of 12px grey. None of that copy is
 * deleted — every sentence is still on the page, in full, one click away. What
 * changed is that it no longer competes with the walk.
 *
 * The marker is a `+` rotated into an `×`, because this product has no icon set
 * and a disclosure triangle is a browser default, not a decision.
 *
 * The face of it was 10px monospace, uppercase, tracked to 0.16em. That is a
 * stamp, and a stamp is not a thing you press — worse, it made "Take care of
 * yourself out there" and "Report this walk, or block the host" the two least
 * legible controls on a screen whose whole argument is that a cautious person
 * can find what they need. Sentence case, 14.5px, medium.
 */
function Disclosure({
  summary,
  children,
  open = false,
}: {
  summary: string
  children: React.ReactNode
  open?: boolean
}) {
  return (
    <details open={open} className="group border-b border-rule-soft last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-body text-[14.5px] font-medium text-text transition-colors hover:text-forest [&::-webkit-details-marker]:hidden">
        {summary}
        <span
          aria-hidden="true"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-rule font-body text-[13px] leading-none text-mid transition-transform duration-200 group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="pb-7">{children}</div>
    </details>
  )
}

/**
 * The section stamp, in clay.
 *
 * Written out rather than passed to `SectionLabel` as a className because that
 * component's own tone class and an override would both be colour utilities in
 * the same Tailwind layer, and which one won would come down to the order the
 * sheet happened to be generated in. Clay is the product's "where it stops"
 * colour: a walk called off, and getting back in the dark. It takes the shared
 * `trek-label` metrics now instead of its old 10px/0.22em monospace, which was
 * a section heading dressed as machine output.
 */
function ClayLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="trek-label text-clay-deep">{children}</h2>
}

/** A person, as a chip you can walk through to their page. */
function PersonChip({ id, name, tag }: { id: string; name: string; tag?: string }) {
  return (
    <Link
      href={`/trek-buddy/people/${id}`}
      className="flex items-center gap-2 rounded-full border border-rule-soft bg-paper py-[5px] pl-[5px] pr-3.5 transition-colors duration-200 hover:border-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
    >
      <Avatar name={name} id={id} size={26} />
      <span className="font-body text-[13px] text-text">{name}</span>
      {/* Forest, not ember. "host" is a role, not a countdown. */}
      {tag && <span className="trek-label-xs text-forest">{tag}</span>}
    </Link>
  )
}

export default async function TrekPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const membership = await getTrekMembership()
  if (!membership.signedIn) redirect(`/auth/login?redirect=/trek-buddy/${id}`)
  if (!membership.onboarded) redirect('/trek-buddy/setup')

  const data = await getTrekPlan(id)
  if (!data) notFound()

  const { plan, isHost, myStatus, meetingPoint, logistics, roster, waitlistPosition, walkIsOver, myCostState } = data

  const full = plan.spots_left <= 0
  const cancelled = plan.status === 'cancelled'
  const confirmed = myStatus === 'confirmed'
  const light = lightForTime(plan.start_time ?? '06:00')
  const multiDay = plan.ends_on !== plan.starts_on

  // Everything the page still needs, in one round trip rather than six.
  //
  // `getMessages` is fetched through the viewer's own session inside the
  // action, so a caller who is not on the walk gets an empty list from the
  // policy rather than a refusal this page would have to handle.
  //
  // The host's own card is new here: the page used to name the host and stop,
  // which on a board whose entire proposition is "a person decides who they
  // spend the day with" was the one thing a stranger most needed and could not
  // get without leaving the page.
  const [messages, recap, notes, host, follow, trust] = await Promise.all([
    getMessages(id),
    walkIsOver ? getRecap(id) : Promise.resolve(null),
    // What applies to THIS outing. Host notes are for the host; the women notes
    // ride along on a women-only walk because that is where they are load-bearing.
    getGuidance({
      activity: plan.activity,
      audiences: isHost
        ? ['all', 'host']
        : plan.women_only
          ? ['all', 'first_time', 'women']
          : ['all', 'first_time'],
      limit: 12,
    }),
    getPerson(plan.host_id),
    isHost ? Promise.resolve(null) : getFollowState(plan.host_id),
    isHost ? Promise.resolve(null) : getMyTrust(),
  ])

  const rosterRows = roster as RosterRow[]
  const goingRoster = rosterRows.filter((r) => r.status === 'confirmed')
  const askedCount = rosterRows.filter((r) => r.status === 'requested').length

  // Counted, never claimed — every one of these is derived in Postgres from
  // walks that actually happened. See migration 054.
  const hostStats = host
    ? [
        `${host.walksHosted} hosted`,
        `${host.walksJoined} joined`,
        host.vouches > 0 ? `${host.vouches} vouched` : null,
        host.homeBase,
      ].filter(Boolean).join(' · ')
    : null

  // ── The terms of the walk ──────────────────────────────────────────────
  //
  // The seven facts a cautious person is actually deciding on, in one ruled
  // table near the top of the page rather than scattered across a masthead, a
  // rail, a folded disclosure and — in the case of pace — a different screen
  // entirely. Women-only was a filter on the board that vanished the moment you
  // opened a walk; senior-friendly was never on this page at all; the minimum
  // party existed only as a meter caption; and the fact that the meeting point
  // is WITHHELD was a sentence in a grey paragraph beneath the fold.
  //
  // Every row says the fact and then says what the fact is worth, because half
  // of these are enforced in Postgres and half of them are a stranger's own
  // account of themselves, and somebody deciding whether to get into a shared
  // cab at 04:30 needs to know which is which. That distinction is the entire
  // product; hiding it behind a badge would be the dishonest version.
  //
  // The two rows that carry a positive constraint take a wash — clay for "who
  // may come at all", sage for "the host has thought about who this suits" —
  // so they are found by somebody scanning rather than only by somebody
  // reading. Everything else stays on paper: if every row were tinted, none of
  // them would be.
  const terms: {
    k: string
    v: React.ReactNode
    note: string
    wash?: string
  }[] = [
    {
      k: 'Difficulty',
      v: DIFFICULTY_LABEL[plan.difficulty] ?? plan.difficulty,
      note: 'Set by the host when they posted this. No walk on this board is allowed to leave it blank — but it is their judgement of the day, not a graded standard.',
    },
    {
      k: 'Pace',
      v: host?.pace ? `${PACE_LABEL[host.pace] ?? host.pace}, by the host’s own account` : 'The host has not stated a pace',
      note: 'Typed in on a profile, never measured. If “steady” has meant something different to you before, ask before the day rather than on the hill.',
    },
    {
      k: 'Languages',
      v: plan.languages.length > 0 ? plan.languages.join(' · ') : 'The host has not said',
      note: 'What the day is likely to be conducted in, so nobody spends it a step outside the conversation.',
    },
    {
      k: 'Who may come',
      v: plan.women_only ? 'Women only' : 'Any member may ask',
      note: plan.women_only
        ? 'Enforced in the database, not by a note asking politely: only a woman can post this walk and only women can ask to join it.'
        : 'The host still decides every person individually, one at a time, and declining is silent.',
      wash: plan.women_only ? 'bg-clay-wash/70' : undefined,
    },
    {
      k: 'Slower walkers',
      v: plan.senior_friendly ? 'Marked senior friendly' : 'Not marked senior friendly',
      note: plan.senior_friendly
        ? 'A field the host set deliberately, and a filter on the board. It means they expect to walk at a pace that keeps the party together.'
        : 'Not a refusal — the host simply has not said either way. It is a fair thing to ask them before you commit to the day.',
      wash: plan.senior_friendly ? 'bg-sage-soft/70' : undefined,
    },
    {
      k: 'Smallest party',
      v: (
        <>
          <span className="font-mono tabular-nums">{plan.min_party}</span> people
        </>
      ),
      note: `This walk needs ${plan.min_party} people going before the exact meeting point is released to anybody at all.`,
    },
    {
      k: 'Meeting point',
      v: meetingPoint ? 'Released to you' : 'Withheld',
      note: meetingPoint
        ? 'It is in the panel beside this one. It was never on the public page, and it reached you because the host confirmed you.'
        : 'Never on the public page. It reaches walkers the host has confirmed, and only once the party is big enough — a walk nobody joins hands its address to nobody.',
    },
  ]

  return (
    <>
      <PlanMasthead plan={plan} hostVouches={host?.vouches ?? null} />

      {/* Two columns, the design's proportion. The left is what you read; the
          right is what you do, and it stays with you — which is the difference
          between a page and a screen. One column below lg, because a 360px rail
          beside a 375px phone is not a rail. */}
      <section className="trek-band bg-paper pb-24 pt-12">
        <div className="trek-measure grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
          <div className="flex min-w-0 flex-col gap-10">
            {/* Clay, never red. A walk that was called off is a disappointment,
                not an error, and the reason the host gave is the only part of
                it worth reading. The edge is 2px because border width encodes
                state, and this is the one critical fact on the page. */}
            {cancelled && (
              <div className="rounded-[var(--r-card)] border-2 border-clay bg-clay-wash px-5 py-4">
                <ClayLabel>Called off</ClayLabel>
                <p className="mt-2 font-body text-[15px] leading-relaxed text-text">
                  {plan.cancel_reason
                    ? `The host called this one off — ${plan.cancel_reason}`
                    : 'The host called this one off.'}
                </p>
              </div>
            )}

            {/* What happened. First, once it has, because a walk that
                demonstrably took place is the only argument this board can make
                that is not a promise. The composer appears for the host alone,
                and only after the walk — RLS and the trigger enforce both, so
                this condition governs a button, not access. */}
            {(recap || (isHost && walkIsOver)) && (
              <Card>
                <div className="border-b border-rule-soft px-6 py-[18px]">
                  <SectionLabel>{recap ? 'How it went' : 'Write the recap'}</SectionLabel>
                </div>
                <div className="p-6">
                  <RecapPanel
                    planId={plan.id}
                    userId={membership.userId!}
                    recap={recap}
                    canWrite={isHost && walkIsOver}
                    hostName={plan.host_name}
                  />
                </div>
              </Card>
            )}

            {/* ── 1 · What this walk asks of you ───────────────────────────
                Built above, and first on the page on purpose: this is the
                screen where somebody decides to spend a day with strangers,
                and the facts that decide it should not be something they have
                to go looking for. */}
            <Card id="terms">
              <div className="border-b border-rule-soft px-6 py-[18px]">
                <SectionLabel>What this walk asks of you</SectionLabel>
              </div>
              <dl className="divide-y divide-rule-soft">
                {terms.map((t) => (
                  <div
                    key={t.k}
                    className={`grid gap-x-6 gap-y-1 px-6 py-4 sm:grid-cols-[150px_minmax(0,1fr)] ${
                      t.wash ?? ''
                    }`}
                  >
                    <dt className="trek-label text-mid sm:pt-1">{t.k}</dt>
                    <dd className="min-w-0">
                      <p className="font-body text-[15px] font-medium leading-snug text-text">
                        {t.v}
                      </p>
                      <p className="mt-1 font-body text-[13px] leading-relaxed text-mid">
                        {t.note}
                      </p>
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>

            {/* ── 2 · The plan ─────────────────────────────────────────────
                The host's own words, set as the product's one serif lede
                rather than as body copy. It was 14px grey Archivo under a mono
                label, which is the same size and weight as the liability
                disclaimer eight sections below it — so the one paragraph on
                the page written by a human being about a specific Saturday
                read as boilerplate. `trek-lede` sets it at 400 rather than the
                350 it was hand-rolled at: Newsreader below 400 is a hairline,
                and a hairline is a fashion masthead. */}
            <section>
              <SectionLabel>The plan</SectionLabel>
              {plan.note ? (
                <p className="trek-lede mt-3.5 max-w-[640px] text-text">{plan.note}</p>
              ) : (
                <p className="mt-3.5 max-w-[640px] font-body text-sm leading-relaxed text-mid">
                  The host has not written anything beyond the facts above.
                </p>
              )}

              {/* Clay, because this is the "where it stops" half — how everyone
                  gets off the hill in the dark is the part of an after-dark
                  walk that goes wrong. */}
              {plan.night_note && (
                <div className="mt-6 border-l-2 border-clay pl-4">
                  <ClayLabel>{DAY_PART_LABEL[plan.day_part]} · getting back</ClayLabel>
                  <p className="mt-2 font-body text-sm leading-relaxed text-text">
                    {plan.night_note}
                  </p>
                </div>
              )}
            </section>

            {/* ── 3 · The day, hour by hour ────────────────────────────────
                The best data in the schema, and it got four grey lines with a
                1px hairline down the side. Every moment now takes ITS OWN
                hour's colour — so a trek that leaves before light, summits in
                the middle of the day and comes down at dusk is drawn as indigo
                → amber → green → clay, and the timeline is literally the day
                passing. That is the board's one idea, applied where the data is
                richest rather than only on the cards. */}
            {plan.itinerary.length > 0 && (
              <section>
                <SectionLabel>The day, hour by hour</SectionLabel>
                <ol className="mt-4 flex flex-col">
                  {plan.itinerary.map((m, i) => {
                    const at = lightForTime(m.at)
                    const dot = dotColor(at, 'light')
                    const next = plan.itinerary[i + 1]
                    const nextDot = next ? dotColor(lightForTime(next.at), 'light') : dot
                    const last = i === plan.itinerary.length - 1
                    return (
                      <li key={`${m.at}-${i}`} className="flex gap-5">
                        <div className="flex flex-col items-center">
                          <span
                            aria-hidden="true"
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{
                              background: dot,
                              boxShadow: '0 0 0 3px var(--paper), 0 0 0 4px var(--rule)',
                            }}
                          />
                          {!last && (
                            <span
                              aria-hidden="true"
                              className="w-0.5 flex-1"
                              style={{ background: `linear-gradient(180deg, ${dot}, ${nextDot})` }}
                            />
                          )}
                        </div>
                        <div className={`-mt-[3px] min-w-0 ${last ? '' : 'pb-[26px]'}`}>
                          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                            <span
                              className="font-mono text-sm tabular-nums"
                              style={{ color: hourInk(at, 'light') }}
                            >
                              {m.at}
                            </span>
                            <span className="font-body text-[15px] leading-snug text-text">
                              {m.label}
                            </span>
                          </div>
                          {m.detail && (
                            <p className="mt-1 font-body text-[13px] leading-relaxed text-mid">
                              {m.detail}
                            </p>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ol>
                <p className="mt-1 font-body text-xs leading-relaxed text-mid">
                  The host&apos;s plan for the day, not a timetable. Hills and weather do what
                  they like.
                </p>
              </section>
            )}

            {/* ── 4 · Bring ────────────────────────────────────────────────
                Read standing over a rucksack the night before, which is why
                these are chips a person can count and not a sentence. */}
            {plan.bring.length > 0 && (
              <section>
                <SectionLabel>Bring</SectionLabel>
                <ul className="mt-3.5 flex flex-wrap gap-2">
                  {plan.bring.map((b) => (
                    <li
                      key={b}
                      className="rounded-full border border-rule bg-surface px-4 py-2 font-body text-[13px] text-text"
                    >
                      {b}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── 5 · Going ────────────────────────────────────────────────
                A board about finding people to go with showed no people. The
                roster itself is host-only — `getTrekPlan` does not even query
                it for anybody else — so this card does not pretend otherwise
                with anonymised initials. It shows the host, who is public, the
                count as seats, and one sentence saying plainly who can see the
                rest. An honest absence beats a decorative one. */}
            <Card className="p-6">
              <div className="flex items-baseline justify-between gap-3">
                <SectionLabel>
                  Going · {plan.going_count} of {plan.capacity}
                </SectionLabel>
                {isHost && (
                  <MoreLink href={`/trek-buddy/${plan.id}/console`}>Manage roster</MoreLink>
                )}
              </div>

              <ul className="mt-4 flex flex-wrap gap-2.5">
                <li>
                  <PersonChip id={plan.host_id} name={plan.host_name} tag="host" />
                </li>
                {goingRoster.map((r) => (
                  <li key={r.user_id}>
                    <PersonChip id={r.user_id} name={r.display_name} />
                  </li>
                ))}
              </ul>

              <SeatMeter
                taken={plan.going_count}
                capacity={plan.capacity}
                light={light}
                className="mt-5"
              />

              {!isHost && (
                <p className="mt-3 font-body text-[13px] leading-relaxed text-mid">
                  Who else is coming is shown to the host and nobody else — the board is not a
                  directory of people to approach.
                  {confirmed && ' You will meet the party by name in the group chat below.'}
                </p>
              )}

              {isHost && askedCount > 0 && (
                <p className="mt-4 border-t border-rule-soft pt-3 font-body text-xs leading-relaxed text-mid tabular-nums">
                  {askedCount === 1 ? '1 person has' : `${askedCount} people have`} asked to come,
                  waiting on you.
                </p>
              )}

              {(full || typeof waitlistPosition === 'number') && (
                <p className="mt-4 border-t border-rule-soft pt-3 font-body text-xs leading-relaxed text-mid tabular-nums">
                  {typeof waitlistPosition === 'number'
                    ? `This walk is full and you are number ${waitlistPosition} in the queue.`
                    : 'This walk is full. The queue moves in order when somebody drops out.'}
                </p>
              )}
            </Card>

            {/* ── 6 · Group chat ───────────────────────────────────────────
                Shown to the confirmed party and the host, which is exactly who
                RLS lets read it — the condition here decides whether a box
                appears, not whether anybody can see the messages. Getting it
                wrong would render an empty box, not leak a word. */}
            {(confirmed || isHost) && (
              <Card id="chat">
                <div className="flex items-center justify-between gap-3 border-b border-rule-soft px-6 py-[18px]">
                  <SectionLabel>Group chat</SectionLabel>
                  <MoreLink href="/trek-buddy/messages">Open chat</MoreLink>
                </div>
                <div className="p-6">
                  <PlanChat planId={plan.id} messages={messages} meId={membership.userId!} />
                </div>
              </Card>
            )}

            {/* ── 7 · The host ─────────────────────────────────────────────
                The person whose decision this whole page turns on. */}
            <Card className="p-6">
              <div className="flex flex-wrap items-center gap-5">
                <Avatar
                  name={plan.host_name}
                  id={plan.host_id}
                  size={64}
                  role="host"
                  href={`/trek-buddy/people/${plan.host_id}`}
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/trek-buddy/people/${plan.host_id}`}
                    className="trek-h3 text-text transition-colors hover:text-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
                  >
                    {plan.host_name}
                  </Link>
                  <p className="mt-1.5 font-body text-[13.5px] leading-relaxed text-mid">
                    {host?.intro?.trim() || 'They have not written an introduction yet.'}
                  </p>
                  {/* Counted, never claimed — and therefore not dressed as a
                      stamp. It was 10px uppercase mono at 0.1em, which set
                      "3 hosted · 12 joined · Dehradun" in the typeface this
                      product reserves for instrument readings; two thirds of
                      that string is words. */}
                  {hostStats && (
                    <p className="mt-2 font-body text-[13px] text-mid tabular-nums">{hostStats}</p>
                  )}
                </div>
                {/* Never on your own walk: following yourself is nonsense the
                    database also refuses. */}
                {/* The compact variant — the pill alone. What following does and
                    does not get you is spelled out in full on the host's own
                    page, and repeating the paragraph in the corner of a card
                    would make a saved search the loudest thing in it. */}
                {!isHost && follow && (
                  <FollowButton
                    personId={plan.host_id}
                    personName={plan.host_name}
                    initialFollowing={follow.following}
                    followers={follow.followers}
                    variant="compact"
                  />
                )}
              </div>
            </Card>

            {/* ── 8 · Everything else, folded ──────────────────────────────
                Seven `<Block>`s of guidance, safety, evidence and controls,
                each with its own mono stamp and its own hairline, all at the
                same volume as the walk itself. Same words, one band, opened by
                the person they apply to. */}
            <section className="border-t border-rule pt-6">
              <SectionLabel>Before you go, and the small print</SectionLabel>

              <div className="mt-2">
                {/* The loudest safety control on the page, and the one with no
                    platform obligation attached: somebody off the platform
                    knowing where you are beats anything this shop can enforce.
                    Open by default for the people it applies to — folding it
                    shut would be the one fold that costs something. */}
                {confirmed && (
                  <Disclosure summary="Tell someone who is not coming" open>
                    <p className="font-body text-sm text-mid">
                      Copy this to a friend or someone at home before you set off.
                    </p>
                    {/* Written out rather than templated with dashes: a trek with
                        no stated hour must not produce "at —, back by —" in the one
                        message somebody sends home before walking into the hills. */}
                    <p className="mt-3 rounded-[var(--r-input)] bg-paper-warm px-4 py-3 font-body text-sm leading-relaxed text-text">
                      I&apos;m going {plan.activity_label.toLowerCase()} at {plan.place} on{' '}
                      {istDay(plan.starts_at)}
                      {multiDay
                        ? `, back on ${istDay(plan.ends_at)}`
                        : plan.back_by
                          ? `, back by ${hhmm(plan.back_by)}`
                          : ''}
                      . Meeting around {plan.meet_area}
                      {plan.start_time ? ` at ${hhmm(plan.start_time)}` : ''}. Organised through
                      DEWDROPZ Trek Buddy by {plan.host_name}.
                    </p>
                  </Disclosure>
                )}

                {confirmed && plan.cost_paise != null && plan.cost_paise > 0 && (
                  <Disclosure summary="How the cost share works">
                    <p className="font-body text-sm text-text">
                      {formatPrice(plan.cost_paise)} each
                      {myCostState === 'settled' && ' — the host has you down as squared up.'}
                      {myCostState === 'on_the_day' && ' — the host has you down as paying on the day.'}
                      {(myCostState === 'owed' || myCostState === null) && ' — not settled yet.'}
                    </p>
                    <p className="mt-1.5 font-body text-xs leading-relaxed text-mid">
                      Split at face value between the people going. Nothing is paid through this
                      site and DEWDROPZ never sees the money — this is the host&apos;s own note, so
                      sort it out with them directly.
                    </p>
                  </Disclosure>
                )}

                {notes.length > 0 && (
                  <Disclosure summary={`Before you go ${plan.activity_label.toLowerCase()}`}>
                    <Guidance
                      notes={notes}
                      title={`Before you go ${plan.activity_label.toLowerCase()}`}
                      intro="From people who have done this around here. Not rules — the things that are only obvious afterwards."
                    />
                  </Disclosure>
                )}

                <Disclosure summary="Take care of yourself out there">
                  <SafetyNotes variant="compact" />
                </Disclosure>

                {/* What is actually known about the person you would be
                    spending a day with. Not a badge — every row says what it
                    does and does not prove. */}
                {!isHost && host && (
                  <Disclosure summary={`What is known about ${plan.host_name}`}>
                    <Evidence person={host} />
                  </Disclosure>
                )}

                {/* Here rather than only on the profile page, because this is
                    where "why can I not ask to join this one" gets asked. */}
                {!isHost && trust && (
                  <Disclosure summary="What a host filtering their walk can see about you">
                    <TrustCard trust={trust} />
                  </Disclosure>
                )}

                {/* A host cannot report their own walk — there is a Cancel
                    button for that, and a self-report is only ever a mistake. */}
                {!isHost && (
                  <Disclosure summary="Report this walk, or block the host">
                    <SafetyActions planId={plan.id} />
                  </Disclosure>
                )}
              </div>

              <p className="mt-6 border-t border-rule pt-5 font-body text-xs leading-relaxed text-mid">
                DEWDROPZ does not organise, lead, vet or supervise this walk and has not checked
                who anyone on it is. Go at your own risk and turn back if conditions change.
                Emergency: <span className="font-mono font-medium text-text tabular-nums">112</span>
                .
              </p>
            </section>
          </div>

          <PlanRail
            plan={plan}
            meetingPoint={meetingPoint}
            logistics={logistics}
            isHost={isHost}
            myStatus={myStatus}
            walkIsOver={walkIsOver}
            myCostState={myCostState}
          >
            {isHost && plan.status === 'open' && (
              <Link
                href={`/trek-buddy/${plan.id}/console`}
                className="trek-pill trek-pill-act font-body mb-5 w-full justify-center"
              >
                Manage this walk →
              </Link>
            )}
            <PlanActions
              planId={plan.id}
              isHost={isHost}
              myStatus={myStatus}
              full={full}
              cancelled={cancelled}
              roster={rosterRows}
              waitlistPosition={waitlistPosition}
            />
          </PlanRail>
        </div>
      </section>
    </>
  )
}
