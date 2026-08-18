'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { mintShareToken, revokeShareToken } from '@/actions/trekShare'

// Sharing a walk with somebody who is not on the board.
//
// Off by default, and that is the whole design. The prototype implies every
// walk has a public URL; making that true would put the place, date, host and
// party size of every walk — women-only ones included — behind nothing but an
// unguessed id. Here a host turns it on for the walk they want to invite
// somebody to, and can turn it off again.
export default function InviteCardPanel({
  planId,
  token: initialToken,
}: {
  planId: string
  token: string | null
}) {
  const [token, setToken] = useState(initialToken)
  const [pending, start] = useTransition()

  const url = token ? `${typeof window === 'undefined' ? '' : window.location.origin}/e/${token}` : ''

  function mint() {
    start(async () => {
      const r = await mintShareToken(planId)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      setToken(r.token)
    })
  }

  function revoke() {
    start(async () => {
      const r = await revokeShareToken(planId)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      setToken(null)
      toast.success('The link is dead')
    })
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied')
    } catch {
      // Clipboard access is refused in plenty of ordinary situations — an
      // insecure origin, a browser that asks first. The input below is
      // selectable, so there is always a way to get the link out.
      toast.error('Copy it from the box.')
    }
  }

  return (
    <div className="rounded-[6px] border border-rule p-4">
      <p className="trek-label font-mono text-forest">
        Bring a friend
      </p>

      {token ? (
        <>
          <p className="mt-2 font-body text-xs leading-relaxed text-mid">
            Anybody with this link can see the walk without an account — where, when, how hard,
            what it costs. Never the meeting point.
          </p>
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-2 w-full rounded-[6px] border border-rule bg-paper-warm/50 px-3 py-2 font-mono text-xs text-text"
          />
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={copy}
              className="trek-pill trek-pill-act font-body">
              Copy link
            </button>
            <button type="button" onClick={revoke} disabled={pending}
              className="trek-label font-mono text-mid hover:text-clay disabled:opacity-40">
              Stop sharing
            </button>
          </div>
          <p className="mt-2 font-body text-xs leading-relaxed text-mid">
            Stopping makes the link a dead end straight away — worth doing once everyone you meant
            to invite has asked.
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 font-body text-xs leading-relaxed text-mid">
            Makes a link you can send to somebody who is not on the board. Off until you ask for
            it, so a walk is never quietly public.
          </p>
          <button type="button" onClick={mint} disabled={pending}
            className="trek-pill trek-pill-quiet font-body disabled:opacity-40">
            {pending ? 'Making…' : 'Make an invite link'}
          </button>
        </>
      )}
    </div>
  )
}
