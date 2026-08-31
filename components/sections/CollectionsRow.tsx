import SectionHeader from '@/components/SectionHeader'
import { stopEyebrow, type TrailStop } from '@/lib/trail'
import Image from 'next/image'
import Link from 'next/link'
import { BLUR_DATA_URL } from '@/lib/constants'
import type { Collection } from '@/types/database'

// The terrain flythrough above sells the two mountain collections in-world;
// this compact row is where that journey lands — all three kits side by side
// (including O Collection's desert range, which doesn't belong on that terrain)
// in half a screen instead of the three full pinned slides it used to take.
//
// `featuredSlugs` is admin-editable (store_settings.home_config) — empty
// means "show every active collection", so this behaves exactly as it always
// did until someone actually picks a subset from /admin/settings.
/**
 * Which collections lead the homepage, in the admin's order.
 *
 * Exported because the hero's second act shows the same three plates a few
 * hundred pixels above this row. Two copies of "empty means show all" is how
 * the front door ends up advertising one set of ranges in the film and a
 * different set in the index directly under it.
 */
export function pickCollections(collections: Collection[], featuredSlugs: string[] = []): Collection[] {
  if (featuredSlugs.length === 0) return collections
  return featuredSlugs
    .map((slug) => collections.find((c) => c.slug === slug))
    .filter((c): c is Collection => Boolean(c))
}

export default function CollectionsRow({
  collections,
  featuredSlugs = [],
  stop,
}: {
  collections: Collection[]
  featuredSlugs?: string[]
  /** The day-arc stop, from lib/trail.ts via app/page.tsx. This section used
   *  to print "11:00 · The Ridge" from a string literal while the rail beside
   *  it read 05:50 off the wrapper — a 5h10 contradiction, both visible at
   *  once on a wide screen. */
  stop: TrailStop
}) {
  const shown = pickCollections(collections, featuredSlugs)

  if (shown.length === 0) return null

  return (
    // Midday on the page's clock — the brightest stop of the day arc.
    // 11:00 · the ridge. Takes `paper-deep` rather than `paper`: The Climb sits
    // directly above on the same ground, and two adjacent sections at identical
    // value read as one long block with a heading dropped in the middle of it.
    // The deeper ground also suits the collection photography, which is the
    // heaviest imagery in the light half of the page.
    <section className="bg-snow border-t border-rule px-6 md:px-10 py-20 md:py-24">
      <div className="max-w-measure mx-auto">
        {/* STAMP — a label over a heading, hard left. This section is a list of
            three things, which is exactly what the species is for. Chapter 02 of
            the rotation documented in components/SectionHeader.tsx. */}
        <SectionHeader
          species="stamp"
          eyebrow={stopEyebrow(stop)}
          title="Three collections. One philosophy."
          aside={
            <Link
              href="/collections"
              className="font-body text-xs uppercase tracking-[0.1em] text-forest transition-colors duration-300 hover:text-text"
            >
              View All →
            </Link>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {shown.map((c) => (
            <Link
              key={c.id}
              href={`/collections/${c.slug}`}
              className="group relative aspect-[4/3] md:aspect-[3/4] lg:aspect-[4/3] rounded-[var(--r-card)] overflow-hidden bg-ink"
            >
              {c.image_url && (
                <Image
                  src={c.image_url}
                  alt={c.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  placeholder="blur"
                  blurDataURL={BLUR_DATA_URL}
                  className="object-cover transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-105"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6">
                <div className="font-body text-[9px] tracking-[0.2em] text-sage uppercase">Collection</div>
                <h3 className="font-display text-2xl text-paper mt-1">{c.name}</h3>
                {c.tagline && <p className="font-body text-xs text-paper/60 mt-1 italic">{c.tagline}</p>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
