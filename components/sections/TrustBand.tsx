import { TRUST_POINTS } from '@/lib/constants'

// Deliberately the quietest section on the page — four logistics facts in one
// thin strip. It answers the "will it arrive / can I return it / will it survive"
// anxieties right after the hero, before asking the visitor to feel anything else.
// On phones the five items would wrap into a three-line blob, so the strip stays
// a single swipeable line instead (scrollbar hidden, edges hinting at more).
export default function TrustBand() {
  return (
    <section className="bg-forest py-5 overflow-hidden">
      <ul className="max-w-6xl mx-auto flex items-center gap-x-8 md:gap-x-10 px-6 md:px-10 overflow-x-auto whitespace-nowrap md:flex-wrap md:justify-center md:overflow-visible md:whitespace-normal [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <li className="flex-shrink-0 font-mono text-[10px] tracking-[0.2em] uppercase text-sage">
          05:50 — The brief
        </li>
        {TRUST_POINTS.map((point) => (
          <li
            key={point}
            className="flex flex-shrink-0 items-center gap-2.5 font-body text-[10px] tracking-[0.14em] uppercase text-paper/85"
          >
            <span className="h-1 w-1 rounded-full bg-sage" aria-hidden="true" />
            {point}
          </li>
        ))}
      </ul>
    </section>
  )
}
