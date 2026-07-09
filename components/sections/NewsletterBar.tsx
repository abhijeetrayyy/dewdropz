'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { subscribeToNewsletter } from '@/actions/reviews'

// "Join the journey" asked for an email without offering anything back. This
// names the thing (The Trail Dispatch), says exactly what arrives and how often,
// and leads with the one genuinely scarce benefit — batches of 200–500 sell out
// in days, so hearing about drops first is worth an email address.
const DISPATCH_PROMISES = [
  {
    title: 'First call on small-batch drops',
    detail: 'Runs of 200–500 pieces that sell out in days — subscribers hear first.',
  },
  {
    title: 'One trail guide a month',
    detail: 'A mapped route, its season window, and the exact packing list we carry.',
  },
  {
    title: 'Field notes from the guides',
    detail: 'What broke, what held, and what we changed because of it.',
  },
]

export default function NewsletterBar() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await subscribeToNewsletter({ email, source: 'footer' })
      setSubmitted(true)
    } catch {
      // Silent failure keeps the section calm; the CTA simply stays available.
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="relative bg-forest px-6 md:px-10 py-20 md:py-28 overflow-hidden">
      {/* Faint contour rings, like the elevation lines on a trek map */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-32 h-[480px] w-[480px] text-paper/[0.06]"
        viewBox="0 0 200 200"
        fill="none"
        stroke="currentColor"
      >
        <path d="M100 30c40 8 62 30 66 62s-16 62-52 70-70-8-82-40 4-64 28-78 24-18 40-14z" strokeWidth="1" />
        <path d="M100 50c30 6 46 22 49 46s-12 46-39 52-52-6-61-30 3-48 21-58 18-13 30-10z" strokeWidth="1" />
        <path d="M100 70c20 4 30 15 32 30s-8 30-25 34-34-4-40-20 2-31 14-38 11-8 19-6z" strokeWidth="1" />
      </svg>

      <div className="relative max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        <div>
          <div className="font-body text-[10px] tracking-[0.3em] text-sage uppercase">The Trail Dispatch</div>
          <h2 className="mt-4 font-display font-light text-[clamp(30px,4.4vw,48px)] text-paper leading-[1.1]">
            One email a month.
            <br />
            <span className="italic text-sage">Worth opening.</span>
          </h2>

          <ul className="mt-8 space-y-5">
            {DISPATCH_PROMISES.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-sage flex-shrink-0" aria-hidden="true" />
                <div>
                  <div className="font-body text-sm text-paper font-medium">{p.title}</div>
                  <div className="font-body text-xs text-paper/55 mt-0.5 leading-relaxed">{p.detail}</div>
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
                  <label htmlFor="dispatch-email" className="font-body text-[10px] tracking-[0.18em] text-paper/60 uppercase">
                    Your email
                  </label>
                  <div className="mt-3 flex flex-col sm:flex-row items-stretch gap-4">
                    <input
                      id="dispatch-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="trail@example.com"
                      className="flex-1 bg-transparent border-b border-paper/25 pb-3 font-body text-base text-paper placeholder:text-paper/30 focus:outline-none focus:border-sage transition-colors"
                    />
                    <button
                      data-cursor="view"
                      data-cursor-text="Join"
                      type="submit"
                      disabled={loading}
                      className="bg-paper text-forest font-body text-xs tracking-[0.12em] uppercase font-medium px-8 py-3.5 rounded-sm hover:bg-sage hover:text-ink transition-colors duration-300 disabled:opacity-50"
                    >
                      {loading ? 'Joining...' : 'Get the Dispatch'}
                    </button>
                  </div>
                  <p className="mt-4 font-body text-[11px] text-paper/40 leading-relaxed">
                    12 emails a year, no noise in between. Unsubscribe anytime with one click.
                  </p>
                </motion.form>
              ) : (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="border border-sage/30 rounded-sm p-6"
                >
                  <div className="font-display italic text-xl text-paper">You&apos;re on the list.</div>
                  <p className="mt-2 font-body text-sm text-paper/60 leading-relaxed">
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
