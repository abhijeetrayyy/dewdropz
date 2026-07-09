import { TRUST_POINTS } from '@/lib/constants'

// Deliberately the quietest section on the page — four logistics facts in one
// thin strip. It answers the "will it arrive / can I return it / will it survive"
// anxieties right after the hero, before asking the visitor to feel anything else.
export default function TrustBand() {
  return (
    <section className="bg-forest px-6 md:px-10 py-5">
      <ul className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-x-10 gap-y-2">
        {TRUST_POINTS.map((point) => (
          <li
            key={point}
            className="flex items-center gap-2.5 font-body text-[10px] tracking-[0.14em] uppercase text-paper/85"
          >
            <span className="h-1 w-1 rounded-full bg-sage" aria-hidden="true" />
            {point}
          </li>
        ))}
      </ul>
    </section>
  )
}
