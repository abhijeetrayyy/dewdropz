'use client'

import { useState } from 'react'
import SectionHeader from '@/components/SectionHeader'
import Image from 'next/image'
import Link from 'next/link'
import { useCart } from '@/providers/CartProvider'
import { BLUR_DATA_URL } from '@/lib/constants'
import { formatPrice } from '@/lib/utils'
import { firstAvailableVariant, isSoldOut, priceFor } from '@/lib/variants'
import { trackEvent } from '@/lib/analytics'
import { toast } from 'sonner'
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
  // Priced off what the button will actually add, and at the variant's real
  // price. The old total summed every product's base price including any that
  // were sold out — so the figure beside "Add the full kit" could be for a kit
  // the button would not buy.

  // "Add the full kit" committed three garments in one click, in three sizes
  // nobody chose, off `variants[0]` — a nondeterministic pick against an
  // unset `sort_order` — with no stock check on any of them.
  const kitPicks = products.map((p) => ({ product: p, variant: firstAvailableVariant(p) }))
  const availablePicks = kitPicks.filter((k) => !isSoldOut(k.product))
  const unavailable = kitPicks.length - availablePicks.length
  const kitTotal = availablePicks.reduce((sum, k) => sum + priceFor(k.product, k.variant), 0)

  function addKit() {
    if (availablePicks.length === 0) return
    let total = 0
    for (const { product, variant } of availablePicks) {
      const price = priceFor(product, variant)
      total += price
      addItem({
        slug: product.slug,
        name: product.name,
        price,
        image: product.images?.[0] ?? '',
        size: variant?.name ?? '',
        variantId: variant?.id ?? null,
      })
    }
    trackEvent('add_to_cart', {
      currency: 'INR',
      value: total,
      items: availablePicks.map(({ product, variant }) => ({
        item_id: product.slug,
        item_name: product.name,
        item_variant: variant?.name ?? '',
      })),
    })
    // Naming every size is the point. Three garments went into a cart with no
    // statement of what size any of them was, and the first time the buyer
    // found out was when the courier arrived.
    toast.success(
      `${availablePicks.length} ${availablePicks.length === 1 ? 'piece' : 'pieces'} added`,
      {
        description:
          availablePicks
            .map(({ product, variant }) => `${product.name}${variant ? ` (${variant.name})` : ''}`)
            .join(', ') +
          (unavailable > 0 ? ` — ${unavailable} sold out and skipped` : ''),
        action: { label: 'View cart', onClick: () => { window.location.href = '/cart' } },
      }
    )
    setAdded(true)
    setTimeout(() => setAdded(false), 2200)
  }

  return (
    <section className="bg-snow border-t border-rule px-6 md:px-10 py-20 md:py-24">
      <div className="max-w-measure mx-auto grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-12 lg:gap-16 items-center">
        {/* The window */}
        <div>
          {/* STATEMENT — the owner writes this headline, and it is the offer,
              so it opens the band alone at scale rather than under a label.

              The pulsing dot is gone with the eyebrow. `animate-ping` ran
              forever on a band whose content changes when somebody edits it in
              /admin — a live indicator for something that is not live, and
              ambient motion, which the page's own law forbids outright. The
              owner's eyebrow keeps its words as the lede. */}
          <SectionHeader
            species="statement"
            ground="paper"
            title={config.headline}
            lede={config.line}
            className="mb-0 md:mb-0"
          />

          {collection && (
            <Link
              href={`/collections/${collection.slug}`}
              className="group mt-8 flex items-center gap-4 border border-forest/15 rounded-[var(--r-input)] p-4 max-w-md hover:border-forest/40 transition-colors duration-300"
            >
              <div className="relative h-16 w-16 rounded-[var(--r-card)] overflow-hidden flex-shrink-0 bg-white">
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
                <div className="font-body text-[9px] tracking-[0.15em] text-forest uppercase">From the collection</div>
                <div className="mt-0.5 font-display text-lg text-text leading-tight">{collection.name}</div>
                {collection.tagline && (
                  <div className="mt-1 font-body text-[11px] text-mid italic">{collection.tagline}</div>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-body text-[10px] tracking-[0.1em] text-forest uppercase group-hover:text-text transition-colors">
                  Explore →
                </div>
              </div>
            </Link>
          )}
        </div>

        {/* The kit */}
        <div>
          {products.length === 0 ? (
            <div className="rounded-[var(--r-panel)] border border-dashed border-paper/20 p-10 text-center">
              <p className="font-body text-sm text-mid">New pieces are on the way — check back soon.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {products.map((p, i) => (
                  <Link key={p.slug} href={`/products/${p.slug}`} className="group">
                    <div className="relative aspect-[3/4] rounded-[var(--r-card)] overflow-hidden bg-white">
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
                      <span className="absolute top-2 left-2 font-mono text-[9px] text-text/80 bg-ink/50 backdrop-blur-sm rounded-[var(--r-tag)] px-1.5 py-0.5">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="mt-2 font-body text-xs text-text leading-tight">{p.name}</div>
                    <div className="font-body text-[11px] text-mid mt-0.5">{formatPrice(p.price)}</div>
                  </Link>
                ))}
              </div>

              <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-rule pt-5">
                <div>
                  <div className="font-body text-[9px] tracking-[0.18em] text-mid uppercase">
                    The full kit — {products.length} piece{products.length === 1 ? '' : 's'}
                  </div>
                  <div className="font-display text-2xl text-text mt-0.5 tabular-nums">{formatPrice(kitTotal)}</div>
                </div>
                <button
                  type="button"
                  onClick={addKit}
                  disabled={availablePicks.length === 0}
                  data-cursor="magnetic"
                  data-cursor-text="Add"
                  className="inline-flex items-center justify-center gap-3 rounded-full bg-forest px-8 py-4 font-body text-[10px] font-medium uppercase tracking-[0.16em] text-snow transition-colors duration-300 hover:bg-forest-mid"
                >
                  {availablePicks.length === 0
                    ? 'Sold out'
                    : added
                      ? 'Kit added to cart ✓'
                      : 'Add the full kit'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
