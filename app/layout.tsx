import type { Metadata, Viewport } from 'next'
import { Fraunces, Archivo, Space_Mono } from 'next/font/google'
import LenisProvider from '@/providers/LenisProvider'
import { IntroProvider } from '@/providers/IntroProvider'
import { CartProvider } from '@/providers/CartProvider'
import Preloader from '@/components/Preloader'
import CustomCursor from '@/components/CustomCursor'
import Grain from '@/components/Grain'
import AnalyticsProvider from '@/providers/AnalyticsProvider'
import { WishlistProvider } from '@/providers/WishlistProvider'
import ShopToaster from '@/components/shop/ShopToaster'
import './globals.css'

// ─── The type system ─────────────────────────────────────────────────────────
// Three roles, because this brand actually speaks in three registers:
//
//   display — Fraunces. A warm old-style serif with a real optical-size axis,
//     so a 116px hero and a 20px card heading are drawn differently rather
//     than scaled. It carries the brand's voice: considered, a little aged,
//     never slick. Kept from the previous system — it was the right call.
//
//   body — Archivo. Replaces Inter. Inter is a superb *interface* face and a
//     poor *brand* one: it is the default of every SaaS product of the last
//     five years, so body copy in it reads as software chrome. Archivo is a
//     grotesque drawn from late-19th-century American gothics — the lineage of
//     signage and industrial printing — which is both sturdier at small sizes
//     and a far better fit for a company that prints garments to order in
//     Dehradun. Real italics, 100–900, and tabular figures for prices.
//
//   mono — Space Mono. NEW, and the reason this file changed at all: the
//     storefront already asks for `font-mono` in 41 places (coordinates,
//     altitudes, clock times on the day-arc, ratings, section indices) but
//     `--font-mono` was never defined, so all of it fell through to whatever
//     monospace the visitor's OS ships — SF Mono on a Mac, Consolas on
//     Windows. The brand's most distinctive texture was unbranded and
//     different on every device. Space Mono's slightly mechanical, retro cut
//     is exactly the "instrument readout" the design was reaching for.
const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-display',
  display: 'swap',
})

const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

// Space Mono is not a variable font, so the weights have to be named.
const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-mono',
  display: 'swap',
})

// The Trek Buddy stack — Newsreader, Inter and IBM Plex Mono — used to be
// declared here, so every page on the site preloaded all three. Measured on
// the homepage: 205.6 KB of a 324 KB font payload rendering zero glyphs,
// because they are wired to `--font-tb-*` and those variables are only read
// inside `.trek-scope`, which the homepage never renders. They now live in
// `app/trek-fonts.ts` and are applied by the two surfaces that use them.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dewdropz.shop'

// ─── Metadata ────────────────────────────────────────────────────────────────
// What was here: a title and a description, and nothing else. No
// `metadataBase`, no `openGraph`, no image, no canonical — so every share of
// this domain on WhatsApp, which is how a brand like this actually travels in
// India, rendered as a grey rectangle.
//
// The description also read "Premium Indian outdoor trekking and adventure
// gear", for a business whose own hero spends a paragraph explaining that it
// is not an expedition outfitter: it prints apparel and drinkware to order.
// The one line Google shows was advertising a different shop.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'DEWDROPZ — mountain-inspired apparel, printed to order',
    template: '%s · DEWDROPZ',
  },
  description:
    'Heavyweight blanks and drinkware, cut oversized and printed one at a time in Dehradun. Put your own artwork on any of them. Cash on delivery across India.',
  applicationName: 'DEWDROPZ',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'DEWDROPZ',
    locale: 'en_IN',
    url: '/',
    title: 'DEWDROPZ — mountain-inspired apparel, printed to order',
    description:
      'Heavyweight blanks and drinkware, printed one at a time in Dehradun. Put your own artwork on any of them.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DEWDROPZ — mountain-inspired apparel, printed to order',
    description:
      'Heavyweight blanks and drinkware, printed one at a time in Dehradun. Put your own artwork on any of them.',
  },
  robots: { index: true, follow: true },
}

// The browser chrome on Android matches the hero's ground instead of flashing
// cream above a near-black page during load.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8F5ED' },
    { media: '(prefers-color-scheme: dark)', color: '#101E17' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${archivo.variable} ${spaceMono.variable}`}>
      <body className="bg-paper text-text antialiased">
        {/* The first tab stop on every page. There were nineteen tab stops
            between the top of the homepage and its <h1>, and no way past
            them — `grep -rni skip` across the layout, the page and
            components/layout/ returned nothing. */}
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <AnalyticsProvider>
          <WishlistProvider>
            <CartProvider>
              <IntroProvider>
                <Preloader />
                <CustomCursor />
                <Grain />
                <LenisProvider>{children}</LenisProvider>
                {/* sonner has been a dependency for this project's whole life
                    and <Toaster/> was mounted only in /admin and /trek-buddy,
                    so every toast fired from the storefront rendered nothing.
                    The cart could change with no confirmation of any kind. */}
                <ShopToaster />
              </IntroProvider>
            </CartProvider>
          </WishlistProvider>
        </AnalyticsProvider>
      </body>
    </html>
  )
}
