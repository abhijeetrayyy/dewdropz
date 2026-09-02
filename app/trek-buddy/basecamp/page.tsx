import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import Inbox, { RequestQueue, type HostRequest } from '@/components/trek/Inbox'
import YouCard, { type VouchPrompt } from '@/components/trek/YouCard'
import Avatar from '@/components/trek/ui/Avatar'
import SeatMeter from '@/components/trek/ui/SeatMeter'
import { HourBar } from '@/components/trek/ui/HourPill'
import EmptyState from '@/components/trek/ui/EmptyState'
import { Datum, Eyebrow, MoreLink, SectionLabel, Tag } from '@/components/trek/ui/Bits'
import {
  getBasecamp, getMyHostRequest, getMyTrekCard, getMyTreks, getNotifications, getPerson,
  getTrekMembership, getTrekPlan, getVouchable, type TrekPlanRow,
} from '@/actions/trekBuddy'
import HostAccess from '@/components/trek/HostAccess'
import { getFollowingCount } from '@/actions/trekSocial'
import { getStreak } from '@/actions/trekRecap'
import { DAY_PART_LABEL, DIFFICULTY_LABEL, hourInk, lightForTime } from '@/lib/trek'

export const metadata: Metadata = {
  title: 'Basecamp — DEWDROPZ',
  robots: { index: false, follow: false },
}

// ── Basecamp: the account home ───────────────────────────────────────────────
//
// The dashboard's job used to be split across two pages that were each half of
// it. `/yours` held the inbox and three identical lists of cards — hosting,
// going, waiting — and `/basecamp` held a feed of what people you follow had
// posted, with no faces in it. Neither was a dashboard: one was a filing
// cabinet and the other was a filtered copy of the board, and the single
// question a member actually arrives with — *what is waiting on me* — was
// answered by neither.
//
// So they are one page, and it opens with the answer. `/yours` is now a
// redirect, and nothing it could show has been dropped: the inbox is the feed
// at the foot of the left column, and its three card lists are one list of
// meter rows ordered by departure, because "hosting", "going" and "waiting" are
// three states of the same object and splitting them by state meant reading
// three lists to find out what Saturday looks like.
//
// THE REQUESTS QUEUE IS THE POINT. Deciding who comes existed only one walk at
// a time, on that walk's own page, from a display name and one sentence — while
// the database already knew how many people had vouched for the asker, how many
// walks they had finished and how long they had been here. This page gathers
// every ask onto one desk and puts that evidence next to the button.
export default async function BasecampPage() {
  const membership = await getTrekMembership()
  if (!membership.signedIn) redirect('/auth/login?redirect=/trek-buddy/basecamp')
  if (!membership.onboarded) redirect('/trek-buddy/setup')

  const [mine, inbox, me, follows, followingCount, vouchable, streak, hostRequest] = await Promise.all([
    getMyTreks(),
    getNotifications(),
    getMyTrekCard(),
    getBasecamp(),
    getFollowingCount(),
    getVouchable(),
    getStreak(membership.userId),
    getMyHostRequest(),
  ])

  // ── Who is waiting on you ─────────────────────────────────────────────────
  //
  // Assembled from the actions that already exist rather than from a new query:
  // `getTrekPlan` is the only thing that hands a host the roster for a walk,
  // and it refuses it to anybody who is not the host — which is exactly the
  // guard this page wants and precisely the one it must not reimplement. It is
  // a fan-out over the walks you host, which is a list that is small by
  // construction (upcoming, uncancelled, yours), and every branch runs in
  // parallel.
  const hosting = mine.hosting
  const details = await Promise.all(hosting.map((p) => getTrekPlan(p.id)))

  type RosterRow = {
    user_id: string; display_name: string
    status: string; message: string | null; created_at: string
  }
  const asks = details.flatMap((d, i) =>
    ((d?.roster ?? []) as RosterRow[])
      .filter((r) => r.status === 'requested')
      .map((r) => ({ plan: hosting[i], r }))
  )

  const askingByPlan: Record<string, number> = {}
  for (const a of asks) askingByPlan[a.plan.id] = (askingByPlan[a.plan.id] ?? 0) + 1

  // One card per person, not per ask — somebody who asked to come on two of
  // your walks is one lookup and one reputation.
  const askerIds = [...new Set(asks.map((a) => a.r.user_id))]
  const askerCards = await Promise.all(askerIds.map((id) => getPerson(id)))
  const cardOf = new Map(askerIds.map((id, i) => [id, askerCards[i]]))

  const requests: HostRequest[] = asks
    .map(({ plan, r }): HostRequest => {
      const c = cardOf.get(r.user_id) ?? null
      return {
        planId: plan.id,
        place: plan.place,
        userId: r.user_id,
        // The roster carries the name it was written with; the person card is
        // the current one. Prefer the current, fall back rather than blank.
        name: c?.displayName ?? r.display_name,
        message: r.message,
        askedAt: r.created_at,
        vouches: c?.vouches ?? 0,
        walks: (c?.walksHosted ?? 0) + (c?.walksJoined ?? 0),
        memberSince: c?.memberSince ?? null,
        // The safety half of the evidence, and it was already sitting in the
        // card being thrown away here. A host deciding whether a stranger joins
        // them for a day should not have to open a second page to find out
        // whether that person has ever verified a number.
        trustRung: c?.trustRung ?? null,
      }
    })
    // Oldest ask first. A queue sorted any other way punishes the person who
    // has been waiting longest, and waiting is the whole complaint.
    .sort((a, b) => a.askedAt.localeCompare(b.askedAt))

  // ── Your events ───────────────────────────────────────────────────────────
  //
  // One list, ordered by departure, carrying its role in a tag. Three lists of
  // identical cards were three answers to a question nobody asks; a walker
  // wants to know what their next three weekends look like, and that is a
  // calendar, not a taxonomy.
  type EventRow = { plan: TrekPlanRow; role: 'hosting' | 'confirmed' | 'requested' }
  const confirmed = mine.going.filter((g) => g.status === 'confirmed')
  const waiting = mine.going.filter((g) => g.status === 'requested')
  const events: EventRow[] = [
    ...hosting.map((plan): EventRow => ({ plan, role: 'hosting' })),
    ...mine.going.map((g): EventRow => ({
      plan: g.plan, role: g.status === 'confirmed' ? 'confirmed' : 'requested',
    })),
  ].sort((a, b) => a.plan.starts_at.localeCompare(b.plan.starts_at))

  // ── Vouches you owe ───────────────────────────────────────────────────────
  const owed = vouchable.reduce((n, w) => n + w.people.filter((p) => !p.vouched).length, 0)
  const latestOwed = vouchable.find((w) => w.people.some((p) => !p.vouched))
  const vouchPrompt: VouchPrompt | null =
    owed > 0 && latestOwed
      ? {
          count: owed,
          place: latestOwed.place,
          names: latestOwed.people.filter((p) => !p.vouched).map((p) => p.display_name),
        }
      : null

  // ── The clock, read once, on the server ───────────────────────────────────
  //
  // IST is a fixed +05:30 with no daylight saving, so the offset arithmetic is
  // exact and — unlike a locale-formatted hour — cannot be handed back as "24"
  // by a different ICU build. Nothing here re-reads the clock in the browser:
  // this band is a greeting and a date, not a ticker.
  const now = new Date()
  const ist = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60_000)
  const hour = ist.getHours()
  const greeting = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : hour < 21 ? 'Evening' : 'Late one'
  const firstName = (membership.displayName ?? me?.displayName ?? 'there').split(/\s+/)[0]
  const today = now.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long',
  })

  // The second line of the headline, and it is never a welcome. Whatever is
  // most true about this account right now, in order of what it costs somebody
  // else if you do not act on it: a person waiting, then a walk you have
  // committed to, then a vouch you owe, then news, then the board.
  const nextUp = events[0]
  const line = ((): string => {
    if (requests.length === 1) return 'One person is waiting on you.'
    if (requests.length > 1) return `${requests.length} people are waiting on you.`
    if (nextUp) {
      const at = nextUp.plan.start_time ? ` at ${nextUp.plan.start_time.slice(0, 5)}` : ''
      return `Your next walk leaves ${dayOf(nextUp.plan.starts_at)}${at}.`
    }
    if (owed === 1) return 'One vouch is still yours to write.'
    if (owed > 1) return `${owed} vouches are still yours to write.`
    if (inbox.unread > 0) {
      const n = inbox.unread
      return `${n} ${n === 1 ? 'thing has' : 'things have'} happened since you last looked.`
    }
    if (follows.length > 0) {
      const n = follows.length
      return `${n} walk${n === 1 ? '' : 's'} from people you follow ${n === 1 ? 'is' : 'are'} still open.`
    }
    // The last two are still specific: the profile prompt names the one field
    // a stranger will miss, and the floor names the board rather than
    // congratulating you on an empty page.
    if (me?.nextUp) return `${me.nextUp.prompt}.`
    return 'Nothing is waiting on you — the board is where this starts.'
  })()

  const tiles: { k: string; v: number; href: string; urgent?: boolean }[] = [
    { k: 'waiting on you', v: requests.length, href: '#decide', urgent: requests.length > 0 },
    { k: 'you are hosting', v: hosting.length, href: '#events' },
    { k: 'you are going', v: confirmed.length, href: '#events' },
    { k: 'new since you looked', v: inbox.unread, href: '#feed' },
  ]

  return (
    <>
      {/* ── Band one · who you are and what is on you ────────────────────── */}
      <section className="trek-band bg-ink pb-9 pt-28 md:pt-32">
        <div className="trek-measure">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
            <div className="min-w-0">
              <Eyebrow tone="ondark">Basecamp · {today}</Eyebrow>
              <h1 className="trek-h1 mt-4 text-paper">
                {greeting}, {firstName}.
                <br />
                <span className="text-paper/60">{line}</span>
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* The streak is a state, not an act and not a clock: nobody is
                  waiting on it and nothing expires. It used to be an amber
                  outline with a ✦ in front of it, which spent this board's one
                  warning colour on a pat on the back — the amber on this screen
                  now belongs entirely to the count of people waiting on you.
                  Sage is the accent an ink band takes, the number is mono
                  because it is a number, and the word beside it is not. */}
              {streak > 0 && (
                <span className="inline-flex items-center gap-2 rounded-full border border-paper/20 px-4.5 py-2.5 font-body text-[13px] text-paper/70">
                  {streak === 1 ? (
                    'Out this week'
                  ) : (
                    <>
                      <span className="font-mono font-medium text-sage tabular-nums">{streak}</span>
                      weeks running
                    </>
                  )}
                </span>
              )}
              {/* On ink the act is a paper fill — forest-on-ink is a button you
                  have to hunt for. */}
              {membership.canHost && (
                <Link
                  href="/trek-buddy/new"
                  className="trek-pill trek-pill-actinv font-body focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
                >
                  Host another
                </Link>
              )}
            </div>
          </div>

          {/* Four counts, and each one is a door to the thing it counts — a
              dashboard number you cannot press is a poster.

              ONE OF THEM IS AMBER, AND ONLY ONE. Every tile used to take a dawn
              border on hover and a dawn focus ring, so the tile that meant
              "three people cannot get on with their weekend until you decide"
              looked like the tile counting walks you are going on. Amber is the
              warning lamp on this board; the only number on this screen with a
              person on the other end of it is the first one, and it is the only
              one that lights. */}
          {/* `auto-rows-fr`: on a phone these sit two-up, and a label that wraps
              to a second line ("waiting on you") made its tile 12px taller than
              the one beside it. Four figures that are meant to be read as a set
              have to sit in a set of identical boxes. */}
          <dl className="mt-8 grid auto-rows-fr grid-cols-2 gap-3 md:grid-cols-4">
            {/* The div wrapper is not decoration: an <a> may not be a direct
                child of a <dl>, and this is a definition list whose values
                happen to be doors. */}
            {tiles.map((t) => (
              <div key={t.k}>
                <Link
                  href={t.href}
                  className={`block rounded-[var(--r-card)] px-5 py-4.5 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage ${
                    t.urgent
                      ? 'border border-dawn/55 bg-dawn/[0.09] hover:bg-dawn/[0.14]'
                      : 'border border-paper/12 bg-paper/[0.04] hover:border-paper/25 hover:bg-paper/[0.07]'
                  }`}
                >
                  <Datum k={t.k} v={t.v} tone="dark" />
                </Link>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Band two · the desk ──────────────────────────────────────────── */}
      <section className="trek-band bg-paper pb-24 pt-10">
        <div className="trek-measure grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-9">
            <RequestQueue requests={requests} canHost={membership.canHost} />

            {/* ── Your events ───────────────────────────────────────────── */}
            <section id="events" className="scroll-mt-24">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 pb-4">
                <h2 className="trek-h2 text-text">
                  Your events{' '}
                  {events.length > 0 && (
                    <span className="font-mono text-[15px] text-mid tabular-nums">
                      · {events.length}
                    </span>
                  )}
                </h2>
                {/* Basecamp ends at `ends_at` by design — it answers "what is
                    still ahead of me". That left finished trips with no door at
                    all, which is what /past is. Placed on this heading rather
                    than in the rail because this list is exactly the thing it
                    is the other half of. */}
                <MoreLink href="/trek-buddy/past">What you have done</MoreLink>
              </div>

              {/* This screen was already the only one telling the truth about
                  the gate — "Hosting is invite-only while this is new." It just
                  had nothing to offer after it. Outside the empty/non-empty
                  branch on purpose: somebody already going on other people's
                  walks is exactly who should be offered the chance to post one. */}
              {!membership.canHost && <HostAccess state={hostRequest} className="mb-4" />}

              {events.length === 0 ? (
                <EmptyState
                  title="Nothing on your calendar."
                  body={
                    <>
                      {membership.canHost
                        ? 'You have not posted a trip. The board fills up when people who are already going say so.'
                        : 'Hosting is invite-only while this is new.'}{' '}
                      Nothing is confirmed either — ask to come on something from the board.
                    </>
                  }
                  action={
                    membership.canHost
                      ? { label: 'Post a trip', href: '/trek-buddy/new' }
                      : { label: 'See what is on', href: '/trek-buddy' }
                  }
                  secondary={membership.canHost ? { label: 'See what is on', href: '/trek-buddy' } : undefined}
                />
              ) : (
                <>
                  <ul className="flex flex-col gap-2.5">
                    {events.map(({ plan, role }) => {
                      const light = lightForTime(plan.start_time)
                      const asking = askingByPlan[plan.id] ?? 0
                      return (
                        <li key={`${role}:${plan.id}`}>
                          <Link
                            href={`/trek-buddy/${plan.id}`}
                            className="trek-row flex flex-wrap items-center gap-x-4.5 gap-y-3 px-5 py-4 transition-colors duration-200 hover:border-rule-warm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
                          >
                            <HourBar light={light} height={56} />

                            <span className="w-[76px] shrink-0">
                              <span
                                className="block font-mono text-[15px] leading-none tabular-nums"
                                style={{ color: hourInk(light, 'light') }}
                              >
                                {plan.start_time ? plan.start_time.slice(0, 5) : '—'}
                              </span>
                              <span className="mt-1.5 block font-mono text-[12px] leading-none text-mid tabular-nums">
                                {shortDate(plan.starts_at)}
                              </span>
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="trek-h3 block truncate text-text">{plan.place}</span>
                              <span className="mt-1 block truncate font-body text-[13px] text-mid">
                                {role === 'hosting'
                                  ? 'You are hosting'
                                  : role === 'confirmed'
                                    ? `You are going · hosted by ${plan.host_name}`
                                    : `You asked · waiting on ${plan.host_name}`}
                                {plan.distance_km ? ` · ${plan.distance_km} km` : ''}
                                {plan.gain_m ? ` · ${plan.gain_m} m up` : ''}
                              </span>

                              {/* ── The facts a body has to agree to ─────────
                                  How hard, whether it runs in the dark, and
                                  whether it is a women-only or a slower-pace
                                  walk were on the card you decided from and
                                  then vanished the moment the walk landed on
                                  your own calendar — so the one list you look
                                  at on the Friday before was the one list that
                                  did not say what Saturday involves. They are
                                  the same tags the board uses, so a walk looks
                                  like itself wherever you meet it. */}
                              <span className="mt-2 flex flex-wrap items-center gap-1.5">
                                <Tag tone="outline">
                                  {DIFFICULTY_LABEL[plan.difficulty] ?? plan.difficulty}
                                </Tag>
                                {plan.day_part !== 'day' && (
                                  <Tag tone="outline">{DAY_PART_LABEL[plan.day_part]}</Tag>
                                )}
                                {plan.women_only && <Tag tone="clay">Women only</Tag>}
                                {/* No `!women_only` guard, and "friendly" not
                                    "ok" — the same correction the board card
                                    got, because the comment above promises
                                    these are the same tags and that promise is
                                    only kept if both move together. This row
                                    wraps, so it never needed the guard for
                                    space in the first place. */}
                                {plan.senior_friendly && (
                                  <Tag tone="sage">Senior friendly</Tag>
                                )}
                              </span>
                            </span>

                            <SeatMeter
                              taken={plan.going_count}
                              capacity={plan.capacity}
                              light={light}
                              className="w-[170px] shrink-0"
                            />

                            {/* A state, so it is sentence case and it is not
                                monospace. The only one of the four that takes
                                amber is "3 asking", which is the same fact the
                                queue at the top of the page is counting. */}
                            <span
                              className={`shrink-0 font-body text-[13px] font-medium ${
                                role === 'hosting'
                                  ? asking > 0
                                    ? 'text-ember'
                                    : 'text-mid'
                                  : role === 'confirmed'
                                    ? 'text-forest'
                                    : 'text-clay-deep'
                              }`}
                            >
                              {role === 'hosting'
                                ? asking > 0
                                  ? `${asking} asking`
                                  : 'Hosting'
                                : role === 'confirmed'
                                  ? 'Going'
                                  : 'Waiting'}
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>

                  {/* ── The asks nobody answered ────────────────────────────
                      A request that was never decided stays `requested`
                      forever: the row trigger stops it becoming `confirmed`
                      once the trek leaves, no job settles it, and none of the
                      seven notification kinds fires on time passing. So the
                      person who asked used to get silence and then absence —
                      the trip simply dropped off this list at its start time
                      and was never mentioned again.

                      Derived, never written, and deliberately quiet: this is a
                      closing note, not a grievance. It exists so the answer to
                      "what happened to that one?" is on the screen. */}
                  {mine.lapsed.length > 0 && (
                    <div className="mt-6 rounded-[var(--r-card)] border border-rule-warm bg-paper-warm px-4 py-3.5">
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mid">
                        Never answered
                      </p>
                      <ul className="mt-2 flex flex-col gap-1.5">
                        {mine.lapsed.map(({ plan }) => (
                          <li key={plan.id} className="font-body text-[13px] leading-snug text-mid">
                            <Link
                              href={`/trek-buddy/${plan.id}`}
                              className="text-text underline-offset-4 hover:underline"
                            >
                              {plan.place}
                            </Link>{' '}
                            set off without a reply from {plan.host_name}.
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2.5 font-body text-[12px] leading-relaxed text-light">
                        Hosts are not obliged to answer, and a full walk often just fills up.
                        Nothing was held against you.
                      </p>
                    </div>
                  )}

                  {/* The one thing on this list that could leave somebody at a
                      dark bus stand, so it is set as a note against the ground
                      rather than as a 12px grey afterthought under a list. */}
                  {waiting.length > 0 && (
                    <p className="mt-4 rounded-[var(--r-card)] border border-rule-warm bg-paper-warm px-4 py-3 font-body text-[13px] leading-relaxed text-text">
                      Hosts are people, not a system. If nobody has answered by the day before,
                      assume it is not happening and make another plan.
                    </p>
                  )}
                </>
              )}
            </section>

            {/* ── What has happened ─────────────────────────────────────── */}
            <Inbox items={inbox.items} unread={inbox.unread} />
          </div>

          {/* ── The rail ───────────────────────────────────────────────── */}
          <aside className="flex flex-col gap-4 lg:sticky lg:top-[88px]">
            {me && <YouCard me={me} vouchPrompt={vouchPrompt} />}

            <div className="rounded-[var(--r-panel)] border border-rule bg-surface p-5">
              <div className="flex items-baseline justify-between gap-3">
                <SectionLabel as="h3">From people you follow</SectionLabel>
                {follows.length > 0 && (
                  <span className="font-mono text-[13px] text-mid tabular-nums">
                    {follows.length}
                  </span>
                )}
              </div>

              {follows.length === 0 ? (
                // Two very different situations, and one box for both would be
                // wrong in whichever case the reader is actually in: following
                // nobody is a thing you fix in one click; following people who
                // have not posted is nobody's fault.
                <EmptyState
                  className="mt-3.5"
                  title={
                    followingCount === 0
                      ? 'You are not following anybody yet.'
                      : `Nothing from the ${followingCount} ${followingCount === 1 ? 'person' : 'people'} you follow.`
                  }
                  body={
                    followingCount === 0 ? (
                      <>
                        Following somebody puts their next walk here. They are not told, and it
                        gives you no standing when you ask to come on one — it is a saved search,
                        nothing more.
                      </>
                    ) : (
                      <>
                        They have not posted anything upcoming. Nothing is invented to fill this
                        space — the board has everything.
                      </>
                    )
                  }
                  action={
                    followingCount === 0
                      ? { label: 'See who is out there', href: '/trek-buddy/people' }
                      : undefined
                  }
                  secondary={followingCount === 0 ? undefined : { label: 'Back to the board', href: '/trek-buddy' }}
                />
              ) : (
                <>
                  <ul className="mt-1.5">
                    {follows.slice(0, 6).map((p) => {
                      const light = lightForTime(p.start_time)
                      return (
                        <li key={p.id}>
                          <Link
                            href={`/trek-buddy/${p.id}`}
                            className="group flex items-center gap-3 border-b border-rule-soft py-3 transition-colors last:border-b-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
                          >
                            <HourBar light={light} height={34} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-body text-[14px] font-medium text-text transition-colors group-hover:text-forest">
                                {p.place}
                              </span>
                              {/* The hour and the date are figures and stay
                                  mono; the host is a person and does not. A
                                  name set in tabular monospace beside a
                                  timestamp reads as a row in a log. */}
                              <span className="mt-0.5 block truncate font-body text-[12px] text-mid">
                                <span className="font-mono tabular-nums">
                                  {p.start_time ? `${p.start_time.slice(0, 5)} · ` : ''}
                                  {shortDate(p.starts_at)}
                                </span>
                                {' · '}
                                {p.host_name}
                              </span>
                            </span>
                            <Avatar name={p.host_name} id={p.host_id} size={26} />
                          </Link>
                        </li>
                      )
                    })}
                  </ul>

                  <p className="mt-3.5 font-body text-[12px] leading-relaxed text-mid">
                    Everything here is on the board too — following just saves you the scrolling.
                    It gives you no standing when you ask to come on one of these.
                  </p>
                  {follows.length > 6 && (
                    <MoreLink href="/trek-buddy" className="mt-3 inline-block">
                      The rest are on the board
                    </MoreLink>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>
      </section>
    </>
  )
}

/** "Saturday, 23 Aug" — the day named, because a date alone is arithmetic. */
function dayOf(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'short',
  })
}

/** "23 Aug", for the fixed-width column of a row. */
function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short',
  })
}
