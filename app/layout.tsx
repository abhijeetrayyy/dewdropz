import type { Metadata } from 'next'
import { Fraunces, Inter } from 'next/font/google'
import LenisProvider from '@/providers/LenisProvider'
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
        <LenisProvider>{children}</LenisProvider>
      </body>
    </html>
  )
}
