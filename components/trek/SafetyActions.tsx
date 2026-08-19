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

// Reporting and blocking.
//
// These are the two controls that matter most on a board where strangers
// arrange to be alone together on a hillside, and they are also the two nobody
// should have to hunt for at the moment they need them.
//
// WHAT CHANGED, AND IT IS THE WHOLE POINT OF THE COMPONENT. The entry used to
// be a single underlined phrase — "Report or block" — in 12px grey, and
// everything that explained what either word actually did was inside the form
// you only saw after pressing it. So the two facts a frightened person most
// needs before they act (blocking is immediate, mutual and silent; reporting
// goes to a human being who reads it) were behind the very decision they were
// meant to inform, and the control itself looked like a footnote.
//
// It is a card now: a quiet one, on the advisory warm ground the rest of the
// product uses for a note rather than an alarm, with the plain-language
// explanation above the control instead of under it. Nothing about it is
// louder — there is no icon, no red, no warning triangle — because a page that
// shouts about danger makes an ordinary walk feel dangerous. It is simply
// always visible, and it says what it does before you touch it.
//
// Clay carries the destructive half. Not red: red is an error, and blocking
// somebody is neither a mistake nor a malfunction — it is a limit you are
// setting, which is exactly what clay means everywhere else here.
//
// The two capitalised, wide-tracked button faces are gone as well. A person
// pressing "Yes, block Priya" is not reading a label on a machine.
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

  const focus =
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage'

  return (
    <div className="rounded-[var(--r-card)] border border-rule bg-paper-warm/70 p-5">
      <h3 className="trek-label text-mid">If something is wrong</h3>

      {/* Above the control, not underneath it. "Blocking takes effect
          immediately and works both ways" is the sentence that decides which
          of the two a person wants, so it cannot live behind the press. */}
      <p className="mt-2.5 max-w-prose font-body text-[13.5px] leading-relaxed text-mid">
        {subjectId
          ? 'Reporting sends this to someone who reads it. Blocking takes effect immediately, works both ways, and is not announced.'
          : (
            <>
              This goes to someone who reads it. If you are in danger right now, call{' '}
              <span className="font-medium text-text">112</span> — that reaches an operator faster
              than we can.
            </>
          )}
      </p>

      {done === 'reported' ? (
        <p className="mt-4 border-t border-rule-soft pt-4 font-body text-[13.5px] leading-relaxed text-text">
          Reported. Someone reads these — we will not tell you what came of it, and you will not
          hear back unless we need to ask you something.
        </p>
      ) : done === 'blocked' ? (
        <p className="mt-4 border-t border-rule-soft pt-4 font-body text-[13.5px] leading-relaxed text-text">
          Blocked. {who} cannot ask to join your walks and you will not see theirs. It works both
          ways and neither of you is told.
        </p>
      ) : !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`trek-pill trek-pill-sm trek-pill-quiet mt-4 font-body ${focus}`}
        >
          {subjectId ? 'Report or block' : 'Report this walk'}
        </button>
      ) : (
        <div className="mt-5 border-t border-rule-soft pt-5">
          <div className="flex items-baseline justify-between gap-4">
            <h4 className="font-body text-[15px] font-medium text-text">
              {subjectId ? `Report ${who}` : 'Report this walk'}
            </h4>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={`font-body text-[13px] text-mid transition-colors hover:text-text ${focus}`}
            >
              Cancel
            </button>
          </div>

          <fieldset className="mt-4">
            <legend className="sr-only">Why are you reporting this?</legend>
            <div className="flex flex-wrap gap-2">
              {reasons.map(([k, text]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setReason(k)}
                  aria-pressed={reason === k}
                  className={`trek-pill trek-pill-sm font-body ${focus} ${
                    reason === k ? 'trek-pill-on' : 'trek-pill-quiet'
                  }`}
                >
                  {text}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="sr-only" htmlFor="safety-detail">What happened</label>
          <textarea
            id="safety-detail"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={3}
            maxLength={800}
            placeholder="What happened? Dates and specifics help more than anything."
            className="mt-4 w-full rounded-[var(--r-input)] border border-rule bg-surface px-3.5 py-2.5 font-body text-sm text-text placeholder:text-mid/60 focus:border-forest focus:outline-none"
          />

          {error && (
            <p className="mt-3 rounded-[var(--r-card)] border border-clay/35 bg-clay-wash px-3.5 py-2.5 font-body text-[13.5px] text-clay-deep">
              {error}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={submitReport}
              disabled={pending || !reason}
              className={`trek-pill trek-pill-act font-body ${focus} disabled:opacity-40`}
            >
              {pending ? 'Sending…' : 'Send report'}
            </button>

            {/* Blocking is separate from reporting on purpose. One is a request
                that somebody look; the other takes effect the moment you press
                it and needs no one's agreement. */}
            {subjectId && (
              confirmBlock ? (
                <span className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={submitBlock}
                    disabled={pending}
                    className={`trek-pill trek-pill-sm border border-clay font-body text-clay-deep transition-colors hover:bg-clay hover:text-paper ${focus} disabled:opacity-40`}
                  >
                    Yes, block {who}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmBlock(false)}
                    className={`font-body text-[13px] text-mid transition-colors hover:text-text ${focus}`}
                  >
                    Keep them
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmBlock(true)}
                  className={`border-b border-rule pb-0.5 font-body text-[13px] text-mid transition-colors hover:border-clay hover:text-clay-deep ${focus}`}
                >
                  Block {who} instead
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}
