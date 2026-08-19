import type { Metadata } from 'next'
import { Fraunces, Archivo, Space_Mono, Newsreader, Inter, IBM_Plex_Mono } from 'next/font/google'
import LenisProvider from '@/providers/LenisProvider'
import { IntroProvider } from '@/providers/IntroProvider'
import { CartProvider } from '@/providers/CartProvider'
import Preloader from '@/components/Preloader'
import CustomCursor from '@/components/CustomCursor'
import Grain from '@/components/Grain'
import AnalyticsProvider from '@/providers/AnalyticsProvider'
import { WishlistProvider } from '@/providers/WishlistProvider'
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

// ─── The Trek Buddy stack ────────────────────────────────────────────────────
// A second, quieter set of three, scoped to the board and used nowhere else.
//
// The shop's voice is Fraunces and Archivo: a wonky optical serif over an
// industrial gothic, warm and a little aged, with Space Mono's retro cut for
// texture. That is a good voice for a company that prints garments — it is
// characterful, and character is what sells a T-shirt.
//
// It is the wrong voice for this. Trek Buddy is where somebody decides whether
// to get into a car at four in the morning with people they have never met. The
// type there has one job, which is to be believed. Fraunces at 300 weight and
// 100px is a magazine cover; Space Mono on every label reads as a craft studio.
// Neither says "this is a system that will hold when it matters".
//
//   display — Newsreader. A reading serif with a real optical-size axis, drawn
//     for long-form journalism. Set at 400 and 500 rather than hairline, it is
//     sober and adult without being cold, and it carries a 48px headline as a
//     STATEMENT rather than as decoration.
//
//   body — Inter. Deliberately the most neutral interface face there is. The
//     shop rejected Inter precisely because it is the default of every SaaS
//     product of the last five years — and here that is the argument FOR it: an
//     interface people are trusting with a safety decision should recede, and
//     legibility at 13px in bright sun on a hillside beats personality.
//
//   mono — IBM Plex Mono, and used far more sparingly than Space Mono was. A
//     number, a time, a count, a coordinate. Not every label on the screen.
const newsreader = Newsreader({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-tb-display',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-tb-body',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-tb-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'DEWDROPZ — Feel Alive',
  description: 'Premium Indian outdoor trekking and adventure gear.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${archivo.variable} ${spaceMono.variable} ${newsreader.variable} ${inter.variable} ${plexMono.variable}`}>
      <body className="bg-paper text-text antialiased">
        <AnalyticsProvider>
          <WishlistProvider>
            <CartProvider>
              <IntroProvider>
                <Preloader />
                <CustomCursor />
                <Grain />
                <LenisProvider>{children}</LenisProvider>
              </IntroProvider>
            </CartProvider>
          </WishlistProvider>
        </AnalyticsProvider>
      </body>
    </html>
  )
}
