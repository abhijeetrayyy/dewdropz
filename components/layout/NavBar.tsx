'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { ScrollTrigger } from '@/lib/gsap'
import { useCart } from '@/providers/CartProvider'
import { useWishlist } from '@/providers/WishlistProvider'
import { Logo } from '@/components/Logo'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { logout } from '@/actions/auth'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// The launch navigation, per the client brief:
//   SHOP | COLLECTIONS | CUSTOMIZE | TREK BUDDY | TRAILS | ABOUT | CONTACT
//
// Journal leaves the bar — "we will not keep this for now". The route and its
// posts are untouched, and the footer still links to it, so nothing is deleted
// on the strength of a nav decision.
//
// Two of these carry a menu, and they are two different ways in: SHOP is
// product-first (what garment do you want), COLLECTIONS is story-first (which
// world do you like). The brief draws that distinction explicitly, so the menus
// are not the same list twice.
type NavLink = {
  label: string
  href: string
  menu?: { heading?: string; items: { label: string; href: string }[] }[]
}

const NAV_LINKS: NavLink[] = [
  {
    label: 'Shop',
    href: '/shop',
    menu: [
      {
        heading: 'Apparel',
        items: [
          { label: 'T-Shirts', href: '/shop?category=t-shirts' },
          { label: 'Hoodies', href: '/shop?category=hoodies' },
          { label: 'Sweatshirts', href: '/shop?category=sweatshirts' },
        ],
      },
      {
        heading: 'Drinkware',
        items: [
          { label: 'Mugs', href: '/shop?category=mugs' },
          { label: 'Tumblers & Bottles', href: '/shop?category=tumblers' },
        ],
      },
    ],
  },
  {
    label: 'Collections',
    href: '/collections',
    menu: [
      {
        items: [
          { label: 'O Collection', href: '/collections/o-collection' },
          { label: 'Mist & Morning', href: '/collections/mist-and-morning' },
          { label: 'Silent Altitude', href: '/collections/silent-altitude' },
        ],
      },
    ],
  },
  { label: 'Customize', href: '/customize' },
  { label: 'Trek Buddy', href: '/trek-buddy' },
  { label: 'Trails', href: '/treks' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
]

export default function NavBar() {
  const navRef = useRef<HTMLElement>(null)
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { count } = useCart()
  const { items: wishlistItems } = useWishlist()
  const pathname = usePathname()
  const [authEmail, setAuthEmail] = useState<string | null>(null)

  // NavBar is mounted per-page (not from one root layout), so it keeps its
  // own lightweight auth check rather than requiring every page to fetch and
  // pass down a user prop. onAuthStateChange keeps the account entry point in
  // sync immediately after sign-in/out, without a full page reload.
  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.auth.getUser().then(({ data }) => setAuthEmail(data.user?.email ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthEmail(session?.user?.email ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleSignOut() {
    await logout()
    setAuthEmail(null)
    router.refresh()
  }
  // Only the homepage opens on a full-bleed dark hero video, so only there can the
  // nav start transparent with light text. Every other page's first section can be
  // light (PageHeader's paper variant), so the solid bar is always on to stay legible.
  const isHome = pathname === '/'
  const solid = scrolled || !isHome

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
        solid
          ? 'h-14 bg-ink/95 backdrop-blur-md border-b border-white/[0.06] shadow-[0_2px_24px_rgba(0,0,0,0.2)]'
          : 'h-[72px] bg-transparent'
      }`}
    >
      <Logo markHeight={26} priority wordmarkClassName="font-display text-base tracking-widest text-paper" />

      <nav className="hidden lg:flex items-center gap-8">
        {NAV_LINKS.map((link) => {
          // While the hero's studio act holds the frame, this link is where the
          // eye should go next — the frame is showing the tool, and this is the
          // site's permanent door to it. SummitHero writes `data-hero-act` on
          // <body> at the act boundaries and the arbitrary variant below reads
          // it, so the cue costs no state, no context and no re-render up here.
          const isStudioDoor = link.href === '/customize'
          const trigger = (
            <Link
              href={link.href}
              className={`group relative font-body text-xs tracking-[0.12em] uppercase text-paper/80 hover:text-paper transition-colors duration-300 ${
                isStudioDoor ? '[body[data-hero-act=studio]_&]:text-paper' : ''
              }`}
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 bg-sage transition-transform duration-300 ease-[var(--ease-out)] group-hover:scale-x-100" />
              {isStudioDoor && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-x-3 -inset-y-2 rounded-full border border-sage/60 opacity-0 transition-opacity duration-500 [body[data-hero-act=studio]_&]:animate-pulse [body[data-hero-act=studio]_&]:opacity-100 motion-reduce:animate-none"
                />
              )}
            </Link>
          )

          if (!link.menu) return <div key={link.label}>{trigger}</div>

          // Opens on hover for a mouse and on focus for a keyboard, and the
          // label itself stays a real link — so Shop and Collections are still
          // reachable in one click without going through the menu, which is how
          // people actually use a top-level category.
          return (
            <div key={link.label} className="group/menu relative">
              {trigger}
              <div className="invisible absolute left-1/2 top-full z-50 -translate-x-1/2 pt-4 opacity-0 transition-[opacity,visibility] duration-200 group-hover/menu:visible group-hover/menu:opacity-100 group-focus-within/menu:visible group-focus-within/menu:opacity-100">
                <div className="min-w-[190px] rounded-sm border border-white/10 bg-ink/95 p-4 shadow-lg backdrop-blur-sm">
                  {link.menu.map((group, gi) => (
                    <div key={group.heading ?? gi} className={gi > 0 ? 'mt-4 border-t border-white/10 pt-4' : ''}>
                      {group.heading && (
                        <div className="mb-2 font-body text-[9px] uppercase tracking-[0.2em] text-sage">
                          {group.heading}
                        </div>
                      )}
                      <ul className="flex flex-col gap-1.5">
                        {group.items.map((item) => (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              className="block whitespace-nowrap font-body text-xs text-paper/70 transition-colors duration-200 hover:text-paper"
                            >
                              {item.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </nav>

      {/* gap-6 (24px x 3 gaps = 72px) left nothing for the header's own
          justify-between to place between the wordmark and this cluster below
          lg — the nav's own links are hidden there, so this and the logo are
          the only two flex children, and their combined width already
          exceeded the available space. Tighter below sm, back to the
          original spacing once the row has room to breathe. */}
      <div className="flex items-center gap-2.5 sm:gap-6">
        <Link
          href="/wishlist"
          aria-label="Wishlist"
          className="flex items-center gap-2 text-paper/80 hover:text-paper transition-colors duration-300"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill={wishlistItems.length > 0 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span className="font-body text-xs">{wishlistItems.length}</span>
        </Link>

        <Link
          href="/cart"
          aria-label="Cart"
          className="flex items-center gap-2 text-paper/80 hover:text-paper transition-colors duration-300"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 20L9 6h6l5 14H4z" strokeLinejoin="round" />
            <path d="M9 6a3 3 0 0 1 6 0" strokeLinecap="round" />
          </svg>
          <span className="font-body text-xs">{count}</span>
        </Link>

        {authEmail ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Account"
              className="relative flex items-center text-paper/80 hover:text-paper transition-colors duration-300"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="8" r="3.5" />
                <path d="M4.5 20c0-4.14 3.36-7 7.5-7s7.5 2.86 7.5 7" strokeLinecap="round" />
              </svg>
              <span className="absolute -top-0.5 -right-0.5 h-[7px] w-[7px] rounded-full bg-sage ring-2 ring-ink" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="truncate font-body text-xs text-mid">{authEmail}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link href="/account">My Account</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link href="/account/orders">Orders</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link href="/account/addresses">Addresses</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link href="/account/designs">My Designs</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link href="/account/settings">Settings</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>Sign Out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link
            href="/auth/login"
            aria-label="Sign in"
            className="flex items-center text-paper/80 hover:text-paper transition-colors duration-300"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M4.5 20c0-4.14 3.36-7 7.5-7s7.5 2.86 7.5 7" strokeLinecap="round" />
            </svg>
          </Link>
        )}

        <button
          aria-label="Menu"
          onClick={() => setMenuOpen((v) => !v)}
          className="lg:hidden flex flex-col gap-1.5 w-6 text-paper"
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
                key={link.label}
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                transition={{ duration: 0.4, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              >
                <Link
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="font-display text-3xl text-paper"
                >
                  {link.label}
                </Link>
                {/* No hover on a phone, so the menus flatten into a quiet row
                    under their parent rather than hiding behind a tap-to-expand
                    the customer has to discover. */}
                {link.menu && (
                  <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
                    {link.menu.flatMap((g) => g.items).map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        className="font-body text-xs uppercase tracking-[0.1em] text-paper/50 transition-colors hover:text-paper"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
