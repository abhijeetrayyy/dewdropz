'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useMagneticHover } from '@/hooks/useMagneticHover'

export default function NewsletterBar() {
  const [submitted, setSubmitted] = useState(false)
  const submitBtn = useMagneticHover(0.4, 10)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <section className="bg-paper py-20 px-6">
      <div className="max-w-[600px] mx-auto text-center">
        <h2 className="font-display italic text-[clamp(28px,4vw,42px)]">Join the journey.</h2>
        <p className="font-body text-sm text-mid mt-2">
          Updates from the trail — no noise, no spam.
        </p>

        <div className="mt-8 relative min-h-[52px]">
          <AnimatePresence mode="wait">
            {!submitted ? (
              <motion.form
                key="form"
                onSubmit={handleSubmit}
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col md:flex-row items-stretch"
              >
                <input
                  type="email"
                  required
                  placeholder="Your email"
                  className="border-b border-rule bg-transparent font-body text-sm py-3 flex-1 focus:outline-none focus:border-forest"
                />
                <motion.button
                  ref={submitBtn.ref as React.RefObject<HTMLButtonElement>}
                  onMouseMove={submitBtn.onMouseMove}
                  onMouseLeave={submitBtn.onMouseLeave}
                  style={{ x: submitBtn.x, y: submitBtn.y }}
                  data-cursor="view"
                  data-cursor-text="Join"
                  type="submit"
                  className="bg-forest text-paper font-body text-xs tracking-[0.1em] uppercase px-6 py-3 mt-4 md:mt-0 md:ml-4"
                >
                  Subscribe
                </motion.button>
              </motion.form>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="flex items-center justify-center gap-2 font-body text-sm text-forest py-3"
              >
                <span>✓</span>
                <span>You&apos;re on the list.</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
