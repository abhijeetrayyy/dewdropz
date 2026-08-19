'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { postMessage, markChatRead, type TrekMessage } from '@/actions/trekChat'
import Avatar from './ui/Avatar'
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
//
// ── Three species, one component ────────────────────────────────────────────
// It used to draw every message the same way: a 6px monogram, a grey byline and
// a paragraph, in one flat column. That made three different kinds of statement
// look like one. A message from the host announcing the start has moved is not
// the same object as somebody asking about parking, and neither is the same
// object as the thing you yourself just said — the first is a change to the
// plan, the second is chatter, the third is your own voice.
//
//   SYSTEM  an announcement — centred, a dashed rule-warm pill on the amber
//           wash, so it reads as a mark on the record rather than as somebody
//           talking. The one amber in the thread, and it earns it: this is the
//           message that changes the plan.
//   MINE    right, forest, paper type, the corner cut on your side.
//   THEIRS  left, surface with a rule-soft border, a face at the foot of the
//           bubble, the corner cut on theirs.
//
// It renders on two surfaces now — inline on the walk's page and filling the
// right pane of the messages screen — and `variant` changes only the frame:
// the ground it sits on, whether it scrolls, and its padding. The bubbles
// themselves are identical, because the whole reason the messages screen exists
// is that both places are the same conversation.
//
// MONO IS GONE FROM THE BYLINES. Every name and every timestamp in here was set
// in 9px monospace at 0.06em tracking, which is two mistakes at once: mono is
// rationed to figures, and "Priya · 12m ago" is not a figure, it is a sentence
// fragment about a person. At nine pixels it was also unreadable to precisely
// the walkers this board keeps saying it is built for. They are body type at 11
// now, which is the smallest size this product uses anywhere.
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

/** The pane's ground on the messages screen — first light at the top of the
    scroll, midday at the composer. Measured off the design file. */
const GROUND = 'linear-gradient(180deg, #FDFBF5 0%, #F8F5ED 100%)'

export default function PlanChat({
  planId,
  messages,
  meId,
  variant = 'inline',
}: {
  planId: string
  messages: TrekMessage[]
  meId: string
  /**
   * `inline` sits in a block on the walk's page. `shell` fills the thread pane
   * on the messages screen: its own ground, its own scroll, a fenced composer.
   */
  variant?: 'inline' | 'shell'
}) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [pending, start] = useTransition()
  // Null during SSR and hydration, then live. A relative time computed on the
  // server is already wrong by the time it is read.
  const now = useClock()
  const marked = useRef<string | null>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const shell = variant === 'shell'

  useEffect(() => {
    // Once per walk, not once per render — marking on every render would fight
    // the router refresh after sending and write a row per keystroke. It tracks
    // the plan id rather than a boolean because on the messages screen the same
    // component survives a move from one thread to the next, and a `true` left
    // over from the previous thread would leave the new one unread forever.
    if (marked.current !== planId) {
      marked.current = planId
      void markChatRead(planId)
    }
  }, [planId])

  // The composer is a pill, and a pill is one line — but Shift+Enter has always
  // broken the line here and a message that wants two of them should not be
  // typed into a slot that shows one. So it grows to about four lines and then
  // scrolls, rather than being an <input> that cannot hold a newline at all.
  useEffect(() => {
    const el = field.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 108)}px`
  }, [body])

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

  const stream =
    messages.length === 0 ? (
      <p
        className={`font-body text-sm leading-relaxed text-mid ${
          shell ? 'm-auto max-w-sm text-center' : ''
        }`}
      >
        Nothing said yet. This is where the party sorts out lifts, kit and whether the weather
        has changed the plan.
      </p>
    ) : (
      <ol className="flex flex-col gap-4">
        {messages.map((m) => {
          const mine = m.user_id === meId
          const at = when(m.created_at, now)

          // ── SYSTEM ────────────────────────────────────────────────────
          // The host changed something. It goes in the thread rather than in
          // a stream of its own — that is the database's decision, since an
          // announcement is a row in the same table with the same moderation
          // — but it must not be mistakable for chatter, because it is the
          // one message in here that is a change to the plan.
          if (m.is_announcement) {
            return (
              <li key={m.id} className="flex flex-col items-center">
                <div className="flex max-w-[80%] items-center gap-2.5 rounded-full border border-dashed border-rule-warm bg-amber-wash px-4.5 py-2">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-dawn"
                  />
                  <span className="whitespace-pre-wrap break-words text-center font-body text-[13px] leading-relaxed text-text">
                    {m.body}
                  </span>
                </div>
                <p className="mt-1.5 font-body text-[11px] text-mid">
                  {mine ? 'You' : m.display_name} · {at}
                </p>
              </li>
            )
          }

          // ── MINE ──────────────────────────────────────────────────────
          if (mine) {
            return (
              <li key={m.id} className="flex flex-col items-end">
                <div className="max-w-[65%]">
                  <div
                    className="whitespace-pre-wrap break-words bg-forest px-4 py-3 font-body text-sm leading-relaxed text-paper"
                    style={{ borderRadius: '14px 14px 4px 14px' }}
                  >
                    {m.body}
                  </div>
                  <p className="mt-1.5 mr-0.5 text-right font-body text-[11px] text-mid">{at}</p>
                </div>
              </li>
            )
          }

          // ── THEIRS ────────────────────────────────────────────────────
          // The face sits at the FOOT of the bubble, not beside its first
          // line: it belongs to the end of the utterance, which is where a
          // speech tail would be, and it keeps a five-line message from
          // hanging a disc in space at the top of it.
          return (
            <li key={m.id} className="flex gap-2.5">
              <Avatar
                name={m.display_name}
                id={m.user_id}
                size={32}
                className="self-end"
              />
              <div className="min-w-0 max-w-[70%]">
                <p className="mb-1 ml-0.5 font-body text-[11px] text-mid">
                  <span className="font-medium text-text">{m.display_name}</span> · {at}
                </p>
                <div
                  className="whitespace-pre-wrap break-words border border-rule-soft bg-surface px-4 py-3 font-body text-sm leading-relaxed text-text"
                  style={{ borderRadius: '14px 14px 14px 4px' }}
                >
                  {m.body}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    )

  const composer = (
    <div className={shell ? 'shrink-0 border-t border-rule bg-surface px-6 py-4' : 'mt-5'}>
      <div className="flex items-end gap-3">
        <label htmlFor="chat-body" className="sr-only">
          Message the party
        </label>
        <textarea
          id="chat-body"
          ref={field}
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
          rows={1}
          maxLength={1000}
          // The design's line, and it states a mechanic rather than modelling a
          // message: the board filters contact details out of free text
          // everywhere else, and the one place somebody is most likely to try
          // is the thread with the people they are about to meet.
          placeholder="Message the group — numbers and emails are filtered out, on purpose"
          className="h-[46px] min-h-[46px] min-w-0 flex-1 resize-none overflow-y-auto rounded-full border border-rule bg-paper px-5 py-3 font-body text-sm leading-snug text-text placeholder:text-mid/60 focus:border-forest focus:outline-none"
        />
        <button
          type="button"
          onClick={send}
          disabled={pending || !body.trim()}
          className="trek-pill trek-pill-act h-[46px] shrink-0 justify-center font-body disabled:opacity-40"
        >
          {pending ? 'Sending…' : 'Send'}
        </button>
      </div>
      <p className="mt-2 font-body text-xs text-mid">
        Everyone confirmed on this walk can read this.
      </p>
    </div>
  )

  if (!shell) {
    return (
      <div>
        {stream}
        {composer}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6"
        style={{ background: GROUND }}
      >
        {stream}
      </div>
      {composer}
    </div>
  )
}
