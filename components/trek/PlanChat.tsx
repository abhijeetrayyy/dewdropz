'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { postMessage, markChatRead, type TrekMessage } from '@/actions/trekChat'
import { useClock } from './useClock'

// The party's conversation about one walk.
//
// Deliberately not a chat app. No typing indicators, no read receipts, no
// realtime socket — this exists so "are we still on in this rain?" the night
// before has somewhere to live other than a WhatsApp group nobody can review.
// It refreshes when you send and when you open the page, and that is enough for
// a dozen messages about one Saturday.
//
// Moderation applies here exactly as it does everywhere else on the board,
// including to phone numbers. That is a real constraint on a confirmed party
// and it is the promise the board makes in writing — "arrangements stay on the
// walk's own page, which is what keeps them reviewable". The refusal explains
// itself when it happens.
function when(iso: string, now: number | null) {
  if (now === null) {
    return new Date(iso).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
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

export default function PlanChat({
  planId,
  messages,
  meId,
}: {
  planId: string
  messages: TrekMessage[]
  meId: string
}) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [pending, start] = useTransition()
  // Null during SSR and hydration, then live. A relative time computed on the
  // server is already wrong by the time it is read.
  const now = useClock()
  const marked = useRef(false)

  useEffect(() => {
    // Once per mount. Marking on every render would fight the router refresh
    // after sending and write a row per keystroke.
    if (!marked.current) {
      marked.current = true
      void markChatRead(planId)
    }
  }, [planId])

  function send() {
    const text = body.trim()
    if (!text) return
    start(async () => {
      const r = await postMessage(planId, text)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      setBody('')
      router.refresh()
    })
  }

  return (
    <div>
      {messages.length === 0 ? (
        <p className="font-body text-sm leading-relaxed text-mid">
          Nothing said yet. This is where the party sorts out lifts, kit and whether the weather
          has changed the plan.
        </p>
      ) : (
        <ol className="space-y-4">
          {messages.map((m) => {
            const mine = m.user_id === meId
            return (
              <li key={m.id} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full font-mono text-[9px] ${
                    mine ? 'bg-forest text-paper' : 'bg-forest/12 text-forest'
                  }`}
                >
                  {m.display_name.trim().charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="font-body text-xs text-mid">
                    <span className="text-text">{mine ? 'You' : m.display_name}</span>
                    {' · '}
                    {when(m.created_at, now)}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap break-words font-body text-sm leading-relaxed text-text">
                    {m.body}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      <div className="mt-5">
        <label htmlFor="chat-body" className="sr-only">
          Message the party
        </label>
        <textarea
          id="chat-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter breaks the line. The other way round is
            // right for a document and wrong for a conversation.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          rows={2}
          maxLength={1000}
          placeholder="Still on for 07:00?"
          className="w-full rounded-sm border border-rule bg-paper px-3 py-2 font-body text-sm text-text placeholder:text-mid/60 focus:border-forest focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="font-body text-xs text-mid">
            Everyone confirmed on this walk can read this.
          </p>
          <button
            type="button"
            onClick={send}
            disabled={pending || !body.trim()}
            className="rounded-full bg-forest px-5 py-2 font-body text-[11px] uppercase tracking-[0.14em] text-paper transition-colors hover:bg-forest-mid disabled:opacity-40"
          >
            {pending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
