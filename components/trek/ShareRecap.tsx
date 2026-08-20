'use client'

import { useState, useTransition } from 'react'
import { mintRecapShareToken, revokeRecapShare } from '@/actions/trekRecap'

// The link a member can actually send somebody.
//
// Until this existed there was none. The board is members-only by design and
// the one shareable object — the invite card at /e/<token> — can be minted by
// hosts alone, and hosting is invite-only. So a product whose stated goal is
// that people get excited and tell their friends handed them nothing to send.
//
// ANY CONFIRMED WALKER, not only the host. The invite card is an invitation to
// a future event and only its host can extend it; a recap is the record of a
// day a group had together, and the host has no better claim on it than anybody
// who was there. The gate is in `trek_recap_share_token` (091), not here — this
// component only decides whether to draw a button.
//
// REVOCABLE AND SAID SO. A link sent to one person ends up in a group, and
// somebody who shared a day and then thought better of it should not have to
// ask anybody. Pressing "Stop sharing" makes the URL a 404 immediately.

export default function ShareRecap({
  planId,
  initialToken,
}: {
  planId: string
  /** The token if this recap is already shared, otherwise null. */
  initialToken: string | null
}) {
  const [token, setToken] = useState(initialToken)
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const url = token
    ? `${typeof window === 'undefined' ? '' : window.location.origin}/w/${token}`
    : ''

  function mint() {
    setError('')
    start(async () => {
      const r = await mintRecapShareToken(planId)
      if (!r.ok) { setError(r.error); return }
      setToken(r.token)
    })
  }

  function revoke() {
    setError('')
    start(async () => {
      const r = await revokeRecapShare(planId)
      if (!r.ok) { setError(r.error); return }
      setToken(null)
      setCopied(false)
    })
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // A clipboard the browser refuses is not an error worth a red box — the
      // address is on screen and can be selected.
      setCopied(false)
    }
  }

  return (
    <div className="mt-6 border-t border-rule-soft pt-5">
      <p className="trek-label text-mid">Send this to somebody</p>

      {token ? (
        <>
          <p className="mt-2 font-body text-[13px] leading-relaxed text-mid">
            Anybody with this link can read it — the words, the photographs, and the first names
            of who went. Not the meeting point, and nothing that leads to anyone&apos;s profile.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <code className="min-w-0 flex-1 truncate rounded-[var(--r-input)] border border-rule bg-surface px-3 py-2 font-mono text-[12.5px] text-text">
              {url.replace(/^https?:\/\//, '')}
            </code>
            <button
              type="button"
              onClick={copy}
              className="trek-pill trek-pill-sm trek-pill-act font-body"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={revoke}
              disabled={pending}
              className="border-b border-rule pb-1 font-body text-[13px] text-mid transition-colors hover:border-clay hover:text-clay-deep disabled:opacity-50"
            >
              {pending ? 'Stopping…' : 'Stop sharing'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 max-w-prose font-body text-[13px] leading-relaxed text-mid">
            This is the only thing on the board that could not have been posted by somebody who
            never left the house. A link makes it readable by one person you send it to, and you
            can stop sharing it at any point.
          </p>
          <button
            type="button"
            onClick={mint}
            disabled={pending}
            className="trek-pill trek-pill-sm trek-pill-act mt-3 font-body disabled:opacity-50"
          >
            {pending ? 'Making a link…' : 'Make a link'}
          </button>
        </>
      )}

      {error && (
        <div className="mt-3 rounded-[var(--r-card)] border border-clay/50 bg-clay-wash px-3.5 py-2.5">
          <p className="font-body text-[13px] leading-relaxed text-clay-deep">{error}</p>
        </div>
      )}
    </div>
  )
}
