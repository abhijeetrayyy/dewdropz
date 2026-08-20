'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { requestHostAccess, type HostRequestState } from '@/actions/trekBuddy'

// The door that was not there.
//
// Hosting has been invite-only since the board launched — `trek_can_host`
// defaults to false, and migration 052 sets out why that is a legal posture and
// not an oversight. What was an oversight is that there was no way to ask. A
// member who wanted to post the walk they were already going on found no form,
// no address, and no sentence telling them a gate existed; they found a board
// with nothing on it and no way to add to it.
//
// Worse, the product pointed at the wall. Discover's empty state offered a
// non-host "Finish your profile", which grants nothing at all, while Basecamp
// said the true thing two screens away. One of those was a dead end dressed as
// a next step.
//
// This says the true thing, once, wherever somebody meets the gate — and it
// gives them the one action that actually moves them. It does NOT open hosting
// and it does not promise it will be granted.

export default function HostAccess({
  state,
  className = '',
}: {
  state: HostRequestState
  className?: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  // Already asked, or already answered. Nothing to press.
  if (state.status === 'open') {
    return (
      <div className={`trek-card p-5 ${className}`}>
        <p className="trek-label text-forest">Asked</p>
        <p className="mt-2.5 font-body text-[14px] leading-relaxed text-text">
          You have asked to host. Somebody reads these by hand, so it is not instant — you will
          get a notification either way.
        </p>
      </div>
    )
  }

  if (state.status === 'granted') return null

  function submit() {
    setError('')
    start(async () => {
      const r = await requestHostAccess(note)
      if ('error' in r) {
        setError(r.error ?? 'Could not send that')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className={`trek-card p-5 ${className}`}>
      <p className="trek-label text-forest">Posting a walk</p>
      <h3 className="trek-h3 mt-2 text-text">
        {state.status === 'declined'
          ? 'You can ask again.'
          : 'Hosting is invite-only while this is new.'}
      </h3>
      <p className="mt-2.5 max-w-prose font-body text-[14px] leading-relaxed text-mid">
        {state.status === 'declined'
          ? 'It was not taken up last time. That is not permanent — a walk or two on the board behind you changes the answer more than anything you could write here.'
          : 'The board opens to hosts one person at a time, so that somebody has read every account that can invite strangers to a real place at a real hour. If you want to post the walk you were going on anyway, say so.'}
      </p>

      {open ? (
        <div className="mt-4">
          <label className="block">
            <span className="trek-label text-mid">
              Anything worth knowing <span className="font-body normal-case tracking-normal">(optional)</span>
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={600}
              placeholder="Where you usually walk, and roughly how often."
              className="mt-2 w-full rounded-[var(--r-input)] border border-rule bg-surface px-3.5 py-2.5 font-body text-[14px] text-text placeholder:text-light focus:border-forest focus:outline-none focus-visible:ring-2 focus-visible:ring-sage/50"
            />
          </label>

          {error && (
            <div className="mt-3 rounded-[var(--r-card)] border border-clay/50 bg-clay-wash px-3.5 py-2.5">
              <p className="font-body text-[13px] leading-relaxed text-clay-deep">{error}</p>
            </div>
          )}

          <div className="mt-3.5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="trek-pill trek-pill-act font-body disabled:opacity-50"
            >
              {pending ? 'Sending…' : 'Ask to host'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="border-b border-rule pb-1 font-body text-[13px] text-mid transition-colors hover:border-text hover:text-text"
            >
              Not now
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="trek-pill trek-pill-act mt-4 font-body"
        >
          Ask to host
        </button>
      )}
    </div>
  )
}
