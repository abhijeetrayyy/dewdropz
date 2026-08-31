import SectionHeader from '@/components/SectionHeader'
import { stopEyebrow, type TrailStop } from '@/lib/trail'
import Image from 'next/image'
import Link from 'next/link'
import { BLUR_DATA_URL } from '@/lib/constants'
import { formatPrice } from '@/lib/utils'
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

  // One pass over the catalogue, not two. `pickEssentials` already scans
  // `products` per category, and the grid then re-scanned it per tile with the
  // identical predicate — the same join answered twice, O(n*m) each time. This
  // folds count, starting price and a fallback photograph out of a single walk.
  //
  // The photograph costs no new query: `images` is already on the product and
  // `products` is already a prop, and `getProducts` orders by `created_at`
  // descending, so `image` really is the newest listing's first frame.
  const summary = new Map<string, { count: number; from: number; image?: string }>()
  for (const product of products) {
    for (const link of product.categories ?? []) {
      const row = summary.get(link.category_id) ?? { count: 0, from: Number.POSITIVE_INFINITY }
      row.count += 1
      if (product.price < row.from) row.from = product.price
      if (!row.image && product.images?.[0]) row.image = product.images[0]
      summary.set(link.category_id, row)
    }
  }
  // Nothing behind any door: every row is a statement rather than a link, so
  // the band would otherwise ship with one click target in it.
  const nothingListed = stocked.every((tile) => (summary.get(tile.id)?.count ?? 0) === 0)

  return (
    // Early afternoon on the page's clock — paper warms a step past midday.
    <section className="bg-mist border-t border-rule px-6 md:px-10 pt-20 pb-24 md:pt-24">
      <div className="max-w-measure mx-auto">
        {/* INDEX — a rule across the full measure with the heading inline on
            it. This is the section a packer with a checklist comes to, and the
            one species that draws the page's own width as a line. It follows a
            stamp and is followed by a statement.

            The link is no longer `hidden md:inline-block`: a phone had no route
            out of this section at all. */}
        <SectionHeader
          species="index"
          no="03"
          eyebrow={stopEyebrow(stop)}
          title="Choose Your Essentials"
          lede="Trail companions — from the cap on your head to the bottle in your pack."
        />

        {/* SPECIMEN CARDS ON A TINTED GROUND.
            Third design for this band, and the reasoning for each move is on
            the record so the next one does not start from zero.

            First it was four `aspect-[4/5]` photo tiles on `bg-ink/60` — a
            photographic grid with no photographs and no data path to any, so
            every tile rendered as a flat grey rectangle reading "Coming soon".
            Then it was hairline rows, which was honest and legible and read as
            a table of contents rather than a shop.

            This is the open version: white cards standing on a green-tinted
            ground, which is the whole page's new direction — the colour does
            the separating and the card does the holding, so nothing needs a
            heavy fill. Held by a shadow and not a border, because Law 2 says a
            card is held by a shadow and a row by a hairline, never both.

            The card works with a photograph and without one. Today there is
            none, so the plate is a wash of the house green at its lightest and
            the type carries the card. The moment a category has an image it
            drops straight in and nothing else moves. */}
        <ul className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stocked.map((tile, i) => {
            const row = summary.get(tile.id)
            const count = row?.count ?? 0
            const src = tile.image_url ?? row?.image ?? null
            const body = (
              <>
                {/* The plate. A photograph when there is one; the house green at
                    its lightest when there is not. No text sits on it, so it
                    carries no contrast obligation either way. */}
                <div className="relative aspect-[5/4] overflow-hidden rounded-[var(--r-input)] bg-[linear-gradient(150deg,var(--sage-soft)_0%,var(--mist)_70%)]">
                  {src && (
                    <Image
                      src={src}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      placeholder="blur"
                      blurDataURL={BLUR_DATA_URL}
                      className="object-cover transition-transform duration-[240ms] ease-[var(--ease-out)] motion-safe:group-hover:scale-[1.03]"
                    />
                  )}
                  <span className="absolute left-3 top-3 font-mono text-[10px] tabular-nums tracking-[0.12em] text-forest">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>

                <h3 className="mt-5 font-display text-[clamp(22px,2vw,28px)] leading-[1.05] text-text transition-colors duration-200 group-hover:text-forest">
                  {tile.name}
                </h3>
                <p className="mt-2 line-clamp-2 font-body text-[13px] leading-relaxed text-mid">
                  {tile.description}
                </p>

                {/* The status sits on the card's floor, so four cards of
                    different copy lengths still line their figures up. */}
                <div className="mt-auto pt-5">
                  {count > 0 ? (
                    <div className="flex items-baseline justify-between border-t border-rule pt-3">
                      <span className="font-mono text-[12px] tabular-nums text-text">
                        From {formatPrice(row?.from ?? 0)}
                      </span>
                      <span className="font-body text-[10px] uppercase tracking-[0.14em] text-forest">
                        <span className="font-mono tabular-nums">{count}</span>{' '}
                        {count === 1 ? 'piece' : 'pieces'}
                        <span className="ml-2 inline-block transition-transform duration-200 ease-[var(--ease-out)] motion-safe:group-hover:translate-x-1">
                          →
                        </span>
                      </span>
                    </div>
                  ) : (
                    // A chip, not a sentence: it is a state, and it should read
                    // as a label on the object rather than an apology under it.
                    <span className="inline-flex items-center gap-2 rounded-full bg-sage-soft px-3 py-1.5 font-body text-[10px] uppercase tracking-[0.14em] text-forest">
                      <span aria-hidden="true" className="h-1 w-1 rounded-full bg-forest" />
                      In production
                    </span>
                  )}
                </div>
              </>
            )
            const cardClass =
              'group flex h-full w-full flex-col rounded-[var(--r-panel)] bg-snow p-5 shadow-[var(--shadow-card)] transition-shadow duration-200 ease-[var(--ease-out)] hover:shadow-[var(--shadow-lift)]'
            return (
              <li key={tile.id} className="flex">
                {count > 0 ? (
                  <Link href={`/shop?category=${tile.slug}`} className={cardClass}>
                    {body}
                  </Link>
                ) : (
                  // Not a link when there is nothing behind the door: an empty
                  // result that also hides the filter which emptied it is worse
                  // than no door at all.
                  <div className={cardClass}>{body}</div>
                )}
              </li>
            )
          })}
        </ul>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-6">
          <Link
            href="/shop"
            className="group inline-flex items-center gap-3 rounded-full bg-forest px-7 py-3.5 font-body text-[11px] uppercase tracking-[0.14em] text-snow transition-colors duration-200 hover:bg-forest-mid"
          >
            Browse everything
            <span className="inline-block transition-transform duration-200 ease-[var(--ease-out)] motion-safe:group-hover:translate-x-1">
              →
            </span>
          </Link>

          {nothingListed && (
            <p className="max-w-[46ch] font-body text-sm leading-relaxed text-mid">
              None of these are listed yet —{' '}
              <Link
                href="#dispatch-email"
                className="border-b border-forest/40 pb-0.5 text-forest transition-colors duration-200 hover:border-forest"
              >
                join the dispatch
              </Link>{' '}
              and you&rsquo;ll hear the day they are.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
