'use client'

import { useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cancelPlan, decideRequest } from '@/actions/trekBuddy'
import {
  checkIn, updateMeetingPoint, announce, promoteWaitlisted, addCoHost, removeCoHost, setCostState,
  type ConsoleRoster,
} from '@/actions/trekConsole'
import type { TrekMessage } from '@/actions/trekChat'
import InviteCardPanel from '@/components/trek/InviteCardPanel'
import Avatar from '@/components/trek/ui/Avatar'
import EmptyState from '@/components/trek/ui/EmptyState'
import { SectionLabel, Tag } from '@/components/trek/ui/Bits'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { formatPrice } from '@/lib/utils'

// The host's desk for one walk.
//
// Everything here already existed in pieces — confirming was on the plan page,
// the meeting point could not be changed at all, and there was nowhere to say
// "we are starting an hour later". Gathering them is most of the value: a host
// standing at a bus stand at 05:10 should not be navigating between screens.
//
// THREE TABS, NOT ONE COLUMN. The three jobs a host has — deciding who comes,
// telling everybody something, and remembering who has squared up — were
// stacked on top of each other in one scroll, so the cost-share chips sat in
// the middle of the roster and the announcement box was in the rail beneath
// the invite link. They are separate acts done at separate moments, and a tab
// each is what stops the screen reading as a settings page. A tab with nothing
// behind it is still drawn: a Money tab that vanishes on a free walk teaches a
// host that the console changes shape, which is worse than an empty ledger.
//
// Co-hosts landed in 082/083 with the three things they needed first: a
// permission model, an audit trail, and this screen to see it on. A co-host can
// confirm, announce and check in; everything else — cancelling, the meeting
// point, appointing other co-hosts, the invite link, the recap — stays with the
// host, so a co-host runs the party without owning the walk.
//
// COST SHARE. Built after being held back twice, and shaped by the objection
// rather than in spite of it: three states and a name, no amounts per person,
// no history, nothing transacted. It is a host's memory aid for a shared cab,
// and the copy says so wherever it appears — because the moment this reads as
// a ledger the site maintains, it is a ledger the site is answerable for. The board takes no money and says so — the cost share is
// "split at face value on the day". A per-person paid/unpaid ledger inside the
// app is the first step toward looking like it settles payments, and the
// difference matters if anything ever goes wrong with one.
//
// WHAT THE RESET CHANGED HERE. This screen was wearing the prototype's costume
// hardest of anything in the product: every control was 9 or 10px monospace,
// uppercase, tracked to 0.14em — Confirm, Decline, Move up, remove, + co-host,
// Check in, the three cost states, the tab names, and the call-off link. That
// is a machine's typeface used for the words a person presses, and eleven of
// them on one screen made a host's desk look like a terminal emulator rather
// than like a desk. Every control is sentence case now, at a size a thumb can
// find in the dark, and monospace is left where it is telling the truth: a
// count, a queue position, a time, a share of a cab fare.
//
// And the amber went with it. Amber on this board means a clock is running, so
// it belongs on exactly one thing here — somebody waiting on a decision from
// you — and not on the tab underline, not on the announcement rules, and not
// on the meeting-point card, which is the most important thing on the screen
// but is not urgent. That card keeps its 2px edge and takes forest instead.

const TABS = [
  { key: 'roster', label: 'Roster' },
  { key: 'comms', label: 'Comms' },
  { key: 'money', label: 'Money' },
] as const

type TabKey = (typeof TABS)[number]['key']

/**
 * The heading over one group of people.
 *
 * A rule runs out of the title to the count, which is what turns a label into
 * a shelf edge — the same gesture `ShelfHead` makes on the board, at console
 * scale. The rule about the group (what confirming one more person does, when
 * check-in opens) sits under it as a sentence rather than beside it as a
 * caption, because on a narrow column a right-aligned note wraps into the
 * count and the head stops reading as one thing.
 */
function GroupHead({ title, count, note }: { title: string; count?: ReactNode; note?: ReactNode }) {
  return (
    <div className="pb-3.5">
      <div className="flex items-baseline gap-3.5">
        <h2 className="trek-h3 text-text">{title}</h2>
        <span aria-hidden="true" className="h-px flex-1 bg-rule" />
        {count !== undefined && count}
      </div>
      {note && (
        <p className="mt-2 font-body text-[13px] leading-relaxed text-mid">{note}</p>
      )}
    </div>
  )
}

/** A group with nobody in it. Dashed, quiet, and never an apology. */
function NoOne({ children }: { children: ReactNode }) {
  return (
    <p className="trek-provisional px-4 py-4 font-body text-sm leading-relaxed text-mid">
      {children}
    </p>
  )
}

/** The stamp over a rail card. A key, not a heading — so it is `trek-label`. */
function RailHead({ children, tone = 'quiet' }: { children: ReactNode; tone?: 'quiet' | 'act' }) {
  return (
    <h3 className={`trek-label ${tone === 'act' ? 'text-forest' : 'text-mid'}`}>{children}</h3>
  )
}

const istDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' })

const COST_LABEL: Record<ConsoleRoster['cost_state'], string> = {
  settled: 'Settled',
  on_the_day: 'On the day',
  owed: 'Not yet',
}

/** The one focus treatment on the screen, so a keyboard finds every control. */
const RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage'

export default function ConsoleClient({
  header,
  planId,
  place,
  whenLabel,
  roster,
  credibility,
  announcements,
  meetingPoint,
  logistics,
  minParty,
  goingCount,
  capacity,
  canCheckIn,
  shareToken,
  nameOf,
  costPaise,
}: {
  /** The walk's identity, rendered on the server and dropped into the ink band. */
  header: ReactNode
  planId: string
  place: string
  /** "Sat 22 Aug · 05:10" — for the message a host sends a friend. */
  whenLabel: string
  roster: ConsoleRoster[]
  /** What the people asking have actually done here, keyed by user id. */
  credibility: Record<string, { hosted: number; joined: number }>
  /** Already filtered to `is_announcement`, newest first. */
  announcements: TrekMessage[]
  meetingPoint: string
  logistics: string
  minParty: number
  goingCount: number
  capacity: number
  canCheckIn: boolean
  shareToken: string | null
  /** user id -> display name, for the "confirmed by" line. */
  nameOf: Record<string, string | null>
  /** Null or zero means the walk has no cost share, and none of this appears. */
  costPaise: number | null
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [tab, setTab] = useState<TabKey>('roster')
  const [point, setPoint] = useState(meetingPoint)
  const [logi, setLogi] = useState(logistics)
  const [editingPoint, setEditingPoint] = useState(false)
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')

  const asking = roster.filter((r) => r.status === 'requested')
  const going = roster.filter((r) => r.status === 'confirmed')
  const queued = roster.filter((r) => r.status === 'waitlisted')
  const coHosts = going.filter((r) => r.is_co_host)
  const hasCost = (costPaise ?? 0) > 0
  const settled = going.filter((r) => r.cost_state !== 'owed').length
  // Deliberately a narrower count than `settled`: "in" is money that has
  // actually changed hands, and "on the day" is a promise about a cab fare
  // that has not been paid yet. The sentence under the table keeps the wider
  // number, because "squared up" is the host's own word for both.
  const inPaise = going.filter((r) => r.cost_state === 'settled').length * (costPaise ?? 0)
  const totalPaise = going.length * (costPaise ?? 0)
  const shortOfQuorum = Math.max(minParty - goingCount, 0)

  // Two result shapes meet here: the console actions return {ok}, and
  // decideRequest — which predates them — returns {error} | {success}. Rather
  // than change a working action's contract for the sake of one caller, both
  // are read for the only thing that matters: did it fail, and what did it say.
  type AnyResult = { ok?: boolean; success?: true; error?: string }
  const run = (fn: () => Promise<AnyResult>, done?: string) =>
    start(async () => {
      const r = await fn()
      if (r.error || r.ok === false) {
        toast.error(r.error ?? 'That did not work.')
        return
      }
      if (done) toast.success(done)
      router.refresh()
    })

  const panel = (key: TabKey) => ({
    role: 'tabpanel' as const,
    id: `console-panel-${key}`,
    'aria-labelledby': `console-tab-${key}`,
    hidden: tab !== key,
  })

  return (
    <>
      {/* ── The control ground ──────────────────────────────────────────────
          Identity and tabs share one ink band, so the strip reads as the edge
          of the header rather than as a toolbar floating above the body. */}
      <section className="trek-band bg-ink pt-28 md:pt-32">
        <div className="trek-measure">
          {header}

          {/* The underline is always drawn and only changes colour. An
              underline that appears and disappears shifts the row by 2px on
              every tab change, which is the difference between a nav that
              settles and one that twitches. Sage, because on an ink band sage
              is this product's accent — the amber it used to take is reserved
              for the one count on this screen that is a person waiting. */}
          <nav role="tablist" aria-label="Console sections" className="mt-8 flex gap-8 border-b border-paper/15">
            {TABS.map((t) => {
              const on = t.key === tab
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  id={`console-tab-${t.key}`}
                  aria-selected={on}
                  aria-controls={`console-panel-${t.key}`}
                  onClick={() => setTab(t.key)}
                  className={`relative px-0.5 pb-3.5 font-body text-[15px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sage ${
                    on ? 'text-paper' : 'text-paper/55 hover:text-paper/85'
                  }`}
                >
                  {t.label}
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-px h-0.5 rounded-[var(--r-bar)] transition-colors"
                    style={{ background: on ? 'var(--sage)' : 'transparent' }}
                  />
                </button>
              )
            })}
          </nav>
        </div>
      </section>

      <section className="trek-band bg-paper pb-24 pt-9">
        <div className="trek-measure grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="min-w-0">
            {/* ── ROSTER ───────────────────────────────────────────────────
                Nobody at all is one state, not three: a screen that answers a
                fresh walk with three stacked dashed boxes reads as three
                things having gone wrong. Once anybody is on it, the groups
                come back and each keeps its own empty line. */}
            <div {...panel('roster')} className="space-y-9">
              {roster.length === 0 && (
                <EmptyState
                  title="Nobody has asked yet"
                  body={
                    <>
                      This is where the asks land — who they are, what they have done here before,
                      and what they said. Sending the invite card to two people you already know is
                      how most walks fill.
                    </>
                  }
                />
              )}

              <section className={roster.length === 0 ? 'hidden' : undefined}>
                <GroupHead
                  title="Asking to come"
                  count={
                    <span
                      className={`font-mono text-[15px] tabular-nums ${
                        asking.length > 0 ? 'text-ember' : 'text-light'
                      }`}
                    >
                      {asking.length}
                    </span>
                  }
                  note={
                    goingCount < minParty
                      ? `${minParty - goingCount} more confirmed releases the meeting point.`
                      : `confirming past ${capacity} opens the waitlist`
                  }
                />

                {asking.length === 0 ? (
                  <NoOne>Nothing waiting on you.</NoOne>
                ) : (
                  <ul className="space-y-2">
                    {asking.map((r) => {
                      const c = credibility[r.user_id]
                      const known = c && (c.joined > 0 || c.hosted > 0)
                      return (
                        <li
                          key={r.user_id}
                          className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[var(--r-card)] border border-dawn/40 bg-amber-wash px-4.5 py-4"
                        >
                          <Avatar
                            name={r.display_name}
                            id={r.user_id}
                            size={40}
                            href={`/trek-buddy/people/${r.user_id}`}
                          />
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/trek-buddy/people/${r.user_id}`}
                              className={`font-body text-[15px] font-medium text-text underline decoration-rule underline-offset-4 hover:decoration-forest ${RING}`}
                            >
                              {r.display_name}
                            </Link>
                            {/* What they have actually done, on its own line
                                rather than trailing the name in 10px — this is
                                the fact the decision turns on. The counts are
                                figures and set as figures; the sentence around
                                them is a sentence. A first-timer is said out
                                loud rather than shown as two zeroes, because
                                everyone was one. */}
                            <p className="mt-1 font-body text-[13px] leading-relaxed text-mid">
                              {known ? (
                                <span className="text-forest">
                                  <span className="font-mono tabular-nums">{c.joined}</span> walked
                                  {' · '}
                                  <span className="font-mono tabular-nums">{c.hosted}</span> hosted
                                </span>
                              ) : (
                                'Not been out with anybody here yet.'
                              )}
                            </p>
                            {r.message && (
                              <p className="mt-1.5 font-body text-[13px] italic leading-relaxed text-mid">
                                &ldquo;{r.message}&rdquo;
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() =>
                                run(
                                  () => decideRequest(planId, r.user_id, 'confirmed'),
                                  `${r.display_name} is coming`
                                )
                              }
                              className={`trek-pill trek-pill-sm trek-pill-act font-body disabled:opacity-40 ${RING}`}
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => run(() => decideRequest(planId, r.user_id, 'declined'))}
                              className={`trek-pill trek-pill-sm trek-pill-quiet bg-surface font-body disabled:opacity-40 ${RING}`}
                            >
                              Decline
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>

              <section className={roster.length === 0 ? 'hidden' : undefined}>
                <GroupHead
                  title="Confirmed"
                  count={
                    <span className="font-mono text-[15px] text-forest tabular-nums">
                      {going.length} / {capacity}
                    </span>
                  }
                  note={
                    canCheckIn
                      ? 'Check people in at the meeting point.'
                      : 'Checking in opens twelve hours before you leave.'
                  }
                />

                {going.length === 0 ? (
                  <NoOne>Nobody confirmed yet.</NoOne>
                ) : (
                  // One ruled sheet rather than eight floating rows. A roster is
                  // a list you read down, and hairlines between the names are
                  // what let the eye do that without counting cards.
                  <ul className="overflow-hidden rounded-[var(--r-card)] border border-rule bg-surface">
                    {going.map((r) => (
                      <li
                        key={r.user_id}
                        className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5 border-b border-rule-soft px-4 py-3 last:border-b-0"
                      >
                        <Avatar
                          name={r.display_name}
                          id={r.user_id}
                          size={32}
                          role={r.is_co_host ? 'host' : 'none'}
                          href={`/trek-buddy/people/${r.user_id}`}
                        />
                        <Link
                          href={`/trek-buddy/people/${r.user_id}`}
                          className={`font-body text-[15px] text-text underline decoration-rule underline-offset-4 hover:decoration-forest ${RING}`}
                        >
                          {r.display_name}
                        </Link>
                        {r.is_co_host && <Tag tone="sage">Co-host</Tag>}
                        {/* Who let this person on. Invisible while the host is the
                            only one who can, and the whole point once they are not. */}
                        {r.decided_by && nameOf[r.decided_by] && (
                          <span className="font-body text-[12px] text-mid">
                            confirmed by {nameOf[r.decided_by]}
                          </span>
                        )}
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            run(
                              () => (r.is_co_host ? removeCoHost(planId, r.user_id) : addCoHost(planId, r.user_id)),
                              r.is_co_host
                                ? `${r.display_name} is no longer a co-host`
                                : `${r.display_name} can help run this walk`
                            )
                          }
                          className={`font-body text-[12px] text-mid underline decoration-rule underline-offset-4 transition-colors hover:text-forest hover:decoration-forest disabled:opacity-40 ${RING}`}
                        >
                          {r.is_co_host ? 'Remove as co-host' : 'Make co-host'}
                        </button>

                        <span className="ml-auto flex items-center gap-3">
                          {hasCost && (
                            <span
                              className={`font-body text-[12px] font-medium ${
                                r.cost_state === 'settled' ? 'text-forest' : 'text-mid'
                              }`}
                            >
                              {COST_LABEL[r.cost_state]}
                            </span>
                          )}
                          {/* Checked in is a state, not an act, so it is not a
                              filled button — it is the sage the whole product
                              uses for "confirmed", and it stays pressable
                              because people get checked in by mistake. */}
                          <button
                            type="button"
                            aria-pressed={Boolean(r.checked_in_at)}
                            disabled={pending || !canCheckIn}
                            onClick={() => run(() => checkIn(planId, r.user_id, !r.checked_in_at))}
                            className={`trek-pill trek-pill-sm font-body disabled:opacity-40 ${RING} ${
                              r.checked_in_at
                                ? 'border border-forest/30 bg-sage-soft text-forest'
                                : 'trek-pill-quiet'
                            }`}
                          >
                            {r.checked_in_at ? 'Here ✓' : 'Check in'}
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <p className="mt-3 font-body text-[13px] leading-relaxed text-mid">
                  A co-host can confirm, announce and check in — not cancel, edit the meeting
                  point, or appoint anybody.
                </p>
              </section>

              <section className={roster.length === 0 ? 'hidden' : undefined}>
                <GroupHead
                  title="Waitlist"
                  count={
                    <span className="flex items-baseline gap-2.5">
                      <span className="font-body text-[12px] text-mid">in order</span>
                      <span className="font-mono text-[15px] text-clay-deep tabular-nums">
                        {queued.length}
                      </span>
                    </span>
                  }
                />

                {queued.length === 0 ? (
                  <NoOne>
                    Nobody waiting. The waitlist starts filling once {capacity} people are
                    confirmed.
                  </NoOne>
                ) : (
                  // Dashed, because a waitlist is provisional by definition —
                  // the same edge every not-yet-real thing on the board takes.
                  <ol className="overflow-hidden rounded-[var(--r-card)] border border-dashed border-rule-warm bg-paper-warm/40">
                    {queued.map((r, i) => (
                      <li
                        key={r.user_id}
                        className="flex flex-wrap items-center gap-x-3.5 gap-y-2 border-b border-rule-warm/60 px-4 py-3 last:border-b-0"
                      >
                        <span className="font-mono text-[13px] text-clay-deep tabular-nums">
                          #{i + 1}
                        </span>
                        <Link
                          href={`/trek-buddy/people/${r.user_id}`}
                          className={`font-body text-[15px] text-text underline decoration-rule-warm underline-offset-4 hover:decoration-forest ${RING}`}
                        >
                          {r.display_name}
                        </Link>
                        <span className="font-body text-[12px] text-mid">
                          waiting since{' '}
                          <span className="font-mono tabular-nums">{istDate(r.created_at)}</span>
                        </span>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            run(() => promoteWaitlisted(planId, r.user_id), `${r.display_name} moved up`)
                          }
                          className={`ml-auto trek-pill trek-pill-sm trek-pill-quiet bg-surface font-body text-forest disabled:opacity-40 ${RING}`}
                        >
                          Move up
                        </button>
                      </li>
                    ))}
                  </ol>
                )}

                <p className="mt-3 font-body text-[13px] leading-relaxed text-mid">
                  The first of these moves up on its own when somebody drops. Bringing one forward
                  by hand puts their ask in front of you — it does not add them to the walk.
                </p>
              </section>
            </div>

            {/* ── COMMS ──────────────────────────────────────────────────── */}
            <div {...panel('comms')} className="space-y-5">
              <div className="trek-card p-5.5">
                <SectionLabel as="h2">Announce to everyone confirmed</SectionLabel>
                <label className="sr-only" htmlFor="console-announce">
                  What to tell everybody
                </label>
                <textarea
                  id="console-announce"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Road is washed out past Pantwari — we are leaving an hour later."
                  className="mt-3 w-full resize-y rounded-[var(--r-card)] border border-rule bg-paper px-4 py-3.5 font-body text-[15px] leading-relaxed text-text placeholder:text-mid/60 focus:border-forest focus:outline-none"
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="max-w-md font-body text-[13px] leading-relaxed text-mid">
                    Goes into the group chat and reaches everyone confirmed, whether or not they are
                    looking at the page. For &ldquo;starting an hour later&rdquo;, not for chat.
                  </p>
                  <button
                    type="button"
                    disabled={pending || note.trim().length < 3}
                    onClick={() =>
                      run(() => announce(planId, note), 'Everyone has been told')
                    }
                    className={`trek-pill trek-pill-act font-body disabled:opacity-40 ${RING}`}
                  >
                    Send announcement
                  </button>
                </div>
              </div>

              <div className="trek-card p-5.5">
                <SectionLabel as="h2">Sent earlier</SectionLabel>
                {announcements.length === 0 ? (
                  <p className="mt-3 font-body text-[15px] leading-relaxed text-mid">
                    Nothing announced yet. Chat is for chat — this is for the things somebody would
                    want to know at five in the morning.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-4">
                    {announcements.map((a) => (
                      <li key={a.id} className="border-l-2 border-forest py-0.5 pl-4">
                        <p className="font-body text-[15px] leading-relaxed text-text">{a.body}</p>
                        <p className="mt-1.5 font-body text-[12px] text-mid">
                          <span className="font-mono tabular-nums">
                            {new Date(a.created_at).toLocaleString('en-IN', {
                              timeZone: 'Asia/Kolkata',
                              day: 'numeric',
                              month: 'short',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                          {' · by '}
                          {a.display_name}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* ── MONEY ──────────────────────────────────────────────────── */}
            <div {...panel('money')}>
              {!hasCost ? (
                <EmptyState
                  title="No cost share on this walk"
                  body={
                    <>
                      You posted this one with nothing to split, so there is nothing to keep track
                      of. A walk with a shared cab or a permit gets a ledger here — a name, a
                      share, and whether they have squared up.
                    </>
                  }
                />
              ) : (
                <div className="trek-card">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule-soft px-6 py-5">
                    <SectionLabel as="h2">
                      Cost share ledger — {formatPrice(costPaise ?? 0)} a head
                    </SectionLabel>
                    <span className="font-mono text-[13px] text-forest tabular-nums">
                      {formatPrice(inPaise)} of {formatPrice(totalPaise)} in
                    </span>
                  </div>

                  {going.length === 0 ? (
                    <p className="px-6 py-5 font-body text-[15px] text-mid">
                      Nobody confirmed yet, so there is nobody to split it between.
                    </p>
                  ) : (
                    // The column heads used to be `sr-only`, which is the right
                    // answer for a table that explains itself and the wrong one
                    // here: three unlabelled chips at the end of a row are a
                    // guess until you press one. A ledger is read, so it gets a
                    // header row a person can see.
                    <table className="w-full border-collapse">
                      <caption className="sr-only">
                        Who has squared up the cost share for this walk
                      </caption>
                      <thead>
                        <tr className="border-b border-rule-soft">
                          <th scope="col" className="trek-label-xs px-6 py-2.5 text-left text-mid">
                            Who
                          </th>
                          <th scope="col" className="trek-label-xs px-3 py-2.5 text-right text-mid">
                            Their share
                          </th>
                          <th scope="col" className="trek-label-xs px-6 py-2.5 text-right text-mid">
                            Where it stands
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {going.map((r) => (
                          <tr key={r.user_id} className="border-b border-rule-soft last:border-b-0">
                            <td className="px-6 py-3">
                              <span className="flex items-center gap-3">
                                <Avatar name={r.display_name} id={r.user_id} size={24} />
                                <Link
                                  href={`/trek-buddy/people/${r.user_id}`}
                                  className={`font-body text-[15px] text-text underline decoration-rule underline-offset-4 hover:decoration-forest ${RING}`}
                                >
                                  {r.display_name}
                                </Link>
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right font-mono text-[13px] text-mid tabular-nums">
                              {formatPrice(costPaise ?? 0)}
                            </td>
                            <td className="px-6 py-3">
                              <span className="flex justify-end gap-1.5">
                                {(
                                  [
                                    ['settled', 'Settled'],
                                    ['on_the_day', 'On the day'],
                                    ['owed', 'Not yet'],
                                  ] as const
                                ).map(([state, label]) => (
                                  <button
                                    key={state}
                                    type="button"
                                    aria-pressed={r.cost_state === state}
                                    disabled={pending}
                                    onClick={() => run(() => setCostState(planId, r.user_id, state))}
                                    className={`rounded-full px-3 py-1.5 font-body text-[12px] font-medium leading-none transition-colors disabled:opacity-40 ${RING} ${
                                      r.cost_state === state
                                        ? 'bg-text text-paper'
                                        : 'border border-rule text-mid hover:border-text hover:text-text'
                                    }`}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {going.length > 0 && (
                    <p className="px-6 pt-4 font-body text-[13px] leading-relaxed text-mid">
                      {settled} of {going.length} have squared up. This is your own note — nothing
                      is paid through this site and DEWDROPZ never sees the money.
                    </p>
                  )}
                  <p className="px-6 pb-5 pt-2 font-body text-[13px] leading-relaxed text-mid">
                    Costs are split at face value — fuel, permits, the cab. DEWDROPZ holds no money
                    and takes no cut; this ledger is a shared memory, not a wallet.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── The rail ─────────────────────────────────────────────────────
              Sticky, and the same on every tab: the meeting point is the one
              thing a host may need to correct while doing anything else. */}
          <aside className="space-y-4 lg:sticky lg:top-[88px]">
            {/* 2px forest, and it is the only 2px border on the screen —
                border weight is how this system says "this one matters", and
                eight people are relying on this being right. It used to be
                dawn, which said something else: amber on this board means a
                clock is running, and the address is not urgent, it is
                critical. Those are different things and they had the same
                colour. */}
            <div className="rounded-[var(--r-panel)] border-2 border-forest bg-surface p-5.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <RailHead tone="act">Exact meeting point</RailHead>
                <span className="font-body text-[12px] font-medium text-forest">
                  Confirmed walkers only
                </span>
              </div>

              {editingPoint ? (
                <>
                  <label className="sr-only" htmlFor="console-point">Meeting point</label>
                  <input
                    id="console-point"
                    value={point}
                    onChange={(e) => setPoint(e.target.value)}
                    placeholder="Gate 2, behind the tea stall"
                    className="mt-3 w-full rounded-[var(--r-input)] border border-rule bg-paper px-3 py-2.5 font-body text-[15px] text-text focus:border-forest focus:outline-none"
                  />
                  <label className="sr-only" htmlFor="console-logistics">Getting there</label>
                  <input
                    id="console-logistics"
                    value={logi}
                    onChange={(e) => setLogi(e.target.value)}
                    placeholder="Shared cab from ISBT, roughly ₹300 each way"
                    className="mt-2 w-full rounded-[var(--r-input)] border border-rule bg-paper px-3 py-2.5 font-body text-[14px] text-text focus:border-forest focus:outline-none"
                  />
                  <p className="mt-2.5 font-body text-[13px] leading-relaxed text-mid">
                    Everyone already confirmed is told it changed. Somebody still waiting on you is
                    not — they have never seen the old one.
                  </p>
                  <div className="mt-3.5 flex items-center gap-4">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(() => updateMeetingPoint(planId, point, logi), 'Meeting point updated')
                      }
                      className={`trek-pill trek-pill-sm trek-pill-act font-body disabled:opacity-40 ${RING}`}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPoint(meetingPoint)
                        setLogi(logistics)
                        setEditingPoint(false)
                      }}
                      className={`font-body text-[13px] text-mid underline-offset-4 transition-colors hover:text-text hover:underline ${RING}`}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {meetingPoint ? (
                    <>
                      <p className="mt-3 font-body text-[16px] font-medium leading-snug text-text">
                        {meetingPoint}
                      </p>
                      {logistics && (
                        <p className="mt-2 font-body text-[13.5px] leading-relaxed text-mid">
                          {logistics}
                        </p>
                      )}
                    </>
                  ) : (
                    // Not set is not a neutral state — it is the one fault on
                    // this screen that leaves people standing in the dark, so
                    // it is drawn as clay rather than as grey helper text.
                    <p className="mt-3 rounded-[var(--r-input)] bg-clay-wash px-3.5 py-3 font-body text-[13.5px] leading-relaxed text-clay-deep">
                      Not set yet. Until it is, nobody on this walk knows where to stand — put the
                      exact spot in, not the town.
                    </p>
                  )}

                  {/* When the address reaches them, said on the screen that
                      owns it. The roster tab makes the same statement above
                      the asks; a host looking at the point itself should not
                      have to switch tabs to find out whether anybody has it. */}
                  <p className="mt-3 border-t border-rule-soft pt-3 font-body text-[13px] leading-relaxed text-mid">
                    {shortOfQuorum > 0
                      ? `${shortOfQuorum} more confirmed releases the meeting point.`
                      : 'Everybody confirmed can see this now.'}
                  </p>

                  <button
                    type="button"
                    onClick={() => setEditingPoint(true)}
                    className={`trek-pill trek-pill-sm trek-pill-quiet mt-3.5 w-full justify-center font-body ${RING}`}
                  >
                    Edit the point
                  </button>
                </>
              )}
            </div>

            <div className="rounded-[var(--r-panel)] border border-rule bg-surface p-5.5">
              <RailHead>{coHosts.length === 1 ? 'Co-host' : 'Co-hosts'}</RailHead>

              {coHosts.length === 0 ? (
                <p className="mt-3 font-body text-[13.5px] leading-relaxed text-mid">
                  Nobody helping you run this one. Appointed, never self-claimed — you pick them
                  off the confirmed list.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {coHosts.map((r) => (
                    <li key={r.user_id} className="flex items-center gap-3">
                      <Avatar name={r.display_name} id={r.user_id} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-body text-[15px] text-text">{r.display_name}</p>
                        <p className="mt-0.5 font-body text-[12px] leading-relaxed text-mid">
                          can confirm, announce and check in
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => removeCoHost(planId, r.user_id),
                            `${r.display_name} is no longer a co-host`
                          )
                        }
                        className={`border-b border-rule pb-0.5 font-body text-[12px] text-mid transition-colors hover:border-text hover:text-text disabled:opacity-40 ${RING}`}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <button
                type="button"
                onClick={() => setTab('roster')}
                className={`mt-3.5 w-full rounded-full border border-dashed border-rule-warm px-4 py-2.5 font-body text-[13px] font-medium leading-none text-mid transition-colors hover:border-mid hover:text-text ${RING}`}
              >
                Add a co-host
              </button>
            </div>

            {/* Cancelling is a clay text link inside a tinted card, never a red
                button. The board has no red: a host calling off a walk because
                the road washed out has not done anything wrong, and a control
                that shouts at them makes sending the correction off the board
                the easier path — which is the one thing this exists to stop. */}
            <div className="rounded-[var(--r-panel)] border border-clay/25 bg-clay-wash p-5.5">
              <RailHead>If plans change</RailHead>
              <p className="mt-2.5 font-body text-[13.5px] leading-relaxed text-mid">
                Calling it off tells all {going.length}, immediately, with your reason. Better a
                cancelled sunrise than a group waiting at a dark bus stand.
              </p>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    disabled={pending}
                    className={`mt-3.5 border-b border-clay pb-0.5 font-body text-[13px] font-medium text-clay-deep transition-colors hover:border-clay-deep disabled:opacity-40 ${RING}`}
                  >
                    Call this walk off
                  </button>
                </AlertDialogTrigger>
                {/* `trek-scope` on the content, because Radix portals this to
                    document.body — outside the layout's wrapper — so without it
                    the dialog renders in the storefront's cream and its serif
                    rather than in the board's own tokens. */}
                <AlertDialogContent className="trek-scope rounded-[var(--r-panel)] border-rule bg-paper sm:rounded-[var(--r-panel)]">
                  <AlertDialogHeader>
                    {/* The size is stated twice on purpose. `buttonVariants`'
                        sibling here — `AlertDialogTitle`'s own base classes —
                        carry `text-lg font-semibold`, which are utilities and
                        therefore beat a plain class in the base layer; naming
                        the size as a utility as well is what lets tailwind-
                        merge drop theirs and leaves `trek-h2` setting the
                        family and the leading. */}
                    <AlertDialogTitle className="trek-h2 text-[23px] font-normal text-text">
                      Call off {place}?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="font-body text-[14px] leading-relaxed text-mid">
                      Everyone going is told straight away, with whatever you write here. This
                      cannot be undone — a cancelled walk stays cancelled, and posting it again
                      starts from nobody.
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <label className="sr-only" htmlFor="console-cancel-reason">
                    Why you are calling it off
                  </label>
                  <textarea
                    id="console-cancel-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="Road washed out past Pantwari — not worth the risk in this rain."
                    className="w-full resize-y rounded-[var(--r-input)] border border-rule bg-surface px-3.5 py-3 font-body text-[15px] leading-relaxed text-text placeholder:text-mid/60 focus:border-clay focus:outline-none"
                  />

                  {/* Both dialog buttons are written as utilities rather than
                      as `trek-pill`, because shadcn's `buttonVariants` puts
                      `rounded-md h-10 px-4 py-2 text-sm` on them through
                      tailwind-merge — which cannot see a plain CSS class and
                      so would silently win against it. Same shape, same
                      sentence case, stated in the language that survives. */}
                  <AlertDialogFooter>
                    <AlertDialogCancel className="h-auto rounded-full border-rule-warm bg-surface px-5 py-2.5 font-body text-[13px] font-medium text-text hover:bg-paper-warm">
                      Keep it on
                    </AlertDialogCancel>
                    {/* Clay, and clay is not red. This confirms a thing that
                        stops — the same colour the board gives a full walk and
                        a waitlist — so it reads as final without reading as a
                        mistake being made. */}
                    <AlertDialogAction
                      onClick={() => run(() => cancelPlan(planId, reason || undefined))}
                      className="h-auto rounded-full border border-clay-deep bg-clay-deep px-5 py-2.5 font-body text-[13px] font-medium text-paper hover:bg-clay"
                    >
                      Call it off
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <InviteCardPanel
              planId={planId}
              token={shareToken}
              place={place}
              whenLabel={whenLabel}
            />
          </aside>
        </div>
      </section>
    </>
  )
}
