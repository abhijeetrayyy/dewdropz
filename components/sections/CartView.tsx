'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import { useCart } from '@/providers/CartProvider'
import { useMagneticHover } from '@/hooks/useMagneticHover'
import ProductCard from '@/components/ProductCard'
import { BLUR_DATA_URL, COLLECTIONS, PRODUCTS } from '@/lib/constants'
import { getCartRecommendations } from '@/lib/recommendations'

// Matches the free-shipping threshold quoted in TrustBand/FooterSection —
// no numeric constant exists yet for it, so this mirrors that copy exactly.
// Plain rupees, not paise: PRODUCTS/CartProvider prices are stored as whole
// rupees (e.g. Mist Tee is `price: 1800`), unlike the backend order/checkout
// system, which stores paise — the two are different unit systems today.
const FREE_SHIPPING_THRESHOLD = 2000

function productImage(slug: string) {
  return PRODUCTS.find((p) => p.slug === slug)?.image
}

export default function CartView() {
  const { items, updateQuantity, removeItem, subtotal } = useCart()
  const checkoutBtn = useMagneticHover(0.3, 10)

  const cartSlugs = items.map((i) => i.slug)
  const suggestions = getCartRecommendations(cartSlugs, 3)
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal)
  const shippingProgress = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100))

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
        <div className="mb-10 border-b border-rule pb-8">
          <div className="font-mono text-[10px] tracking-[0.2em] text-forest uppercase">The Pack</div>
          <h1 className="mt-3 font-display font-light text-[clamp(32px,5vw,48px)] text-text">Your Cart</h1>
          <p className="mt-2 font-body text-sm text-mid">
            {items.reduce((n, i) => n + i.quantity, 0)} piece{items.reduce((n, i) => n + i.quantity, 0) === 1 ? '' : 's'} — ships from Dehradun in 2 days.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 flex flex-col">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <motion.div
                  key={`${item.slug}-${item.size}`}
                  initial={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-4 md:gap-6 border-b border-rule py-6 overflow-hidden"
                >
                  <Link href={`/products/${item.slug}`} className="relative w-20 h-24 md:w-24 md:h-28 rounded-sm overflow-hidden flex-shrink-0">
                    {productImage(item.slug) ? (
                      <Image
                        src={productImage(item.slug)!}
                        alt={item.name}
                        fill
                        sizes="96px"
                        placeholder="blur"
                        blurDataURL={BLUR_DATA_URL}
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full" style={{ background: item.gradient }} />
                    )}
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link href={`/products/${item.slug}`} className="font-display text-lg text-text hover:text-forest transition-colors">
                      {item.name}
                    </Link>
                    <div className="font-body text-xs text-mid mt-1 uppercase tracking-[0.05em]">Size: {item.size}</div>
                  </div>

                  <div className="flex items-center border border-rule rounded-sm">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.slug, item.size, item.quantity - 1)}
                      className="w-8 h-8 flex items-center justify-center text-mid hover:text-forest transition-colors"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="w-7 text-center font-body text-sm tabular-nums">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.slug, item.size, item.quantity + 1)}
                      className="w-8 h-8 flex items-center justify-center text-mid hover:text-forest transition-colors"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  <div className="w-20 md:w-24 text-right font-body text-sm font-medium text-forest tabular-nums">
                    Rs. {(item.price * item.quantity).toLocaleString('en-IN')}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(item.slug, item.size)}
                    aria-label="Remove item"
                    className="text-mid hover:text-clay transition-colors text-lg leading-none"
                  >
                    ×
                  </button>
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
                    Add <span className="text-forest font-medium">Rs. {remaining.toLocaleString('en-IN')}</span> more for free shipping.
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

              <div className="flex items-center justify-between font-body text-sm text-mid py-2">
                <span>Subtotal</span>
                <span className="text-text tabular-nums">Rs. {subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between font-body text-sm text-mid py-2 border-b border-rule">
                <span>Shipping &amp; tax</span>
                <span className="text-mid">Calculated at checkout</span>
              </div>
              <div className="flex items-center justify-between font-body text-base font-medium py-4">
                <span className="text-text">Total</span>
                <span className="text-forest tabular-nums">Rs. {subtotal.toLocaleString('en-IN')}</span>
              </div>

              <motion.a
                ref={checkoutBtn.ref as React.RefObject<HTMLAnchorElement>}
                onMouseMove={checkoutBtn.onMouseMove}
                onMouseLeave={checkoutBtn.onMouseLeave}
                style={{ x: checkoutBtn.x, y: checkoutBtn.y }}
                data-cursor="view"
                data-cursor-text="Checkout"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
            {suggestions.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
