import Link from 'next/link'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'

/** Deliberately says what happens NEXT, not just "thanks". A rental has a
 *  handover, a deposit and a return date — none of which have happened yet.
 *
 *  Reached only after `verifyRentalPayment` has confirmed the money, so it can
 *  say "paid" without asking the database again. Everything it asserts is true
 *  of every booking that legitimately arrives here; nothing on it depends on a
 *  value it has not been given. */
export default async function RentBookedPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params
  return (
    <>
      <NavBar />
      <main id="main" className="bg-paper">
        <div className="mx-auto max-w-2xl px-6 pb-24 pt-32">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-forest">Paid &amp; reserved</p>
          <h1 className="mt-3 font-display text-4xl leading-tight text-ink">The gear is yours for those dates.</h1>
          <p className="mt-3 font-mono text-sm text-ink">{number}</p>

          <p className="mt-5 font-body text-[14px] leading-relaxed text-mid">
            Keep this number. You can{' '}
            <Link href="/rent/lookup" className="text-forest underline underline-offset-4">look it up any time</Link>{' '}
            with the email you used — and if you make an account with that address, it appears under
            your rentals automatically.
          </p>

          {/* The steps a person actually has left. The old list opened with
              "you pay on handover", which stopped being true the moment paying
              became how a reservation is made — and it was the FIRST thing this
              page said to somebody who had just paid. */}
          <ol className="mt-8 space-y-4 border-t border-rule pt-6 font-body text-[15px] text-mid">
            <li><strong className="text-ink">The rental is paid.</strong> A receipt and a GST invoice are on their way to your email.</li>
            <li><strong className="text-ink">The deposit comes later.</strong> Refundable, handed over at the counter when you collect — or taken separately before we post it. It is not a charge.</li>
            <li><strong className="text-ink">Bring it back by the end date.</strong> A late return is charged at the daily rate, capped at the deposit.</li>
            <li><strong className="text-ink">Your deposit comes back</strong> once the gear has been checked — less anything owed, itemised.</li>
          </ol>

          <p className="mt-6 rounded-[var(--r-panel)] border border-rule bg-paper-deep/40 p-4 font-body text-[14px] leading-relaxed text-mid">
            Changed your mind? You can cancel from{' '}
            <Link href="/account/rentals" className="text-forest underline underline-offset-4">your rentals</Link>,
            and the exact refund is shown before you confirm. Cancel within a day and everything
            comes back; the deposit always does.{' '}
            <Link href="/rent/terms" className="text-forest underline underline-offset-4">The terms</Link>.
          </p>

          <Link href="/rent" className="mt-8 inline-block font-body text-sm text-forest underline underline-offset-4">
            Rent something else
          </Link>
        </div>
      </main>
      <FooterSection />
    </>
  )
}
