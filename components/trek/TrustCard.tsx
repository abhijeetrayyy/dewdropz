'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { startPhoneVerification, confirmPhoneVerification } from '@/actions/trekTrust'
import type { MyTrust } from '@/actions/trekTrust'
import Avatar from './ui/Avatar'
import { Datum, Tag } from './ui/Bits'

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
//
// WHAT CHANGED. This was a ruled list of three grey paragraphs with the only
// two numbers on it — your rung and `2/2` — set at 10px beside the words. It is
// a state machine with a progress reading, and it now looks like one: the head
// carries who you are and which rung you are on, the figures sit over a rule at
// instrument size, and the three rungs are drawn as tiles whose border says
// their state (solid sage reached, dashed warm still locked — the same two
// edges the rest of the product uses for exactly that). Every sentence about
// what a rung means is kept verbatim, under the rung it belongs to.
//
// `name` is optional because the page that renders this only fetches your
// trust row. When a caller can supply it, the card wears your face and the
// "you" ring; when it cannot, the disc shows the rung itself, which is the
// other thing this card is about.
//
// WHAT CHANGED IN THIS PASS, AND IT IS MOSTLY ABOUT AMBER. The fallback disc
// was a dawn wash with an ember figure inside a dawn ring, and the rung name
// beside your own name was 9px monospace in uppercase at 0.16em. Both are now
// out of bounds: amber on this board means a clock is running and your own
// standing is not a deadline, and a wide-tracked uppercase word that states a
// state — "Phone verified" — is precisely the thing that rule was written for.
// The disc takes forest, the same colour `Avatar` now rings a "you" with, so
// the two forms of this card agree; the rung name becomes a sentence-case Tag,
// sage once you have reached the top of the ladder.
//
// A failed verification also stopped being amber. It is not urgent — it is a
// place where something stopped, which is what clay is for, and this board has
// no red in it at all.
//
// The three rung explanations came out of their disclosures. They were behind
// a monospace "What it means →" in each tile, and a person who cannot ask to
// join a walk is reading this card for exactly that sentence. Three short
// paragraphs across three tiles cost less than the tap did.

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

const field =
  'min-w-0 rounded-[var(--r-input)] border border-rule bg-paper px-3 py-2.5 font-body text-sm text-text placeholder:text-mid/60 focus:border-forest focus:outline-none'

export default function TrustCard({
  trust,
  name,
  id,
  homeBase,
}: {
  trust: MyTrust
  /** Your board name, when the page knows it. Drives the avatar. */
  name?: string
  /** Your user id, so the avatar tint is the one everybody else sees. */
  id?: string | null
  homeBase?: string | null
}) {
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

  const rungTag = RUNGS[trust.rung].name

  return (
    <section className="trek-card p-6 md:p-7">
      <div className="flex items-center gap-4">
        {name ? (
          <Avatar name={name} id={id} size={52} role="you" />
        ) : (
          <span
            aria-hidden="true"
            className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-sage-soft font-mono text-xl leading-none text-forest tabular-nums"
            style={{ boxShadow: '0 0 0 3px var(--surface), 0 0 0 5px var(--forest)' }}
          >
            {trust.rung === 2 ? '✓' : trust.rung}
          </span>
        )}

        <div className="min-w-0">
          <h2 className="trek-h3 text-text">{name ?? 'How far you have come'}</h2>
          {name && homeBase && (
            <p className="mt-1 font-body text-[13px] text-mid">{homeBase}</p>
          )}
        </div>

        {/* Sentence case, because this states where you stand and a state set
            in wide-tracked capitals reads as a stamp somebody put on you. */}
        <span className="ml-auto shrink-0">
          <Tag tone={trust.rung === 2 ? 'sage' : 'outline'}>{rungTag}</Tag>
        </span>
      </div>

      {/* The reading. Three counts, and the third is a tick rather than a
          number because a phone is not a quantity. */}
      <div className="mt-6 grid grid-cols-3 gap-3 border-t border-rule-soft pt-5">
        <Datum k="Rung" v={`${trust.rung}/2`} />
        <Datum k="Vouches" v={`${trust.vouches}/2`} />
        <Datum k="Phone" v={trust.phoneVerified ? '✓' : '—'} />
      </div>

      {/* The ladder itself. A reached rung is held by a solid sage edge, one
          still ahead of you by a dashed warm one — the product's two ways of
          drawing "this is real" and "this is not yet". */}
      <ol className="mt-6 grid gap-2.5 border-t border-rule-soft pt-5 sm:grid-cols-3">
        {RUNGS.map((r) => {
          const reached = trust.rung >= r.n
          return (
            <li
              key={r.n}
              className={`rounded-[var(--r-card)] border p-3.5 ${
                reached ? 'border-sage/45 bg-sage/[0.08]' : 'border-dashed border-rule-warm'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full font-mono text-[10px] leading-none tabular-nums ${
                    reached ? 'bg-forest text-paper' : 'border border-rule-warm text-mid'
                  }`}
                >
                  {reached ? '✓' : r.n + 1}
                </span>
                {r.n === 2 && (
                  <span className="font-mono text-[10px] text-mid tabular-nums">
                    {trust.vouches}/2
                  </span>
                )}
              </div>

              <p
                className={`mt-2.5 font-body text-[14px] font-medium ${
                  reached ? 'text-text' : 'text-mid'
                }`}
              >
                {r.name}
              </p>

              <p className="mt-1.5 font-body text-[13px] leading-relaxed text-mid">{r.what}</p>
            </li>
          )
        })}
      </ol>

      {!trust.phoneVerified && (
        <div className="mt-6 border-t border-rule-soft pt-5">
          {!sentTo ? (
            <>
              <label htmlFor="trust-phone" className="font-body text-[13px] text-mid">
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
                  className={`flex-1 ${field}`}
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={pending || !phone.trim()}
                  className="trek-pill trek-pill-act font-body focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage disabled:opacity-40"
                >
                  {pending ? 'Sending…' : 'Send code'}
                </button>
              </div>
              <p className="mt-2 font-body text-[13px] leading-relaxed text-mid">
                Indian numbers need no country code. From elsewhere, type yours in full with the +.
              </p>
            </>
          ) : (
            <>
              <label htmlFor="trust-code" className="font-body text-[13px] text-mid">
                Code sent to {sentTo}
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  id="trust-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  className={`w-36 ${field} font-mono tracking-[0.3em] tabular-nums`}
                />
                <button
                  type="button"
                  onClick={confirm}
                  disabled={pending || !code.trim()}
                  className="trek-pill trek-pill-act font-body focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage disabled:opacity-40"
                >
                  {pending ? 'Checking…' : 'Confirm'}
                </button>
                <button
                  type="button"
                  onClick={() => { setSentTo(null); setCode(''); setProblem(null) }}
                  className="font-body text-[13px] text-mid underline-offset-4 transition-colors hover:text-forest hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
                >
                  Use a different number
                </button>
              </div>
            </>
          )}

          {/* Clay, never red, and no longer amber either. A number that did not
              go through is a place where something stopped — which is clay's
              whole job on this board — and it is not a clock running, which is
              the only thing amber is allowed to say now. */}
          {problem && (
            <div className="mt-3 rounded-[var(--r-card)] border border-clay/35 bg-clay-wash p-3.5">
              <p className="font-body text-[13px] leading-relaxed text-text">{problem}</p>
              {providerMissing && (
                <p className="mt-2 font-body text-[13px] leading-relaxed text-mid">
                  Nothing is wrong with your number — this site has not been connected to an SMS
                  service yet, so no code can be sent to anyone. Everything else on the board works
                  as normal.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* The vouch clause carries sage — the colour this product spends on a
          thing that was earned rather than claimed — and the rest of the
          sentence stays in the body grey, so the highlight is the claim and not
          the caveat attached to it. */}
      {trust.vouches > 0 && (
        <p className="mt-5 border-t border-rule-soft pt-4 font-body text-[13.5px] leading-relaxed text-mid">
          <span className="font-medium text-sage">
            Vouched by {trust.vouches} {trust.vouches === 1 ? 'person' : 'people'}
          </span>{' '}
          you actually walked with — a vouch can only be written after a completed walk, by somebody
          who was confirmed on it.
        </p>
      )}

      {trust.phoneVerified && trust.vouches < 2 && (
        <p className="mt-3 font-body text-[13px] leading-relaxed text-mid">
          {trust.vouches === 0
            ? 'Go on a walk. Afterwards the people who were there can vouch for you, and two vouches is the last rung.'
            : 'One more vouch to go. It has to come from someone you have actually been out with.'}
        </p>
      )}
    </section>
  )
}
