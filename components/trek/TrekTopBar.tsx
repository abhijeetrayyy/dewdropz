'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Avatar from './ui/Avatar'
import { Lockup } from './ui/Mark'

// The shell.
//
// Trek Buddy had none. `TrekHero` — a full-height photograph with the same
// picture and the same headline — was stamped on seven pages and doubled as
// navigation, so every screen re-introduced the product instead of continuing
// it, and five of those pages passed an empty `counts` object into a filter
// rail that then rendered nothing. A page that reintroduces itself is a
// brochure. An app has chrome, and the chrome is what makes the difference
// between visiting a thing and being inside it.
//
// Three cells at 1fr / auto / 1fr, so the nav stays optically centred on the
// viewport no matter how wide the brand or the actions get.
//
// THE COUNTS RIDE INSIDE THE WORD. "Messages 4" is one glance; a dot floating
// near the word is two — you see that something happened, then you look for
// where. And the active underline is always rendered and only changes colour,
// so routing never reflows the bar.

type Item = { key: string; label: string; href: string; badge?: number }

export default function TrekTopBar({
  displayName,
  userId,
  canHost,
  unreadMessages = 0,
  unreadNotifications = 0,
  signedIn,
}: {
  displayName?: string | null
  userId?: string | null
  canHost?: boolean
  unreadMessages?: number
  unreadNotifications?: number
  signedIn: boolean
}) {
  const pathname = usePathname() ?? ''

  const nav: Item[] = signedIn
    ? [
        { key: 'board', label: 'Discover', href: '/trek-buddy' },
        { key: 'people', label: 'People', href: '/trek-buddy/people' },
        { key: 'basecamp', label: 'Basecamp', href: '/trek-buddy/basecamp', badge: unreadNotifications },
        { key: 'messages', label: 'Messages', href: '/trek-buddy/messages', badge: unreadMessages },
      ]
    : [
        { key: 'board', label: 'Discover', href: '/trek-buddy' },
        { key: 'trails', label: 'Trails', href: '/treks' },
        { key: 'shop', label: 'Shop', href: '/shop' },
      ]

  const isOn = (href: string) =>
    href === '/trek-buddy' ? pathname === '/trek-buddy' : pathname.startsWith(href)

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-paper/[0.08] bg-ink/[0.92] backdrop-blur-[14px]">
      <div className="grid h-full grid-cols-[auto_1fr] items-center gap-4 px-6 md:grid-cols-[1fr_auto_1fr] md:px-10">
        <Link
          href="/trek-buddy"
          className="min-w-0 justify-self-start rounded-[var(--r-input)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sage"
        >
          <Lockup tone="onink" />
        </Link>

        <nav className="col-span-2 hidden items-center gap-8 justify-self-center md:col-span-1 md:flex">
          {nav.map((n) => {
            const on = isOn(n.href)
            return (
              <Link
                key={n.key}
                href={n.href}
                aria-current={on ? 'page' : undefined}
                className={`relative py-2 font-body text-[13px] font-medium transition-colors duration-200 ${
                  on ? 'text-paper' : 'text-paper/60 hover:text-paper'
                }`}
              >
                {n.label}
                {n.badge ? (
                  <span className="ml-2 inline-flex min-w-[18px] items-center justify-center rounded-full bg-dawn px-1.5 py-px font-mono text-[10px] font-medium leading-[1.5] text-paper tabular-nums">
                    {n.badge > 9 ? '9+' : n.badge}
                  </span>
                ) : null}
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-0 h-0.5 w-full rounded-[2px] transition-colors duration-300"
                  style={{ background: on ? 'var(--sage)' : 'transparent' }}
                />
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-4 justify-self-end">
          {signedIn ? (
            <>
              {canHost && (
                <Link
                  href="/trek-buddy/new"
                  className="hidden rounded-full border border-paper/25 px-4 py-2 font-body text-[13px] font-medium text-paper transition-colors duration-200 hover:border-paper/70 hover:bg-paper/[0.06] sm:inline-flex"
                >
                  Post a walk
                </Link>
              )}
              <Link
                href="/trek-buddy/profile"
                aria-label="Your profile"
                className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
              >
                <Avatar
                  name={displayName || 'You'}
                  id={userId}
                  size={32}
                  role="you"
                  ground="dark"
                />
              </Link>
            </>
          ) : (
            <Link
              href="/auth/login?redirect=/trek-buddy"
              className="trek-pill trek-pill-actinv"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>

      {/* The phone bar. Same items, moved to the foot where a thumb is — a
          four-item nav wrapping to three lines under a logo was the single
          worst thing about this feature on a phone. */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex items-stretch border-t border-paper/[0.08] bg-ink/[0.94] backdrop-blur-[14px] md:hidden">
        {nav.map((n) => {
          const on = isOn(n.href)
          return (
            <Link
              key={n.key}
              href={n.href}
              aria-current={on ? 'page' : undefined}
              className={`relative flex flex-1 flex-col items-center gap-1.5 py-3 font-body text-[11px] font-medium transition-colors ${
                on ? 'text-paper' : 'text-paper/55'
              }`}
            >
              <span
                aria-hidden="true"
                className="h-0.5 w-6 rounded-full transition-colors"
                style={{ background: on ? 'var(--sage)' : 'transparent' }}
              />
              {n.label}
              {n.badge ? (
                <span className="absolute right-[22%] top-2 grid h-4 min-w-4 place-items-center rounded-full bg-dawn px-1 font-mono text-[9px] leading-none text-paper tabular-nums">
                  {n.badge > 9 ? '9+' : n.badge}
                </span>
              ) : null}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
