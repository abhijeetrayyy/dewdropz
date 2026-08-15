import { TRUST_POINTS } from '@/lib/constants'

// 05:50 — first light, and the page's first light ground.
//
// This was a solid block of `dawn` (#E39B3F): a saturated signal-orange strip
// immediately after a deliberately restrained hero, which read as a promo banner
// rather than as part of the brand. Its actual job is only to break the dark run
// of sections beneath it, and warm paper does that without shouting. What is
// left of the sunrise is a single hairline of real dawn across the top — light
// arriving at an edge, which is what first light looks like.
//
// The content was four identical uppercase strings wrapped inline (and on phones,
// a horizontal scroll strip that hid half of them). Now each is a label and a
// value in a four-up band, so the eye gets hierarchy instead of a hedge of small
// caps — and on phones it is a 2x2 grid where everything is visible at once
// rather than something you have to discover by swiping.
export default function TrustBand() {
  return (
    <section className="relative bg-paper-warm">
      {/* First light, as an edge rather than a fill. */}
      <div
        aria-hidden
        className="h-[3px] w-full"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, #E39B3F 22%, #F6DCA8 50%, #E39B3F 78%, transparent 100%)',
        }}
      />

      <ul className="mx-auto grid max-w-6xl grid-cols-2 px-6 md:grid-cols-4 md:px-10">
        {TRUST_POINTS.map((point, i) => (
          <li
            key={point.label}
            className={`border-rule-warm px-1 py-6 md:px-6 md:py-7 ${
              i > 1 ? 'border-t' : ''
            } ${i % 2 === 1 ? 'border-l' : ''} md:border-t-0 ${
              i === 0 ? 'md:border-l-0' : 'md:border-l'
            } ${i % 2 === 1 ? 'pl-5 md:pl-6' : ''}`}
          >
            <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-ember">
              {point.label}
            </div>
            <div className="mt-2 font-body text-[13px] leading-snug text-forest-deep md:text-sm">
              {point.value}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
