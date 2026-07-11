import Image from 'next/image'
import Link from 'next/link'
import { BLUR_DATA_URL, COLLECTIONS } from '@/lib/constants'

// The terrain flythrough above sells the two mountain collections in-world;
// this compact row is where that journey lands — all three kits side by side
// (including O Collection's desert range, which doesn't belong on that terrain)
// in half a screen instead of the three full pinned slides it used to take.
export default function CollectionsRow() {
  return (
    // Midday on the page's clock — the brightest stop of the day arc.
    <section className="bg-paper px-6 md:px-10 py-20 md:py-24">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-forest uppercase">11:00 · The Ridge</div>
            <h2 className="font-display text-[clamp(30px,4.4vw,46px)] text-text mt-2">
              Three conditions. Three kits.
            </h2>
          </div>
          <Link
            href="/collections"
            data-cursor="view"
            data-cursor-text="View"
            className="hidden md:inline-block font-body text-xs tracking-[0.1em] text-forest uppercase hover:text-text transition-colors duration-300"
          >
            View All →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {COLLECTIONS.map((c) => (
            <Link
              key={c.id}
              href={`/collections/${c.id}`}
              data-cursor="view"
              data-cursor-text="Explore"
              className="group relative aspect-[4/3] md:aspect-[3/4] lg:aspect-[4/3] rounded-sm overflow-hidden"
            >
              <Image
                src={c.image}
                alt={c.name}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                className="object-cover transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6">
                <div className="font-body text-[9px] tracking-[0.2em] text-sage uppercase">{c.bestFor}</div>
                <h3 className="font-display text-2xl text-paper mt-1">{c.name}</h3>
                <p className="font-body text-xs text-paper/60 mt-1 italic">{c.tagline}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
