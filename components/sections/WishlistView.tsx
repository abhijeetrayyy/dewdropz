'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useWishlist } from '@/providers/WishlistProvider'
import { useCart } from '@/providers/CartProvider'
import ProductCard from '@/components/ProductCard'
import { BLUR_DATA_URL, COLLECTIONS, PRODUCTS } from '@/lib/constants'
import { getCartRecommendations } from '@/lib/recommendations'

// Mirrors CartView's structure and voice — the two are the same kind of page
// (a saved-items list backed by localStorage, no login required) and should
// read as one system. The populated state earns its place with three things a
// wishlist should actually have: items grouped by the collection they belong
// to (so "what did I save this for" is legible at a glance), a one-click way
// to move everything into the cart, and genuine recommendations — the same
// getCartRecommendations helper Cart uses, since it works off any slug list.
export default function WishlistView() {
  const { items } = useWishlist()
  const { addItem } = useCart()
  const [addedAll, setAddedAll] = useState(false)

  const saved = PRODUCTS.filter((p) => items.includes(p.slug))
  const recommendations = getCartRecommendations(items, 3)

  const grouped = COLLECTIONS.map((c) => ({
    collection: c,
    products: saved.filter((p) => p.collectionId === c.id),
  })).filter((g) => g.products.length > 0)
  // Grouping only earns its keep once there's more than one group to tell apart —
  // a single "Mist & Morning" header over every item you own is just noise.
  const showGroups = grouped.length > 1

  function handleAddAllToCart() {
    for (const p of saved) {
      addItem({ slug: p.slug, name: p.name, price: p.price, gradient: p.gradient, size: p.sizes[0] })
    }
    setAddedAll(true)
    setTimeout(() => setAddedAll(false), 2200)
  }

  if (saved.length === 0) {
    return (
      <>
        <section className="bg-paper px-6 md:px-10 pt-40 pb-24 min-h-[50vh] flex items-center justify-center">
          <div className="text-center max-w-sm">
            <div className="font-mono text-[10px] tracking-[0.2em] text-forest uppercase">Saved For Later</div>
            <h1 className="mt-3 font-display font-light text-3xl text-text">Nothing saved yet.</h1>
            <p className="mt-3 font-body text-sm text-mid">
              Tap the heart on anything you&apos;re not ready to carry uphill today.
            </p>
            <Link
              href="/shop"
              data-cursor="view"
              data-cursor-text="Shop"
              className="mt-8 inline-block bg-forest text-paper px-8 py-3.5 text-[10px] tracking-[0.12em] uppercase font-body font-medium rounded-sm hover:bg-forest-mid transition-colors duration-300"
            >
              Explore Collections
            </Link>
          </div>
        </section>

        <section className="bg-ink px-6 md:px-10 py-16 md:py-20">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8 font-mono text-[10px] tracking-[0.2em] text-sage uppercase text-center">
              Three conditions, three kits
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {COLLECTIONS.map((c) => (
                <Link
                  key={c.id}
                  href={`/collections/${c.id}`}
                  data-cursor="view"
                  data-cursor-text="View"
                  className="group relative aspect-[4/5] rounded-sm overflow-hidden"
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
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <span className="font-body text-[9px] tracking-[0.15em] text-sage uppercase">{c.bestFor}</span>
                    <h3 className="mt-1 font-display text-xl text-paper group-hover:text-sage transition-colors duration-300">
                      {c.name}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </>
    )
  }

  return (
    <section className="bg-paper px-6 md:px-10 pt-32 pb-24 md:pt-40 min-h-[60vh]">
      <div className="max-w-6xl mx-auto">
        <div className="mb-14 border-b border-rule pb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-forest uppercase">Saved For Later</div>
            <h1 className="mt-3 font-display font-light text-[clamp(32px,5vw,48px)] text-text">Your Wishlist</h1>
            <p className="mt-2 font-body text-sm text-mid">
              {saved.length} piece{saved.length === 1 ? '' : 's'} saved · free shipping over Rs. 2,000 · 7-day returns
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddAllToCart}
            data-cursor="magnetic"
            data-cursor-text="Add"
            className="inline-flex items-center justify-center gap-2 flex-shrink-0 bg-forest text-paper px-7 py-3.5 text-[10px] tracking-[0.12em] uppercase font-body font-medium rounded-sm hover:bg-forest-mid transition-colors duration-300 w-fit"
          >
            {addedAll ? 'Added all to cart ✓' : 'Add all to cart'}
          </button>
        </div>

        {showGroups ? (
          <div className="space-y-16">
            {grouped.map(({ collection, products }) => (
              <div key={collection.id}>
                <div className="mb-6 flex items-baseline gap-3">
                  <h2 className="font-display text-xl text-text">{collection.name}</h2>
                  <span className="font-body text-xs text-mid italic">{collection.tagline}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
                  {products.map((p) => (
                    <ProductCard key={p.slug} product={p} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
            {saved.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        )}
      </div>

      {recommendations.length > 0 && (
        <div className="max-w-6xl mx-auto mt-24">
          <div className="mb-10 font-body text-xs tracking-[0.18em] text-forest uppercase">Complete the Kit</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
            {recommendations.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
