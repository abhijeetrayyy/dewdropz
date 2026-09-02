import type { Metadata } from 'next'
import Link from 'next/link'
import WhatTheBoardDoes from '@/components/trek/WhatTheBoardDoes'
import SafetyNotes from '@/components/trek/SafetyNotes'
import JourneyRail from '@/components/trek/ui/JourneyRail'

// Everything the landing page used to say, in full, in one place.
//
// INDEXABLE, unlike every other page under /trek-buddy. There is no member and
// no trip on it — it is the product's account of what it enforces and where
// that stops, which is exactly the thing a stranger should be able to find
// without an account. `robots.ts` carries a specific `Allow` for this path that
// beats the blanket `Disallow: /trek-buddy/`.
export const metadata: Metadata = {
  title: 'What TrekBuddy enforces, and where it stops — DEWDROPZ',
  description:
    'The full account: six rules the database enforces, four places it stops, six things to do before you go, and the questions people actually ask.',
  alternates: { canonical: '/trek-buddy/safety' },
}

// WHY THIS PAGE EXISTS, and what it is not.
//
// It is not new writing. Every word here was already on the signed-out landing
// page, and it is reproduced whole — the six enforced rules with their bodies,
// the four limits with theirs, the six take-care notes, and the four questions
// whose honest answers are the reason people trust this thing.
//
// What changed is where it sits. That landing page ran to roughly 2,400 words,
// 36% of its sentences carried a negation, and four of its nine sections were
// framed by what the product is not or cannot do. Somebody arriving to find out
// whether they could go for a walk with people read, in order: what this is not,
// where enforcement stops, six things that are your job and not ours, and a
// question-and-answer whose first word is "Nobody."
//
// That is a risk disclosure, and it was standing where the reason should be.
//
// The honesty is this product's best asset and none of it is deleted. It is
// moved one click away, complete, linked from the landing, from onboarding and
// from every trip — and it is now the only page under /trek-buddy a search
// engine is allowed to read, which is a stronger position than being the fifth
// section of a page nobody finished.
const QUESTIONS: { q: string; a: string }[] = [
  {
    q: 'Does it cost anything?',
    a: 'No. Nobody pays for a place and DEWDROPZ takes no cut. Some trips split real costs at face value — fuel, a permit, a shared cab — and the amount is on the card before you ask. The platform holds no money.',
  },
  {
    q: 'Who is checking that these people are who they say they are?',
    a: 'Nobody. The platform verifies actions, never identities — that a number is held, that a trip was completed, that a vouch came from somebody who was there. It cannot verify a name, an age, or fitness. Everyone here is a stranger until you have walked together.',
  },
  {
    q: 'What stops somebody just turning up?',
    a: 'The exact meeting point is not on the public page. It is released to confirmed members only, and only once the trip has enough people going — so a trip nobody joins hands its address to nobody. A host confirms each person individually, and declining is silent.',
  },
  {
    q: 'Can I bring a friend?',
    a: 'Yes, and there is an invite card for exactly that. Anybody can open the public page of a trip; the meeting point stays hidden until the host confirms them, the same as for anyone else.',
  },
  {
    q: 'What happens if a trip is called off?',
    a: 'Everybody confirmed is told immediately, with the host’s reason. A cancelled trip leaves the board for everyone. Better a cancelled sunrise than a group waiting at a dark bus stand.',
  },
  {
    q: 'Is DEWDROPZ organising these?',
    a: 'No. DEWDROPZ makes and sells outdoor gear, and this board is a place its members use to find each other. Nobody from the company organises, leads, vets or supervises any of it, and no one is watching a screen while you are out. In an emergency, call 112.',
  },
]

export default function SafetyPage() {
  return (
    <>
      <section className="trek-band bg-ink pb-14 pt-28 md:pt-32">
        <div className="trek-measure">
          <p className="trek-eyebrow text-sage">The whole of it</p>
          <h1 className="trek-h1 mt-4 max-w-[22ch] text-balance text-paper">
            What this board enforces, and where that enforcement stops.
          </h1>
          <p className="mt-5 max-w-xl font-body text-[16px] leading-[1.7] text-paper/75">
            Both halves get the same width and the same weight. Only one of them is reassuring,
            and you need the other one more.
          </p>
          <Link
            href="/trek-buddy"
            className="trek-pill trek-pill-onink mt-8 font-body"
          >
            ← Back to TrekBuddy
          </Link>
        </div>
      </section>

      {/* One trip, end to end. It sits above the rules because the rules are
          about the moments in it, and a reader who has not seen the sequence is
          being handed answers to questions they have not formed. */}
      <section className="trek-band border-b border-rule-warm bg-paper-warm py-14 md:py-16">
        <div className="trek-measure">
          <p className="trek-eyebrow text-forest">End to end</p>
          <h2 className="trek-h2 mt-4 max-w-2xl text-text">
            One trip, from the moment you see it to the moment you vouch for the people you did it
            with.
          </h2>
          <div className="mt-9 rounded-[var(--r-panel)] border border-rule bg-surface p-6 md:p-9">
            <JourneyRail stage="vouched" showNotes />
          </div>
        </div>
      </section>

      <section className="trek-band bg-paper py-14 md:py-16">
        <div className="trek-measure">
          {/* Bodies open, not folded. On the landing these were behind a
              disclosure so the titles could carry the argument at a glance;
              here there is nothing else competing, and a limit nobody opens is
              a limit nobody was told. */}
          <WhatTheBoardDoes />
        </div>
      </section>

      <section className="trek-band border-y border-rule-warm bg-paper-warm py-14 md:py-16">
        <div className="trek-measure">
          <SafetyNotes />
        </div>
      </section>

      <section className="trek-band bg-paper py-16 md:py-20">
        <div className="trek-measure grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-16">
          <div>
            <p className="trek-eyebrow text-forest">Questions</p>
            <h2 className="trek-h2 mt-4 text-text">
              The ones people actually ask, answered without hedging.
            </h2>
          </div>

          <div className="border-t border-rule">
            {QUESTIONS.map((item) => (
              <details key={item.q} className="group border-b border-rule">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 font-body text-[16px] font-medium text-text transition-colors hover:text-forest [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span
                    aria-hidden="true"
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-rule text-mid transition-transform duration-200 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="max-w-2xl pb-6 font-body text-[14.5px] leading-[1.7] text-mid">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="trek-band bg-ink py-14 md:py-16">
        <div className="trek-measure flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <p className="max-w-xl font-body text-[15px] leading-relaxed text-paper/70">
            In an emergency, call <span className="font-mono text-paper">112</span>. It works from
            any phone in India. DEWDROPZ does not receive it and cannot help you on a hillside.
          </p>
          <Link href="/trek-buddy" className="trek-pill trek-pill-actinv font-body">
            See what is on
          </Link>
        </div>
      </section>
    </>
  )
}
