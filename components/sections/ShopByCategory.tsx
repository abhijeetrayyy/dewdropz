import { stopEyebrow, type TrailStop } from '@/lib/trail'
import Image from 'next/image'
import Link from 'next/link'
import { BLUR_DATA_URL } from '@/lib/constants'
import type { Category, ProductWithCollection } from '@/types/database'

// The packer's entry point. The hero serves the dreamer; this serves the person
// with a trek booked in three weeks and a checklist — straight lines into the
// catalogue by what they need, before any more storytelling.

/**
 * Which tiles this section shows.
 *
 * Exported because `app/page.tsx` has to know the answer BEFORE rendering: the
 * section sits inside a `data-trail-*` wrapper that puts a chapter on the trail
 * HUD, so a page that guesses differently from the section advertises a stop
 * that is not on the page. One function, both callers.
 *
 * THE STOCK RULE, AND WHEN IT DOES NOT APPLY
 *
 * A tile with nothing behind it is a dead end — tap "Bottles", land on an empty
 * shop. So the default ("show every active category") is still filtered down to
 * categories that actually have products in them.
 *
 * But `featuredSlugs` is not a default: it is somebody in /admin/settings
 * naming exactly which tiles this section carries. The 23 August brief does
 * precisely that — "In this section keep Caps, Coffee Mugs, Bottles, Tumblers
 * (4 Items)" — for a range that is still being photographed and listed. An
 * explicit editorial pick is honoured as given, and the tiles say "Coming soon"
 * rather than a piece count, which the tile has always known how to render.
 */
export function pickEssentials(
  categories: Category[],
  products: ProductWithCollection[],
  featuredSlugs: string[] = []
): Category[] {
  if (featuredSlugs.length) {
    return featuredSlugs
      .map((s) => categories.find((c) => c.slug === s))
      .filter((c): c is Category => Boolean(c))
  }
  return categories.filter((tile) =>
    products.some((p) => p.categories?.some((pc) => pc.category_id === tile.id))
  )
}

export default function ShopByCategory({
  categories,
  products,
  featuredSlugs = [],
  stop,
}: {
  categories: Category[]
  products: ProductWithCollection[]
  /** Admin's pick, in their order. Empty = every active category that has
   *  stock, which is what this section did before the setting existed. See
   *  `pickEssentials` for why a non-empty pick skips the stock filter. */
  featuredSlugs?: string[]
  /** The day-arc stop. Was the literal "13:00 · Pack Check" under a wrapper
   *  that said 06:40 — the largest of the four drifts at 6h20. */
  stop: TrailStop
}) {
  const stocked = pickEssentials(categories, products, featuredSlugs)

  if (stocked.length === 0) return null

  return (
    // Early afternoon on the page's clock — paper warms a step past midday.
    <section className="bg-paper-warm px-6 md:px-10 pt-20 pb-24 md:pt-24">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12 flex items-end justify-between">
          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-forest uppercase">{stopEyebrow(stop)}</div>
            <h2 className="font-display text-[clamp(34px,5vw,54px)] text-text mt-2">
              Choose Your Essentials
            </h2>
            <p className="mt-3 font-display italic text-base text-mid max-w-md">
              Trail Companions — From the cap on your head to the bottle in your pack.
            </p>
          </div>
          <Link
            href="/shop"
            className="hidden md:inline-block font-body text-xs tracking-[0.1em] text-forest uppercase hover:text-text transition-colors duration-300"
          >
            Browse Everything →
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {stocked.map((tile) => {
            const count = products.filter((p) => p.categories?.some((pc) => pc.category_id === tile.id)).length
            return (
              <Link
                key={tile.id}
                href={`/shop?category=${tile.slug}`}
                className="group relative aspect-[4/5] rounded-[var(--r-card)] overflow-hidden bg-ink/60"
              >
                {tile.image_url && (
                  <Image
                    src={tile.image_url}
                    alt={tile.name}
                    fill
                    sizes="(max-width: 1024px) 50vw, 25vw"
                    placeholder="blur"
                    blurDataURL={BLUR_DATA_URL}
                    className="object-cover transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
                  <div className="font-body text-[9px] tracking-[0.2em] text-sage uppercase">
                    {count === 0 ? 'Coming soon' : `${count} ${count === 1 ? 'piece' : 'pieces'}`}
                  </div>
                  <h3 className="font-display text-xl md:text-2xl text-paper mt-1 leading-tight">
                    {tile.name}
                  </h3>
                  {tile.description && (
                    <p className="font-body text-xs text-paper/60 mt-1.5 leading-relaxed hidden sm:block">
                      {tile.description}
                    </p>
                  )}
                  <span className="mt-3 inline-block font-body text-[10px] tracking-[0.12em] uppercase text-paper/80 border-b border-sage/50 pb-0.5 transition-colors duration-300 group-hover:text-paper group-hover:border-sage">
                    {/* The whole name, not `name.split(' ')[0]`. With the four
                        essentials in place that first word was doing real
                        damage: "Coffee Mugs" advertised itself as "Shop
                        Coffee", which is a thing this shop does not sell. */}
                    Shop {tile.name} →
                  </span>
                </div>
              </Link>
            )
          })}
        </div>

        <Link
          href="/shop"
          className="mt-8 md:hidden block text-center font-body text-xs tracking-[0.1em] text-forest uppercase"
        >
          Browse Everything →
        </Link>
      </div>
    </section>
  )
}
