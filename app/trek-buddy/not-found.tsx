import Link from 'next/link'

export default function TrekBuddyNotFound() {
  return (
    <section className="trek-band flex min-h-[70vh] items-center bg-ink py-32">
      <div className="trek-measure max-w-xl">
        {/* Amber here said "hurry" about a walk that is simply not there. The
            eyebrow is sage — the accent on ink — and set as a real eyebrow
            rather than mono tracked to 0.28em. */}
        <p className="trek-eyebrow text-sage">
          Nothing here
        </p>
        <h1 className="mt-4 font-display text-[clamp(30px,4vw,44px)] leading-none text-paper">
          This walk is not on the board.
        </h1>
        <p className="mt-4 font-body text-sm leading-relaxed text-paper/65">
          It may have been called off, or it may never have been yours to see — walks are visible to
          signed-in members, and a cancelled one leaves the board for everyone.
        </p>
        {/* The one act on an ink band is the inverted pill, sentence case. */}
        <Link href="/trek-buddy" className="trek-pill trek-pill-actinv mt-8">
          See what is on
        </Link>
      </div>
    </section>
  )
}
