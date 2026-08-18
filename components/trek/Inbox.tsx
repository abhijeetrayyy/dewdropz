'use client'

/* eslint-disable react-hooks/set-state-in-effect -- reading the clock is the
   one thing that must NOT happen during render here: this component is
   prerendered on the server and hydrated on the client, so a Date.now() in
   render is a guaranteed mismatch. Same established pattern as SummitHero's
   matchMedia read. */

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { markNotificationsRead, type TrekNotification } from '@/actions/trekBuddy'

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

// The inbox.
//
// Until this existed, being accepted onto a walk reached you only if you
// happened to come back and look, and being turned down reached you not at all
// — the walk simply left your list. So this is not a feature beside the
// product, it is the half of it that was missing.
//
// It lives on "Yours" rather than in a bell in the corner because everything
// here is about a specific walk of yours, and the page those walks are on is
// where you can act on any of it.
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

  if (items.length === 0) {
    return (
      <div className="rounded-[6px] border border-dashed border-rule px-5 py-6">
        <p className="font-body text-sm text-mid">
          Nothing has happened yet. When somebody asks to come on one of your walks, or a host
          decides about yours, it lands here.
        </p>
      </div>
    )
  }

  const shown = showAll ? items : items.slice(0, 5)

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3 pb-3">
        <h2 className="trek-label font-mono text-mid">
          What has happened
          {unread > 0 && (
            <span className="ml-2 rounded-full bg-forest px-2 py-0.5 font-mono text-[9px] text-paper tabular-nums">
              {unread} new
            </span>
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
            className="border-b border-rule pb-0.5 trek-label font-mono text-mid transition-colors hover:text-text disabled:opacity-40"
          >
            {pending ? 'Marking…' : 'Mark all read'}
          </button>
        )}
      </div>

      <ul className="divide-y divide-rule border-t border-rule">
        {shown.map((n) => {
          const meta = KIND[n.kind] ?? { label: 'Update', tone: 'plain' as const }
          const Row = (
            <div
              className={`flex gap-3.5 py-3.5 transition-colors ${
                n.planId ? 'group-hover:bg-paper-warm/40' : ''
              }`}
            >
              {/* Unread is a filled dot, read is a hollow one. The rail idiom
                  again, at its smallest. */}
              <span
                aria-hidden="true"
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  n.read
                    ? 'border border-mid/40'
                    : meta.tone === 'bad'
                      ? 'bg-clay'
                      : meta.tone === 'good'
                        ? 'bg-forest'
                        : 'bg-mid'
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2.5">
                  <span
                    className={`trek-label font-mono ${
                      meta.tone === 'bad'
                        ? 'text-clay'
                        : meta.tone === 'good'
                          ? 'text-forest'
                          : 'text-mid'
                    }`}
                  >
                    {meta.label}
                  </span>
                  <span className="font-mono text-[10px] text-mid/70">{when(n.createdAt, now)}</span>
                </div>
                <p className={`mt-1 font-body text-sm leading-snug ${n.read ? 'text-mid' : 'text-text'}`}>
                  {n.body}
                </p>
              </div>
            </div>
          )

          return (
            <li key={n.id}>
              {n.planId ? (
                <Link href={`/trek-buddy/${n.planId}`} className="group block">
                  {Row}
                </Link>
              ) : (
                Row
              )}
            </li>
          )
        })}
      </ul>

      {items.length > 5 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 border-b border-rule pb-0.5 trek-label font-mono text-mid transition-colors hover:text-text"
        >
          {showAll ? 'Show less' : `Show all ${items.length}`}
        </button>
      )}
    </div>
  )
}
