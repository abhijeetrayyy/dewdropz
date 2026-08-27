'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import { useMagneticHover } from '@/hooks/useMagneticHover'
import { submitContactMessage } from '@/actions/contact'
import { SITE } from '@/lib/constants'

function InfoRow({ label, value, href }: { label: string; value: string; href?: string }) {
  const { ref: magneticRef, x: magneticX, y: magneticY, onMouseMove: magneticMove, onMouseLeave: magneticLeave } = useMagneticHover(0.3, 8)
  const content = (
    <motion.span
      ref={magneticRef as React.RefObject<HTMLSpanElement>}
      onMouseMove={magneticMove}
      onMouseLeave={magneticLeave}
      style={{ x: magneticX, y: magneticY }}
      className="font-body text-lg text-paper inline-block"
    >
      {value}
    </motion.span>
  )
  return (
    <div className="border-b border-paper/10 py-6">
      <div className="font-body text-[10px] tracking-[0.2em] text-sage uppercase mb-2">{label}</div>
      {href ? (
        <a href={href} data-cursor="magnetic" className="hover:text-sage transition-colors duration-300">
          {content}
        </a>
      ) : (
        content
      )}
    </div>
  )
}

export default function ContactForm() {
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const { ref: submitBtnRef, x: submitBtnX, y: submitBtnY, onMouseMove: submitBtnMove, onMouseLeave: submitBtnLeave } = useMagneticHover(0.35, 10)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    try {
      const result = await submitContactMessage(form)
      if ('error' in result) {
        toast.error(typeof result.error === 'string' ? result.error : 'Please check the form and try again')
        return
      }
      setSubmitted(true)
    } catch {
      toast.error('Could not send your message — please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="bg-altitude px-6 md:px-10 py-20 md:py-28">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16">
        <div>
          <div className="font-body text-[10px] tracking-[0.2em] text-sage uppercase">Get In Touch</div>
          <h2 className="mt-4 font-display font-light text-[clamp(28px,4vw,40px)] text-paper leading-[1.1]">
            Questions before your next trek? We read every message.
          </h2>

          <div className="mt-10">
            <InfoRow label="Email" value={SITE.email} href={`mailto:${SITE.email}`} />
            <InfoRow label="Phone" value={SITE.phone} href={`tel:${SITE.phone.replace(/\s/g, '')}`} />
            <InfoRow label="Studio" value={SITE.address} />
          </div>

          <div className="mt-10 flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-sage animate-pulse" />
            <span className="font-body text-xs text-paper/60">
              Typical response time: <span className="text-sage">under 24 hours</span>
            </span>
          </div>

          <div className="mt-8 flex items-center gap-5">
            <a
              href={SITE.instagram}
              data-cursor="magnetic"
              className="font-body text-xs text-paper/55 uppercase tracking-[0.1em] hover:text-sage transition-colors duration-300"
            >
              Instagram
            </a>
            <a
              href={SITE.whatsapp}
              data-cursor="magnetic"
              className="font-body text-xs text-paper/55 uppercase tracking-[0.1em] hover:text-sage transition-colors duration-300"
            >
              WhatsApp
            </a>
          </div>
        </div>

        <div className="relative min-h-[420px]">
          <AnimatePresence mode="wait">
            {!submitted ? (
              <motion.form
                key="form"
                onSubmit={handleSubmit}
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-6"
              >
                <div>
                  <label className="font-body text-[10px] tracking-[0.15em] text-paper/55 uppercase">Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full border-b border-paper/40 bg-transparent font-body text-sm text-paper py-3 mt-1 focus:border-paper focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="font-body text-[10px] tracking-[0.15em] text-paper/55 uppercase">Email</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border-b border-paper/40 bg-transparent font-body text-sm text-paper py-3 mt-1 focus:border-paper focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="font-body text-[10px] tracking-[0.15em] text-paper/55 uppercase">Message</label>
                  <textarea
                    required
                    rows={4}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="w-full border-b border-paper/40 bg-transparent font-body text-sm text-paper py-3 mt-1 focus:border-paper focus:outline-none transition-colors resize-none"
                  />
                </div>
                <motion.button
                  ref={submitBtnRef as React.RefObject<HTMLButtonElement>}
                  onMouseMove={submitBtnMove}
                  onMouseLeave={submitBtnLeave}
                  style={{ x: submitBtnX, y: submitBtnY }}
                  type="submit"
                  disabled={sending}
                  className="mt-2 inline-flex min-h-[46px] w-fit items-center justify-center rounded-full bg-paper px-8 font-body text-[11px] font-medium uppercase tracking-[0.14em] text-ink transition-colors duration-300 hover:bg-sage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper/50 focus-visible:ring-offset-2 focus-visible:ring-offset-altitude disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {sending ? 'Sending…' : 'Send Message'}
                </motion.button>
              </motion.form>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-start justify-center h-full gap-2"
              >
                <span className="font-display text-2xl text-paper">Message received.</span>
                <p className="font-body text-sm text-paper/60 max-w-xs">
                  We read every message ourselves — expect a reply within 24 hours.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
