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
//
// THE TWO BARS ARE SIBLINGS, NOT NESTED, AND THAT IS THE WHOLE FIX.
// `backdrop-filter` makes an element a containing block for every
// fixed-position descendant. While the phone bar lived inside <header>, its
// `bottom-0` resolved against the 64px header instead of the viewport: it
// rendered at the TOP of the screen, painted over the lockup — which measured
// as genuinely unclickable — and, being wider than the viewport, dragged the
// whole document's scrollWidth out past it. Every page on a phone could be
// panned sideways because of this one nesting.

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
        { key: 'home', label: 'Today', href: '/trek-buddy' },
        { key: 'discover', label: 'Discover', href: '/trek-buddy/discover' },
        { key: 'people', label: 'People', href: '/trek-buddy/people' },
        { key: 'basecamp', label: 'Basecamp', href: '/trek-buddy/basecamp', badge: unreadNotifications },
        { key: 'messages', label: 'Messages', href: '/trek-buddy/messages', badge: unreadMessages },
      ]
    : [
        // No 'Shop' here: the brand cell already carries "← Shop", and two
        // controls to the same place three centimetres apart is clutter.
        { key: 'home', label: 'What this is', href: '/trek-buddy' },
        { key: 'trails', label: 'Trails', href: '/treks' },
      ]

  const isOn = (href: string) =>
    // Both of these are prefixes of everything, so they only ever match exactly.
    href === '/' || href === '/trek-buddy' ? pathname === href : pathname.startsWith(href)

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-paper/[0.08] bg-ink/[0.92] backdrop-blur-[14px]">
        <div className="grid h-full grid-cols-[auto_1fr] items-center gap-4 px-5 md:grid-cols-[1fr_auto_1fr] md:px-10">
          {/* THE WAY BACK.
              Trek Buddy moved into its own shell, which fixed the product
              reintroducing itself on every page and created a new problem: once
              you were inside it there was no route out. The storefront's nav
              points here; nothing pointed home. Somebody who came to look at a
              walk and then wanted a jacket had the browser's back button and
              nothing else — and if they had arrived on a walk from a shared
              link, not even that.

              So the brand cell is two controls, not one: the lockup goes to the
              board, and the shop sits beside it behind a hairline. Reading
              "TrekBuddy by Dewdropz | Shop" also says what this thing IS — a
              part of a shop, not a separate company — which is exactly what the
              product's own copy claims and what the chrome was contradicting.

              AND IT IS NO LONGER HIDDEN ON A PHONE. It used to appear only at
              `sm` and up, which meant the argument above held on a laptop and
              collapsed on the device most people are holding: the phone bar
              carried a sixth "Shop" tab instead, so the way out was duplicated
              on wide screens and, at six tabs, was the reason the bar did not
              fit. One control, on every width. */}
          <div className="flex min-w-0 items-center gap-2.5 justify-self-start md:gap-4">
            <Link
              href="/trek-buddy"
              className="min-w-0 rounded-[var(--r-input)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sage"
            >
              <Lockup tone="onink" />
            </Link>

            <span aria-hidden="true" className="h-7 w-px shrink-0 bg-paper/15" />

            <Link
              href="/"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1.5 font-body text-[13px] font-medium text-paper/55 transition-colors hover:bg-paper/[0.06] hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage md:px-2.5"
            >
              <span aria-hidden="true" className="text-[15px] leading-none">←</span>
              Shop
            </Link>
          </div>

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
                    <span className="ml-2 inline-flex min-w-[18px] items-center justify-center rounded-full bg-ember px-1.5 py-px font-mono text-[10px] font-semibold leading-[1.5] text-paper tabular-nums">
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
                  className="trek-tap rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
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
      </header>

      {/* The phone bar. Same items, at the foot where a thumb is — a four-item
          nav wrapping to three lines under a logo was the single worst thing
          about this feature on a phone, and for a while afterwards the bar was
          pinned to the bottom of the HEADER instead, which was worse: it hid
          the lockup and it made every page pannable sideways.

          Five items, not six. "Shop" is the brand cell's job and it is visible
          there on every width now; carrying it here too was what forced six
          tabs into 375px and left "Basecamp 9+" no room to sit.

          The count still rides inside the word rather than floating near it, so
          the badge is part of the same inline row as the label and the row is
          what gets measured. `pb-[env(safe-area-inset-bottom)]` keeps the
          labels clear of the iOS home indicator. */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex items-stretch border-t border-paper/[0.08] bg-ink/[0.94] pb-[env(safe-area-inset-bottom)] backdrop-blur-[14px] md:hidden">
        {nav.map((n) => {
          const on = isOn(n.href)
          return (
            <Link
              key={n.key}
              href={n.href}
              aria-current={on ? 'page' : undefined}
              // 10px, and only here. A fifth of a 375px phone is 75px; at 11px
              // "Basecamp" plus its count needs 78 and the word gets clipped to
              // "Basecam…", which is worse for every reader than a smaller
              // whole word. This is not the same call as `.trek-label`, which
              // is uppercase, tracked, and carries content at 10px in the
              // middle of a page — this is a sentence-case wayfinder in a fixed
              // position behind a 48px tap target, which is what both phone
              // platforms set their own tab bars at.
              className={`flex min-w-0 flex-1 flex-col items-center gap-1.5 py-3 font-body text-[10px] font-medium transition-colors ${
                on ? 'text-paper' : 'text-paper/55'
              }`}
            >
              <span
                aria-hidden="true"
                className="h-0.5 w-6 shrink-0 rounded-full transition-colors"
                style={{ background: on ? 'var(--sage)' : 'transparent' }}
              />
              {/* `w-full` bounds this row to the tab it sits in. Without it the
                  row is sized to its content — the column is `items-center`, so
                  a child is centred at its natural width rather than stretched
                  — and "Basecamp" plus a two-character count is wider than a
                  fifth of a 375px phone. It ran straight into "Messages".
                  Bounded, `truncate` finally has something to truncate against,
                  and the count is small enough that it never has to. */}
              <span className="flex w-full min-w-0 items-center justify-center gap-0.5">
                <span className="min-w-0 truncate">{n.label}</span>
                {n.badge ? (
                  <span className="inline-flex min-w-[14px] shrink-0 items-center justify-center rounded-full bg-ember px-[3px] font-mono text-[9px] font-semibold leading-[14px] text-paper tabular-nums">
                    {n.badge > 9 ? '9+' : n.badge}
                  </span>
                ) : null}
              </span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
