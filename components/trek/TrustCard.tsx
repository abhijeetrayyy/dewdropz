'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { startPhoneVerification, confirmPhoneVerification } from '@/actions/trekTrust'
import type { MyTrust } from '@/actions/trekTrust'

// The trust ladder, on your own profile — the one place it is about you rather
// than about somebody you are deciding whether to walk with.
//
// The rungs are shown all three at once, including the ones already behind you,
// because the point is not a score. It is a short, finite list of what a host
// filtering their walk can see, so that "why can I not ask to join this one"
// always has an answer on this page.
//
// The copy is careful about what rung 1 means. A verified number proves someone
// controls a SIM, and nothing else — not their name, not their age, not that
// they are who they say. Writing "verified" and letting a reader infer identity
// would be the platform taking credit for a check it never made.

const RUNGS = [
  {
    n: 0,
    name: 'Joined',
    what: 'You have an account and a filled-in profile. Everyone here has at least this.',
  },
  {
    n: 1,
    name: 'Phone verified',
    what: 'A mobile number confirmed by a code. It proves you hold a SIM — not who you are — and that is enough to make a throwaway account cost something.',
  },
  {
    n: 2,
    name: 'Vouched for',
    what: 'Two people who actually walked with you said so afterwards. This is the one that is hard to fake, and the one hosts look at.',
  },
] as const

export default function TrustCard({ trust }: { trust: MyTrust }) {
  const [phone, setPhone] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [providerMissing, setProviderMissing] = useState(false)
  const [pending, startTransition] = useTransition()

  function send() {
    setProblem(null)
    setProviderMissing(false)
    startTransition(async () => {
      const r = await startPhoneVerification(phone)
      if (!r.ok) {
        setProviderMissing(Boolean(r.needsProvider))
        setProblem(r.error)
        return
      }
      setSentTo(r.phone)
      toast.success(`Code sent to ${r.phone}`)
    })
  }

  function confirm() {
    if (!sentTo) return
    setProblem(null)
    startTransition(async () => {
      const r = await confirmPhoneVerification(sentTo, code)
      if (!r.ok) {
        setProblem(r.error)
        return
      }
      toast.success('Phone verified')
      setSentTo(null)
      setCode('')
    })
  }

  return (
    <section>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mid">
        How far you have come
      </p>

      <ol className="mt-3 divide-y divide-rule border-y border-rule">
        {RUNGS.map((r) => {
          const reached = trust.rung >= r.n
          return (
            <li key={r.n} className="flex gap-3 py-3">
              <span
                aria-hidden="true"
                className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border text-center font-mono text-[10px] leading-[18px] ${
                  reached
                    ? 'border-text bg-text text-paper'
                    : 'border-rule text-mid'
                }`}
              >
                {reached ? '✓' : r.n + 1}
              </span>
              <div className="min-w-0">
                <p className={`font-body text-sm ${reached ? 'text-text' : 'text-mid'}`}>
                  {r.name}
                  {r.n === 2 && (
                    <span className="ml-2 font-mono text-[10px] text-mid">
                      {trust.vouches}/2
                    </span>
                  )}
                </p>
                <p className="mt-0.5 font-body text-xs leading-relaxed text-mid">{r.what}</p>
              </div>
            </li>
          )
        })}
      </ol>

      {!trust.phoneVerified && (
        <div className="mt-5">
          {!sentTo ? (
            <>
              <label htmlFor="trust-phone" className="font-body text-xs text-mid">
                Mobile number
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  id="trust-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="98765 43210"
                  className="min-w-0 flex-1 rounded-sm border border-rule bg-paper px-3 py-2 font-body text-sm text-text placeholder:text-mid/60 focus:border-text focus:outline-none"
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={pending || !phone.trim()}
                  className="rounded-full bg-text px-5 py-2 font-body text-[11px] uppercase tracking-[0.14em] text-paper transition-colors hover:bg-mid disabled:opacity-40"
                >
                  {pending ? 'Sending…' : 'Send code'}
                </button>
              </div>
              <p className="mt-2 font-body text-xs text-mid">
                Indian numbers need no country code. From elsewhere, type yours in full with the +.
              </p>
            </>
          ) : (
            <>
              <label htmlFor="trust-code" className="font-body text-xs text-mid">
                Code sent to {sentTo}
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  id="trust-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  className="w-36 rounded-sm border border-rule bg-paper px-3 py-2 font-mono text-sm tracking-[0.3em] text-text placeholder:text-mid/60 focus:border-text focus:outline-none"
                />
                <button
                  type="button"
                  onClick={confirm}
                  disabled={pending || !code.trim()}
                  className="rounded-full bg-text px-5 py-2 font-body text-[11px] uppercase tracking-[0.14em] text-paper transition-colors hover:bg-mid disabled:opacity-40"
                >
                  {pending ? 'Checking…' : 'Confirm'}
                </button>
                <button
                  type="button"
                  onClick={() => { setSentTo(null); setCode(''); setProblem(null) }}
                  className="font-body text-[11px] uppercase tracking-[0.14em] text-mid underline-offset-4 hover:text-text hover:underline"
                >
                  Use a different number
                </button>
              </div>
            </>
          )}

          {problem && (
            <div className="mt-3 rounded-sm border border-amber-300 bg-amber-50 p-3">
              <p className="font-body text-xs leading-relaxed text-amber-900">{problem}</p>
              {providerMissing && (
                <p className="mt-2 font-body text-xs leading-relaxed text-amber-800">
                  Nothing is wrong with your number — this site has not been connected to an SMS
                  service yet, so no code can be sent to anyone. Everything else on the board works
                  as normal.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {trust.phoneVerified && trust.vouches < 2 && (
        <p className="mt-3 font-body text-xs leading-relaxed text-mid">
          {trust.vouches === 0
            ? 'Go on a walk. Afterwards the people who were there can vouch for you, and two vouches is the last rung.'
            : 'One more vouch to go. It has to come from someone you have actually been out with.'}
        </p>
      )}
    </section>
  )
}
