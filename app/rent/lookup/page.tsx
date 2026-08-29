import type { Metadata } from 'next'
import Link from 'next/link'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import LookupClient from './LookupClient'

export const metadata: Metadata = {
  title: 'Find your booking — DEWDROPZ',
  description: 'Look up a gear booking with its number and the email it was made under.',
}

/**
 * For bookings made without an account.
 *
 * Renting does not require signing in, and "your rentals" does — so a guest
 * booking was invisible to the person who made it. Two factors, because a
 * booking number is printed, read aloud and emailed, and is therefore not a
 * secret on its own.
 */
export default function RentalLookupPage() {
  return (
    <>
      <NavBar />
      <main className="bg-paper">
        <div className="mx-auto max-w-3xl px-6 pb-24 pt-28 sm:pt-32">
          <Link href="/rent" className="font-mono text-[11px] uppercase tracking-[0.14em] text-mid hover:text-forest">
            ← The gear locker
          </Link>
          <h1 className="mt-6 font-display text-4xl leading-tight text-ink">Find your booking.</h1>
          <p className="mt-3 max-w-prose font-body text-mid">
            Booked without an account? Enter the number from your confirmation and the email you
            used. If you have an account, your bookings are already on{' '}
            <Link href="/account/rentals" className="text-forest underline underline-offset-4">your rentals</Link>.
          </p>

          <LookupClient />
        </div>
      </main>
      <FooterSection />
    </>
  )
}
