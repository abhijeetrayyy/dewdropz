import type { Metadata } from 'next'
import { Fraunces, Inter } from 'next/font/google'
import LenisProvider from '@/providers/LenisProvider'
import { IntroProvider } from '@/providers/IntroProvider'
import { CartProvider } from '@/providers/CartProvider'
import Preloader from '@/components/Preloader'
import CustomCursor from '@/components/CustomCursor'
import Grain from '@/components/Grain'
import AnalyticsProvider from '@/providers/AnalyticsProvider'
import { WishlistProvider } from '@/providers/WishlistProvider'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-display',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
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
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
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
