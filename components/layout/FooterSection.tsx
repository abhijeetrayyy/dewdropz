'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { useMagneticHover } from '@/hooks/useMagneticHover'
import { SITE } from '@/lib/constants'

const NAV_LINKS = [
  { label: 'Collections', href: '/collections' },
  { label: 'Treks', href: '/treks' },
  { label: 'About', href: '/about' },
  { label: 'Journal', href: '/journal' },
  { label: 'Contact', href: '/contact' },
  { label: 'Sustainability', href: '/sustainability' },
  { label: 'Privacy', href: '/privacy' },
]

function SocialLink({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: React.ReactNode
}) {
  const magnetic = useMagneticHover(0.45, 10)
  return (
    <motion.a
      ref={magnetic.ref as React.RefObject<HTMLAnchorElement>}
      onMouseMove={magnetic.onMouseMove}
      onMouseLeave={magnetic.onMouseLeave}
      style={{ x: magnetic.x, y: magnetic.y }}
      data-cursor="view"
      href={href}
      aria-label={label}
      className="hover:text-white transition-colors"
    >
      {children}
    </motion.a>
  )
}

export default function FooterSection() {
  return (
    <footer className="bg-ink text-white/60 py-16 px-6 md:px-10">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
        <div>
          <div className="font-display text-white text-xl">DEWDROPZ</div>
          <div className="font-display italic text-sage text-sm mt-1">— Feel Alive</div>
          <div className="flex items-center gap-4 mt-6">
            <SocialLink href={SITE.instagram} label="Instagram">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
              </svg>
            </SocialLink>
            <SocialLink href={SITE.whatsapp} label="WhatsApp">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 12a8 8 0 1 1-3.6-6.7L20 4l-1.2 3.6A8 8 0 0 1 20 12z" />
              </svg>
            </SocialLink>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 font-body text-sm">
          {NAV_LINKS.map((link) => (
            <Link key={link.label} href={link.href} className="hover:text-white transition-colors py-1">
              {link.label}
            </Link>
          ))}
        </div>

        <div className="md:text-right">
          <svg
            width="40"
            height="40"
            viewBox="0 0 100 100"
            className="text-sage md:ml-auto"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M50 15C35 35 25 50 25 65a25 25 0 0 0 50 0c0-15-10-30-25-50z" />
            <path d="M35 65l10-12 8 8 12-15" />
          </svg>
          <div className="font-display italic text-sage text-3xl mt-4">Feel Alive</div>
          <div className="font-mono text-[11px] text-white/30 mt-2">dewdropz.shop</div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto border-t border-white/10 mt-12 pt-6 flex items-center justify-between">
        <span className="font-body text-xs text-white/30">© 2026 DEWDROPZ</span>
        <span className="font-body text-xs text-white/30">Made by DoonDzn</span>
      </div>
    </footer>
  )
}
