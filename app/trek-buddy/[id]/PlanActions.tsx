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
  planId, isHost, myStatus, full, cancelled, roster,
}: {
  planId: string
  isHost: boolean
  myStatus: string | null
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
    return (
      <div className="mt-8">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest">
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
                    className="rounded-sm bg-forest px-3 py-1.5 font-body text-[10px] uppercase tracking-[0.1em] text-paper disabled:opacity-40"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => decideRequest(planId, r.user_id, 'declined'))}
                    className="rounded-sm border border-rule px-3 py-1.5 font-body text-[10px] uppercase tracking-[0.1em] text-mid hover:border-text hover:text-text disabled:opacity-40"
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

        {waiting.length === 0 && going.length === 0 && (
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
              className="mt-2 w-full rounded-sm border border-rule bg-white px-3 py-2.5 font-body text-sm text-text focus:border-forest focus:outline-none"
            />
          </label>
          {error && <p className="mt-3 font-body text-xs text-clay">{error}</p>}
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => requestToJoin(planId, message))}
            className="mt-3 rounded-sm bg-forest px-6 py-3 font-body text-[10px] uppercase tracking-[0.12em] text-paper transition-colors hover:bg-forest-mid disabled:opacity-50"
          >
            {pending ? 'Asking…' : 'Ask to come'}
          </button>
        </>
      )}
    </div>
  )
}
