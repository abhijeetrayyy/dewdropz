'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, useMotionValue, useSpring } from 'motion/react'
import { useCart } from '@/providers/CartProvider'
import { useWishlist } from '@/providers/WishlistProvider'
import { useHasMounted } from '@/hooks/useHasMounted'
import { ContourLines } from '@/components/ui/ContourLines'
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
    // Was ±14°. On a 3:4 photograph of a garment that is enough perspective to
    // visibly skew the shoulders and shear the print area — the card drew
    // attention to itself and away from the product, which is the opposite of
    // what a shop grid is for, and it is the single strongest "cheap web demo"
    // tell on the page. ±4° still tracks the pointer, so the card reads as a
    // physical thing that responds; it just no longer distorts the goods.
    rotateY.set(px * 4)
    rotateX.set(py * -4)
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
        className="absolute right-2.5 top-2.5 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-surface/85 text-mid shadow-[var(--shadow-card)] backdrop-blur-sm transition-[opacity,background-color,color] hover:bg-surface hover:text-forest focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40 sm:right-4 sm:top-4 sm:h-8 sm:w-8 md:opacity-0 md:group-hover:opacity-100"
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
            <span className="rounded-[var(--r-tag)] bg-forest px-1.5 py-0.5 text-[10px] font-medium text-paper shadow-[var(--shadow-card)] sm:px-2 sm:py-1 sm:text-[11px]">
              {discountPct}% OFF
            </span>
          ) : null}
          {soldOut ? (
            <span className="rounded-[var(--r-tag)] bg-ink/80 px-1.5 py-0.5 text-[10px] font-medium text-paper backdrop-blur-sm sm:px-2 sm:py-1 sm:text-[11px]">Sold out</span>
          ) : lowStock ? (
            <span className="flex items-center gap-1.5 rounded-[var(--r-tag)] bg-surface/95 py-0.5 pl-1.5 pr-2 text-[10px] font-medium text-clay-deep shadow-[var(--shadow-card)] backdrop-blur-sm sm:py-1 sm:text-[11px]">
              <span className="h-1.5 w-1.5 flex-shrink-0 animate-pulse rounded-full bg-clay-deep" />
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
          style={{ rotateX: springRotateX, rotateY: springRotateY, transformPerspective: 1200 }}
          className="product-image relative aspect-[3/4] overflow-hidden rounded-[var(--r-card)] shadow-[var(--shadow-card)] transition-shadow duration-500 group-hover:shadow-[var(--shadow-lift)]"
        >
          <div className={`relative h-full w-full bg-paper-warm ${soldOut ? 'opacity-60' : ''}`}>
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
            ) : (
              // A product with no photograph yet. This used to render as a bare
              // cream rectangle — a hole in the grid, and on a four-column row
              // it read as a broken layout rather than a pending one. It is the
              // same failure as a dashed grey empty state, just at card scale.
              //
              // So the card still carries the brand: the topographic motif the
              // rest of the site uses for warm ground, and the piece's own
              // initial set in the display face. It reads as a product awaiting
              // its picture, which is what it is.
              <span className="absolute inset-0 flex items-center justify-center overflow-hidden bg-paper-deep">
                <ContourLines className="opacity-[0.14]" />
                <span
                  aria-hidden="true"
                  className="relative font-display text-[clamp(40px,7vw,64px)] leading-none text-forest/25"
                >
                  {product.name.charAt(0).toUpperCase()}
                </span>
              </span>
            )}
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
