'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useCart } from '@/providers/CartProvider'
import { BLUR_DATA_URL } from '@/lib/constants'
import { formatPrice } from '@/lib/utils'
import type { ProductWithCollection, Collection, HomeConfig } from '@/types/database'

// This used to rotate through four hardcoded seasonal kits (lib/constants.ts
// SEASON_KITS), each pulling four specific trekking-gear slugs — a real
// feature when the catalogue had trekking gear. With a print-on-demand blanks
// catalogue that variety doesn't exist, and an admin could never change what
// this section sold without a code change either way. It's a single block now,
// sourced from store_settings.home_config.season_kit and editable from
// /admin/settings — headline, body copy, linked collection, and which
// products fill the grid.
export default function SeasonKit({
  config,
  allProducts,
  collections,
}: {
  config: HomeConfig['season_kit']
  allProducts: ProductWithCollection[]
  collections: Collection[]
}) {
  const { addItem } = useCart()
  const [added, setAdded] = useState(false)

  if (!config.enabled) return null

  const collection = config.collection_slug ? collections.find((c) => c.slug === config.collection_slug) : null
  const products = config.product_slugs
    .map((slug) => allProducts.find((p) => p.slug === slug))
    .filter((p): p is ProductWithCollection => Boolean(p))
  const kitTotal = products.reduce((sum, p) => sum + p.price, 0)

  function addKit() {
    for (const p of products) {
      addItem({ slug: p.slug, name: p.name, price: p.price, image: p.images?.[0] ?? '', size: p.variants?.[0]?.name ?? '' })
    }
    setAdded(true)
    setTimeout(() => setAdded(false), 2200)
  }

  return (
    <section className="bg-altitude px-6 md:px-10 py-20 md:py-24">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-12 lg:gap-16 items-center">
        {/* The window */}
        <div>
          <div className="flex items-center gap-3">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sage/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sage" />
            </span>
            <span className="font-mono text-[10px] tracking-[0.22em] text-sage uppercase">{config.eyebrow}</span>
          </div>

          <h2 className="mt-5 font-display font-light text-[clamp(32px,4.8vw,54px)] text-paper leading-[1.05]">
            {config.headline}
          </h2>
          <p className="mt-4 font-body text-sm md:text-base text-paper/65 leading-relaxed max-w-md">{config.line}</p>

          {collection && (
            <Link
              href={`/collections/${collection.slug}`}
              className="group mt-8 flex items-center gap-4 border border-paper/15 rounded-sm p-4 max-w-md hover:border-sage/40 transition-colors duration-300"
            >
              <div className="relative h-16 w-16 rounded-sm overflow-hidden flex-shrink-0 bg-ink/60">
                {collection.image_url && (
                  <Image
                    src={collection.image_url}
                    alt={collection.name}
                    fill
                    sizes="64px"
                    placeholder="blur"
                    blurDataURL={BLUR_DATA_URL}
                    className="object-cover"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-body text-[9px] tracking-[0.15em] text-sage uppercase">From the collection</div>
                <div className="mt-0.5 font-display text-lg text-paper leading-tight">{collection.name}</div>
                {collection.tagline && (
                  <div className="mt-1 font-body text-[11px] text-paper/50 italic">{collection.tagline}</div>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-body text-[10px] tracking-[0.1em] text-sage uppercase group-hover:text-paper transition-colors">
                  Explore →
                </div>
              </div>
            </Link>
          )}
        </div>

        {/* The kit */}
        <div>
          {products.length === 0 ? (
            <div className="rounded-sm border border-dashed border-paper/20 p-10 text-center">
              <p className="font-body text-sm text-paper/50">New pieces are on the way — check back soon.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {products.map((p, i) => (
                  <Link key={p.slug} href={`/products/${p.slug}`} className="group">
                    <div className="relative aspect-[3/4] rounded-sm overflow-hidden bg-ink/40">
                      {p.images?.[0] && (
                        <Image
                          src={p.images[0]}
                          alt={p.name}
                          fill
                          sizes="(max-width: 640px) 50vw, 15vw"
                          placeholder="blur"
                          blurDataURL={BLUR_DATA_URL}
                          className="object-cover transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-105"
                        />
                      )}
                      <span className="absolute top-2 left-2 font-mono text-[9px] text-paper/80 bg-ink/50 backdrop-blur-sm rounded-sm px-1.5 py-0.5">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="mt-2 font-body text-xs text-paper leading-tight">{p.name}</div>
                    <div className="font-body text-[11px] text-paper/50 mt-0.5">{formatPrice(p.price)}</div>
                  </Link>
                ))}
              </div>

              <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-paper/10 pt-5">
                <div>
                  <div className="font-body text-[9px] tracking-[0.18em] text-paper/45 uppercase">
                    The full kit — {products.length} piece{products.length === 1 ? '' : 's'}
                  </div>
                  <div className="font-display text-2xl text-paper mt-0.5 tabular-nums">{formatPrice(kitTotal)}</div>
                </div>
                <button
                  type="button"
                  onClick={addKit}
                  data-cursor="magnetic"
                  data-cursor-text="Add"
                  className="inline-flex items-center justify-center gap-3 rounded-full bg-paper px-8 py-4 font-body text-[10px] font-medium uppercase tracking-[0.16em] text-ink transition-colors duration-300 hover:bg-sage"
                >
                  {added ? 'Kit added to cart ✓' : 'Add the full kit'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
