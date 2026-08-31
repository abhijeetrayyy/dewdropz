'use client'

import { stopEyebrow, type TrailStop } from '@/lib/trail'
import { useState } from 'react'
import SectionHeader from '@/components/SectionHeader'
import { AnimatePresence, motion } from 'motion/react'
import { subscribeToNewsletter } from '@/actions/reviews'

// "Join the journey" asked for an email without offering anything back. This
// names the thing (The Trail Dispatch), says exactly what arrives and how often,
// and leads with the one genuinely scarce benefit — batches of 200–500 sell out
// in days, so hearing about drops first is worth an email address.
const DISPATCH_PROMISES = [
  {
    title: 'First access to new drops',
    detail: 'Be the first to know when new collections and limited releases go live.',
  },
  {
    title: 'Stories from the mountains',
    detail: 'Slow travel, hidden places, trail notes and moments worth remembering.',
  },
  {
    title: 'Behind the collections',
    detail: 'The inspiration, sketches and stories behind every DEWDROPZ release.',
  },
]

export default function NewsletterBar({ stop }: { stop?: TrailStop }) {
  // Optional, because this section is also mounted on /about, /collections,
  // /collections/[slug], /journal, /sustainability and /treks. The day arc is
  // a HOMEPAGE conceit — a clock time reading "21:00 · Radio check" on the
  // About page is not a drift, it is a category error. Those pages get the
  // dispatch's own name and no hour.
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      // READ THE RESULT. `subscribeToNewsletter` RETURNS `{ error }`, it does
      // not throw — so `await` resolved normally on every failure path and
      // `setSubmitted(true)` ran regardless. A rejected address, a rate limit,
      // a database error: all of them were answered with "You're on the list."
      // The `catch` below only ever fired on a transport failure, which is the
      // one case that was already invisible. The page has been telling people
      // they are subscribed when they are not.
      const result = await subscribeToNewsletter({ email, source: 'homepage' })
      if (result && 'error' in result && result.error) {
        setError(
          typeof result.error === 'string'
            ? result.error
            : 'That address did not look right — try again?'
        )
        return
      }
      setSubmitted(true)
    } catch {
      setError('Could not reach the server. Try again in a moment.')
    } finally {
      setLoading(false)
    }
  }
  // Blue hour, and not night twice. This band was `--forest-deep`, the same
  // ground as BrandPulse directly above it — two dark sections at an identical
  // value read as one slab, and the exemption for a full-bleed photograph
  // applies to that band, not to this one. `--altitude` is a real step
  // between them, it is the token the palette calls blue hour, and it leaves
  // the footer's `--ink` a step below to land on.

  return (
    <section className="relative overflow-hidden border-t border-rule bg-mist px-6 md:px-10 py-20 md:py-28">
      {/* Faint contour rings, like the elevation lines on a trek map */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-32 h-[480px] w-[480px] text-forest/[0.07]"
        viewBox="0 0 200 200"
        fill="none"
        stroke="currentColor"
      >
        <path d="M100 30c40 8 62 30 66 62s-16 62-52 70-70-8-82-40 4-64 28-78 24-18 40-14z" strokeWidth="1" />
        <path d="M100 50c30 6 46 22 49 46s-12 46-39 52-52-6-61-30 3-48 21-58 18-13 30-10z" strokeWidth="1" />
        <path d="M100 70c20 4 30 15 32 30s-8 30-25 34-34-4-40-20 2-31 14-38 11-8 19-6z" strokeWidth="1" />
      </svg>

      <div className="relative max-w-measure mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        <div>
          {/* INDEX — the last opening on the page, and a rule is the right
              way to end a run: it draws the measure one final time under the
              band that asks for something back. `--sage-lit` on the display
              clause for the same contrast reason as BrandPulse above. */}
          <SectionHeader
            species="index"
            ground="paper"
            no="12"
            // Not "… — The Trail Dispatch": the heading and the form below
            // already say what this is, and the longer string was eating the
            // rule's width inside a half-width column.
            eyebrow={stop ? stopEyebrow(stop) : 'The Trail Dispatch'}
            title={
              <>
                One email a month.
                <br />
                <span className="italic text-forest">Actually worth opening.</span>
              </>
            }
            className="mb-0"
          />

          <ul className="mt-8 space-y-5">
            {DISPATCH_PROMISES.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-forest flex-shrink-0" aria-hidden="true" />
                <div>
                  <div className="font-body text-sm text-text font-medium">{p.title}</div>
                  <div className="font-body text-xs text-mid mt-0.5 leading-relaxed">{p.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:pl-4">
          <div className="min-h-[120px]">
            <AnimatePresence mode="wait">
              {!submitted ? (
                <motion.form
                  key="form"
                  onSubmit={handleSubmit}
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <label htmlFor="dispatch-email" className="font-body text-[10px] tracking-[0.18em] text-mid uppercase">
                    Your email
                  </label>
                  <div className="mt-3 flex flex-col sm:flex-row items-stretch gap-4">
                    <input
                      id="dispatch-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      // A field you can see. The boundary was `paper/25` (1.9:1) and the
                      // placeholder `paper/30` (2.2:1) — the page's only conversion
                      // object, drawn at the threshold of visible. /40 and /55 give the
                      // boundary 2.9:1 and the placeholder 4.6:1, and the focus ring
                      // moves to `--sage-lit`, which is 9.7:1 on this ground where
                      // `--sage` was 6.0:1.
                      className="flex-1 border-b border-forest/35 bg-transparent pb-3 font-body text-base text-text transition-colors placeholder:text-mid focus:border-forest focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-forest text-snow font-body text-xs tracking-[0.12em] uppercase font-medium px-8 py-3.5 rounded-[var(--r-input)] hover:bg-forest-mid transition-colors duration-300 disabled:opacity-50"
                    >
                      {loading ? 'Joining...' : 'Get the Dispatch'}
                    </button>
                  </div>
                  {/* The result of the last attempt, announced. `role="alert"`
                      because a sighted visitor sees the line appear and a
                      screen-reader user otherwise gets nothing at all — the
                      form simply sat there. `--dawn` rather than a red: this
                      palette has no destructive token, and the one warm accent
                      reads as attention on this ground at 7.4:1. */}
                  {error && (
                    <p role="alert" className="mt-4 font-body text-[12px] leading-relaxed text-dawn">
                      {error}
                    </p>
                  )}
                  <p className="mt-4 font-body text-[11px] leading-relaxed text-mid">
                    12 emails a year, no noise in between. Unsubscribe anytime with one click.
                  </p>
                </motion.form>
              ) : (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="border border-forest/30 rounded-[var(--r-panel)] p-6"
                >
                  <div className="font-display italic text-xl text-text">You&apos;re on the list.</div>
                  <p className="mt-2 font-body text-sm text-mid leading-relaxed">
                    The next Dispatch goes out at the start of the month — trail, packing list, and
                    whatever the guides broke since the last one.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}
