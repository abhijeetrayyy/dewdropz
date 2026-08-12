import Image from 'next/image'
import Link from 'next/link'
import { BLUR_DATA_URL } from '@/lib/constants'
import type { Category, ProductWithCollection } from '@/types/database'

// The packer's entry point. The hero serves the dreamer; this serves the person
// with a trek booked in three weeks and a checklist — straight lines into the
// catalogue by what they need, before any more storytelling.
export default function ShopByCategory({
  categories,
  products,
  featuredSlugs = [],
}: {
  categories: Category[]
  products: ProductWithCollection[]
  /** Admin's pick, in their order. Empty = every active top-level category,
   *  which is what this section did before the setting existed. */
  featuredSlugs?: string[]
}) {
  const shown = featuredSlugs.length
    ? featuredSlugs.map((s) => categories.find((c) => c.slug === s)).filter((c): c is Category => Boolean(c))
    : categories

  if (shown.length === 0) return null

  return (
    // Early afternoon on the page's clock — paper warms a step past midday.
    <section className="bg-[#F6F0E2] px-6 md:px-10 pt-20 pb-24 md:pt-24">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12 flex items-end justify-between">
          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-forest uppercase">13:00 · Pack Check</div>
            <h2 className="font-display text-[clamp(34px,5vw,54px)] text-text mt-2">
              What are you packing for?
            </h2>
            <p className="mt-3 font-display italic text-base text-mid max-w-md">
              &ldquo;Lay everything out. If you can&apos;t say why it&apos;s in the pack, it stays behind.&rdquo;
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
          {shown.map((tile) => {
            const count = products.filter((p) => p.categories?.some((pc) => pc.category_id === tile.id)).length
            return (
              <Link
                key={tile.id}
                href={`/shop?category=${tile.slug}`}
                className="group relative aspect-[4/5] rounded-sm overflow-hidden bg-ink/60"
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
                    Shop {tile.name.split(' ')[0]} →
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
