'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { requestToJoin, withdrawRequest, decideRequest, cancelPlan } from '@/actions/trekBuddy'

type RosterRow = { user_id: string; display_name: string; status: string; message: string | null }

// Everything a viewer can do to a plan, in one place, because who can do what
// depends on which of three people they are: the host, someone who has asked,
// or someone who has not.
export default function PlanActions({
  planId, isHost, myStatus, full, cancelled, roster, waitlistPosition,
}: {
  planId: string
  isHost: boolean
  myStatus: string | null
  /** Where you stand in the queue, 1-based. Null unless you are waitlisted. */
  waitlistPosition?: number | null
  full: boolean
  cancelled: boolean
  roster: RosterRow[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function run(fn: () => Promise<{ error?: string } | { success: true }>) {
    setError('')
    start(async () => {
      const r = await fn()
      if (r && 'error' in r && r.error) { setError(r.error); return }
      router.refresh()
    })
  }

  if (cancelled) return null

  if (isHost) {
    const waiting = roster.filter((r) => r.status === 'requested')
    const going = roster.filter((r) => r.status === 'confirmed')
    // Kept apart from `waiting` on purpose: these are not decisions the host is
    // sitting on. There is no place to give, and showing them in the same list
    // would read as a pile of unanswered asks.
    const queued = roster.filter((r) => r.status === 'waitlisted')
    return (
      <div className="mt-8">
        <h2 className="trek-label font-mono text-forest">
          Your walk
        </h2>

        {waiting.length > 0 && (
          <div className="mt-4">
            <p className="font-body text-xs uppercase tracking-[0.1em] text-mid">
              Asked to come ({waiting.length})
            </p>
            <ul className="mt-2 divide-y divide-rule border-y border-rule">
              {waiting.map((r) => (
                <li key={r.user_id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/trek-buddy/people/${r.user_id}`}
                      className="font-body text-sm text-text underline decoration-rule underline-offset-4 hover:decoration-forest">
                      {r.display_name}
                    </Link>
                    {r.message && (
                      <p className="mt-0.5 font-body text-xs text-mid">{r.message}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={pending || full}
                    onClick={() => run(() => decideRequest(planId, r.user_id, 'confirmed'))}
                    title={full ? 'This walk is full' : undefined}
                    className="trek-pill trek-pill-act font-body disabled:opacity-40"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => decideRequest(planId, r.user_id, 'declined'))}
                    className="rounded-[6px] border border-rule px-3 py-1.5 font-body text-[10px] uppercase tracking-[0.1em] text-mid hover:border-text hover:text-text disabled:opacity-40"
                  >
                    Decline
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 font-body text-xs text-mid">
              Declining is silent — they are not told why, and you do not owe a reason.
            </p>
          </div>
        )}

        {going.length > 0 && (
          <div className="mt-6">
            <p className="font-body text-xs uppercase tracking-[0.1em] text-mid">
              Coming with you ({going.length})
            </p>
            <p className="mt-1 flex flex-wrap gap-x-3 font-body text-sm text-text">
              {going.map((r) => (
                <Link key={r.user_id} href={`/trek-buddy/people/${r.user_id}`}
                  className="underline decoration-rule underline-offset-4 hover:decoration-forest">
                  {r.display_name}
                </Link>
              ))}
            </p>
          </div>
        )}

        {/* The queue, in order, and read-only. There is nothing for the host to
            press: a place has to come free before the person at the front can
            be decided on, and offering a button that cannot work is worse than
            offering none. It is here so the host knows the interest exists. */}
        {queued.length > 0 && (
          <div className="mt-6">
            <p className="font-body text-xs uppercase tracking-[0.1em] text-mid">
              Waiting for a place ({queued.length})
            </p>
            <ol className="mt-2 space-y-1">
              {queued.map((r, i) => (
                <li key={r.user_id} className="flex items-baseline gap-2 font-body text-sm text-text">
                  <span className="font-mono text-[10px] text-mid tabular-nums">{i + 1}</span>
                  <Link href={`/trek-buddy/people/${r.user_id}`}
                    className="underline decoration-rule underline-offset-4 hover:decoration-forest">
                    {r.display_name}
                  </Link>
                </li>
              ))}
            </ol>
            <p className="mt-2 font-body text-xs leading-relaxed text-mid">
              If somebody drops out, the first of these moves to &ldquo;asked to come&rdquo; on its
              own and you decide then.
            </p>
          </div>
        )}

        {waiting.length === 0 && going.length === 0 && queued.length === 0 && (
          <p className="mt-3 font-body text-sm text-mid">
            Nobody has asked to come yet.
          </p>
        )}

        {error && <p className="mt-4 font-body text-xs text-clay">{error}</p>}

        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const reason = window.prompt('Why are you calling it off? Everyone going will see this.')
            if (reason === null) return
            run(() => cancelPlan(planId, reason || undefined))
          }}
          className="mt-8 border-b border-rule pb-1 font-body text-[10px] uppercase tracking-[0.12em] text-clay transition-colors hover:text-text disabled:opacity-40"
        >
          Call this walk off
        </button>
      </div>
    )
  }

  if (myStatus === 'confirmed') {
    return (
      <div className="mt-8">
        <p className="font-body text-sm text-text">
          You&apos;re confirmed for this walk.
        </p>
        {error && <p className="mt-3 font-body text-xs text-clay">{error}</p>}
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => withdrawRequest(planId))}
          className="mt-3 border-b border-rule pb-1 font-body text-[10px] uppercase tracking-[0.12em] text-mid transition-colors hover:text-text disabled:opacity-40"
        >
          I can&apos;t make it
        </button>
      </div>
    )
  }

  if (myStatus === 'requested') {
    return (
      <div className="mt-8">
        <p className="font-body text-sm text-text">
          You&apos;ve asked to come. {}
          <span className="text-mid">The host will confirm or decline.</span>
        </p>
        {error && <p className="mt-3 font-body text-xs text-clay">{error}</p>}
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => withdrawRequest(planId))}
          className="mt-3 border-b border-rule pb-1 font-body text-[10px] uppercase tracking-[0.12em] text-mid transition-colors hover:text-text disabled:opacity-40"
        >
          Withdraw
        </button>
      </div>
    )
  }

  if (myStatus === 'waitlisted') {
    return (
      <div className="mt-8">
        <p className="font-body text-sm text-text">
          This walk is full, so you&apos;re in the queue
          {typeof waitlistPosition === 'number' ? (
            <>
              {' '}at <span className="font-mono tabular-nums">number {waitlistPosition}</span>
            </>
          ) : null}
          .
        </p>
        {/* Says what happens next without promising a place. The queue moves you
            in front of the host; it does not seat you, because on this board the
            host decides who comes and a queue that overrode that would quietly
            repeal the safest thing about it. */}
        <p className="mt-1.5 font-body text-xs leading-relaxed text-mid">
          If somebody drops out you move up on your own, and your ask goes to the host the moment
          you reach the front. Nobody is added to a walk automatically — the host still decides.
        </p>
        {error && <p className="mt-3 font-body text-xs text-clay">{error}</p>}
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => withdrawRequest(planId))}
          className="mt-3 border-b border-rule pb-1 font-body text-[10px] uppercase tracking-[0.12em] text-mid transition-colors hover:text-text disabled:opacity-40"
        >
          Leave the queue
        </button>
      </div>
    )
  }

  if (myStatus === 'declined' || myStatus === 'removed') {
    return (
      <p className="mt-8 font-body text-sm text-mid">
        You&apos;re not on this walk.
      </p>
    )
  }

  return (
    <div className="mt-8">
      {full ? (
        <p className="font-body text-sm text-mid">This walk is full.</p>
      ) : (
        <>
          <label className="block">
            <span className="font-body text-xs uppercase tracking-[0.12em] text-mid">
              Say hello (optional)
            </span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder="Anything the host should know — pace, experience, whether you're driving."
              className="mt-2 w-full rounded-[6px] border border-rule bg-white px-3 py-2.5 font-body text-sm text-text focus:border-forest focus:outline-none"
            />
          </label>
          {error && <p className="mt-3 font-body text-xs text-clay">{error}</p>}
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => requestToJoin(planId, message))}
            className="trek-pill trek-pill-act font-body disabled:opacity-50"
          >
            {pending ? 'Asking…' : 'Ask to come'}
          </button>
        </>
      )}
    </div>
  )
}
