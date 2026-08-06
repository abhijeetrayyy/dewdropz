'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import { useMagneticHover } from '@/hooks/useMagneticHover'
import { submitContactMessage } from '@/actions/contact'
import { SITE } from '@/lib/constants'

function InfoRow({ label, value, href }: { label: string; value: string; href?: string }) {
  const magnetic = useMagneticHover(0.3, 8)
  const content = (
    <motion.span
      ref={magnetic.ref as React.RefObject<HTMLSpanElement>}
      onMouseMove={magnetic.onMouseMove}
      onMouseLeave={magnetic.onMouseLeave}
      style={{ x: magnetic.x, y: magnetic.y }}
      className="font-body text-lg text-white inline-block"
    >
      {value}
    </motion.span>
  )
  return (
    <div className="border-b border-white/10 py-6">
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
  const submitBtn = useMagneticHover(0.35, 10)

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
          <h2 className="mt-4 font-display font-light text-[clamp(28px,4vw,40px)] text-white leading-[1.1]">
            Questions before your next trek? We read every message.
          </h2>

          <div className="mt-10">
            <InfoRow label="Email" value={SITE.email} href={`mailto:${SITE.email}`} />
            <InfoRow label="Phone" value={SITE.phone} href={`tel:${SITE.phone.replace(/\s/g, '')}`} />
            <InfoRow label="Studio" value={SITE.address} />
          </div>

          <div className="mt-10 flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-sage animate-pulse" />
            <span className="font-body text-xs text-white/60">
              Typical response time: <span className="text-sage">under 24 hours</span>
            </span>
          </div>

          <div className="mt-8 flex items-center gap-5">
            <a
              href={SITE.instagram}
              data-cursor="magnetic"
              className="font-body text-xs text-white/50 uppercase tracking-[0.1em] hover:text-sage transition-colors duration-300"
            >
              Instagram
            </a>
            <a
              href={SITE.whatsapp}
              data-cursor="magnetic"
              className="font-body text-xs text-white/50 uppercase tracking-[0.1em] hover:text-sage transition-colors duration-300"
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
                  <label className="font-body text-[10px] tracking-[0.15em] text-white/50 uppercase">Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full border-b border-white/20 bg-transparent font-body text-sm text-white py-3 mt-1 focus:outline-none focus:border-sage transition-colors"
                  />
                </div>
                <div>
                  <label className="font-body text-[10px] tracking-[0.15em] text-white/50 uppercase">Email</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border-b border-white/20 bg-transparent font-body text-sm text-white py-3 mt-1 focus:outline-none focus:border-sage transition-colors"
                  />
                </div>
                <div>
                  <label className="font-body text-[10px] tracking-[0.15em] text-white/50 uppercase">Message</label>
                  <textarea
                    required
                    rows={4}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="w-full border-b border-white/20 bg-transparent font-body text-sm text-white py-3 mt-1 focus:outline-none focus:border-sage transition-colors resize-none"
                  />
                </div>
                <motion.button
                  ref={submitBtn.ref as React.RefObject<HTMLButtonElement>}
                  onMouseMove={submitBtn.onMouseMove}
                  onMouseLeave={submitBtn.onMouseLeave}
                  style={{ x: submitBtn.x, y: submitBtn.y }}
                  data-cursor="view"
                  data-cursor-text="Send"
                  type="submit"
                  disabled={sending}
                  className="mt-2 bg-sage text-ink font-body text-xs tracking-[0.12em] uppercase font-medium px-8 py-3.5 w-fit rounded-sm hover:bg-white transition-colors duration-300 disabled:opacity-50"
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
                <span className="font-display text-2xl text-white">Message received.</span>
                <p className="font-body text-sm text-white/60 max-w-xs">
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
