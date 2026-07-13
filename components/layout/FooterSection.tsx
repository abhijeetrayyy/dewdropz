'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { useMagneticHover } from '@/hooks/useMagneticHover'
import { Logo } from '@/components/Logo'
import { CATEGORY_TILES, COLLECTIONS, SITE } from '@/lib/constants'

const FOOTER_COLUMNS = [
  {
    heading: 'Shop',
    links: [
      { label: 'All Gear', href: '/shop' },
      ...CATEGORY_TILES.map((t) => ({ label: t.name, href: `/shop?category=${t.id}` })),
    ],
  },
  {
    heading: 'Collections',
    links: [
      ...COLLECTIONS.map((c) => ({ label: c.name, href: `/collections/${c.id}` })),
      { label: 'View All', href: '/collections' },
    ],
  },
  {
    heading: 'Explore',
    links: [
      // Treks paused — restore by uncommenting.
      // { label: 'Treks', href: '/treks' },
      { label: 'Journal', href: '/journal' },
      { label: 'About', href: '/about' },
      { label: 'Sustainability', href: '/sustainability' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { label: 'Contact & FAQs', href: '/contact' },
      { label: 'Your Account', href: '/account' },
      { label: 'Wishlist', href: '/wishlist' },
      { label: 'Cart', href: '/cart' },
      { label: 'Privacy', href: '/privacy' },
    ],
  },
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
    <footer className="bg-ink text-white/60 pt-20 px-6 md:px-10 overflow-hidden">
      {/* Brand + sitemap */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-6 gap-x-6 gap-y-12">
        <div className="col-span-2">
          <Logo
            markHeight={34}
            wordmarkClassName="font-display text-white text-xl tracking-tight"
            tagline="— Feel Alive"
            taglineClassName="font-display italic text-sage text-sm"
          />
          <p className="mt-5 font-body text-sm text-white/40 leading-relaxed max-w-[260px]">
            Trekking gear built by guides in Dehradun, tested above 5,200 metres on the
            trails we still walk every season.
          </p>

          <div className="mt-6 space-y-1.5 font-body text-sm">
            <a href={`mailto:${SITE.email}`} className="block hover:text-white transition-colors">{SITE.email}</a>
            <a href={`tel:${SITE.phone.replace(/\s/g, '')}`} className="block hover:text-white transition-colors">{SITE.phone}</a>
            <div className="text-white/35 leading-relaxed pt-1">{SITE.address}</div>
          </div>

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

        {FOOTER_COLUMNS.map((col) => (
          <nav key={col.heading} aria-label={col.heading}>
            <div className="font-body text-[10px] tracking-[0.2em] text-sage uppercase mb-4">{col.heading}</div>
            <ul className="space-y-2.5">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="font-body text-sm hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      {/* Logistics reassurance, one quiet line */}
      <div className="max-w-7xl mx-auto border-t border-white/10 mt-14 pt-6 flex flex-wrap items-center gap-x-8 gap-y-2 font-body text-[11px] tracking-[0.08em] uppercase text-white/35">
        <span>COD · UPI · Cards</span>
        <span>Free shipping over ₹2,000</span>
        <span>7-day returns</span>
        <span>Ships from Dehradun in 2 days</span>
      </div>

      {/* The sign-off — oversized wordmark, like a summit marker */}
      <div className="max-w-7xl mx-auto mt-12 select-none" aria-hidden="true">
        <div
          className="font-display font-light uppercase leading-[0.8] tracking-[-0.03em] text-transparent text-[clamp(64px,12.5vw,190px)] whitespace-nowrap"
          style={{ WebkitTextStroke: '1px rgba(246,243,230,0.14)' }}
        >
          Dewdropz
        </div>
      </div>

      {/* Legal row */}
      <div className="max-w-7xl mx-auto border-t border-white/10 mt-4 py-6 flex flex-wrap items-center justify-between gap-3">
        <span className="font-body text-xs text-white/30">© 2026 DEWDROPZ · Est. 2019, Dehradun</span>
        <span className="font-mono text-[10px] tracking-[0.1em] text-white/25">30.3165° N, 78.0322° E</span>
        <span className="font-body text-xs text-white/30">Made by DoonDzn</span>
      </div>
    </footer>
  )
}
