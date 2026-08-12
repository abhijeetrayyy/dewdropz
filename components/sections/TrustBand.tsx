import { TRUST_POINTS } from '@/lib/constants'

// 05:50 — first light. The one strip of warm colour on the page.
//
// This used to be a fourth consecutive dark band (hero green → forest → navy →
// forest), four sections at nearly the same value with no rhythm between them.
// It is also, narratively, the exact moment the sun arrives — so it takes the
// `dawn` ground instead. Two jobs at once: it breaks the dark run, and it makes
// the page's own story legible in colour rather than only in the HUD's clock.
//
// The content stays deliberately plain — four logistics facts answering the
// "will it arrive / can I return it / will it survive" anxieties right after the
// hero. On phones the items would wrap into a three-line blob, so the strip
// stays a single swipeable line (scrollbar hidden, edges hinting at more).
export default function TrustBand() {
  return (
    <section className="relative overflow-hidden bg-dawn py-5">
      {/* A low sun-flare across the strip, so the amber reads as light rather
          than as a flat block of brand colour. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-1/4 w-1/2 bg-[radial-gradient(ellipse_at_center,rgba(255,241,214,0.55),transparent_70%)]"
      />
      <ul className="relative mx-auto flex max-w-6xl items-center gap-x-8 overflow-x-auto whitespace-nowrap px-6 md:flex-wrap md:justify-center md:gap-x-10 md:overflow-visible md:whitespace-normal md:px-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <li className="flex-shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-ember">
          05:50 — First light
        </li>
        {TRUST_POINTS.map((point) => (
          <li
            key={point}
            className="flex flex-shrink-0 items-center gap-2.5 font-body text-[10px] font-medium uppercase tracking-[0.14em] text-forest-deep"
          >
            <span className="h-1 w-1 rounded-full bg-ember" aria-hidden="true" />
            {point}
          </li>
        ))}
      </ul>
    </section>
  )
}
