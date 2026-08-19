import Link from 'next/link'
import type { MyTrekCard, TrekPlanRow } from '@/actions/trekBuddy'
import { lightForTime } from '@/lib/trek'
import TrekPlanCard from './TrekPlanCard'
import Avatar from './ui/Avatar'
import FacePile from './ui/FacePile'
import SeatMeter from './ui/SeatMeter'
import { HourBar } from './ui/HourPill'
import Countdown from './Countdown'
import { LiveDot, MoreLink, ShelfHead } from './ui/Bits'
import EmptyState from './ui/EmptyState'

// Today — the platform's front door for somebody who is already a member.
//
// /trek-buddy used to be the board: a search field, a filter rail, a day arc
// and eleven cards. That is a fine screen and it was the wrong front door. A
// board answers "show me everything and let me narrow it", which is a question
// you ask on your second visit. On arrival the questions are: is anybody
// waiting on me, am I going somewhere soon, and is there anything new. A
// filterable index answers none of those, so every visit started with work.
//
// So this page is not a list. It is a short answer to those three questions, in
// that order, and then a door to the board for the browsing that comes after.
// Nothing here is more than one screen tall before something happens.

type HomeRequest = {
  planId: string
  planPlace: string
  userId: string
  displayName: string
  message: string | null
  walks: number
  since: string | null
}

export default function TrekHome({
  me,
  soon,
  fresh,
  mine,
  requests,
  people,
  boardCount,
  canHost,
}: {
  me: MyTrekCard | null
  /** Leaving inside 48 hours. */
  soon: TrekPlanRow[]
  /** Newest on the board, already excluding anything in `soon`. */
  fresh: TrekPlanRow[]
  /** Walks the viewer is hosting or confirmed on, soonest first. */
  mine: TrekPlanRow[]
  /** People asking to come on walks the viewer hosts. */
  requests: HomeRequest[]
  /** A few members to put faces on the page. */
  people: { id: string; name: string; mentor: boolean }[]
  boardCount: number
  canHost: boolean
}) {
  const next = mine[0]
  const firstName = (me?.displayName ?? '').trim().split(/\s+/)[0] || 'there'

  return (
    <>
      {/* ── The answer, before anything else ─────────────────────────────
          One line that changes with the state of your account, and the two
          things you might do about it. This is the whole orientation. */}
      <section className="trek-band bg-ink pb-9 pt-28 md:pt-32">
        <div className="trek-measure">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="min-w-0">
              <p className="trek-eyebrow text-sage">Today</p>
              <h1 className="trek-h1 mt-4 max-w-[24ch] text-balance text-paper">
                {requests.length > 0 ? (
                  <>
                    {firstName}, {requests.length}{' '}
                    {requests.length === 1 ? 'person is' : 'people are'} waiting on you.
                  </>
                ) : next ? (
                  <>
                    {firstName}, you are going to {next.place}.
                  </>
                ) : (
                  <>Nothing of yours is coming up, {firstName}.</>
                )}
              </h1>
              <p className="mt-4 max-w-lg font-body text-[15px] leading-relaxed text-paper/60">
                {requests.length > 0
                  ? 'They cannot plan their day until you decide. Confirming is not a commitment to anything except their company.'
                  : next
                    ? 'Everything you need for it is on its page — the people, the chat, and the meeting point once enough are going.'
                    : `${boardCount} ${boardCount === 1 ? 'walk is' : 'walks are'} on the board. Asking to come takes one line.`}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/trek-buddy/discover" className="trek-pill trek-pill-actinv font-body">
                See the board
              </Link>
              {canHost && (
                <Link href="/trek-buddy/new" className="trek-pill trek-pill-onink font-body">
                  Post a walk
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── 1 · Waiting on you ───────────────────────────────────────────
          Only drawn when it is true. A dashboard that renders an empty
          "requests" panel every day teaches you to stop looking at it. */}
      {requests.length > 0 && (
        <section className="trek-band border-b border-rule bg-amber-wash/60 py-8">
          <div className="trek-measure">
            <div className="flex items-center gap-3 pb-4">
              <LiveDot />
              <h2 className="trek-label text-ember">Waiting on you</h2>
              <span aria-hidden="true" className="h-px flex-1 bg-dawn/20" />
              <span className="font-mono text-[13px] text-ember tabular-nums">
                {requests.length}
              </span>
            </div>

            <ul className="grid gap-3 md:grid-cols-2">
              {requests.slice(0, 4).map((r) => (
                <li key={`${r.planId}-${r.userId}`}>
                  <Link
                    href={`/trek-buddy/${r.planId}/console`}
                    className="trek-row flex items-center gap-4 px-4 py-3.5 transition-colors hover:border-forest/40"
                  >
                    <Avatar name={r.displayName} id={r.userId} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-body text-[14px] text-text">
                        <span className="font-medium">{r.displayName}</span> asked to join{' '}
                        {r.planPlace}
                      </span>
                      {r.message && (
                        <span className="mt-0.5 block truncate font-body text-[13px] italic text-mid">
                          “{r.message}”
                        </span>
                      )}
                      <span className="mt-1 block font-body text-[12px] text-forest">
                        <span className="font-mono tabular-nums">{r.walks}</span>{' '}
                        {r.walks === 1 ? 'walk' : 'walks'} on the board
                        {r.since && (
                          <>
                            {' · member since '}
                            <span className="font-mono tabular-nums">
                              {new Date(r.since).getFullYear()}
                            </span>
                          </>
                        )}
                      </span>
                    </span>
                    <span aria-hidden="true" className="shrink-0 text-mid">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── 2 · Yours ────────────────────────────────────────────────── */}
      <section className="trek-band bg-paper py-10">
        <div className="trek-measure grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <ShelfHead
              title="Yours"
              count={mine.length || undefined}
              action={<MoreLink href="/trek-buddy/basecamp">Basecamp</MoreLink>}
            />

            {mine.length === 0 ? (
              <EmptyState
                title="You are not on a walk yet."
                body="Ask to come on one and it appears here, with its chat and its meeting point."
                action={{ label: 'See the board', href: '/trek-buddy/discover' }}
              />
            ) : (
              <ul className="space-y-2.5">
                {mine.slice(0, 3).map((p) => {
                  const light = lightForTime(p.start_time)
                  const hosting = p.host_id === me?.userId
                  return (
                    <li key={p.id}>
                      <Link
                        href={`/trek-buddy/${p.id}`}
                        className="trek-row flex items-center gap-4 px-4 py-3.5 transition-colors hover:border-forest/40"
                      >
                        <HourBar light={light} height={40} />
                        <span className="w-[74px] shrink-0">
                          <span className="block font-mono text-[14px] text-text tabular-nums">
                            {p.start_time?.slice(0, 5) ?? '—'}
                          </span>
                          <span className="mt-0.5 block font-mono text-[11px] text-mid tabular-nums">
                            {new Date(p.starts_at).toLocaleDateString('en-IN', {
                              timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short',
                            })}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-display text-[17px] font-medium text-text">
                            {p.place}
                          </span>
                          <span className="mt-0.5 block font-body text-[12.5px] text-mid">
                            {hosting ? 'You are hosting' : 'You are going'} · from {p.meet_area}
                          </span>
                        </span>
                        <SeatMeter
                          taken={p.going_count}
                          capacity={p.capacity}
                          showCaption={false}
                          className="hidden w-[120px] shrink-0 sm:block"
                        />
                        <Countdown
                          iso={p.starts_at}
                          prefix="in"
                          className="hidden shrink-0 font-mono text-[12px] text-mid tabular-nums md:block"
                        />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* You, and the people you would be walking with. */}
          <aside className="min-w-0">
            <ShelfHead title="You" />
            <div className="trek-card p-5">
              <div className="flex items-center gap-3.5">
                <Avatar name={me?.displayName ?? 'You'} id={me?.userId} size={52} role="you" />
                <div className="min-w-0">
                  <p className="truncate font-display text-[19px] font-medium text-text">
                    {me?.displayName ?? 'You'}
                  </p>
                  <p className="mt-0.5 font-body text-[12.5px] text-mid">
                    {me?.homeBase ?? 'No home base yet'}
                  </p>
                </div>
              </div>

              <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-rule-soft pt-4">
                {[
                  ['Walked', (me?.walksJoined ?? 0) + (me?.walksHosted ?? 0)],
                  ['Hosted', me?.walksHosted ?? 0],
                  ['Vouches', me?.vouches ?? 0],
                ].map(([k, v]) => (
                  <div key={String(k)}>
                    <dd className="font-mono text-[19px] leading-none text-text tabular-nums">{v}</dd>
                    <dt className="trek-datum-key text-mid">{k}</dt>
                  </div>
                ))}
              </dl>

              <Link
                href="/trek-buddy/profile"
                className="mt-4 block border-t border-rule-soft pt-3.5 font-body text-[13px] font-medium text-forest transition-colors hover:text-forest-mid"
              >
                What a stranger sees →
              </Link>
            </div>

            {people.length > 0 && (
              <div className="trek-card mt-3 p-5">
                <p className="trek-label text-mid">Out there this month</p>
                <div className="mt-3.5 flex items-center gap-3">
                  <FacePile
                    people={people.map((p) => ({
                      id: p.id, name: p.name, role: p.mentor ? 'mentor' : 'none',
                    }))}
                    size={32}
                  />
                </div>
                <Link
                  href="/trek-buddy/people"
                  className="mt-4 block font-body text-[13px] font-medium text-forest transition-colors hover:text-forest-mid"
                >
                  Who is out there →
                </Link>
              </div>
            )}
          </aside>
        </div>
      </section>

      {/* ── 3 · Leaving soon ─────────────────────────────────────────── */}
      {soon.length > 0 && (
        <section className="trek-band border-y border-rule bg-paper-warm py-8">
          <div className="trek-measure">
            <div className="flex items-center gap-3 pb-4">
              <LiveDot />
              <h2 className="trek-label text-ember">Leaving within 48 hours</h2>
              <span aria-hidden="true" className="h-px flex-1 bg-rule-warm" />
              <span className="font-mono text-[13px] text-mid tabular-nums">{soon.length}</span>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {soon.slice(0, 3).map((p) => (
                <li key={p.id} className="flex">
                  <TrekPlanCard plan={p} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── 4 · New on the board, then the door to all of it ─────────── */}
      <section className="trek-band bg-paper py-10 pb-20">
        <div className="trek-measure">
          <ShelfHead
            title="New on the board"
            count={boardCount}
            action={<MoreLink href="/trek-buddy/discover">All {boardCount} walks</MoreLink>}
          />
          {fresh.length === 0 ? (
            <EmptyState
              title="Nothing new since you were last here."
              body="The board is small and honest about it. Posting the walk you were going on anyway is how it grows."
              action={canHost ? { label: 'Post a walk', href: '/trek-buddy/new' } : undefined}
              secondary={{ label: 'See everything', href: '/trek-buddy/discover' }}
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {fresh.slice(0, 3).map((p) => (
                <li key={p.id} className="flex">
                  <TrekPlanCard plan={p} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  )
}
