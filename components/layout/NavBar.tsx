'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ScrollTrigger } from '@/lib/gsap'

const NAV_LINKS = ['Collections', 'About', 'Journal', 'Contact']

export default function NavBar() {
  const navRef = useRef<HTMLElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const trigger = ScrollTrigger.create({
      start: 'top -80',
      onEnter: () => setScrolled(true),
      onLeaveBack: () => setScrolled(false),
    })
    return () => trigger.kill()
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  return (
    <header
      ref={navRef}
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 transition-all duration-500 ease-[var(--ease-out)] ${
        scrolled ? 'h-14 backdrop-blur-md bg-ink/80' : 'h-[72px] bg-transparent'
      }`}
    >
      <span className="font-display text-base tracking-widest text-paper">DEWDROPZ</span>

      <nav className="hidden md:flex items-center gap-10">
        {NAV_LINKS.map((link) => (
          <a
            key={link}
            href="#"
            className="font-body text-xs tracking-[0.12em] uppercase text-paper/80 hover:text-paper transition-colors duration-300"
          >
            {link}
          </a>
        ))}
      </nav>

      <div className="flex items-center gap-6">
        <button aria-label="Cart" className="flex items-center gap-2 text-paper/80 hover:text-paper transition-colors duration-300">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 20L9 6h6l5 14H4z" strokeLinejoin="round" />
            <path d="M9 6a3 3 0 0 1 6 0" strokeLinecap="round" />
          </svg>
          <span className="font-body text-xs">0</span>
        </button>

        <button
          aria-label="Menu"
          onClick={() => setMenuOpen((v) => !v)}
          className="md:hidden flex flex-col gap-1.5 w-6 text-paper"
        >
          <span className="block h-px w-full bg-current" />
          <span className="block h-px w-full bg-current" />
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 top-0 h-screen w-screen bg-ink flex flex-col items-center justify-center gap-8"
          >
            <button
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
              className="absolute top-6 right-6 text-paper/80 text-sm tracking-widest uppercase font-body"
            >
              Close
            </button>
            {NAV_LINKS.map((link, i) => (
              <motion.div
                key={link}
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                transition={{ duration: 0.4, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              >
                <a
                  href="#"
                  onClick={() => setMenuOpen(false)}
                  className="font-display text-3xl text-paper"
                >
                  {link}
                </a>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
