'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { blockMember, reportTrek } from '@/actions/trekBuddy'

type Reason = 'unsafe' | 'harassment' | 'spam' | 'impersonation' | 'not_real' | 'other'

/**
 * Reasons, worded for the person doing the reporting rather than for the
 * moderator reading it. The two subjects get different sets because "this walk
 * is not real" is not a thing you say about a person, and "harassment" is not
 * a thing you say about a date on a board.
 */
const PLAN_REASONS: [Reason, string][] = [
  ['unsafe', 'The plan is unsafe'],
  ['not_real', 'This walk is not real'],
  ['spam', 'Spam or selling something'],
  ['other', 'Something else'],
]
const PERSON_REASONS: [Reason, string][] = [
  ['harassment', 'Harassment or abuse'],
  ['impersonation', 'Pretending to be someone'],
  ['unsafe', 'Made me feel unsafe'],
  ['spam', 'Spam or selling something'],
  ['other', 'Something else'],
]

// Reporting and blocking, kept quiet but never more than one click away.
//
// These are the two controls that matter most on a board where strangers
// arrange to be alone together on a hillside, and they are also the two nobody
// should have to hunt for at the moment they need them. So: plain text, bottom
// of the page, no icon, no red — loud enough to find, quiet enough that the
// page does not read as a warning.
//
// Blocking is immediate and mutual: the database stops either of you seeing or
// joining the other's walks. Reporting goes to a queue a person reads. Saying
// which is which matters, because "I reported them" and "they can no longer
// reach me" are different needs and people conflate them.
export default function SafetyActions({
  planId,
  subjectId,
  subjectName,
}: {
  planId?: string
  subjectId?: string
  subjectName?: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<Reason | null>(null)
  const [detail, setDetail] = useState('')
  const [done, setDone] = useState<'reported' | 'blocked' | null>(null)
  const [error, setError] = useState('')
  const [confirmBlock, setConfirmBlock] = useState(false)

  const reasons = subjectId ? PERSON_REASONS : PLAN_REASONS
  const who = subjectName ?? 'this person'

  function submitReport() {
    if (!reason) return
    setError('')
    start(async () => {
      const r = await reportTrek({ reason, detail: detail.trim() || undefined, planId, subjectId })
      if (r && 'error' in r) { setError(r.error ?? 'Could not send that'); return }
      setDone('reported')
      setOpen(false)
    })
  }

  function submitBlock() {
    if (!subjectId) return
    setError('')
    start(async () => {
      const r = await blockMember(subjectId)
      if (r && 'error' in r) { setError(r.error ?? 'Could not block'); return }
      setDone('blocked')
      setOpen(false)
      router.refresh()
    })
  }

  if (done === 'reported') {
    return (
      <p className="font-body text-xs leading-relaxed text-mid">
        Reported. Someone reads these — we will not tell you what came of it, and you will not
        hear back unless we need to ask you something.
      </p>
    )
  }
  if (done === 'blocked') {
    return (
      <p className="font-body text-xs leading-relaxed text-mid">
        Blocked. {who} cannot ask to join your walks and you will not see theirs. It works both
        ways and neither of you is told.
      </p>
    )
  }

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="border-b border-rule pb-0.5 font-body text-xs text-mid transition-colors hover:text-text"
        >
          {subjectId ? 'Report or block' : 'Report this walk'}
        </button>
      ) : (
        <div className="rounded-[6px] border border-rule bg-paper-warm p-5">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="trek-label font-mono text-mid">
              {subjectId ? `Report ${who}` : 'Report this walk'}
            </h3>
            <button type="button" onClick={() => setOpen(false)}
              className="font-body text-xs text-mid transition-colors hover:text-text">
              Cancel
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {reasons.map(([k, text]) => (
              <button key={k} type="button" onClick={() => setReason(k)} aria-pressed={reason === k}
                className={`rounded-full border px-3.5 py-1.5 font-body text-xs transition-colors ${
                  reason === k
                    ? 'border-forest bg-forest text-paper'
                    : 'border-rule text-mid hover:border-text hover:text-text'
                }`}>
                {text}
              </button>
            ))}
          </div>

          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={3}
            maxLength={800}
            placeholder="What happened? Dates and specifics help more than anything."
            className="mt-4 w-full rounded-[6px] border border-rule bg-white px-3.5 py-2.5 font-body text-sm text-text placeholder:text-mid/60 focus:border-forest focus:outline-none"
          />

          {error && <p className="mt-3 font-body text-sm text-clay">{error}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={submitReport} disabled={pending || !reason}
              className="trek-pill trek-pill-act font-body disabled:opacity-40 transition-colors hover:bg-forest-mid disabled:opacity-40">
              {pending ? 'Sending…' : 'Send report'}
            </button>

            {/* Blocking is separate from reporting on purpose. One is a request
                that somebody look; the other takes effect the moment you press
                it and needs no one's agreement. */}
            {subjectId && (
              confirmBlock ? (
                <span className="flex items-center gap-3">
                  <button type="button" onClick={submitBlock} disabled={pending}
                    className="rounded-[6px] border border-clay px-4 py-2.5 font-body text-[10px] uppercase tracking-[0.12em] text-clay transition-colors hover:bg-clay hover:text-paper disabled:opacity-40">
                    Yes, block {who}
                  </button>
                  <button type="button" onClick={() => setConfirmBlock(false)}
                    className="font-body text-xs text-mid transition-colors hover:text-text">
                    Keep them
                  </button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmBlock(true)}
                  className="border-b border-rule pb-0.5 font-body text-xs text-mid transition-colors hover:text-text">
                  Block {who} instead
                </button>
              )
            )}
          </div>

          <p className="mt-4 font-body text-xs leading-relaxed text-mid">
            {subjectId
              ? 'Reporting sends this to someone who reads it. Blocking takes effect immediately, works both ways, and is not announced.'
              : 'This goes to someone who reads it. If you are in danger right now, call 112 — that reaches an operator faster than we can.'}
          </p>
        </div>
      )}
    </div>
  )
}
