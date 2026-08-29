import Link from 'next/link'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'

/** Deliberately says what happens NEXT, not just "thanks". A hire has a
 *  handover, a deposit and a return date — none of which have happened yet. */
export default async function RentBookedPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params
  return (
    <>
      <NavBar />
      <main className="bg-paper">
        <div className="mx-auto max-w-2xl px-6 pb-24 pt-32">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-sage">Reserved</p>
          <h1 className="mt-3 font-display text-4xl leading-tight text-ink">The gear is held for you.</h1>
          <p className="mt-3 font-mono text-sm text-ink">{number}</p>

          <p className="mt-5 font-body text-[14px] leading-relaxed text-mid">
            Keep this number. You can{' '}
            <Link href="/rent/lookup" className="text-forest underline underline-offset-4">look it up any time</Link>{' '}
            with the email you used — and if you make an account with that address, it appears under
            your rentals automatically.
          </p>

          <ol className="mt-8 space-y-4 border-t border-rule pt-6 font-body text-[15px] text-mid">
            <li><strong className="text-ink">We confirm by email.</strong> Bring the booking number.</li>
            <li><strong className="text-ink">You pay on handover.</strong> The rental and the refundable deposit, together, when you collect or when it is delivered.</li>
            <li><strong className="text-ink">Bring it back by the end date.</strong> A late return is charged at the daily rate, capped at the deposit.</li>
            <li><strong className="text-ink">Your deposit comes back</strong> once it has been checked — less anything owed, itemised.</li>
          </ol>

          <Link href="/rent" className="mt-8 inline-block font-body text-sm text-forest underline underline-offset-4">
            Rent something else
          </Link>
        </div>
      </main>
      <FooterSection />
    </>
  )
}
