'use client'

/* eslint-disable react-hooks/set-state-in-effect -- reading the clock is the
   one thing that must NOT happen during render here: this component is
   prerendered on the server and hydrated on the client, so a Date.now() in
   render is a guaranteed mismatch. Same established pattern as SummitHero's
   matchMedia read. */

import { useEffect, useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { decideRequest, markNotificationsRead, type TrekNotification } from '@/actions/trekBuddy'
import Avatar from './ui/Avatar'
import EmptyState from './ui/EmptyState'

/**
 * What each kind means, in one colour and one word.
 *
 * Coloured by consequence rather than by category: the two that change your
 * weekend — you are on, or the walk is off — read differently from the ones
 * that are merely news. On a board where the alternative is finding out by
 * reloading a page, that distinction is the whole value.
 */
const KIND: Record<string, { label: string; tone: 'good' | 'bad' | 'plain' }> = {
  request_received:  { label: 'Someone asked', tone: 'plain' },
  request_confirmed: { label: 'You are going', tone: 'good' },
  request_declined:  { label: 'Not this one',  tone: 'bad' },
  request_withdrawn: { label: 'Pulled out',    tone: 'plain' },
  plan_cancelled:    { label: 'Called off',    tone: 'bad' },
  point_released:    { label: 'Meeting point', tone: 'good' },
  vouched:           { label: 'Vouched',       tone: 'good' },
}

/** The dot, and the kicker, take the same colour — one decision, drawn twice. */
const TONE_DOT = { good: 'var(--forest)', bad: 'var(--clay)', plain: 'var(--mid)' }
const TONE_TEXT = { good: 'text-forest', bad: 'text-clay-deep', plain: 'text-mid' }

/**
 * When it happened.
 *
 * `now` is passed in rather than read from Date.now() inside render, and it is
 * null until the component has mounted. This is a client component rendered
 * from an async server page, so Next prerenders it with the SERVER clock and
 * then hydrates with the CLIENT one — a bare Date.now() in render makes every
 * one of these a hydration mismatch, and "just now" against "1m ago" is
 * exactly the kind of off-by-one that produces it. Before mount it prints the
 * absolute IST time instead, which is deterministic on both sides.
 */
function when(iso: string, now: number | null) {
  if (now === null) {
    return new Date(iso).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short',
      hour: 'numeric', minute: '2-digit',
    })
  }
  const mins = Math.round((now - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const h = Math.round(mins / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d}d ago`
}

// ── The requests queue ───────────────────────────────────────────────────────

/**
 * One person asking to come on one of your walks, with the case for them.
 *
 * The credibility fields are the reason this type is wider than the roster row
 * the plan page uses. A host was being asked to decide who spends a day in the
 * hills with them from a display name and one sentence, while the database
 * already knew how many people had vouched for that person, how many walks
 * they had actually finished, and how long they had been on the board. Those
 * three facts were being computed and then not shown to the only person whose
 * decision they exist to inform.
 */
export type HostRequest = {
  planId: string
  /** Where the walk goes — the row says "asked to join {place}". */
  place: string
  userId: string
  name: string
  message: string | null
  /** When they asked, so the queue can be ordered oldest first. */
  askedAt: string
  vouches: number
  /** Hosted plus joined: walks they have actually been out on. */
  walks: number
  memberSince: string | null
  /**
   * 0 joined · 1 phone verified · 2 phone verified and vouched for twice.
   *
   * The one fact on this row that is about safety rather than about sociability,
   * and `trek_person_card` has carried it since migration 065 for exactly this
   * screen — a host looking at somebody's card was shown a vouch count and
   * nothing about whether a phone number had ever been held. Null is a person
   * whose card could not be read at all, which is treated as unverified: on this
   * row an unknown and a no must not look different.
   */
  trustRung: number | null
}

/** "member since Mar 2025" — fixed zone and fixed parts, so it is deterministic. */
function monthYear(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', month: 'short', year: 'numeric',
  })
}

/**
 * A figure inside the credibility run.
 *
 * The run used to be set entirely in 10px tracked monospace, which made the
 * words as machine-like as the numbers and put the whole line at a size a host
 * scanning a queue would skip. Mono is rationed to figures now, so the count is
 * mono and tabular and the noun beside it is prose — which is also what lets
 * the run be set two steps larger without shouting.
 */
function Fig({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[13px] font-medium tabular-nums">{children}</span>
}

/**
 * Has this person ever held a phone number up to the board?
 *
 * Rung 1 and above is a verified number; rung 0 and a null card are both "no",
 * and they are drawn the same on purpose. What it proves is narrow and the
 * product says so everywhere else — that somebody holds that SIM, not who they
 * are — but it is the only check on the row that a person cannot simply type.
 */
function verified(r: HostRequest) {
  return (r.trustRung ?? 0) >= 1
}

/**
 * Decide who comes.
 *
 * The most important block on the product, and until now it existed only one
 * walk at a time, on a page you had to already be looking at. A host with three
 * walks up had three desks. This is the one desk: everybody waiting on you,
 * oldest ask first, each with the evidence next to the button.
 *
 * The decision goes through `decideRequest` untouched — the same action the
 * plan page and the console call, with the same RPC behind it deciding whether
 * the caller may. What changed is only what the host can see before pressing.
 */
export function RequestQueue({
  requests,
  canHost = false,
}: {
  requests: HostRequest[]
  canHost?: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  // Decided rows stay put for a beat rather than vanishing under the pointer.
  // The refresh below removes them; this is what the host sees in between, and
  // it is the only confirmation they get that the press landed.
  const [decided, setDecided] = useState<Record<string, 'confirmed' | 'declined'>>({})
  const [failed, setFailed] = useState<Record<string, string>>({})

  const key = (r: HostRequest) => `${r.planId}:${r.userId}`

  const decide = (r: HostRequest, decision: 'confirmed' | 'declined') =>
    start(async () => {
      const result = await decideRequest(r.planId, r.userId, decision)
      // The RPC's refusals are written to be read by a person — "this plan is
      // not taking anyone", "you are not the host" — so they are shown as they
      // came, in clay. There is no Toaster mounted on these routes, so an
      // error raised anywhere but in the row itself would be invisible.
      if ('error' in result) {
        setFailed((f) => ({ ...f, [key(r)]: result.error }))
        return
      }
      setFailed((f) => { const next = { ...f }; delete next[key(r)]; return next })
      setDecided((d) => ({ ...d, [key(r)]: decision }))
      router.refresh()
    })

  return (
    <section id="decide" className="scroll-mt-24">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 pb-4">
        <h2 className="trek-h2 text-text">
          Decide who comes{' '}
          {/* The one amber on this screen, and it is the same fact the ink
              band's first tile carries: a number of people who cannot get on
              with their weekend until you press something. Everything else
              that used to be amber here — the unread marker, the hover plate,
              the focus ring — has been taken off it, because an accent that
              appears five times is a texture rather than a signal. */}
          {requests.length > 0 && (
            <span className="font-mono text-[15px] text-ember tabular-nums">
              · {requests.length} waiting
            </span>
          )}
        </h2>
        <span className="font-body text-[13px] text-mid">
          declining is silent — you owe nobody a reason
        </span>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          title="Nobody is waiting on you."
          body={
            <>
              When somebody asks to come on a walk you are hosting, they land here — with what the
              board knows about them next to the button, because a name and one sentence is not
              enough to decide a day on.
            </>
          }
          action={
            canHost
              ? { label: 'Post a walk', href: '/trek-buddy/new' }
              : { label: 'Find a walk', href: '/trek-buddy' }
          }
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {requests.map((r) => {
            const state = decided[key(r)]
            const error = failed[key(r)]
            return (
              <li
                key={key(r)}
                className={`trek-row flex flex-wrap items-center gap-4 px-5 py-4 transition-opacity duration-300 ${
                  state ? 'opacity-55' : ''
                }`}
              >
                <Avatar
                  name={r.name}
                  id={r.userId}
                  size={40}
                  href={`/trek-buddy/people/${r.userId}`}
                />

                <div className="min-w-0 flex-1">
                  <p className="font-body text-[15px] leading-snug text-text">
                    <Link
                      href={`/trek-buddy/people/${r.userId}`}
                      className="font-semibold underline decoration-rule underline-offset-4 transition-colors hover:decoration-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
                    >
                      {r.name}
                    </Link>
                    <span className="text-mid"> asked to join </span>
                    <Link
                      href={`/trek-buddy/${r.planId}`}
                      className="underline decoration-rule underline-offset-4 transition-colors hover:decoration-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
                    >
                      {r.place}
                    </Link>
                  </p>

                  {r.message && (
                    <p className="mt-1.5 border-l-2 border-rule-warm pl-3 font-body text-[13px] italic leading-relaxed text-mid">
                      &ldquo;{r.message}&rdquo;
                    </p>
                  )}

                  {/* ── The case for this person ──────────────────────────
                      Given a plate of its own rather than a 10px caption,
                      because this is the evidence the whole screen exists to
                      put next to the button, and a host skimming a queue was
                      being asked to read it at the size of a footnote. Sage
                      wash with forest type: the product's trust colour, at a
                      contrast a small run can actually be read at.

                      It still never says nothing. Somebody with no vouches and
                      no walks reads "no vouches yet · first walk", which is a
                      real thing to know about a person rather than an absence
                      where a reason should be — hiding a zero would flatter new
                      members at the host's expense.

                      And the phone fact leaves the run when it is a NO. An
                      unverified number in the same green as two vouches would
                      read as one more thing earned; in clay it reads as what it
                      is, which is a limit on what the board can tell you. */}
                  <ul className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-[var(--r-tag)] bg-sage-soft px-3 py-2 font-body text-[13px] leading-tight text-forest">
                    <li>
                      {r.vouches > 0 ? (
                        <>
                          <Fig>{r.vouches}</Fig> {r.vouches === 1 ? 'vouch' : 'vouches'}
                        </>
                      ) : (
                        'no vouches yet'
                      )}
                    </li>
                    <li>
                      {r.walks > 0 ? (
                        <>
                          <Fig>{r.walks}</Fig> {r.walks === 1 ? 'walk done' : 'walks done'}
                        </>
                      ) : (
                        'first walk'
                      )}
                    </li>
                    {r.memberSince && (
                      <li>
                        member since <Fig>{monthYear(r.memberSince)}</Fig>
                      </li>
                    )}
                    <li className={verified(r) ? '' : 'font-medium text-clay-deep'}>
                      {verified(r) ? 'phone verified' : 'no verified phone'}
                    </li>
                  </ul>

                  {error && (
                    <p className="mt-2 font-body text-[13px] text-clay-deep">{error}</p>
                  )}
                </div>

                {state ? (
                  // Announced, not just drawn: the buttons vanish when a
                  // decision lands, and a host using a screen reader would
                  // otherwise hear the row go quiet and learn nothing.
                  <span
                    role="status"
                    className={`shrink-0 font-body text-[13px] font-medium ${
                      state === 'confirmed' ? 'text-forest' : 'text-mid'
                    }`}
                  >
                    {state === 'confirmed' ? 'Coming' : 'Declined'}
                  </span>
                ) : (
                  <div className="flex shrink-0 gap-2">
                    {/* Forest fills; declining is an outline. The two are
                        deliberately not a matched pair of buttons — one of them
                        lets a person into your day and the other quietly does
                        not, and a screen that draws them identically is asking
                        the host to press carefully rather than helping them. */}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => decide(r, 'confirmed')}
                      aria-label={`Confirm ${r.name} for ${r.place}`}
                      className="trek-pill trek-pill-act font-body focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage disabled:opacity-40"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => decide(r, 'declined')}
                      aria-label={`Decline ${r.name} for ${r.place}`}
                      className="trek-pill trek-pill-quiet font-body focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage disabled:opacity-40"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// ── The feed ─────────────────────────────────────────────────────────────────

// What has happened.
//
// Until this existed, being accepted onto a walk reached you only if you
// happened to come back and look, and being turned down reached you not at all
// — the walk simply left your list. So this is not a feature beside the
// product, it is the half of it that was missing.
//
// It lives on Basecamp — which has absorbed the old "Yours" page — because
// everything here is about a specific walk of yours, and the page those walks
// are on is where you can act on any of it.
//
// Drawn as a ruled list rather than as cards: this is a log, every line is the
// same kind of thing, and a stack of bordered boxes would give five equal
// events five separate frames to be read out of.
export default function Inbox({
  items,
  unread,
}: {
  items: TrekNotification[]
  unread: number
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [showAll, setShowAll] = useState(false)
  // Set once, after mount. See `when` above.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => { setNow(Date.now()) }, [])

  const shown = showAll ? items : items.slice(0, 8)

  return (
    <section id="feed" className="scroll-mt-24">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 pb-4">
        <h2 className="trek-h2 text-text">
          What has happened{' '}
          {/* Deliberately NOT amber. Nobody is waiting on you to read a log —
              the queue above is the only thing on this page with a person on
              the other end of it, and it keeps the accent. The count is still a
              figure, so it is still mono. */}
          {unread > 0 && (
            <span className="font-mono text-[15px] text-mid tabular-nums">· {unread} new</span>
          )}
        </h2>
        {unread > 0 && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await markNotificationsRead()
                router.refresh()
              })
            }
            className="trek-pill trek-pill-quiet trek-pill-sm font-body focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage disabled:opacity-40"
          >
            {pending ? 'Marking…' : 'Mark all read'}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Nothing has happened yet."
          body={
            <>
              When somebody asks to come on one of your walks, or a host decides about yours, it
              lands here.
            </>
          }
          action={{ label: 'See what is on', href: '/trek-buddy' }}
        />
      ) : (
        <>
          <ul className="border-t border-rule">
            {shown.map((n) => {
              const meta = KIND[n.kind] ?? { label: 'Update', tone: 'plain' as const }
              const Row = (
                <div className="flex gap-3.5 border-b border-rule py-3.5 transition-colors">
                  {/* 7px, filled in the kind's colour when it is news to you
                      and hollow once it is not. The rail idiom at its
                      smallest, and the only difference between a thing that
                      happened and a thing you have already read. */}
                  <span
                    aria-hidden="true"
                    className="mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full"
                    style={
                      n.read
                        ? { boxShadow: `0 0 0 1px ${TONE_DOT[meta.tone]}`, opacity: 0.5 }
                        : { background: TONE_DOT[meta.tone] }
                    }
                  />

                  <p
                    className={`min-w-0 flex-1 font-body text-[15px] leading-[1.45] ${
                      n.read ? 'text-mid' : 'font-semibold text-text'
                    }`}
                  >
                    <span
                      // "You are going" is a state, not a figure, so it is no
                      // longer 10px tracked monospace capitals — it is the
                      // sentence's own type, held at medium so an unread row's
                      // semibold does not swallow the distinction between the
                      // kicker and the thing that happened.
                      className={`mr-1.5 font-medium ${TONE_TEXT[meta.tone]}`}
                    >
                      {meta.label} ·
                    </span>
                    {n.body}
                  </p>

                  {/* One unread signal, not three. The dot to the left is
                      already filled-or-hollow and the sentence is already
                      bolded; the amber pip that used to sit here as well was
                      the same fact a third time, in the one colour this product
                      reserves for somebody waiting on you. */}
                  <span className="mt-1 shrink-0 self-start font-mono text-[11px] text-mid tabular-nums">
                    {when(n.createdAt, now)}
                  </span>
                </div>
              )

              return (
                <li key={n.id}>
                  {n.planId ? (
                    <Link
                      href={`/trek-buddy/${n.planId}`}
                      className="block transition-colors hover:bg-paper-warm/40 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sage"
                    >
                      {Row}
                    </Link>
                  ) : (
                    Row
                  )}
                </li>
              )
            })}
          </ul>

          {items.length > 8 && (
            <button
              type="button"
              aria-expanded={showAll}
              onClick={() => setShowAll((v) => !v)}
              className="trek-pill trek-pill-quiet trek-pill-sm mt-4 font-body focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
            >
              {showAll ? 'Show less' : `Show all ${items.length}`}
            </button>
          )}
        </>
      )}
    </section>
  )
}
