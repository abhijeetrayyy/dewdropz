'use client'

import { useEffect, useState, useSyncExternalStore, useTransition } from 'react'
import { toast } from 'sonner'
import { mintShareToken, revokeShareToken } from '@/actions/trekShare'
import { SectionLabel } from '@/components/trek/ui/Bits'

// Sharing a walk with somebody who is not on the board.
//
// Off by default, and that is the whole design. The prototype implies every
// walk has a public URL; making that true would put the place, date, host and
// party size of every walk — women-only ones included — behind nothing but an
// unguessed id. Here a host turns it on for the walk they want to invite
// somebody to, and can turn it off again.
//
// ONE TAP, NOT A PARAGRAPH TO RETYPE. This used to be a read-only input full
// of a URL and nothing else, which quietly asked the host to compose the
// message themselves — and a host who has to write "come walking with me,
// here's a link" writes it in WhatsApp, from scratch, wrong, or not at all.
// The message is written here, shown as the bubble it will become, and handed
// straight to WhatsApp with the link already in it. Copy stays, because the
// same message goes in a Telegram group or an SMS just as well.
//
// THE ONE LINE THAT MATTERS IS NOT A FOOTNOTE. What a host is actually deciding
// when they press this is how much of a private walk becomes readable by
// anybody holding a URL, and the sentence answering that was 12px grey under
// two buttons and a text field. It is a ruled note now, and the half of it that
// is a guarantee — never the meeting point — is set in the page's own ink
// rather than in the grey reserved for things you may skip.

// The origin is only knowable in the browser. Read the way `useClock` reads
// the time — an empty server snapshot, the real value after mount — rather
// than `typeof window === 'undefined'` inside the render, which produces a
// value React has to reconcile, or setState in an effect, which cascades.
const noSubscribe = () => () => {}
const originSnapshot = () => window.location.origin
const noOrigin = () => ''

/** The one focus treatment, matching the console this panel sits in. */
const RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage'

export default function InviteCardPanel({
  planId,
  token: initialToken,
  place,
  whenLabel,
}: {
  planId: string
  token: string | null
  /** Named in the message, so it reads as an invitation and not as a link. */
  place?: string
  /** "Sat 22 Aug · 05:10". */
  whenLabel?: string
}) {
  const [token, setToken] = useState(initialToken)
  const [pending, start] = useTransition()
  const [copied, setCopied] = useState(false)
  const origin = useSyncExternalStore(noSubscribe, originSnapshot, noOrigin)

  const url = token ? `${origin}/e/${token}` : ''
  const when = whenLabel ? whenLabel.replace(' · ', ', ') : ''
  const message = [
    place ? `Come walking with me — ${place}${when ? `, ${when}` : ''}.` : 'Come walking with me.',
    'Everything about it is on this card, and you can ask to come from there:',
    url,
  ].join(' ')

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2400)
    return () => clearTimeout(t)
  }, [copied])

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
      await navigator.clipboard.writeText(message)
      setCopied(true)
    } catch {
      // Clipboard access is refused in plenty of ordinary situations — an
      // insecure origin, a browser that asks first. The link below is
      // selectable, so there is always a way to get it out.
      toast.error('Copy it from the box.')
    }
  }

  return (
    <div id="invite" className="scroll-mt-24 rounded-[var(--r-panel)] border border-rule bg-surface p-5.5">
      <SectionLabel as="h3">Bring a friend</SectionLabel>

      {token ? (
        <>
          {/* The message as it will land, in the shape it will land in. A
              preview bubble is read; a wall of selectable text is skipped. */}
          <p className="mt-3 rounded-[var(--r-card)] rounded-bl-[var(--r-bar)] bg-paper-warm px-3.5 py-3 font-body text-[13px] leading-relaxed text-text">
            {message}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`trek-pill trek-pill-sm trek-pill-act font-body ${RING}`}
            >
              Send on WhatsApp
            </a>
            <button
              type="button"
              onClick={copy}
              aria-live="polite"
              className={`trek-pill trek-pill-sm trek-pill-quiet font-body ${RING}`}
            >
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
          </div>

          <input
            readOnly
            aria-label="The invite link"
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className={`mt-3 w-full rounded-full border border-rule bg-surface px-3.5 py-2 font-body text-[12px] text-mid ${RING}`}
          />

          {/* What the link does, and the boundary it does not cross. Ruled off
              rather than run on, because a host is answering somebody's safety
              question with it and should be able to find it again. */}
          <p className="mt-3.5 border-t border-rule-soft pt-3 font-body text-[13px] leading-relaxed text-mid">
            Anybody with this link can see the walk without an account — where, when, how hard,
            what it costs.{' '}
            <span className="font-medium text-text">Never the meeting point.</span>
          </p>

          <button
            type="button"
            onClick={revoke}
            disabled={pending}
            className={`mt-3 border-b border-clay/50 pb-0.5 font-body text-[13px] font-medium text-clay-deep transition-colors hover:border-clay-deep disabled:opacity-40 ${RING}`}
          >
            Stop sharing
          </button>
          <p className="mt-2 font-body text-[12px] leading-relaxed text-mid">
            Stopping makes the link a dead end straight away — worth doing once everyone you meant
            to invite has asked.
          </p>
        </>
      ) : (
        <>
          <p className="mt-3 font-body text-[13px] leading-relaxed text-mid">
            Makes a link you can send to somebody who is not on the board. Off until you ask for
            it, so a walk is never quietly public.
          </p>
          <button
            type="button"
            onClick={mint}
            disabled={pending}
            className={`trek-pill trek-pill-sm trek-pill-quiet mt-3.5 w-full justify-center font-body disabled:opacity-40 ${RING}`}
          >
            {pending ? 'Making…' : 'Make an invite link'}
          </button>
        </>
      )}
    </div>
  )
}
