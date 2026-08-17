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
import { getNavCollections } from '@/actions/products'
import Image from 'next/image'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// The launch navigation:
//   SHOP | COLLECTIONS | CUSTOMIZE | TREK BUDDY | TRAILS
//
// About and Contact have left the bar. They are not what anybody comes here to
// do, and five items is the number at which a centred nav still reads as one
// line instead of a queue — the footer keeps both, which is where people go
// looking for them anyway. Journal left earlier on the same reasoning.
//
// Two of these carry a menu, and they are two different ways in: SHOP is
// product-first (what garment do you want), COLLECTIONS is story-first (which
// world do you like). So the panels are not the same list twice — one is a
// taxonomy, the other is three names with what each one is.
type MenuItem = { label: string; href: string; note?: string }
type NavLink = {
  label: string
  href: string
  menu?: {
    groups: { heading?: string; items: MenuItem[] }[]
    /** The way out of the menu and into the whole thing. */
    all: { label: string; href: string }
    /** Which shape the panel takes. */
    layout: 'columns' | 'stack'
  }
}

const NAV_LINKS: NavLink[] = [
  {
    label: 'Shop',
    href: '/shop',
    menu: {
      layout: 'columns',
      all: { label: 'Everything in the shop', href: '/shop' },
      groups: [
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
  },
  {
    label: 'Collections',
    href: '/collections',
    menu: {
      layout: 'stack',
      all: { label: 'All three collections', href: '/collections' },
      groups: [
        {
          items: [
            {
              label: 'O Collection',
              href: '/collections/o-collection',
              note: 'Where the trail becomes a way of life.',
            },
            {
              label: 'Mist & Morning',
              href: '/collections/mist-and-morning',
              note: 'Fog, dew, first light.',
            },
            {
              label: 'Silent Altitude',
              href: '/collections/silent-altitude',
              note: 'Alpine stillness. Deep quiet.',
            },
          ],
        },
      ],
    },
  },
  { label: 'Customize', href: '/customize' },
  { label: 'Trek Buddy', href: '/trek-buddy' },
  { label: 'Trails', href: '/treks' },
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
  // Which panel is down. Held in state rather than done with :hover so the
  // pointer can cross the gap between a label and its panel without the panel
  // vanishing underneath it — the single most common way a hover menu feels
  // broken — and so keyboard and Escape can drive the same thing a mouse does.
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const closeTimer = useRef<number | null>(null)
  // The collections, with their pictures, fetched the first time somebody opens
  // that menu and never again. The static list below renders instantly and is
  // what shows if this never arrives — so the menu is never empty, never
  // shifts, and costs nothing on a page nobody hovers.
  const [navCollections, setNavCollections] = useState<
    { slug: string; name: string; tagline: string | null; image_url: string | null }[]
  >([])
  const askedForCollections = useRef(false)

  const openNow = (label: string) => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    setOpenMenu(label)
    if (label === 'Collections' && !askedForCollections.current) {
      askedForCollections.current = true
      getNavCollections().then(setNavCollections).catch(() => {})
    }
  }
  // Long enough to cross the gap, short enough that it never feels stuck open.
  const closeSoon = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setOpenMenu(null), 140)
  }
  useEffect(() => () => { if (closeTimer.current) window.clearTimeout(closeTimer.current) }, [])

  useEffect(() => {
    if (!openMenu) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenMenu(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openMenu])

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
  // The bar goes solid while a panel is down, so the panel hangs off something
  // instead of floating over the hero with a seam of video between them.
  const solid = scrolled || !isHome || Boolean(openMenu)

  // No effect closing this on `pathname`: NavBar is mounted per page, so a
  // navigation remounts it and the state is gone anyway. The trigger and every
  // item close it themselves, which covers a same-page link.

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
      // A grid, not justify-between. With three flex children the nav sat
      // wherever the logo and the icon cluster left room, which is why it
      // collided with the wordmark at exactly 1024px. Equal 1fr rails put the
      // nav in the true centre of the bar and keep it there at every width.
      className={`fixed top-0 left-0 right-0 z-50 grid grid-cols-[1fr_auto_1fr] items-center px-6 md:px-10 transition-all duration-500 ease-[var(--ease-out)] ${
        solid
          ? 'h-14 bg-ink/95 backdrop-blur-md border-b border-white/[0.06] shadow-[0_2px_24px_rgba(0,0,0,0.2)]'
          : 'h-[72px] bg-transparent'
      }`}
    >
      <div className="justify-self-start">
        {/* The wordmark stands down on a phone. Mark + wordmark + three icons
            + the menu button came to more than 375px, so DEWDROPZ ran into the
            wishlist heart. The Link keeps its aria-label, so the name is still
            announced with the mark alone. */}
        <Logo
          markHeight={26}
          priority
          wordmarkClassName="hidden font-display text-base tracking-widest text-paper sm:inline"
        />
      </div>

      <nav className="hidden items-center gap-7 justify-self-center lg:flex xl:gap-9">
        {NAV_LINKS.map((link) => {
          // While the hero's studio act holds the frame, this link is where the
          // eye should go next — the frame is showing the tool, and this is the
          // site's permanent door to it. SummitHero writes `data-hero-act` on
          // <body> at the act boundaries and the arbitrary variant below reads
          // it, so the cue costs no state, no context and no re-render up here.
          const isStudioDoor = link.href === '/customize'
          const open = openMenu === link.label
          // Where you are, marked. A nav that never says which section you are
          // in makes every page feel like it arrived from nowhere.
          const active =
            link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)

          const trigger = (
            <Link
              href={link.href}
              onClick={() => setOpenMenu(null)}
              aria-expanded={link.menu ? open : undefined}
              className={`group relative block py-2 font-body text-xs uppercase tracking-[0.12em] transition-colors duration-300 ${
                active || open ? 'text-paper' : 'text-paper/70 hover:text-paper'
              } ${isStudioDoor ? '[body[data-hero-act=studio]_&]:text-paper' : ''}`}
            >
              {link.label}
              {/* One rule under the label doing two jobs: it is drawn for the
                  section you are in, and it draws itself on hover for the ones
                  you are not. Same line, so the bar never has two kinds of
                  underline arguing with each other. */}
              <span
                className={`absolute -bottom-0.5 left-0 h-px w-full origin-left bg-sage transition-transform duration-300 ease-[var(--ease-out)] ${
                  active || open ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                }`}
              />
              {isStudioDoor && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-x-3 -inset-y-1 rounded-full border border-sage/60 opacity-0 transition-opacity duration-500 [body[data-hero-act=studio]_&]:animate-pulse [body[data-hero-act=studio]_&]:opacity-100 motion-reduce:animate-none"
                />
              )}
            </Link>
          )

          if (!link.menu) return <div key={link.label}>{trigger}</div>

          const menu = link.menu
          return (
            <div
              key={link.label}
              className="relative"
              onMouseEnter={() => openNow(link.label)}
              onMouseLeave={closeSoon}
              onFocus={() => openNow(link.label)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpenMenu(null)
              }}
            >
              {trigger}

              <AnimatePresence>
                {open && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    // pt-3 is the bridge the pointer crosses. Without it the
                    // gap between label and panel is a dead zone that closes
                    // the menu halfway to the thing you were reaching for.
                    className="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3"
                  >
                    <div
                      className={`relative overflow-hidden rounded-sm border border-white/10 bg-ink/97 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.85)] backdrop-blur-md ${
                        menu.layout === 'columns' ? 'min-w-[430px]' : 'min-w-[350px]'
                      }`}
                    >
                      {/* The one flourish on the whole bar: a sage hairline
                          that draws across the top edge as the panel lands, so
                          the menu arrives rather than appearing. */}
                      <motion.span
                        aria-hidden="true"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.04 }}
                        className="absolute inset-x-0 top-0 h-px origin-left bg-sage"
                      />

                      <div
                        className={`p-5 ${
                          menu.layout === 'columns' ? 'grid grid-cols-2 gap-x-8 gap-y-1' : ''
                        }`}
                      >
                        {menu.groups.map((group, gi) => (
                          <div key={group.heading ?? gi} className={menu.layout === 'stack' ? '' : ''}>
                            {group.heading && (
                              <p className="mb-2.5 font-mono text-[9px] uppercase tracking-[0.22em] text-sage">
                                {group.heading}
                              </p>
                            )}
                            <ul className={menu.layout === 'stack' ? 'flex flex-col' : 'flex flex-col gap-0.5'}>
                              {(menu.layout === 'stack' && navCollections.length
                                ? navCollections.map((c) => ({
                                    label: c.name,
                                    href: `/collections/${c.slug}`,
                                    note: c.tagline ?? undefined,
                                    image: c.image_url ?? undefined,
                                  }))
                                : group.items
                              ).map((item: MenuItem & { image?: string }) => (
                                <li key={item.href}>
                                  <Link
                                    href={item.href}
                                    onClick={() => setOpenMenu(null)}
                                    className="group/i flex items-start gap-3 rounded-[3px] py-1.5 pl-0.5 pr-2 transition-colors duration-200"
                                  >
                                    {item.image ? (
                                      // The collection itself, not a bullet.
                                      // Desaturated until you reach for it, so
                                      // three photographs in a dark panel read
                                      // as one object rather than three.
                                      <span className="relative block h-11 w-14 shrink-0 overflow-hidden rounded-[3px] border border-white/10">
                                        <Image
                                          src={item.image}
                                          alt=""
                                          fill
                                          sizes="56px"
                                          className="object-cover opacity-70 saturate-[0.5] transition-all duration-500 group-hover/i:scale-105 group-hover/i:opacity-100 group-hover/i:saturate-100"
                                        />
                                      </span>
                                    ) : (
                                      /* The same growing rule the hour rail and
                                         the weather tiles use. One idiom for
                                         "this is the one", used everywhere. */
                                      <span
                                        aria-hidden="true"
                                        className="mt-[9px] h-px w-1.5 shrink-0 bg-paper/25 transition-all duration-300 group-hover/i:w-4 group-hover/i:bg-sage"
                                      />
                                    )}
                                    <span className={`min-w-0 ${item.image ? 'pt-0.5' : ''}`}>
                                      <span
                                        className={`block whitespace-nowrap text-paper/75 transition-colors duration-200 group-hover/i:text-paper ${
                                          item.note ? 'font-display text-[15px] leading-snug' : 'font-body text-xs'
                                        }`}
                                      >
                                        {item.label}
                                      </span>
                                      {item.note && (
                                        <span className="mt-0.5 block font-body text-[11px] leading-snug text-paper/40">
                                          {item.note}
                                        </span>
                                      )}
                                    </span>
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>

                      {/* The way out of the menu and into the whole thing. */}
                      <Link
                        href={menu.all.href}
                        onClick={() => setOpenMenu(null)}
                        className="group/a flex items-center justify-between gap-6 border-t border-white/10 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-paper/50 transition-colors duration-200 hover:bg-white/[0.03] hover:text-paper"
                      >
                        {menu.all.label}
                        <span aria-hidden="true" className="transition-transform duration-300 group-hover/a:translate-x-1">
                          →
                        </span>
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
      <div className="flex items-center gap-2.5 justify-self-end sm:gap-5">
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
            className="fixed inset-0 top-0 flex h-screen w-screen flex-col items-center justify-center gap-7 overflow-y-auto bg-ink px-6 py-20"
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
                // Bounded and centred. Without a width the block grew to fit
                // its widest child, so a long sub-item row ran off both edges
                // of a phone and dragged its own heading out of the centre
                // with it.
                className="w-full max-w-sm text-center"
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
                  <div className="mt-2.5 flex flex-wrap justify-center gap-x-3.5 gap-y-1.5">
                    {link.menu.groups.flatMap((g) => g.items).map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        className="font-body text-[11px] uppercase tracking-[0.08em] text-paper/50 transition-colors hover:text-paper"
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
