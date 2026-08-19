import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import Evidence from '@/components/trek/Evidence'
import SafetyActions from '@/components/trek/SafetyActions'
import Guidance from '@/components/trek/Guidance'
import FollowButton from '@/components/trek/FollowButton'
import Avatar from '@/components/trek/ui/Avatar'
import EmptyState from '@/components/trek/ui/EmptyState'
import { HourBar } from '@/components/trek/ui/HourPill'
import { Datum, SectionLabel, Tag } from '@/components/trek/ui/Bits'
import { EXPERIENCE_LABEL, TrustPips } from '@/components/trek/PersonCardTile'
import { getFollowState } from '@/actions/trekSocial'
import { getStreak } from '@/actions/trekRecap'
import {
  getGuidance, getPerson, getPersonPlans, getTrekKinds, getTrekMembership,
} from '@/actions/trekBuddy'
import { dotColor, lightForTime } from '@/lib/trek'

export const metadata: Metadata = {
  title: 'A member — DEWDROPZ',
  robots: { index: false, follow: false },
}

const PACE_LABEL: Record<string, string> = {
  steady: 'Steady — stops often, no rush',
  brisk: 'Brisk — keeps moving',
  fast: 'Fast — expects a pace',
}

const istShort = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: '2-digit',
  })

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null)

// Somebody else's profile.
//
// The question this page exists to answer is narrow and specific: do I want to
// spend a day in the hills with this person? Everything on it still serves that
// — what they do, how fast they walk, where they set off from, and the facts
// the board can actually stand behind, each one saying what it proves.
//
// WHAT WAS WRONG WITH IT WAS THE SHAPE, AND ONE MISSING QUERY.
//
// The shape: a single narrow column of headed paragraphs, which made a person
// read like a terms page. It is two columns now — what they are on the left,
// what the board counted on the right — under a header that finally gives a
// member the same treatment a walk gets, because a board about who you go with
// cannot make its walks look more important than its people.
//
// The query: the page counted how many walks somebody had hosted and then gave
// you no way to reach the one they are hosting on Saturday. `getPersonPlans`
// fixes exactly that, and the rail is the whole reason it exists — a profile
// you cannot act on is a dead end with a photograph.
//
// AND THE PHOTOGRAPH IS GONE. The header ran a stock ridge full-bleed at 45%
// under a three-stop scrim, picked by hashing the member's id. It gave a person
// the same masthead a walk gets, which was the stated intent, and it did it by
// putting a mountain none of them has necessarily been up behind their name.
// On the one screen whose entire job is "should I spend a day in the hills with
// this stranger", scenery is an argument nobody made. The band is ink, the
// identity is the 96px avatar they wear on every other screen, and the five
// figures underneath are the only things on it claiming anything.
//
// The body is sorted the same way: everything the person TYPED is inside one
// paper-warm panel that says so at the top, and everything the board COUNTED is
// on the plain paper below it as figures and as a dated log. That split was
// already the argument the copy made; it was just never drawn.
export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const membership = await getTrekMembership()
  if (!membership.signedIn) redirect(`/auth/login?redirect=/trek-buddy/people/${id}`)
  if (!membership.onboarded) redirect('/trek-buddy/setup')

  const person = await getPerson(id)
  if (!person) notFound()
  const isMe = membership.userId === id

  const [kinds, follow, streak, hosting] = await Promise.all([
    // Labels come from the kinds table now, so a profile listing an activity an
    // admin added last week does not render the raw key.
    getTrekKinds(),
    // Skipped entirely on your own page — there is no button to feed.
    isMe ? Promise.resolve({ following: false, followers: 0 }) : getFollowState(id),
    getStreak(id),
    getPersonPlans(id),
  ])
  const kindLabel = Object.fromEntries(kinds.map((k) => [k.key, k.label]))

  // A mentor's page carries what they are for. Everyone else's does not, so the
  // badge stays meaningful rather than becoming a rank.
  const mentorNotes = person.mentor
    ? await getGuidance({ audiences: ['first_time', 'all'], limit: 5 })
    : []

  const walks = person.walksHosted + person.walksJoined

  // ── The trail log ───────────────────────────────────────────────────────
  //
  // Only what the board can actually show by name. Every walk that has already
  // happened is counted in the strip above — the board publishes the ones still
  // open, and a profile is not the place to invent a second, looser rule about
  // where somebody has been. So the log is the walks you could still join them
  // on, with the day they joined the board underneath as the line it starts on.
  const log: {
    key: string
    dot: string
    date: string
    title: string
    sub: string
    role: string
    roleTone: 'sage' | 'outline'
    href?: string
  }[] = hosting.map((p) => {
    const light = lightForTime(p.start_time)
    return {
      key: p.id,
      dot: dotColor(light, 'light'),
      date: istShort(p.starts_at),
      title: p.place,
      sub: [
        p.activity_label,
        hhmm(p.start_time) ? `leaves ${hhmm(p.start_time)}` : 'multi-day',
        `from ${p.meet_area}`,
      ].join(' · '),
      role: 'Hosting',
      // Sage, not ember. Hosting an open walk is a standing fact about this
      // person, not a countdown, and amber on this board is a countdown.
      roleTone: 'sage',
      href: `/trek-buddy/${p.id}`,
    }
  })

  if (person.memberSince) {
    log.push({
      key: 'joined',
      dot: 'var(--rule)',
      date: istShort(person.memberSince),
      title: 'Joined the board',
      sub: 'Profile finished, terms accepted',
      role: 'Member',
      roleTone: 'outline',
    })
  }

  // What they typed about themselves, in one ledger rather than five headed
  // paragraphs. Pace and languages moved in here too: they are the same kind of
  // claim as the rest, and splitting them out implied the board had checked
  // them, which it has not.
  const declared: { k: string; v: string }[] = []
  if (person.experience) {
    declared.push({ k: 'Experience', v: EXPERIENCE_LABEL[person.experience] ?? person.experience })
  }
  if (person.pace) declared.push({ k: 'Pace', v: PACE_LABEL[person.pace] ?? person.pace })
  if (person.yearsOut != null) {
    declared.push({ k: 'Going out for', v: `${person.yearsOut} year${person.yearsOut === 1 ? '' : 's'}` })
  }
  if (person.highestM != null) {
    declared.push({ k: 'Highest been', v: `${person.highestM.toLocaleString('en-IN')} m` })
  }
  if (person.usualDays.length > 0) declared.push({ k: 'Usually goes', v: person.usualDays.join(', ') })
  if (person.carries.length > 0) declared.push({ k: 'Carries', v: person.carries.join(', ') })
  if (person.languages.length > 0) declared.push({ k: 'Speaks', v: person.languages.join(', ') })

  // The badges are the true half of `Evidence`, set as objects instead of
  // sentences. The full list — including what each one does NOT prove, and the
  // rows that are false — stays underneath in the disclosure, because dropping
  // the limits and keeping the badges is precisely the laundering migration 052
  // refused to build.
  //
  // They were 40px discs carrying a glyph on six hand-mixed rgba tints, two of
  // them "✦" and one of them amber — a wall of little medals, which is the
  // exact look a board that refuses to verify anybody must not have. Each is
  // now a line with a dot in a token colour: sage where the board counted it,
  // clay for the one thing DEWDROPZ appoints, slate for a capability rather
  // than a credit. The sentences are untouched.
  const badges: { dot: string; t: string; d: string }[] = []
  if (person.mentor) {
    badges.push({
      dot: 'var(--clay)',
      t: 'Mentor', d: 'Appointed by DEWDROPZ. Never self-claimed.',
    })
  }
  if (walks > 0) {
    badges.push({
      dot: 'var(--sage)',
      t: walks === 1 ? '1 walk on this board' : `${walks} walks on this board`,
      d: `${person.walksHosted} hosted, ${person.walksJoined} joined. Counted, not claimed.`,
    })
  }
  if (person.vouches > 0) {
    badges.push({
      dot: 'var(--sage)',
      t: person.vouches === 1 ? 'Vouched for by 1 person' : `Vouched for by ${person.vouches} people`,
      d: 'Only someone who was on a completed walk with them can say this.',
    })
  }
  if (streak > 0) {
    badges.push({
      dot: 'var(--sage)',
      t: streak === 1 ? 'Out this week' : `Out ${streak} weeks running`,
      d: 'Counted back from the most recent week they were out.',
    })
  }
  if (person.isCustomer) {
    badges.push({
      dot: 'var(--sage)',
      t: 'DEWDROPZ customer', d: 'A delivered order — a real person, a real address in India.',
    })
  }
  if (person.canHost) {
    badges.push({
      dot: 'var(--slate)',
      t: 'Hosts walks', d: 'Can post a plan and decide who comes on it.',
    })
  }

  return (
    <>
      {/* ── The header ───────────────────────────────────────────────────── */}
      <header className="trek-band bg-ink pb-9 pt-28 md:pt-32">
        <div className="trek-measure">
            <Link
              href="/trek-buddy/people"
              className="font-body text-[13px] text-paper/65 transition-colors hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
            >
              ← People
            </Link>

            <div className="mt-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-6">
              <div className="flex items-center gap-6">
                <Avatar
                  name={person.displayName}
                  id={person.userId}
                  size={96}
                  ground="dark"
                  role={isMe ? 'you' : person.mentor ? 'mentor' : person.canHost ? 'host' : 'none'}
                />
                <div className="min-w-0">
                  {/* The clay of the ring around the avatar, lifted to the one
                      value that reads on ink — the same one the board uses for
                      a called-off walk. It is a sentence rather than a stamp,
                      because "appointed" is the whole content of it. */}
                  {person.mentor && (
                    <p className="font-body text-[13px] font-medium leading-none text-[#C09A85]">
                      Mentor — appointed by DEWDROPZ, never self-claimed
                    </p>
                  )}
                  <h1 className="trek-h1 mt-2.5 text-paper">{person.displayName}</h1>
                  <p className="mt-2.5 font-body text-sm text-paper/70">
                    {[
                      person.homeBase ?? 'Somewhere near',
                      isMe
                        ? null
                        : `${follow.followers} ${follow.followers === 1 ? 'follower' : 'followers'}`,
                    ].filter(Boolean).join(' · ')}
                  </p>
                  {/* The rung, on the header rather than only in the rail. A
                      host filtering their walk is allowed to require it, so it
                      is a fact about whether you can walk with this person —
                      that belongs next to the name, not two screens down. */}
                  <TrustPips rung={person.trustRung} ground="dark" className="mt-3" />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {isMe ? (
                  <Link href="/trek-buddy/profile" className="trek-pill trek-pill-actinv font-body">
                    Edit your profile
                  </Link>
                ) : (
                  <FollowButton
                    personId={id}
                    personName={person.displayName}
                    initialFollowing={follow.following}
                    followers={follow.followers}
                    ground="dark"
                    variant="compact"
                  />
                )}
                {/* There is no invitation object on this board and there is not
                    going to be one — you invite somebody by putting a walk up
                    and letting them ask. So the button goes where that happens,
                    and only for members who can actually post. */}
                {!isMe && membership.canHost && (
                  <Link href="/trek-buddy/new" className="trek-pill trek-pill-onink font-body">
                    Invite to an event
                  </Link>
                )}
              </div>
            </div>

            {/* Five readings. Every one of them counted in Postgres from
                something that happened — which is the sentence the old page
                spent a paragraph making and never showed. It says it now, in
                four words over the figures, because the whole weight of the
                warm panel below depends on somebody having noticed that these
                five are a different kind of thing. */}
            <div className="mt-8 border-t border-paper/20 pt-5">
              <p className="trek-label-xs text-paper/50">Counted by the board</p>
              <div className="mt-4 flex flex-wrap gap-x-11 gap-y-5">
                <Datum k="walks joined" v={person.walksJoined} tone="dark" />
                <Datum k="hosted" v={person.walksHosted} tone="dark" />
                <Datum k="vouches" v={person.vouches} tone="dark" />
                <Datum
                  k="member since"
                  v={person.memberSince ? new Date(person.memberSince).getFullYear() : '—'}
                  tone="dark"
                />
                <Datum k="week streak" v={streak} tone="dark" />
              </div>
            </div>
        </div>
      </header>

      {/* ── The body ─────────────────────────────────────────────────────── */}
      <section className="trek-band bg-paper pb-24 pt-12">
        <div className="trek-measure grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
          <div className="flex min-w-0 flex-col gap-9">
            {isMe && (
              <p className="rounded-[var(--r-card)] border border-forest/25 bg-forest/[0.04] px-4 py-3 font-body text-sm text-text">
                This is how other people see you.
              </p>
            )}

            {person.mentor && (
              <div className="border-l-2 border-clay bg-clay-wash px-5 py-4">
                {person.mentorBio && (
                  <p className="font-body text-sm leading-relaxed text-text">{person.mentorBio}</p>
                )}
                <p className={`font-body text-xs leading-relaxed text-mid ${person.mentorBio ? 'mt-2' : ''}`}>
                  Mentors are named by us, never self-claimed, and it is not a safety guarantee —
                  it means somebody who has done a lot of this is happy to be asked.
                </p>
              </div>
            )}

            {/* ── Everything they typed ──────────────────────────────────────
                One warm panel, headed once. These were two sections a screen
                apart with the trail log between them, so the intro read as a
                statement of record and the ledger read as a spec sheet — and
                the sentence that governs both of them ("nobody has checked any
                of it") only appeared next to the second. A tint applies it to
                everything inside without repeating it, and it is the same tint
                the board uses on a person's card, so the two screens agree
                about which half of a stranger you are reading.

                Pace and experience come first inside it now. A walker deciding
                whether they will be left behind is asking this question and no
                other, and it used to be the fourth row of a seven-row list. */}
            <section className="rounded-[var(--r-card)] border border-rule-warm bg-paper-warm p-6 md:p-7">
              <SectionLabel>In their words</SectionLabel>
              {person.intro ? (
                <p className="trek-lede mt-3.5 max-w-[600px] text-text">
                  &ldquo;{person.intro}&rdquo;
                </p>
              ) : (
                <p className="mt-3.5 font-body text-sm leading-relaxed text-mid">
                  This member has not written an intro yet.
                </p>
              )}

              {person.activities.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {person.activities.map((a) => (
                    <li
                      key={a}
                      className="rounded-full border border-rule bg-surface px-3.5 py-1.5 font-body text-xs text-text"
                    >
                      {kindLabel[a] ?? a.replace(/_/g, ' ')}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-7 border-t border-rule-warm pt-5">
                <SectionLabel>What they say about themselves</SectionLabel>
                <p className="mt-1.5 font-body text-xs text-mid">
                  Typed by them. Nobody has checked any of it.
                </p>
                {declared.length > 0 ? (
                  <dl className="mt-4 divide-y divide-rule-warm border-y border-rule-warm">
                    {declared.map((f) => (
                      <div key={f.k} className="flex gap-5 py-3">
                        <dt className="trek-label-xs w-[132px] shrink-0 pt-1 text-mid">{f.k}</dt>
                        <dd className="font-body text-sm text-text">{f.v}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-4 font-body text-sm text-mid">
                    They have not filled any of this in.
                  </p>
                )}
              </div>
            </section>

            <section>
              <SectionLabel>Trail log — counted from what happened</SectionLabel>
              {log.length > 0 ? (
                <>
                  <ul className="mt-4 border-t border-rule">
                    {log.map((l) => {
                      const row = (
                        <>
                          <span
                            aria-hidden="true"
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: l.dot }}
                          />
                          <span className="w-[88px] shrink-0 font-mono text-[11px] text-mid tabular-nums">
                            {l.date}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-body text-sm text-text">{l.title}</span>
                            <span className="block truncate font-body text-[11px] text-mid">{l.sub}</span>
                          </span>
                          <span className="shrink-0">
                            <Tag tone={l.roleTone}>{l.role}</Tag>
                          </span>
                        </>
                      )
                      return (
                        <li key={l.key} className="border-b border-rule">
                          {l.href ? (
                            <Link
                              href={l.href}
                              className="-mx-2 flex items-center gap-4 rounded-[var(--r-input)] px-2 py-3.5 transition-colors hover:bg-paper-warm/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
                            >
                              {row}
                            </Link>
                          ) : (
                            <span className="flex items-center gap-4 py-3.5">{row}</span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                  <p className="mt-3 font-body text-xs leading-relaxed text-mid">
                    {walks > 0
                      ? `${person.walksHosted} hosted and ${person.walksJoined} joined are counted in the figures above, from walks that had already happened. The log names the ones still open, because those are the only ones you can do anything about.`
                      : 'Nothing has happened yet. The figures above fill themselves in from walks that actually took place — nobody can type into them.'}
                  </p>
                </>
              ) : (
                <EmptyState
                  className="mt-4"
                  title="Nothing on the log yet."
                  body={
                    isMe
                      ? 'Post a walk or ask to come on one. This log is written by what happens, which is why it cannot be filled in from the profile page.'
                      : 'They have not hosted anything that is still open, and the board does not list walks that are over. Nothing here is a judgement — most people join before they host.'
                  }
                  action={
                    isMe && membership.canHost
                      ? { label: 'Post a walk', href: '/trek-buddy/new' }
                      : { label: 'See what is on', href: '/trek-buddy' }
                  }
                />
              )}
            </section>

            {mentorNotes.length > 0 && (
              <div className="border-t border-rule pt-8">
                <Guidance
                  notes={mentorNotes}
                  title="What they would tell you before your first one"
                  intro="The board's guidance, shown here because this is where somebody new usually ends up looking."
                />
              </div>
            )}

            {/* Nobody needs to report or block themselves. */}
            {!isMe && (
              <div className="border-t border-rule pt-6">
                <SafetyActions subjectId={person.userId} subjectName={person.displayName} />
              </div>
            )}
          </div>

          {/* ── The rail ───────────────────────────────────────────────── */}
          <aside className="flex flex-col gap-4 lg:sticky lg:top-[88px]">
            <div className="rounded-[var(--r-panel)] border border-rule bg-surface p-6">
              <SectionLabel as="h2">Badges — earned, not bought</SectionLabel>

              {/* The ladder from migration 062, which a host filtering a walk
                  is actually allowed to require. It was enforced in Postgres,
                  settable in the composer, and drawn nowhere. */}
              {person.trustRung != null && (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-[var(--r-card)] bg-paper px-3.5 py-3">
                  <span className="trek-label-xs text-mid">
                    Trust rung <span className="font-mono tabular-nums">{person.trustRung}/2</span>
                  </span>
                  <TrustPips rung={person.trustRung} />
                </div>
              )}

              {badges.length > 0 ? (
                <ul className="mt-5 flex flex-col gap-3.5">
                  {badges.map((b) => (
                    <li key={b.t} className="flex gap-3">
                      <span
                        aria-hidden="true"
                        className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: b.dot }}
                      />
                      <span className="min-w-0">
                        <span className="block font-body text-sm text-text">{b.t}</span>
                        <span className="block font-body text-[12px] leading-relaxed text-mid">{b.d}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 font-body text-[13px] leading-relaxed text-mid">
                  Nothing counted yet. Every badge here is written by something that happened on a
                  walk — none of them can be claimed, bought or asked for.
                </p>
              )}

              {/* The full ledger, absences and disclaimers included. A badge
                  list on its own is an endorsement; this is what keeps it from
                  becoming one. */}
              <details className="group mt-5 border-t border-rule-soft pt-4">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 font-body text-[13px] font-medium text-mid transition-colors hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage [&::-webkit-details-marker]:hidden">
                  What none of it proves
                  <span aria-hidden="true" className="inline-block group-open:hidden">→</span>
                </summary>
                <div className="mt-4">
                  <Evidence person={person} streak={streak} />
                </div>
              </details>
            </div>

            <div className="rounded-[var(--r-panel)] bg-ink p-6">
              <SectionLabel as="h2" tone="trust">Hosting next</SectionLabel>
              {hosting.length > 0 ? (
                <ul className="mt-3">
                  {hosting.slice(0, 4).map((p) => {
                    const light = lightForTime(p.start_time)
                    return (
                      <li key={p.id}>
                        <Link
                          href={`/trek-buddy/${p.id}`}
                          className="-mx-2 flex items-center gap-3 rounded-[var(--r-input)] px-2 py-2.5 transition-colors hover:bg-paper/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
                        >
                          <HourBar light={light} ground="dark" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-body text-sm text-paper">{p.place}</span>
                            <span className="block truncate font-mono text-[11px] text-paper/55 tabular-nums">
                              {istShort(p.starts_at)}
                              {hhmm(p.start_time) ? ` · ${hhmm(p.start_time)}` : ''}
                            </span>
                          </span>
                          {/* Whether there is room is the fact that decides
                              whether this link is worth following, and it was
                              the tail of a mono run-on with the date. Clay is
                              the board's colour for a limit reached. */}
                          <span
                            className={`shrink-0 rounded-[var(--r-tag)] px-2 py-[3px] font-body text-[11px] font-medium leading-[1.4] ${
                              p.spots_left > 0
                                ? 'border border-paper/25 text-paper/75'
                                : 'border border-clay/50 text-[#C09A85]'
                            }`}
                          >
                            {p.spots_left > 0 ? `${p.spots_left} left` : 'Waitlist'}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="mt-3.5 font-body text-[13px] leading-relaxed text-paper/55">
                  Nothing of theirs is on the board right now. Follow them and the next one turns up
                  in your basecamp.
                </p>
              )}
            </div>

            <p className="font-body text-xs leading-relaxed text-mid">
              There is no way to message someone here, and that is deliberate — walks are arranged
              on the walk&apos;s own page, where the host decides who comes. That is also what keeps
              them reviewable.
            </p>
          </aside>
        </div>
      </section>
    </>
  )
}
