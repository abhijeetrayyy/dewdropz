import Link from 'next/link'
import CookieChoicesLink from '@/components/CookieChoicesLink'
import { Logo } from '@/components/Logo'
import { SocialLink } from '@/components/layout/SocialLink'
import { SITE } from '@/lib/constants'
import { getCollections } from '@/actions/products'
import { getCategories } from '@/actions/categories'
import { getStoreSettings } from '@/actions/settings'
import { formatPrice } from '@/lib/utils'

/**
 * Whether a contact route is real enough to publish.
 *
 * `lib/constants.ts` carries a six-line confession above `SITE`: "PLACEHOLDERS,
 * all of them, and they are live on the site right now. `instagram` points at
 * instagram.com's front page, not an account. `phone` and `whatsapp` are
 * 98765 43210 — the number Indian form examples use, which is not a real line."
 *
 * The footer rendered every one of them anyway, on every page of the site, the
 * phone as a `tel:` link. In a cash-on-delivery market buyers check whether a
 * shop has a real phone number before they order, so this single string did
 * more damage than every trust badge on the page repairs.
 *
 * These predicates are deliberately local and deliberately dumb: they reject
 * the specific placeholders that are known to be in the file, so the moment
 * somebody puts real values in `SITE` everything appears with no code change.
 * A footer carrying only an email address is honest; one carrying a fake phone
 * number is not.
 */
const PLACEHOLDER_DIGITS = '9876543210'

function isRealPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10 && !digits.endsWith(PLACEHOLDER_DIGITS)
}

/** A social URL with no path is the platform's front page, not an account. */
function isRealProfile(value: string): boolean {
  try {
    const u = new URL(value)
    return u.pathname.replace(/\/+$/, '').length > 0
  } catch {
    return false
  }
}

export default async function FooterSection() {
  const [collections, categories, settings] = await Promise.all([
    getCollections(),
    getCategories({ parentId: null }),
    getStoreSettings(),
  ])

  const footerColumns = [
    {
      heading: 'Shop',
      // Named products, not gear shelves. The old column listed "All Gear" and
      // whatever categories the database happened to hold, which was the
      // outfitter taxonomy the brand is moving away from.
      links: [
        { label: 'All Products', href: '/shop' },
        { label: 'T-Shirts', href: '/shop?category=t-shirts' },
        { label: 'Hoodies', href: '/shop?category=hoodies' },
        { label: 'Sweatshirts', href: '/shop?category=sweatshirts' },
        { label: 'Drinkware', href: '/shop?category=drinkware' },
        { label: 'Rent Gear', href: '/rent' },
      ],
    },
    {
      heading: 'Collections',
      links: [
        ...collections.map((c) => ({ label: c.name, href: `/collections/${c.slug}` })),
        { label: 'View All', href: '/collections' },
      ],
    },
    {
      heading: 'Explore',
      links: [
        { label: 'Journal', href: '/journal' },
        { label: 'About DEWDROPZ', href: '/about' },
        { label: 'Our Philosophy', href: '/sustainability' },
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
        { label: 'Cookie choices', href: '#cookie-choices' },
      ],
    },
  ]

  return (
    <footer className="bg-ink text-white/60 pt-20 px-6 md:px-10 overflow-hidden">
      {/* Brand + sitemap */}
      <div className="max-w-measure mx-auto grid grid-cols-2 md:grid-cols-6 gap-x-6 gap-y-12">
        <div className="col-span-2">
          <Logo
            markHeight={34}
            wordmarkClassName="font-display text-white text-xl tracking-tight"
            tagline="— Feel Alive"
            taglineClassName="font-display italic text-sage text-sm"
          />
          <p className="mt-5 font-body text-sm text-white/40 leading-relaxed max-w-[260px]">
            Designed for everyday journeys. Inspired by mountains, mist and the
            spirit of exploration.
          </p>

          <div className="mt-6 space-y-1.5 font-body text-sm">
            <a href={`mailto:${SITE.email}`} className="block hover:text-white transition-colors">{SITE.email}</a>
            {isRealPhone(SITE.phone) && (
              <a href={`tel:${SITE.phone.replace(/\s/g, '')}`} className="block hover:text-white transition-colors">{SITE.phone}</a>
            )}
            {/* Was `text-white/35` — 2.2:1 on this ground, for the shop's
                postal address. */}
            <div className="text-white/60 leading-relaxed pt-1">{SITE.address}</div>
          </div>

          {/* Every one of these pointed at the platform's front page rather
              than at an account — `https://instagram.com`, no path — so the
              icons were three dead ends dressed as proof the brand exists.
              They appear the moment SITE carries a real profile URL. */}
          {(isRealProfile(SITE.instagram) ||
            isRealProfile(SITE.facebook) ||
            isRealProfile(SITE.linkedin)) && (
            <div className="flex items-center gap-4 mt-6">
              {isRealProfile(SITE.instagram) && (
                <SocialLink href={SITE.instagram} label="Instagram">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
                  </svg>
                </SocialLink>
              )}
              {isRealProfile(SITE.facebook) && (
                <SocialLink href={SITE.facebook} label="Facebook">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M14 8.5V7a1 1 0 0 1 1-1h1.5V3.5H14A3.5 3.5 0 0 0 10.5 7v1.5H8.5V11h2v9.5H14V11h2.2l.3-2.5H14z" />
                  </svg>
                </SocialLink>
              )}
              {isRealProfile(SITE.linkedin) && (
                <SocialLink href={SITE.linkedin} label="LinkedIn">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M6.5 8.5H4v11h2.5v-11zM5.25 3.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM20 13.6c0-3-1.6-4.4-3.8-4.4a3.3 3.3 0 0 0-3 1.6V8.5H10.8v11h2.5v-5.8c0-1.5.3-3 2.2-3s1.9 1.7 1.9 3.1v5.7H20v-5.9z" />
                  </svg>
                </SocialLink>
              )}
            </div>
          )}
        </div>

        {footerColumns.map((col) => (
          <nav key={col.heading} aria-label={col.heading}>
            <div className="font-body text-[10px] tracking-[0.2em] text-sage uppercase mb-4">{col.heading}</div>
            <ul className="space-y-2.5">
              {col.links.map((link) => (
                <li key={link.label}>
                  {/* Withdrawing consent is not a page — it re-opens the choice
                      in place, so this one entry is a control rather than a
                      link. It has to be as reachable as giving consent was. */}
                  {link.href === '#cookie-choices' ? (
                    <CookieChoicesLink className="font-body text-sm hover:text-white transition-colors" />
                  ) : (
                    <Link href={link.href} className="font-body text-sm hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      {/* Logistics reassurance, one quiet line */}
      <div className="max-w-measure mx-auto border-t border-white/10 mt-14 pt-6 flex flex-wrap items-center gap-x-8 gap-y-2 font-body text-[11px] tracking-[0.08em] uppercase text-white/35">
        <span>COD · UPI · Cards</span>
        {/* From the setting, not from a string. The same figure was hardcoded
            here AND in `TRUST_POINTS`, beside a live `free_shipping_threshold`
            that is what checkout actually charges against — so an owner raising
            the threshold left two places on every page still promising the old
            one, and switching free shipping off left both still promising it. */}
        {settings.free_shipping_threshold > 0 && (
          <span>Free shipping over {formatPrice(settings.free_shipping_threshold)}</span>
        )}
        <span>7-day returns</span>
        <span>Fast dispatch across India</span>
      </div>

      {/* The sign-off — oversized wordmark, like a summit marker */}
      <div className="max-w-measure mx-auto mt-12 select-none" aria-hidden="true">
        <div
          className="font-display font-light uppercase leading-[0.8] tracking-[-0.03em] text-transparent text-[clamp(64px,12.5vw,190px)] whitespace-nowrap"
          style={{ WebkitTextStroke: '1px rgba(246,243,230,0.14)' }}
        >
          Dewdropz
        </div>
      </div>

      {/* Legal row */}
      <div className="max-w-measure mx-auto border-t border-white/10 mt-4 py-6 flex flex-wrap items-center justify-between gap-3">
        <span className="font-body text-xs text-white/30">© 2026 DEWDROPZ</span>
        <span className="font-mono text-[10px] tracking-[0.1em] text-white/25">30.3165° N, 78.0322° E</span>
        <span className="font-body text-xs text-white/30">Made by DoonDzn</span>
      </div>
    </footer>
  )
}
