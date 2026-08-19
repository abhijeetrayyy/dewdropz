'use client'

import Link from 'next/link'
import { useEffect } from 'react'

// Something went wrong, said in the product's own voice rather than Next's.
export default function TrekBuddyError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[trek-buddy]', error)
  }, [error])

  return (
    <section className="trek-band flex min-h-[70vh] items-center bg-ink py-32">
      <div className="trek-measure max-w-xl">
        {/* A failure is not an emergency. This eyebrow was mono at 0.28em in
            amber, which borrowed the one colour the reset reserves for a clock
            actually running — a countdown, an unread, a host waiting. Sage is
            the accent on an ink band, and the eyebrow is a real eyebrow now. */}
        <p className="trek-eyebrow text-sage">
          The board did not load
        </p>
        <h1 className="mt-4 font-display text-[clamp(30px,4vw,44px)] leading-none text-paper">
          That is on us, not on you.
        </h1>
        <p className="mt-4 font-body text-sm leading-relaxed text-paper/65">
          Nothing you did caused this and nothing you posted is lost. Try again — and if it keeps
          happening, the walks are still where you left them.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          {/* Was a hand-rolled amber pill in uppercase semibold. On an ink band
              the one act is `trek-pill-actinv` — paper fill, ink type — and
              buttons are sentence case, so the shouting goes. */}
          <button onClick={reset} className="trek-pill trek-pill-actinv">
            Try again
          </button>
          <Link
            href="/trek-buddy"
            className="self-center border-b border-paper/25 pb-1 font-body text-[13px] text-paper/65 transition-colors hover:text-paper"
          >
            Back to the board →
          </Link>
        </div>
      </div>
    </section>
  )
}
