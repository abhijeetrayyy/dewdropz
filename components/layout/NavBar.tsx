'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { useCart } from '@/providers/CartProvider'
import { useWishlist } from '@/providers/WishlistProvider'
import { Logo } from '@/components/Logo'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { logout } from '@/actions/auth'
import { getNavCollections } from '@/actions/products'
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
//
// ── WHY THE PANELS NO LONGER CARRY PHOTOGRAPHS ──────────────────────────────
//
// The Collections panel used to put a 54x42 thumbnail beside each name. Every
// part of that was working against itself, measured on the running site:
//
//   · The images are remote (Unsplash), and they were requested at w=640 and
//     w=1080 to be painted into a 54x42 box — up to a twenty-fold oversample.
//   · Their natural sizes came back 56x84, 55x36 and 56x37: three different
//     aspect ratios forced through one fixed box, so each cropped differently
//     and the row never looked like a set.
//   · They only STARTED loading after a hover fired `getNavCollections()`, so
//     the panel opened as a list of hairline bullets and then re-laid itself
//     out as a list of pictures underneath the pointer.
//   · And at 54x42, a landscape photograph of a mountain range is mush. It
//     could not communicate the thing it cost all that to show.
//
// So the menu is type now. It opens instantly, it never reflows, and it costs
// no network at all. The collections' real photography still sells them at full
// size on /collections, the shop's collection strip and the PDP cross-sell —
// places where it is big enough to mean something.
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
    /** An editorial aside filling the panel's right third. */
    feature?: { eyebrow: string; title: string; note: string; href: string; cta: string }
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
      // Two short lists left most of this panel empty. The differentiator gets
      // the space instead of whitespace does.
      feature: {
        eyebrow: 'Made yours',
        title: 'Put your own artwork on any of it.',
        note: 'Front, back or both — previewed on the piece before anything prints.',
        href: '/customize',
        cta: 'Open the studio',
      },
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

/** Past this, the bar has left the hero and may hide on the way down. */
const HIDE_AFTER = 260
/** Where the bar stops being transparent. */
const SOLID_AFTER = 80

export default function NavBar() {
  const navRef = useRef<HTMLElement>(null)
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)
  /** Travelling down, deep enough that the bar should get out of the way. */
  const [retracted, setRetracted] = useState(false)
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
  // The live collections, for names and taglines only — there are no pictures
  // in this menu any more. Fetched once when the bar mounts and the browser is
  // idle, NOT on first hover: on hover it arrived after the panel had already
  // opened, and the panel visibly re-laid itself out. Text-only means the two
  // versions are the same shape, so even a slow reply cannot shift anything.
  const [navCollections, setNavCollections] = useState<
    { slug: string; name: string; tagline: string | null }[]
  >([])

  const openNow = (label: string) => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    setOpenMenu(label)
  }
  // Long enough to cross the gap, short enough that it never feels stuck open.
  const closeSoon = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setOpenMenu(null), 140)
  }
  useEffect(() => () => { if (closeTimer.current) window.clearTimeout(closeTimer.current) }, [])

  useEffect(() => {
    let cancelled = false
    const run = () => {
      getNavCollections()
        .then((rows) => { if (!cancelled) setNavCollections(rows) })
        .catch(() => {})
    }
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number }
    const id = w.requestIdleCallback ? w.requestIdleCallback(run) : window.setTimeout(run, 400)
    return () => {
      cancelled = true
      if (!w.requestIdleCallback) window.clearTimeout(id)
    }
  }, [])

  // Which hero act is holding the frame, mirrored into state.
  //
  // This used to be done purely in CSS, with an arbitrary variant —
  // `[body[data-hero-act=studio]_&]:text-paper` — and the colour half of it
  // never worked. The ring beside it did, on the same element, from the same
  // class string, and an identical string on a freshly created sibling
  // resolved correctly; only the real anchor stayed dim. Whatever the cause,
  // a cue that fails silently on one property and not another is not worth
  // keeping: this reads the attribute and applies the class in JS, where it
  // can be seen and tested.
  const [heroAct, setHeroAct] = useState('')
  useEffect(() => {
    const read = () => setHeroAct(document.body.dataset.heroAct ?? '')
    read()
    const mo = new MutationObserver(read)
    mo.observe(document.body, { attributes: true, attributeFilter: ['data-hero-act'] })
    return () => mo.disconnect()
  }, [])

  useEffect(() => {
    if (!openMenu) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenMenu(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openMenu])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

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

  const handleSignOut = useCallback(async () => {
    await logout()
    setAuthEmail(null)
    router.refresh()
  }, [router])

  // Only the homepage opens on a full-bleed dark hero, so only there can the
  // nav start transparent. Every other page's first section can be light
  // (PageHeader's paper variant), so the solid bar is always on to stay legible.
  const isHome = pathname === '/'
  // The bar goes solid while a panel is down, so the panel hangs off something
  // instead of floating over the hero with a seam of scenery between them.
  const solid = scrolled || !isHome || Boolean(openMenu)
  // Never retract while something is open, or the panel you are reading slides
  // off the top of the window with the bar it is attached to.
  const hidden = retracted && !openMenu && !menuOpen
  const openLink = openMenu ? NAV_LINKS.find((l) => l.label === openMenu) : undefined

  // ── The scroll contract ────────────────────────────────────────────────────
  // Three states, not one. There was only ever `scrolled`, so on a 12,000px
  // homepage the bar sat over the content for the entire descent.
  //
  //   top of page  transparent, 72px, always shown
  //   scrolled     solid, 56px, shown
  //   going down   solid, 56px, retracted off the top
  //   going up     comes straight back, at any depth
  //
  // Reading up is how people navigate: a visitor who scrolls up is looking for
  // the way out, and that is exactly when the bar should be there. One
  // ScrollTrigger drives all of it, so there is a single source of scroll truth
  // and it stays in step with Lenis like the rest of the site.
  useEffect(() => {
    // ── Why this reads window.scrollY directly ─────────────────────────────
    // Two ScrollTrigger-based versions of this were written and both failed the
    // same way: the bar retracted on the way down and would not come back on
    // the way up. Measured, the cause is that `self.scroll()` does not track
    // upward movement under this project's Lenis setup, while `window.scrollY`
    // does — verified by stepping the page from 1600 to 1000 and watching the
    // two disagree. ScrollTrigger stays in charge of everything tied to the
    // page's animation timeline; this one small piece of state does not need
    // it, and is correct and testable without it.
    //
    // It flips on ACCUMULATED travel, not per-frame delta. A smoothed scroller
    // reports small direction reversals as it settles, and any one of them
    // landing at the end of a gesture would flip the bar back — which is why
    // the earlier per-frame version behaved differently at different scroll
    // speeds. Movement is summed while it keeps going one way, the count
    // resets when the direction changes, and the bar only moves after FLIP
    // pixels of real travel. That is also what people expect: a nudge does
    // nothing, a deliberate scroll does something.
    const FLIP = 48
    let last = window.scrollY
    let travel = 0
    let queued = false

    const measure = () => {
      queued = false
      const y = window.scrollY
      const d = y - last
      last = y
      setScrolled(y > SOLID_AFTER)

      // Near the top the bar is always present, whatever the gesture.
      if (y <= HIDE_AFTER) {
        travel = 0
        setRetracted(false)
        return
      }
      if ((d > 0 && travel < 0) || (d < 0 && travel > 0)) travel = 0
      travel += d
      if (travel > FLIP) {
        setRetracted(true)
        travel = 0
      } else if (travel < -FLIP) {
        setRetracted(false)
        travel = 0
      }
    }

    const onScroll = () => {
      if (queued) return
      queued = true
      requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  // Published so a page can lay itself out under the bar instead of guessing
  // with a hardcoded pt-32. AuthShell already reads `--nav-h`; until now
  // nothing set it, so it was silently falling back to 0px.
  useEffect(() => {
    document.documentElement.style.setProperty('--nav-h', solid ? '56px' : '72px')
  }, [solid])

  return (
    <header
      ref={navRef}
      data-solid={solid ? '' : undefined}
      // A grid, not justify-between. With three flex children the nav sat
      // wherever the logo and the icon cluster left room, which is why it
      // collided with the wordmark at exactly 1024px. Equal 1fr rails put the
      // nav in the true centre of the bar and keep it there at every width.
      className={`fixed top-0 left-0 right-0 z-50 grid grid-cols-[1fr_auto_1fr] items-center px-6 md:px-10 transition-[height,background-color,transform,border-color] duration-500 ease-[var(--ease-out)] ${
        hidden ? '-translate-y-full' : 'translate-y-0'
      } ${
        solid
          ? 'h-14 border-b border-paper/10 bg-ink/95 shadow-[0_2px_24px_rgba(0,0,0,0.28)] backdrop-blur-md'
          : 'h-[72px] border-b border-transparent bg-transparent'
      }`}
    >
      {/* `relative z-50`: the mobile sheet below is a positioned
          child of this same header at z-40, so without a stacking
          position of their own the logo and the icon cluster paint
          UNDER it — the close button was covered and the menu could
          be opened but not dismissed by tapping. */}
      <div className="relative z-50 justify-self-start">
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

      {/* `relative`, because the panels hang off the NAV, not off the label
          that opened them. Anchoring a 660px panel to its own trigger put its
          left edge 37px off the left of the window at 1024px — the narrowest
          width this bar is shown at — since SHOP sits well left of centre.
          Centred on the nav it is centred on the window at every width, which
          is also how a menu this wide is supposed to read: one surface that
          belongs to the whole bar. */}
      <nav className="relative hidden items-center gap-7 justify-self-center lg:flex xl:gap-9">
        {NAV_LINKS.map((link) => {
          // While an act of the hero holds the frame, the nav item that act is
          // about lights up — the frame is showing the thing, and this is the
          // site's permanent door to it. SummitHero writes `data-hero-act` on
          // <body> at the act boundaries. These strings are SummitHero's
          // `HeroAct`; they are an interface between the two files.
          const actDoor =
            link.href === '/collections' ? 'collections'
            : link.href === '/customize' ? 'studio'
            : link.href === '/trek-buddy' ? 'trek'
            : null
          const spotlit = actDoor !== null && actDoor === heroAct
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
                // One colour utility, never two. Appending `text-paper`
                // alongside `text-paper/70` puts two same-specificity rules on
                // the element, and the stylesheet's own order decides which
                // wins — not the order they appear in the attribute.
                active || open || spotlit ? 'text-paper' : 'text-paper/70 hover:text-paper'
              }`}
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
              {actDoor !== null && (
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute -inset-x-3 -inset-y-1 rounded-full border border-sage/60 transition-opacity duration-500 motion-reduce:animate-none ${
                    spotlit ? 'animate-pulse opacity-100' : 'opacity-0'
                  }`}
                />
              )}
            </Link>
          )

          if (!link.menu) return <div key={link.label}>{trigger}</div>

          return (
            <div
              key={link.label}
              onMouseEnter={() => openNow(link.label)}
              onMouseLeave={closeSoon}
              onFocus={() => openNow(link.label)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpenMenu(null)
              }}
            >
              {trigger}
            </div>
          )
        })}

        {/* One panel for whichever menu is down. It carries the same hover
            handlers as the trigger, so the pointer can leave the label, cross
            the pt-3 bridge and land in the panel without the close timer ever
            firing. */}
        <AnimatePresence>
          {openLink?.menu && (
            <motion.div
              key={openLink.label}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              onMouseEnter={() => openNow(openLink.label)}
              onMouseLeave={closeSoon}
              // pt-3 is the bridge the pointer crosses. Without it the gap
              // between label and panel is a dead zone that closes the menu
              // halfway to the thing you were reaching for.
              className="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3"
            >
              <MenuPanel menu={openLink.menu} collections={navCollections} onNavigate={() => setOpenMenu(null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* gap-6 (24px x 3 gaps = 72px) left nothing for the header's own
          justify-between to place between the wordmark and this cluster below
          lg — the nav's own links are hidden there, so this and the logo are
          the only two flex children, and their combined width already
          exceeded the available space. */}
      <div className="relative z-50 flex items-center gap-2.5 justify-self-end sm:gap-5">
        <Link
          href="/wishlist"
          aria-label={`Wishlist, ${wishlistItems.length} saved`}
          className="flex items-center gap-2 text-paper/80 transition-colors duration-300 hover:text-paper"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill={wishlistItems.length > 0 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span className="font-mono text-[11px] tabular-nums">{wishlistItems.length}</span>
        </Link>

        <Link
          href="/cart"
          aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`}
          className="flex items-center gap-2 text-paper/80 transition-colors duration-300 hover:text-paper"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M4 20L9 6h6l5 14H4z" strokeLinejoin="round" />
            <path d="M9 6a3 3 0 0 1 6 0" strokeLinecap="round" />
          </svg>
          <span className="font-mono text-[11px] tabular-nums">{count}</span>
        </Link>

        {authEmail ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Account"
              className="relative flex items-center text-paper/80 transition-colors duration-300 hover:text-paper"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
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
            className="flex items-center text-paper/80 transition-colors duration-300 hover:text-paper"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M4.5 20c0-4.14 3.36-7 7.5-7s7.5 2.86 7.5 7" strokeLinecap="round" />
            </svg>
          </Link>
        )}

        {/* Measured at 24 x 8 pixels — two 1px rules and a 6px gap — which is
            one third of the WCAG 2.5.8 minimum in one dimension and a quarter
            of it in the other. It is also the ONLY door off the homepage below
            1024px, since the whole nav collapses into it. The bars are
            unchanged; the button around them is a real 44px target. */}
        <button
          aria-label={menuOpen ? 'Close menu' : 'Menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="-mr-2 flex h-11 w-11 flex-col items-center justify-center gap-1.5 text-paper lg:hidden"
        >
          <span
            className={`block h-px w-6 bg-current transition-transform duration-300 ${menuOpen ? 'translate-y-[3.5px] rotate-45' : ''}`}
          />
          <span
            className={`block h-px w-6 bg-current transition-transform duration-300 ${menuOpen ? '-translate-y-[3.5px] -rotate-45' : ''}`}
          />
        </button>
      </div>

      <MobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        pathname={pathname}
        authEmail={authEmail}
        collections={navCollections}
      />
    </header>
  )
}

/**
 * The panel that hangs under the bar. One component for both shapes, so a
 * category list and a collection list cannot drift into two different designs.
 *
 *   columns  two category lists plus the studio pitch filling the right third.
 *            Two short lists alone left most of a 660px panel empty.
 *   stack    three collections, each a name in the display face with the line
 *            that says what it is. This is the panel that used to carry the
 *            thumbnails; it is type now, and it opens instantly.
 */
function MenuPanel({
  menu,
  collections,
  onNavigate,
}: {
  menu: NonNullable<NavLink['menu']>
  collections: { slug: string; name: string; tagline: string | null }[]
  onNavigate: () => void
}) {
  // Live names where we have them; the static list is the fallback and renders
  // identically, so nothing moves if the fetch lands late.
  const stackItems: MenuItem[] = collections.length
    ? collections.map((c) => ({
        label: c.name,
        href: `/collections/${c.slug}`,
        note: c.tagline ?? undefined,
      }))
    : menu.groups.flatMap((g) => g.items)

  return (
    <div
      className={`relative overflow-hidden rounded-[var(--r-panel)] border border-paper/10 bg-ink/97 shadow-[0_28px_70px_-28px_rgba(0,0,0,0.85)] backdrop-blur-md ${
        menu.layout === 'columns' ? 'w-[660px]' : 'w-[420px]'
      }`}
    >
      {/* The one flourish on the whole bar: a sage hairline that draws across
          the top edge as the panel lands, so the menu arrives rather than
          appearing. */}
      <motion.span
        aria-hidden="true"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.04 }}
        className="absolute inset-x-0 top-0 h-px origin-left bg-sage"
      />

      {menu.layout === 'columns' ? (
        <div className="grid grid-cols-[1fr_1fr_1.25fr]">
          <div className="col-span-2 grid grid-cols-2 gap-x-8 p-7">
            {menu.groups.map((group, gi) => (
              <div key={group.heading ?? gi}>
                {group.heading && (
                  <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.22em] text-sage">
                    {group.heading}
                  </p>
                )}
                <ul className="flex flex-col">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <MenuRow item={item} onNavigate={onNavigate} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {menu.feature && (
            <Link
              href={menu.feature.href}
              onClick={onNavigate}
              className="group/f flex flex-col justify-between border-l border-paper/10 bg-paper/[0.03] p-7 transition-colors duration-300 hover:bg-paper/[0.06]"
            >
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-dawn">
                  {menu.feature.eyebrow}
                </p>
                <p className="mt-3 font-display text-[19px] leading-snug text-paper">
                  {menu.feature.title}
                </p>
                <p className="mt-2 font-body text-[12px] leading-relaxed text-paper/50">
                  {menu.feature.note}
                </p>
              </div>
              <span className="mt-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-paper">
                {menu.feature.cta}
                <span aria-hidden="true" className="transition-transform duration-300 group-hover/f:translate-x-1">
                  →
                </span>
              </span>
            </Link>
          )}
        </div>
      ) : (
        <ul className="flex flex-col p-3">
          {stackItems.map((item) => (
            <li key={item.href}>
              <MenuRow item={item} onNavigate={onNavigate} large />
            </li>
          ))}
        </ul>
      )}

      {/* The way out of the menu and into the whole thing. */}
      <Link
        href={menu.all.href}
        onClick={onNavigate}
        className="group/a flex items-center justify-between gap-6 border-t border-paper/10 px-7 py-3.5 font-mono text-[10px] uppercase tracking-[0.16em] text-paper/50 transition-colors duration-200 hover:bg-paper/[0.03] hover:text-paper"
      >
        {menu.all.label}
        <span aria-hidden="true" className="transition-transform duration-300 group-hover/a:translate-x-1">
          →
        </span>
      </Link>
    </div>
  )
}

/**
 * One row in a panel. Both panels use it, so a category and a collection can
 * never drift into two different row designs again.
 *
 * `large` is the collections treatment: the name in the display face with its
 * tagline under it. The growing hairline is the same idiom the hour rail and
 * the hero's weather rail use for "this is the one".
 */
function MenuRow({
  item,
  onNavigate,
  large = false,
}: {
  item: MenuItem
  onNavigate: () => void
  large?: boolean
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`group/i flex items-start gap-3 rounded-[var(--r-input)] transition-colors duration-200 hover:bg-paper/[0.05] ${
        large ? 'px-4 py-3' : 'px-2 py-1.5'
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-px w-1.5 shrink-0 bg-paper/25 transition-all duration-300 group-hover/i:w-4 group-hover/i:bg-sage ${
          large ? 'mt-[13px]' : 'mt-[9px]'
        }`}
      />
      <span className="min-w-0">
        <span
          className={`block text-paper/80 transition-colors duration-200 group-hover/i:text-paper ${
            large ? 'font-display text-[17px] leading-snug' : 'font-body text-[13px]'
          }`}
        >
          {item.label}
        </span>
        {item.note && (
          <span className="mt-0.5 block font-body text-[12px] leading-snug text-paper/45">
            {item.note}
          </span>
        )}
      </span>
    </Link>
  )
}

/**
 * The phone navigation.
 *
 * What it replaces: every link centred in a column, at `text-3xl`, with each
 * menu's children flattened into a wrapped row of 11px uppercase chips
 * underneath its parent. Centred text makes a list of five hard to scan
 * because no two items share a left edge, and 11px chips in a wrapped row are
 * both hard to read and hard to hit accurately.
 *
 * This is a left-aligned sheet instead: one column, everything on the same
 * left edge, section children indented under their parent as real rows, and
 * the account / wishlist / cart actions at the foot where they can be reached
 * with a thumb rather than only from the 20px icons in the bar.
 */
function MobileMenu({
  open,
  onClose,
  pathname,
  authEmail,
  collections,
}: {
  open: boolean
  onClose: () => void
  pathname: string
  authEmail: string | null
  collections: { slug: string; name: string; tagline: string | null }[]
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          id="mobile-nav"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 top-0 z-40 h-[100dvh] w-screen overflow-y-auto overscroll-contain bg-ink lg:hidden"
        >
          <nav className="flex min-h-full flex-col px-6 pb-10 pt-24">
            <ul className="flex flex-col">
              {NAV_LINKS.map((link, i) => {
                const active =
                  link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)
                const children =
                  link.menu?.layout === 'stack' && collections.length
                    ? collections.map((c) => ({ label: c.name, href: `/collections/${c.slug}` }))
                    : (link.menu?.groups.flatMap((g) => g.items) ?? [])
                return (
                  <motion.li
                    key={link.label}
                    initial={{ y: 18, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.35, delay: 0.04 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                    className="border-b border-paper/10"
                  >
                    <Link
                      href={link.href}
                      onClick={onClose}
                      className="flex items-baseline gap-3 py-4"
                    >
                      <span
                        className={`font-display text-[28px] leading-none ${active ? 'text-paper' : 'text-paper/85'}`}
                      >
                        {link.label}
                      </span>
                      {active && (
                        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-sage" />
                      )}
                    </Link>

                    {children.length > 0 && (
                      <ul className="-mt-1 flex flex-col pb-4 pl-1">
                        {children.map((c) => (
                          <li key={c.href}>
                            <Link
                              href={c.href}
                              onClick={onClose}
                              // A real row with a real target height, not a chip
                              // in a wrapped line.
                              className="flex min-h-[44px] items-center font-body text-[14px] text-paper/55 transition-colors active:text-paper"
                            >
                              {c.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </motion.li>
                )
              })}
            </ul>

            <div className="mt-auto pt-10">
              <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-paper/35">
                Your account
              </p>
              <div className="mt-3 flex flex-col">
                <Link href={authEmail ? '/account' : '/auth/login'} onClick={onClose} className="flex min-h-[44px] items-center font-body text-[15px] text-paper/80">
                  {authEmail ? 'My account' : 'Sign in'}
                </Link>
                <Link href="/wishlist" onClick={onClose} className="flex min-h-[44px] items-center font-body text-[15px] text-paper/80">
                  Wishlist
                </Link>
                <Link href="/cart" onClick={onClose} className="flex min-h-[44px] items-center font-body text-[15px] text-paper/80">
                  Cart
                </Link>
              </div>
            </div>
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
