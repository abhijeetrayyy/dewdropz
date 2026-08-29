'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid, Package, MapPin, Tent, Palette, Settings, Heart, ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── The account rail ─────────────────────────────────────────────────────────
//
// What was here: seven bare <Link>s in a flex column, all the same colour, with
// no active state. A navigation that cannot tell you which page you are on is
// failing at its only job — and with every label at the same weight there was
// nothing to look at, which is a large part of why the account area read as
// unfinished.
//
// Three things fix it. Position: the current route is marked, by fill and by a
// rule down its left edge, so it survives being read in greyscale. Shape: icons
// give each row a silhouette, so the list is scannable rather than read.
// Weight: the counts are here, because "Orders" and "Orders 12" are different
// invitations, and the rail is where a person decides where to go next.

type Item = {
  href: string
  label: string
  icon: typeof Package
  count?: number
  exact?: boolean
}

export default function AccountRail({
  counts,
  isAdmin,
  children,
}: {
  counts: { orders: number; designs: number; rentals: number }
  isAdmin: boolean
  // The sign-out control is a server-action form, so it is passed in rather
  // than imported — this component is a client boundary and cannot hold one.
  children?: React.ReactNode
}) {
  const pathname = usePathname()

  const items: Item[] = [
    // `exact` only on the index: without it, /account/orders would light up
    // Overview as well, and two active rows is worse than none.
    { href: '/account',           label: 'Overview',  icon: LayoutGrid, exact: true },
    { href: '/account/orders',    label: 'Orders',    icon: Package,  count: counts.orders },
    { href: '/account/designs',   label: 'Designs',   icon: Palette,  count: counts.designs },
    { href: '/account/rentals',   label: 'Rentals',   icon: Tent,     count: counts.rentals },
    { href: '/account/addresses', label: 'Addresses', icon: MapPin },
    { href: '/wishlist',          label: 'Wishlist',  icon: Heart },
    { href: '/account/settings',  label: 'Settings',  icon: Settings },
  ]

  const isOn = (item: Item) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href)

  return (
    <nav
      aria-label="Account"
      className="rounded-[var(--r-panel)] border border-rule/70 bg-surface p-2 shadow-[var(--shadow-card)]"
    >
      {/* On phones the rail lies down and scrolls, rather than stacking seven
          full-width rows above the content and pushing the actual page below
          the fold. */}
      <ul className="flex gap-1 overflow-x-auto [scrollbar-width:none] lg:flex-col lg:overflow-visible [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const on = isOn(item)
          const Icon = item.icon
          return (
            <li key={item.href} className="shrink-0 lg:shrink">
              <Link
                href={item.href}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'group relative flex items-center gap-3 rounded-[var(--r-input)] px-3 py-2.5 font-body text-sm transition-colors duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40',
                  on
                    ? 'bg-sage-soft text-forest'
                    : 'text-mid hover:bg-paper-warm/60 hover:text-text'
                )}
              >
                {/* The second signal. Fill alone is a hue difference; this is a
                    shape difference, and it is what makes the active row
                    survive a greyscale screenshot. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-forest transition-opacity duration-200',
                    on ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <Icon
                  className={cn('h-4 w-4 shrink-0 transition-colors', on ? 'text-forest' : 'text-light group-hover:text-mid')}
                  strokeWidth={1.75}
                />
                <span className={cn('whitespace-nowrap', on && 'font-medium')}>{item.label}</span>
                {typeof item.count === 'number' && item.count > 0 && (
                  <span
                    className={cn(
                      'ml-auto hidden rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums lg:inline-block',
                      on ? 'bg-forest/10 text-forest' : 'bg-paper-warm text-light'
                    )}
                  >
                    {item.count}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>

      {isAdmin && (
        <div className="mt-2 border-t border-rule-soft pt-2">
          <Link
            href="/admin"
            className="flex items-center gap-3 rounded-[var(--r-input)] px-3 py-2.5 font-body text-sm text-clay-deep transition-colors duration-200 hover:bg-clay-wash"
          >
            {/* Was `text-amber-600` — a raw Tailwind palette value in a site
                with a defined semantic one. `--clay-deep` is the token for
                exactly this register, and it clears AA where amber-600 did not. */}
            <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span className="whitespace-nowrap">Admin</span>
          </Link>
        </div>
      )}

      {children && <div className="mt-2 border-t border-rule-soft px-3 pb-1 pt-3">{children}</div>}
    </nav>
  )
}
