'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import { useCart } from '@/providers/CartProvider'
import { useMagneticHover } from '@/hooks/useMagneticHover'
import ProductCard from '@/components/ProductCard'
import RecentlyViewed from '@/components/sections/RecentlyViewed'
import { BLUR_DATA_URL } from '@/lib/constants'
import { formatPrice } from '@/lib/utils'
import { getCartRecommendations } from '@/lib/recommendations'
import type { ProductWithCollection, Collection } from '@/types/database'

export default function CartView({
  allProducts,
  collections,
  freeShippingThreshold,
}: {
  allProducts: ProductWithCollection[]
  collections: Collection[]
  /** In paise, from store settings — previously a constant here that had to be
   *  kept in step by hand with the product page and the footer, and wasn't. */
  freeShippingThreshold: number
}) {
  const { items, updateQuantity, removeItem, subtotal } = useCart()
  const { ref: checkoutBtnRef, x: checkoutBtnX, y: checkoutBtnY, onMouseMove: checkoutBtnMove, onMouseLeave: checkoutBtnLeave } = useMagneticHover(0.3, 10)
  // Set by the recovery-email landing page. Arriving from an inbox to a cart
  // that silently repopulated itself is disorienting; one line explains it.
  const recovered = useSearchParams().get('recovered') === '1'

  const cartSlugs = items.map((i) => i.slug)
  const suggestions = getCartRecommendations(allProducts, cartSlugs, 6)
  const remaining = Math.max(0, freeShippingThreshold - subtotal)
  const shippingProgress = Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100))

  if (items.length === 0) {
    return (
      <>
        <section className="bg-paper px-6 md:px-10 pt-40 pb-24 min-h-[50vh] flex items-center justify-center">
          <div className="text-center max-w-sm">
            <div className="font-mono text-[10px] tracking-[0.2em] text-forest uppercase">The Pack</div>
            <h1 className="mt-3 font-display font-light text-3xl text-text">Your cart is empty.</h1>
            <p className="mt-3 font-body text-sm text-mid">
              Nothing packed yet. Go find something worth carrying uphill.
            </p>
            <Link
              href="/collections"
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
              {collections.map((c) => (
                <Link
                  key={c.id}
                  href={`/collections/${c.slug}`}
                  className="group relative aspect-[4/5] rounded-sm overflow-hidden bg-ink/60"
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
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    {c.tagline && <span className="font-body text-[9px] tracking-[0.15em] text-sage uppercase">{c.tagline}</span>}
                    <h3 className="mt-1 font-display text-xl text-paper group-hover:text-sage transition-colors duration-300">
                      {c.name}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <RecentlyViewed className="bg-paper px-6 md:px-10 py-16 md:py-20 border-t border-rule" />
      </>
    )
  }

  return (
    <>
    <section className="bg-paper px-6 md:px-10 pt-32 pb-24 md:pt-40 min-h-[60vh]">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10 border-b border-rule pb-8">
          <div className="font-mono text-[10px] tracking-[0.2em] text-forest uppercase">The Pack</div>
          <h1 className="mt-3 font-display font-light text-[clamp(32px,5vw,48px)] text-text">Your Cart</h1>
          <p className="mt-2 font-body text-sm text-mid">
            {items.reduce((n, i) => n + i.quantity, 0)} piece{items.reduce((n, i) => n + i.quantity, 0) === 1 ? '' : 's'} — ships from Dehradun in 2 days.
          </p>
          {recovered && (
            <p className="mt-3 font-body text-sm text-forest">Welcome back — your saved cart has been restored.</p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 flex flex-col">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <motion.div
                  key={`${item.slug}-${item.size}-${item.customDesignId ?? ''}`}
                  initial={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-wrap items-center gap-x-4 gap-y-3 md:flex-nowrap md:gap-6 border-b border-rule py-6 overflow-hidden"
                >
                  <Link href={`/products/${item.slug}`} className="group relative w-20 h-24 md:w-24 md:h-28 rounded-sm overflow-hidden flex-shrink-0 bg-rule/40">
                    {item.image && (
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        sizes="96px"
                        placeholder="blur"
                        blurDataURL={BLUR_DATA_URL}
                        className="object-cover transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-105"
                      />
                    )}
                  </Link>

                  <div className="min-w-[140px] flex-1 md:min-w-0">
                    <Link href={`/products/${item.slug}`} className="font-display text-lg text-text hover:text-forest transition-colors">
                      {item.name}
                    </Link>
                    <div className="font-body text-xs text-mid mt-1 uppercase tracking-[0.05em] flex items-center gap-2">
                      Size: {item.size}
                      {item.customDesignId && (
                        <span className="px-1.5 py-0.5 rounded-sm bg-forest/10 text-forest text-[9px] tracking-[0.08em] normal-case">
                          Custom Design
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quantity/price/remove used to be three more direct
                      children of the row above — five fixed-width-ish items
                      fighting for one line left the name column's flex-1
                      resolving to 0 width below md, and its un-clipped text
                      spilled out over the quantity control. This group now
                      wraps onto its own line on mobile (indented to sit under
                      the name, not the thumbnail) and sits inline again at md+. */}
                  <div className="flex w-full items-center justify-between pl-[96px] md:w-auto md:justify-start md:gap-6 md:pl-0">
                    <div className="flex items-center border border-rule rounded-sm">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.slug, item.size, item.quantity - 1, item.customDesignId)}
                        className="w-8 h-8 flex items-center justify-center text-mid hover:text-forest transition-colors"
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="w-7 text-center font-body text-sm tabular-nums">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.slug, item.size, item.quantity + 1, item.customDesignId)}
                        className="w-8 h-8 flex items-center justify-center text-mid hover:text-forest transition-colors"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>

                    <div className="flex items-center gap-3 md:gap-6">
                      <div className="w-20 md:w-24 text-right font-body text-sm font-medium text-forest tabular-nums">
                        {formatPrice(item.price * item.quantity)}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(item.slug, item.size, item.customDesignId)}
                        aria-label="Remove item"
                        className="text-mid hover:text-clay transition-colors text-lg leading-none"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="lg:col-span-1">
            <div className="border border-rule rounded-lg p-6 sticky top-28">
              <h2 className="font-body text-[10px] tracking-[0.15em] text-text uppercase mb-4">Order Summary</h2>

              {/* Free-shipping progress — the same reassurance TrustBand promises
                  up front, made concrete right before checkout. */}
              <div className="mb-5 pb-5 border-b border-rule">
                {remaining > 0 ? (
                  <p className="font-body text-xs text-mid leading-relaxed">
                    Add <span className="text-forest font-medium">{formatPrice(remaining)}</span> more for free shipping.
                  </p>
                ) : (
                  <p className="font-body text-xs text-forest font-medium">Free shipping unlocked ✓</p>
                )}
                <div className="mt-2.5 h-1 rounded-full bg-rule overflow-hidden">
                  <div
                    className="h-full rounded-full bg-forest transition-[width] duration-500"
                    style={{ width: `${shippingProgress}%` }}
                  />
                </div>
              </div>

              {/* There used to be a bold green "Total" here showing the subtotal.
                  It was not the total — GST and delivery are added at checkout —
                  so a ₹1,800 cart said ₹1,800 and the customer was charged around
                  ₹2,224. A confident wrong number is worse than an honest absent
                  one: the customer anchors on it and meets the real figure at the
                  bank screen. The total appears at checkout, where the delivery
                  address makes it knowable. */}
              <div className="flex items-center justify-between font-body text-base font-medium py-4 border-b border-rule">
                <span className="text-text">Subtotal</span>
                <span className="text-forest tabular-nums">{formatPrice(subtotal)}</span>
              </div>
              <p className="font-body text-xs text-mid pt-3 pb-1 leading-relaxed">
                GST and delivery are added at checkout, once you pick where it is going.
              </p>

              <motion.a
                ref={checkoutBtnRef as React.RefObject<HTMLAnchorElement>}
                onMouseMove={checkoutBtnMove}
                onMouseLeave={checkoutBtnLeave}
                style={{ x: checkoutBtnX, y: checkoutBtnY }}
                href="/checkout"
                onClick={() => {
                  import('@/lib/analytics').then(({ trackEvent }) => {
                    trackEvent('begin_checkout', { currency: 'INR', value: subtotal, items: items.map(i => ({ item_id: i.slug, item_name: i.name, quantity: i.quantity })) })
                  })
                }}
                className="block w-full text-center bg-forest text-paper px-6 py-3.5 text-[10px] tracking-[0.12em] uppercase font-body font-medium rounded-sm hover:bg-forest-mid transition-colors duration-300"
              >
                Checkout
              </motion.a>

              <div className="mt-4 flex items-center justify-center gap-2 font-body text-[9px] tracking-[0.08em] uppercase text-light">
                <span>COD available</span>
                <span aria-hidden="true">·</span>
                <span>7-day returns</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="max-w-6xl mx-auto mt-24">
          <div className="mb-10 font-body text-xs tracking-[0.18em] text-forest uppercase">Complete the Kit</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-8 sm:gap-y-12 lg:grid-cols-3">
            {suggestions.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </div>
      )}
    </section>

    <RecentlyViewed className="bg-paper px-6 md:px-10 pb-24 border-t border-rule pt-16" />
    </>
  )
}
