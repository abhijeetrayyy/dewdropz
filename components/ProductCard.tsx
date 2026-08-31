'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { toast } from 'sonner'
import { useCart } from '@/providers/CartProvider'
import { useWishlist } from '@/providers/WishlistProvider'
import { useHasMounted } from '@/hooks/useHasMounted'
import { ContourLines } from '@/components/ui/ContourLines'
import { BLUR_DATA_URL } from '@/lib/constants'
import { formatPrice } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics'
import { firstAvailableVariant, isSoldOut } from '@/lib/variants'
import type { ProductWithCollection } from '@/types/database'

// ── A product, in a grid ─────────────────────────────────────────────────────
//
// Rendered by the shop, the wishlist, a collection page and the related row on
// a product page — which is why the two bugs below mattered five times over.
//
// WHAT THE PRICE AND THE BUTTON USED TO BE
//
// Byte-for-byte identical: `font-body text-xs sm:text-sm font-medium
// text-forest`, both of them, and the description above them the same size
// again. So a shop page published its price in the same voice as a caption, at
// 0.70x the product name — and then both were wedged into one 24px
// `overflow-hidden` window that translated on hover, which meant that hovering
// a card (the gesture that means "I am interested") took its price off the
// screen, and that the focus ring — 2px at 3px offset — was clipped on all four
// sides of the buy control. Below `md` the window was inert, so "Add to cart"
// was a 16px-tall text link with no padding sitting on a dead 16px price row.
//
// Neither role could be given more size without breaking the other, because
// they were sharing 24px. So the window is gone and they share a row instead:
// the price at 17px semibold with tabular figures, the action as a real target.

export default function ProductCard({ product }: { product: ProductWithCollection }) {
  const { addItem } = useCart()
  const [added, setAdded] = useState(false)
  // hasItem() reads localStorage via WishlistProvider, which the server can never
  // see — rendering it immediately risks a hydration mismatch if the provider's
  // own load effect fires before this component's hydration pass completes (it's
  // a race, so this showed up as "sometimes," same shape as the Lenis scroll bug).
  // Gating on this component's own mount, not the provider's data, guarantees the
  // first client render matches the server every time; the real state appears a
  // frame later once mounted flips true.
  const mounted = useHasMounted()

  // THE BUG THIS REPLACES. `product.inventory_quantity` is the PRODUCT-level
  // counter; a garment's sizes are separate rows with their own. For the custom
  // hoodie the product row reads 99 while size S holds 24 — unrelated numbers,
  // so this guard could never see a size sell out. Meanwhile the handler took
  // `variants[0]` with no stock check at all, and `[0]` is not the smallest size
  // and not a default: `sort_order` ties at zero on every variant row, so the
  // database returns them in whatever order suits it.
  //
  // `firstAvailableVariant` is the fix that already existed — written for this
  // exact defect, already used by TheClimb and SeasonKit. This card was the one
  // add-to-cart never converted to it.
  const variant = firstAvailableVariant(product)
  const soldOut = isSoldOut(product) || (product.inventory_quantity != null && product.inventory_quantity <= 0)

  const stock = product.inventory_quantity
  const lowStock = !soldOut && stock != null && stock > 0 && stock <= product.low_stock_threshold

  // The 1600ms timer was never cleared, so adding twice inside 1.6s let the
  // first timer cancel the second confirmation.
  useEffect(() => {
    if (!added) return
    const t = setTimeout(() => setAdded(false), 1600)
    return () => clearTimeout(t)
  }, [added])

  const handleAddToCart = () => {
    if (soldOut) return
    // A product WITH variants and nothing buyable never reaches here, because
    // `isSoldOut` is true. A product with no variants at all does not track
    // stock per size and is sold as itself.
    if ((product.variants?.length ?? 0) > 0 && !variant) return

    addItem({
      slug: product.slug,
      name: product.name,
      price: product.price,
      image: product.images?.[0] ?? '',
      size: variant?.name ?? '',
      variantId: variant?.id ?? null,
    })

    // The shop grid was the only commerce surface on the site emitting nothing
    // — so the funnel reported that the page whose entire job is selling
    // converted at zero, and the next merchandising decision would have been
    // made on that number.
    trackEvent('add_to_cart', {
      currency: 'INR',
      value: product.price,
      items: [{ item_id: product.slug, item_name: product.name, item_variant: variant?.name ?? '' }],
    })

    // ShopToaster is mounted site-wide and themed, and nothing on this page
    // had ever called it. A label swapping inside the card for 1600ms was the
    // whole confirmation, it did not say what had been added, and on desktop it
    // happened inside a clipped window the shopper may not have been looking at.
    toast.success('Added to cart', {
      description: `${product.name}${variant ? `, size ${variant.name}` : ''} — ${formatPrice(product.price)}`,
      action: { label: 'View cart', onClick: () => { window.location.href = '/cart' } },
    })

    setAdded(true)
  }

  const { toggleItem, hasItem } = useWishlist()
  const saved = mounted && hasItem(product.slug)

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault()
    toggleItem(product.slug)
  }

  const discountPct =
    product.compare_at_price && product.compare_at_price > product.price
      ? Math.round((1 - product.price / product.compare_at_price) * 100)
      : null

  return (
    <div className="product-card group relative">
      <button
        onClick={handleWishlist}
        data-saved={saved}
        aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
        // h-11, because 28px was the smallest target on the page and this is a
        // control a thumb uses. No shadow: it is a chip ON a card, and it cannot
        // sit at the card's own elevation — `bg-surface/85` plus the blur
        // already gives it 5.7–8.1:1 over any photograph.
        //
        // `data-[saved=true]:opacity-100` because the resting `md:opacity-0`
        // meant a desktop shopper could not see which items they had already
        // saved without hovering every card in turn — which is the one question
        // a wishlist exists to answer.
        className="absolute right-2 top-2 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-surface/85 text-mid backdrop-blur-sm transition-[opacity,background-color,color] duration-200 hover:bg-surface hover:text-forest focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest data-[saved=true]:opacity-100 sm:right-3 sm:top-3 md:opacity-0 md:group-hover:opacity-100"
      >
        <svg
          width="16" height="16" viewBox="0 0 24 24"
          fill={saved ? 'var(--forest)' : 'none'}
          stroke={saved ? 'var(--forest)' : 'currentColor'}
          strokeWidth="1.5"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
        </svg>
      </button>

      {(discountPct || soldOut || lowStock) && (
        <div className="absolute left-2.5 top-2.5 z-20 flex flex-col items-start gap-1 sm:left-4 sm:top-4">
          {/* No shadow on any of these. `--shadow-card` was carrying a 700px
              rail, a 400px photograph, a 28px icon and a 20px tag at one and the
              same elevation — 25 uses across five object scales — so it had
              stopped meaning anything. It now means "a product photograph". */}
          {discountPct ? (
            <span className="rounded-[var(--r-tag)] bg-forest px-2 py-1 font-body text-[11px] font-medium text-paper">
              {discountPct}% OFF
            </span>
          ) : null}
          {soldOut ? (
            <span className="rounded-[var(--r-tag)] bg-ink/80 px-2 py-1 font-body text-[11px] font-medium text-paper backdrop-blur-sm">
              Sold out
            </span>
          ) : lowStock ? (
            // The one warm note in the catalogue, and the token's own brief:
            // --dawn is for where the light arrives, and this is the only live
            // state on the grid. --ink on --dawn-soft is 14.35:1, against
            // 5.79:1 before. The pulsing dot is gone with it — an infinite
            // opacity loop is ambient motion (Law 06), it was ungated for
            // reduced motion, and on a scarcity badge a blink reads as a
            // pressure tactic. The number is the urgency.
            <span className="rounded-[var(--r-tag)] bg-dawn-soft px-2 py-1 font-body text-[11px] font-medium text-ink">
              Only {stock} left
            </span>
          ) : null}
        </div>
      )}

      {/* aria-hidden + tabIndex -1: this and the title link below go to the same
          place, so every card was two adjacent links to one destination — and
          on a product with no photograph this one had no accessible name at all,
          which is a live axe failure on `trekking-poles-buy`. Pointer behaviour
          is unaffected. */}
      <Link href={`/products/${product.slug}`} aria-hidden="true" tabIndex={-1}>
        <div className="product-image relative aspect-[3/4] overflow-hidden rounded-[var(--r-card)] shadow-[var(--shadow-card)] transition-shadow duration-200 group-hover:shadow-[var(--shadow-lift)]">
          {/* --paper-deep, not --paper-warm: the backing plate was the exact
              colour of the ground the grid sits on, so a card whose photograph
              had not arrived was a cream hole visible only by its shadow. */}
          <div className={`relative h-full w-full bg-paper-deep ${soldOut ? 'opacity-60' : ''}`}>
            {product.images?.[0] ? (
              <Image
                src={product.images[0]}
                alt={product.name}
                fill
                // The old value was `25vw`, which describes a four-column grid
                // this page has never had. At 1023px the card is 459px wide and
                // 25vw asked for 256 — a 1.79x under-request, doubled on a 2x
                // display, on the one element that IS the product.
                sizes="(min-width: 640px) 340px, 47vw"
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                className={`object-cover transition-[opacity,scale] duration-200 ease-[var(--ease-out)] group-hover:scale-105 ${product.images?.[1] ? 'group-hover:opacity-0' : ''}`}
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
                sizes="(min-width: 640px) 340px, 47vw"
                className="object-cover opacity-0 transition-[opacity,scale] duration-200 ease-[var(--ease-out)] group-hover:scale-105 group-hover:opacity-100"
              />
            ) : null}
          </div>

          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--paper)_1px,_transparent_1px)] bg-[size:12px_12px] opacity-[0.05] mix-blend-overlay" />
        </div>
      </Link>

      <Link href={`/products/${product.slug}`}>
        <h3 className="mt-3 line-clamp-2 font-display text-[17px] leading-[1.25] transition-colors duration-200 hover:text-forest sm:mt-4 sm:text-[19px]">
          {product.name}
        </h3>
      </Link>

      {/* `line-clamp-2` with a reserved height, at every width. It was
          `line-clamp-1 sm:line-clamp-none` — so the phone got a truncated
          fragment (about 27 characters) and every desktop width got NO clamp at
          all, which let a long description wrap to two lines while its
          neighbour stayed at one. The grid row then took the height of its
          tallest caption and the shorter cards' prices sat 20px higher: the
          40px row gap was a floor, not a measurement. */}
      <p className="mt-1 line-clamp-2 min-h-[2lh] font-body text-[13px] leading-[1.45] text-mid">
        {product.short_description}
      </p>

      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="flex items-baseline gap-2 font-body text-[17px] font-semibold tabular-nums leading-none text-forest">
          {formatPrice(product.price)}
          {discountPct ? (
            // A step down, not a same-size twin. Two prices at one size,
            // separated only by a weight and a hue, with a 1px rule through the
            // middle of the second one's figures.
            <span className="font-body text-[13px] font-normal text-mid line-through">
              {formatPrice(product.compare_at_price!)}
            </span>
          ) : null}
        </span>
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={soldOut}
          data-cursor="magnetic"
          aria-label={soldOut ? `${product.name} — sold out` : `Add ${product.name} to cart`}
          className="inline-flex min-h-[44px] shrink-0 items-center rounded-[var(--r-tag)] border border-rule-warm px-3 font-body text-[11px] font-medium uppercase tracking-[0.08em] text-forest transition-colors duration-200 hover:border-forest hover:bg-forest hover:text-paper disabled:cursor-not-allowed disabled:border-rule disabled:bg-transparent disabled:text-light md:min-h-[36px]"
        >
          {soldOut ? 'Sold out' : added ? 'Added ✓' : 'Add'}
        </button>
      </div>
    </div>
  )
}
