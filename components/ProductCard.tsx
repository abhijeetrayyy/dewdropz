'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, useMotionValue, useSpring } from 'motion/react'
import { useCart } from '@/providers/CartProvider'
import { useWishlist } from '@/providers/WishlistProvider'
import { useHasMounted } from '@/hooks/useHasMounted'
import { BLUR_DATA_URL } from '@/lib/constants'
import { formatPrice } from '@/lib/utils'
import type { ProductWithCollection } from '@/types/database'

export default function ProductCard({ product }: { product: ProductWithCollection }) {
  const { addItem } = useCart()
  const ref = useRef<HTMLDivElement>(null)
  const rotateX = useMotionValue(0)
  const rotateY = useMotionValue(0)
  const springRotateX = useSpring(rotateX, { stiffness: 200, damping: 20 })
  const springRotateY = useSpring(rotateY, { stiffness: 200, damping: 20 })

  const [added, setAdded] = useState(false)
  // hasItem() reads localStorage via WishlistProvider, which the server can never
  // see — rendering it immediately risks a hydration mismatch if the provider's
  // own load effect fires before this component's hydration pass completes (it's
  // a race, so this showed up as "sometimes," same shape as the Lenis scroll bug).
  // Gating on this component's own mount, not the provider's data, guarantees the
  // first client render matches the server every time; the real state appears a
  // frame later once mounted flips true.
  const mounted = useHasMounted()

  const handleMouseMove = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    rotateY.set(px * 14)
    rotateX.set(py * -14)
  }

  const handleMouseLeave = () => {
    rotateX.set(0)
    rotateY.set(0)
  }

  const handleAddToCart = () => {
    if (soldOut) return
    // A card adds the first variant — carry its id rather than making checkout
    // guess it back from the name.
    const first = product.variants?.[0]
    addItem({
      slug: product.slug,
      name: product.name,
      price: product.price,
      image: product.images?.[0] ?? '',
      size: first?.name ?? '',
      variantId: first?.id ?? null,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 1600)
  }

  const { toggleItem, hasItem } = useWishlist()

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault()
    toggleItem(product.slug)
  }

  const discountPct =
    product.compare_at_price && product.compare_at_price > product.price
      ? Math.round((1 - product.price / product.compare_at_price) * 100)
      : null

  const stock = product.inventory_quantity
  const soldOut = stock != null && stock <= 0
  const lowStock = stock != null && stock > 0 && stock <= product.low_stock_threshold

  return (
    <div className="product-card group relative">
      <button
        onClick={handleWishlist}
        aria-label={mounted && hasItem(product.slug) ? 'Remove from wishlist' : 'Save to wishlist'}
        className="absolute top-2.5 right-2.5 sm:top-4 sm:right-4 z-20 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-paper/80 backdrop-blur-sm rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-paper"
      >
        <svg
          width="16" height="16" viewBox="0 0 24 24"
          fill={mounted && hasItem(product.slug) ? "var(--forest)" : "none"}
          stroke={mounted && hasItem(product.slug) ? "var(--forest)" : "currentColor"}
          strokeWidth="1.5"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
        </svg>
      </button>

      {(discountPct || soldOut || lowStock) && (
        <div className="absolute top-2.5 left-2.5 sm:top-4 sm:left-4 z-20 flex flex-col gap-1 items-start">
          {discountPct ? (
            <span className="bg-forest text-paper text-[10px] sm:text-[11px] font-medium px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-sm">
              {discountPct}% OFF
            </span>
          ) : null}
          {soldOut ? (
            <span className="bg-mid text-paper text-[10px] sm:text-[11px] font-medium px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-sm">Sold out</span>
          ) : lowStock ? (
            <span className="bg-paper/90 text-clay text-[10px] sm:text-[11px] font-medium pl-1.5 pr-2 py-0.5 sm:py-1 rounded-sm backdrop-blur-sm flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-clay animate-pulse flex-shrink-0" />
              Only {stock} left
            </span>
          ) : null}
        </div>
      )}

      <Link href={`/products/${product.slug}`}>
        <motion.div
          ref={ref}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ rotateX: springRotateX, rotateY: springRotateY, transformPerspective: 800 }}
          className="product-image aspect-[3/4] rounded-sm overflow-hidden relative"
        >
          <div className={`h-full w-full relative bg-rule/40 ${soldOut ? 'opacity-60' : ''}`}>
            {product.images?.[0] ? (
              <Image
                src={product.images[0]}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 50vw, 25vw"
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                className={`object-cover transition-[opacity,scale] duration-500 ease-[var(--ease-out)] group-hover:scale-105 ${product.images?.[1] ? 'group-hover:opacity-0' : ''}`}
              />
            ) : null}
            {product.images?.[1] ? (
              <Image
                src={product.images[1]}
                alt=""
                fill
                sizes="(max-width: 640px) 50vw, 25vw"
                className="object-cover opacity-0 transition-[opacity,scale] duration-500 ease-[var(--ease-out)] group-hover:scale-105 group-hover:opacity-100"
              />
            ) : null}
          </div>

          <div className="absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-overlay bg-[radial-gradient(ellipse_at_center,_var(--paper)_1px,_transparent_1px)] bg-[size:12px_12px]" />
        </motion.div>
      </Link>

      <Link href={`/products/${product.slug}`}>
        <h3 className="font-display text-base sm:text-xl mt-3 sm:mt-4 mb-1 hover:text-forest transition-colors duration-300 leading-snug">
          {product.name}
        </h3>
      </Link>
      <p className="font-body text-xs sm:text-sm text-mid line-clamp-1 sm:line-clamp-none">{product.short_description}</p>
      {/* Hover-swap (price -> "Add to cart") only makes sense where hover exists.
          Clipped to a 24px window and revealed via translate on md+; on touch
          screens that clip made "Add to cart" permanently unreachable, since
          nothing ever triggers the hover that would have scrolled it into view —
          below md both rows just stack and stay visible instead. */}
      <div className="mt-1.5 sm:mt-2 relative h-auto md:h-6 md:overflow-hidden">
        <div
          className={`md:transition-transform md:duration-300 ${added ? 'md:-translate-y-1/2' : 'md:group-hover:-translate-y-1/2'}`}
        >
          <span className="font-body text-xs sm:text-sm font-medium text-forest md:h-6 flex items-center gap-1.5">
            {formatPrice(product.price)}
            {discountPct ? (
              <span className="text-mid line-through font-normal">{formatPrice(product.compare_at_price!)}</span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={soldOut}
            data-cursor="magnetic"
            className="font-body text-xs sm:text-sm font-medium text-forest block md:h-6 cursor-pointer hover:underline text-left disabled:text-mid disabled:cursor-not-allowed disabled:no-underline"
          >
            {soldOut ? 'Sold out' : added ? 'Added ✓' : 'Add to cart'}
          </button>
        </div>
      </div>
    </div>
  )
}
