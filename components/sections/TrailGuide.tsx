import Image from 'next/image'
import { BLUR_DATA_URL, TRAILS } from '@/lib/constants'
import { ContourLines } from '@/components/ui/ContourLines'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// A reference guide to the trails this gear was built on — not a booking page.
// The old version sold departures with prices, dates and "2 spots left"; this
// one answers the three questions someone actually has before a first
// Himalayan trek: how hard is it, when do I go, and what will I see.
//
// The month strip is the centrepiece. Season is the single most consequential
// decision on any of these trails — the same route is a snow climb in January
// and a meadow walk in September — and a row of twelve cells communicates that
// faster than a sentence ever does.
export default function TrailGuide() {
  return (
    <section className="relative overflow-hidden bg-[#F6F0E2] px-6 py-20 md:px-10 md:py-24">
      <ContourLines className="opacity-[0.10]" />

      <div className="relative mx-auto max-w-6xl space-y-14 md:space-y-20">
        {TRAILS.map((trail, i) => (
          <article
            key={trail.slug}
            className="grid grid-cols-1 gap-7 border-t border-forest/15 pt-10 md:grid-cols-[0.85fr_1fr] md:gap-10 lg:gap-14"
          >
            {/* Plate */}
            <div className="relative">
              <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-[#E4DAC4] md:aspect-[3/4]">
                <Image
                  src={trail.image}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 40vw"
                  placeholder="blur"
                  blurDataURL={BLUR_DATA_URL}
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/55 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper/70">
                    {String(i + 1).padStart(2, '0')} · {trail.region}
                  </div>
                </div>
              </div>
            </div>

            {/* The entry */}
            <div className="min-w-0">
              <h2 className="font-display text-[clamp(26px,3.6vw,40px)] leading-[1.05] text-text">{trail.name}</h2>

              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-y border-forest/15 py-4 sm:grid-cols-4">
                <Fact k="Altitude" v={trail.altitude} />
                <Fact k="Difficulty" v={trail.difficulty} />
                <Fact k="On foot" v={trail.duration} />
                <Fact k="Base" v={trail.base} />
              </dl>

              <p className="mt-5 font-body text-sm leading-relaxed text-mid md:text-[15px]">{trail.why}</p>

              {/* When to go */}
              <div className="mt-7">
                <div className="font-body text-[10px] uppercase tracking-[0.18em] text-forest">When to go</div>
                <ul className="mt-2.5 flex gap-1" aria-label="Best months">
                  {MONTHS.map((m) => {
                    const good = (trail.bestMonths as readonly string[]).includes(m)
                    return (
                      <li
                        key={m}
                        // Colour alone can't carry this, so the good months also
                        // get weight and full opacity on the label itself.
                        className={`flex-1 rounded-[2px] px-0.5 py-1.5 text-center font-mono text-[9px] uppercase ${
                          good ? 'bg-forest text-paper' : 'bg-forest/[0.07] text-mid/40'
                        }`}
                        title={good ? `${m} — good` : `${m} — not the season`}
                      >
                        {m[0]}
                        <span className="sr-only">{m}{good ? ' — good month' : ' — out of season'}</span>
                      </li>
                    )
                  })}
                </ul>
                <p className="mt-2.5 font-body text-[13px] leading-relaxed text-mid">{trail.season}</p>
              </div>

              {/* What you pass */}
              <div className="mt-7">
                <div className="font-body text-[10px] uppercase tracking-[0.18em] text-forest">What you pass</div>
                <ul className="mt-2.5 space-y-2">
                  {trail.sights.map((s) => (
                    <li key={s.name} className="flex gap-3 font-body text-[13px] leading-relaxed">
                      <span aria-hidden className="mt-[7px] h-1 w-1 flex-shrink-0 rounded-full bg-sage" />
                      <span>
                        <span className="text-text">{s.name}</span>
                        <span className="text-mid"> — {s.note}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Restrictions are the one thing a guide must not bury. */}
              {'access' in trail && trail.access && (
                <p className="mt-6 rounded-sm border-l-2 border-clay bg-clay/[0.07] px-4 py-3 font-body text-[12.5px] leading-relaxed text-mid">
                  <span className="font-medium text-text">Before you go — </span>
                  {trail.access}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-body text-[9px] uppercase tracking-[0.16em] text-mid/60">{k}</dt>
      <dd className="mt-1 truncate font-body text-[13px] text-text">{v}</dd>
    </div>
  )
}
