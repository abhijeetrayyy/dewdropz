'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { decideRequest } from '@/actions/trekBuddy'
import {
  checkIn, updateMeetingPoint, announce, promoteWaitlisted, type ConsoleRoster,
} from '@/actions/trekConsole'

// The host's desk for one walk.
//
// Everything here already existed in pieces — confirming was on the plan page,
// the meeting point could not be changed at all, and there was nowhere to say
// "we are starting an hour later". Gathering them is most of the value: a host
// standing at a bus stand at 05:10 should not be navigating between screens.
//
// Deliberately not built, and both for reasons rather than time:
//
// CO-HOSTS. The design gives a co-host the power to confirm people. That is the
// board's central safety decision, and handing it to a second person needs a
// permission model, an audit trail and a way to see who admitted whom. It
// deserves its own pass rather than a checkbox at the end of this one.
//
// WHO HAS PAID. The board takes no money and says so — the cost share is
// "split at face value on the day". A per-person paid/unpaid ledger inside the
// app is the first step toward looking like it settles payments, and the
// difference matters if anything ever goes wrong with one.
export default function ConsoleClient({
  planId,
  roster,
  meetingPoint,
  logistics,
  minParty,
  goingCount,
  canCheckIn,
}: {
  planId: string
  roster: ConsoleRoster[]
  meetingPoint: string
  logistics: string
  minParty: number
  goingCount: number
  canCheckIn: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [point, setPoint] = useState(meetingPoint)
  const [logi, setLogi] = useState(logistics)
  const [editingPoint, setEditingPoint] = useState(false)
  const [note, setNote] = useState('')

  const asking = roster.filter((r) => r.status === 'requested')
  const going = roster.filter((r) => r.status === 'confirmed')
  const queued = roster.filter((r) => r.status === 'waitlisted')

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

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-10">
        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl text-text">Asking to come · {asking.length}</h2>
            {goingCount < minParty && (
              <p className="font-body text-xs text-mid">
                {minParty - goingCount} more confirmed releases the meeting point.
              </p>
            )}
          </div>

          {asking.length === 0 ? (
            <p className="mt-3 font-body text-sm text-mid">Nothing waiting on you.</p>
          ) : (
            <ul className="mt-3 divide-y divide-rule border-y border-rule">
              {asking.map((r) => (
                <li key={r.user_id} className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/trek-buddy/people/${r.user_id}`}
                        className="font-body text-sm text-text underline decoration-rule underline-offset-4 hover:decoration-forest">
                        {r.display_name}
                      </Link>
                      {r.message && (
                        <p className="mt-1 font-body text-sm italic leading-relaxed text-mid">
                          &ldquo;{r.message}&rdquo;
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button type="button" disabled={pending}
                        onClick={() => run(() => decideRequest(planId, r.user_id, 'confirmed'), `${r.display_name} is coming`)}
                        className="rounded-full bg-forest px-4 py-1.5 font-body text-[10px] uppercase tracking-[0.12em] text-paper hover:bg-forest-mid disabled:opacity-40">
                        Confirm
                      </button>
                      <button type="button" disabled={pending}
                        onClick={() => run(() => decideRequest(planId, r.user_id, 'declined'))}
                        className="rounded-full border border-rule px-4 py-1.5 font-body text-[10px] uppercase tracking-[0.12em] text-mid hover:border-clay hover:text-clay disabled:opacity-40">
                        Decline
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl text-text">Coming · {going.length}</h2>
            <p className="font-body text-xs text-mid">
              {canCheckIn
                ? 'Check people in at the meeting point.'
                : 'Checking in opens twelve hours before you leave.'}
            </p>
          </div>

          {going.length === 0 ? (
            <p className="mt-3 font-body text-sm text-mid">Nobody confirmed yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-rule border-y border-rule">
              {going.map((r) => (
                <li key={r.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <Link href={`/trek-buddy/people/${r.user_id}`}
                    className="font-body text-sm text-text underline decoration-rule underline-offset-4 hover:decoration-forest">
                    {r.display_name}
                  </Link>
                  <button
                    type="button"
                    disabled={pending || !canCheckIn}
                    onClick={() => run(() => checkIn(planId, r.user_id, !r.checked_in_at))}
                    className={`rounded-full px-4 py-1.5 font-body text-[10px] uppercase tracking-[0.12em] disabled:opacity-40 ${
                      r.checked_in_at
                        ? 'bg-forest text-paper'
                        : 'border border-rule text-mid hover:border-forest hover:text-forest'
                    }`}
                  >
                    {r.checked_in_at ? 'Here ✓' : 'Check in'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {queued.length > 0 && (
          <section>
            <h2 className="font-display text-xl text-text">Waiting · in order</h2>
            <p className="mt-1 font-body text-xs leading-relaxed text-mid">
              The first of these moves up on its own when somebody drops. Bringing one forward by
              hand puts their ask in front of you — it does not add them to the walk.
            </p>
            <ol className="mt-3 divide-y divide-rule border-y border-rule">
              {queued.map((r, i) => (
                <li key={r.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] text-mid tabular-nums">#{i + 1}</span>
                    <Link href={`/trek-buddy/people/${r.user_id}`}
                      className="font-body text-sm text-text underline decoration-rule underline-offset-4 hover:decoration-forest">
                      {r.display_name}
                    </Link>
                  </span>
                  <button type="button" disabled={pending}
                    onClick={() => run(() => promoteWaitlisted(planId, r.user_id), `${r.display_name} moved up`)}
                    className="rounded-full border border-rule px-4 py-1.5 font-body text-[10px] uppercase tracking-[0.12em] text-mid hover:border-forest hover:text-forest disabled:opacity-40">
                    Move up
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-sm border border-rule bg-paper-warm/40 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest">
            Exact meeting point
          </p>
          {editingPoint ? (
            <>
              <input value={point} onChange={(e) => setPoint(e.target.value)}
                placeholder="Gate 2, behind the tea stall"
                className="mt-2 w-full rounded-sm border border-rule bg-paper px-3 py-2 font-body text-sm text-text focus:border-forest focus:outline-none" />
              <input value={logi} onChange={(e) => setLogi(e.target.value)}
                placeholder="Shared cab from ISBT, roughly ₹300 each way"
                className="mt-2 w-full rounded-sm border border-rule bg-paper px-3 py-2 font-body text-sm text-text focus:border-forest focus:outline-none" />
              <p className="mt-2 font-body text-xs leading-relaxed text-mid">
                Everyone already confirmed is told it changed. Somebody still waiting on you is
                not — they have never seen the old one.
              </p>
              <div className="mt-3 flex gap-2">
                <button type="button" disabled={pending}
                  onClick={() => run(() => updateMeetingPoint(planId, point, logi), 'Meeting point updated')}
                  className="rounded-full bg-forest px-4 py-1.5 font-body text-[10px] uppercase tracking-[0.12em] text-paper hover:bg-forest-mid disabled:opacity-40">
                  Save
                </button>
                <button type="button" onClick={() => { setPoint(meetingPoint); setLogi(logistics); setEditingPoint(false) }}
                  className="font-mono text-[10px] uppercase tracking-[0.12em] text-mid hover:text-text">
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 font-body text-sm text-text">{meetingPoint}</p>
              {logistics && <p className="mt-1 font-body text-xs text-mid">{logistics}</p>}
              <button type="button" onClick={() => setEditingPoint(true)}
                className="mt-3 border-b border-rule pb-1 font-body text-[10px] uppercase tracking-[0.12em] text-mid hover:text-text">
                Edit the point
              </button>
            </>
          )}
        </div>

        <div className="rounded-sm border border-rule p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest">
            Tell everyone
          </p>
          <p className="mt-2 font-body text-xs leading-relaxed text-mid">
            Goes into the group chat and reaches everyone confirmed, whether or not they are
            looking at the page. For &ldquo;starting an hour later&rdquo;, not for chat.
          </p>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000}
            placeholder="Road is washed out past Pantwari — we are leaving an hour later."
            className="mt-2 w-full rounded-sm border border-rule bg-paper px-3 py-2 font-body text-sm text-text placeholder:text-mid/60 focus:border-forest focus:outline-none" />
          <button type="button" disabled={pending || note.trim().length < 3}
            onClick={() => run(() => announce(planId, note), 'Everyone has been told')}
            className="mt-2 w-full rounded-full bg-forest px-4 py-2 font-body text-[10px] uppercase tracking-[0.12em] text-paper hover:bg-forest-mid disabled:opacity-40">
            Announce
          </button>
        </div>
      </aside>
    </div>
  )
}
