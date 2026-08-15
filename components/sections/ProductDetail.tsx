'use client'

import { useRef, useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, useMotionValue, useSpring } from 'motion/react'
import { ChevronLeft, ChevronRight, Smartphone, CreditCard, Landmark, Banknote } from 'lucide-react'
import { gsap } from '@/lib/gsap'
import { useCart } from '@/providers/CartProvider'
import { useWishlist } from '@/providers/WishlistProvider'
import { useMagneticHover } from '@/hooks/useMagneticHover'
import { useHasMounted } from '@/hooks/useHasMounted'
import ProductCard from '@/components/ProductCard'
import RecentlyViewed from '@/components/sections/RecentlyViewed'
import ProductDeliveryCheck from '@/components/ProductDeliveryCheck'
import Accordion from '@/components/Accordion'
import SizeGuideModal from '@/components/SizeGuideModal'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { trackEvent } from '@/lib/analytics'
import { formatPrice } from '@/lib/utils'
import { BLUR_DATA_URL } from '@/lib/constants'
import type { ProductWithCollection, Collection } from '@/types/database'

const PAYMENT_METHODS = [
  { label: 'UPI', icon: Smartphone },
  { label: 'Cards', icon: CreditCard },
  { label: 'Netbanking', icon: Landmark },
  { label: 'COD', icon: Banknote },
]

interface ProductDetailProps {
  product: ProductWithCollection
  collection: Collection | null
  related: ProductWithCollection[]
  collections: Collection[]
  /** In paise, from store settings. */
  freeShippingThreshold: number
  offers: { label: string; description: string }[]
}

// The free-shipping figure is no longer written here. It said "over Rs. 3,000"
// while the cart, the footer and the actual store setting all said ₹2,000 — so
// the product page was quoting a threshold that did not exist, and changing the
// real one in admin could never have fixed it.
const TRUST_BADGES = [
  { label: '7-day easy returns', icon: 'M4 4v6h6M4 10a8 8 0 1 0 2.3-5.7L4 7' },
  { label: 'Field tested at altitude', icon: 'M12 3l9 18H3L12 3z' },
]

const SHIP_ICON = 'M3 12h18M3 12l4-4m-4 4l4 4M21 12l-4-4m4 4l-4 4'

export default function ProductDetail({
  product, collection, related, collections, freeShippingThreshold, offers,
}: ProductDetailProps) {
  const { addItem } = useCart()
  const { toggleItem, hasItem } = useWishlist()
  const saved = hasItem(product.slug)
  // Gate on this component's own mount, not the provider's localStorage load, so
  // the first client render always matches the server (same fix as ProductCard).
  const mounted = useHasMounted()
  const [activeImage, setActiveImage] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [variantId, setVariantId] = useState(product.variants?.[0]?.id ?? '')
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)

  // Customizable blanks (hoodie/sweatshirt/tee) carry their colourways in
  // customization_config, not as ordinary variant attributes — this page used
  // to render Size only and never surfaced them at all, so a shopper had no
  // idea a colour choice existed before clicking into the studio.
  const colorways = product.customization_config?.colors ?? []
  const [colorName, setColorName] = useState(colorways.find((c) => c.available)?.name ?? '')
  const selectedColor = colorways.find((c) => c.name === colorName)

  // The gallery reflects whichever colour is selected — reusing the same
  // front/back mockup photos the studio itself uses, so picking a colour here
  // isn't just a swatch with no visible effect. Falls back to the product's
  // own photos for non-customizable products or a colourway with no mockups.
  const colorImages = selectedColor
    ? [selectedColor.front?.mockupImage, selectedColor.back?.mockupImage].filter((u): u is string => !!u)
    : []
  const images = colorImages.length > 0 ? colorImages : product.images?.length ? product.images : []

  function selectColor(name: string) {
    setColorName(name)
    setActiveImage(0)
  }

  const variant = product.variants?.find((v) => v.id === variantId)
  const price = product.price + (variant?.price_adjustment ?? 0)
  const stockQty = product.variants?.length ? (variant?.inventory_quantity ?? 0) : product.inventory_quantity
  const inStock = (stockQty ?? 0) > 0
  const lowStock = stockQty != null && stockQty > 0 && stockQty <= product.low_stock_threshold
  const discountPct =
    product.compare_at_price && product.compare_at_price > price
      ? Math.round((1 - price / product.compare_at_price) * 100)
      : null

  function showImage(i: number) {
    setActiveImage((i + images.length) % images.length)
  }

  const imgRef = useRef<HTMLDivElement>(null)
  const galleryColRef = useRef<HTMLDivElement>(null)
  const relatedGridRef = useRef<HTMLDivElement>(null)
  const rotateX = useMotionValue(0)
  const rotateY = useMotionValue(0)
  const springRotateX = useSpring(rotateX, { stiffness: 150, damping: 20 })
  const springRotateY = useSpring(rotateY, { stiffness: 150, damping: 20 })
  const addBtn = useMagneticHover(0.25, 8)

  const handleMouseMove = (e: React.MouseEvent) => {
    const el = imgRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    rotateY.set(px * 10)
    rotateX.set(py * -10)
  }
  const handleMouseLeave = () => {
    rotateX.set(0)
    rotateY.set(0)
  }

  const handleAddToCart = () => {
    trackEvent('add_to_cart', { currency: 'INR', value: price, items: [{ item_id: product.slug, item_name: product.name }] })
    addItem(
      { slug: product.slug, name: product.name, price, image: images[0] ?? '', size: variant?.name ?? '' },
      quantity
    )
    setAdded(true)
    setTimeout(() => setAdded(false), 1800)
  }

  // Track Recently Viewed & ViewItem
  useEffect(() => {
    trackEvent('view_item', { currency: 'INR', value: product.price, items: [{ item_id: product.slug, item_name: product.name }] })

    const stored = localStorage.getItem('dewdropz_recently_viewed')
    let items: string[] = []
    if (stored) {
      try {
        items = JSON.parse(stored)
      } catch {
        // ignore malformed local storage
      }
    }
    items = items.filter((s) => s !== product.slug)
    items.unshift(product.slug)
    if (items.length > 9) items = items.slice(0, 9)
    localStorage.setItem('dewdropz_recently_viewed', JSON.stringify(items))
  }, [product.slug, product.price, product.name])

  // Subtle scroll parallax on the gallery column — same yPercent/ScrollTrigger
  // technique as AboutStory.tsx, applied to the column wrapping the tilt image
  // rather than the tilt image itself, so GSAP's transform and Framer's
  // rotateX/rotateY style don't fight over the same element.
  useEffect(() => {
    if (!galleryColRef.current) return
    const tween = gsap.to(galleryColRef.current, {
      yPercent: -4,
      ease: 'none',
      scrollTrigger: {
        trigger: galleryColRef.current,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
      },
    })
    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
    }
  }, [])

  // Related-products grid reveal, reusing the same .product-card/.product-image
  // class hooks ProductCard already renders, so no new markup is needed on
  // ProductCard's side.
  useEffect(() => {
    if (!relatedGridRef.current || related.length === 0) return
    const ctx = gsap.context(() => {
      gsap.from('.product-card', {
        y: 50,
        opacity: 0,
        stagger: { each: 0.12, from: 'start' },
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: { trigger: relatedGridRef.current, start: 'top 85%', once: true, invalidateOnRefresh: true },
      })
      gsap.fromTo(
        '.product-image',
        { clipPath: 'inset(0% 0% 100% 0%)' },
        {
          clipPath: 'inset(0% 0% 0% 0%)',
          stagger: { each: 0.12, from: 'start' },
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: { trigger: relatedGridRef.current, start: 'top 85%', once: true, invalidateOnRefresh: true },
        }
      )
    }, relatedGridRef)
    return () => ctx.revert()
  }, [related])

  return (
    <>
      {collections.length > 0 && (
        <div className="pt-20 md:pt-24 bg-paper border-b border-rule">
          <div className="max-w-7xl mx-auto px-6 md:px-10 py-5 grid grid-cols-3 gap-4 md:gap-10">
            {collections.map((c) => (
              <Link
                key={c.slug}
                href={`/collections/${c.slug}`}
                className="group flex items-center gap-3 min-w-0"
              >
                <div className="relative h-11 w-11 md:h-12 md:w-12 rounded-sm overflow-hidden flex-shrink-0">
                  {c.image_url && (
                    <Image
                      src={c.image_url}
                      alt={c.name}
                      fill
                      sizes="48px"
                      className="object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-body text-xs text-text group-hover:text-forest transition-colors duration-300 truncate">
                    {c.name}
                  </div>
                  <div className="hidden sm:block font-body text-[10px] text-mid truncate">{c.tagline}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <section className="bg-paper px-6 md:px-10 pt-10 md:pt-14 pb-24">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 font-body text-xs text-mid">
            <Link href="/collections" className="hover:text-forest transition-colors">
              Collections
            </Link>
            {collection && (
              <>
                {' / '}
                <Link href={`/collections/${collection.slug}`} className="hover:text-forest transition-colors">
                  {collection.name}
                </Link>
              </>
            )}
            {' / '}
            <span className="text-text">{product.name}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            <div ref={galleryColRef}>
              <motion.div
                ref={imgRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onClick={() => images[activeImage] && setLightboxOpen(true)}
                style={{ rotateX: springRotateX, rotateY: springRotateY, transformPerspective: 900 }}
                className="group aspect-[3/4] rounded-sm overflow-hidden relative bg-rule/40 cursor-zoom-in"
              >
                {images[activeImage] ? (
                  <Image
                    key={images[activeImage]}
                    src={images[activeImage]}
                    alt={product.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    placeholder="blur"
                    blurDataURL={BLUR_DATA_URL}
                    className="object-cover transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-105"
                  />
                ) : null}
                {discountPct ? (
                  <span className="absolute top-4 left-4 z-10 bg-forest text-paper text-xs font-medium px-2.5 py-1 rounded-sm">
                    {discountPct}% OFF
                  </span>
                ) : null}
                {images.length > 1 && (
                  <span className="absolute bottom-4 right-4 z-10 bg-black/50 text-paper text-[11px] font-body px-2 py-1 rounded-sm">
                    {activeImage + 1} / {images.length}
                  </span>
                )}
                {collection?.tagline && (
                  <span className="absolute bottom-4 left-4 z-10 font-mono text-[10px] tracking-[0.15em] uppercase text-paper bg-ink/55 backdrop-blur-sm rounded-sm px-2.5 py-1.5 max-w-[70%]">
                    {collection.tagline}
                  </span>
                )}
                <div className="absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-overlay bg-[radial-gradient(ellipse_at_center,_var(--paper)_1px,_transparent_1px)] bg-[size:12px_12px]" />
              </motion.div>

              {images.length > 1 && (
                <div className="mt-4 flex gap-3">
                  {images.map((img, i) => (
                    <button
                      key={img}
                      type="button"
                      onClick={() => setActiveImage(i)}
                      className={`group flex-1 aspect-square rounded-sm overflow-hidden relative border transition-colors duration-300 ${
                        activeImage === i ? 'border-forest' : 'border-rule hover:border-mid'
                      }`}
                    >
                      <Image
                        src={img}
                        alt={`${product.name} view ${i + 1}`}
                        fill
                        sizes="120px"
                        className="object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.6 }}
              >
                {collection && (
                  <div className="font-body text-xs tracking-[0.18em] text-forest uppercase">{collection.name}</div>
                )}
                {collection?.description && (
                  <p className="mt-3 font-display italic text-base text-mid leading-relaxed max-w-md">
                    {collection.description}
                  </p>
                )}
                <h1 className="mt-3 font-display font-light text-[clamp(32px,4.5vw,52px)] text-text leading-[1.05]">
                  {product.name}
                </h1>
                <div className="mt-4 font-body text-xl text-forest font-medium flex items-baseline gap-3">
                  {formatPrice(price)}
                  {product.compare_at_price && product.compare_at_price > price && (
                    <span className="font-body text-sm text-mid line-through">{formatPrice(product.compare_at_price)}</span>
                  )}
                  {discountPct ? (
                    <span className="font-body text-xs text-clay font-medium">{discountPct}% off</span>
                  ) : null}
                </div>
                {/* Prices are exclusive of GST, which is added at checkout —
                    said here rather than discovered on the payment screen. */}
                <div className="mt-1 font-body text-[11px] text-mid">Plus GST, calculated at checkout</div>

                {offers.length > 0 && (
                  <ul className="mt-4 space-y-1.5">
                    {offers.map((o) => (
                      <li key={o.label} className="flex items-baseline gap-2 font-body text-xs">
                        <span className="rounded-sm bg-forest/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-forest">
                          Offer
                        </span>
                        <span className="text-text">
                          <strong className="font-medium">{o.label}</strong>
                          <span className="text-mid"> — {o.description}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {lowStock && (
                  <p className="mt-2 font-body text-xs text-clay flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-clay animate-pulse flex-shrink-0" />
                    Only {stockQty} left in stock
                  </p>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.6, delay: 0.12 }}
              >
                {product.highlights && product.highlights.length > 0 && (
                  <ul className="mt-6 space-y-2 max-w-md">
                    {product.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2.5 font-body text-sm text-text leading-relaxed">
                        <span className="mt-1.5 h-1 w-1 rounded-full bg-forest flex-shrink-0" />
                        {h}
                      </li>
                    ))}
                  </ul>
                )}

                <p className="mt-6 font-body text-sm text-mid leading-relaxed max-w-md">
                  {product.description || product.short_description}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.6, delay: 0.24 }}
              >
              {colorways.length > 0 && (
                <div className="mt-8">
                  <div className="flex items-baseline gap-2 mb-3">
                    <div className="font-body text-[10px] tracking-[0.15em] text-text uppercase">Colour</div>
                    {selectedColor && <span className="font-body text-xs text-mid">{selectedColor.name}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {colorways.map((c) => {
                      const selectable = c.available && !!(c.front || c.back)
                      const selected = colorName === c.name
                      return (
                        <button
                          key={c.name}
                          type="button"
                          disabled={!selectable}
                          onClick={() => selectColor(c.name)}
                          title={selectable ? c.name : `${c.name} — coming soon`}
                          aria-label={selectable ? c.name : `${c.name}, coming soon`}
                          aria-pressed={selected}
                          className={`relative h-8 w-8 rounded-full border transition-all duration-300 ${
                            selected
                              ? 'border-forest ring-2 ring-forest ring-offset-2 ring-offset-paper'
                              : selectable
                              ? 'border-rule hover:border-forest'
                              : 'cursor-not-allowed border-rule opacity-40'
                          }`}
                          style={{ backgroundColor: c.hex }}
                        >
                          {/* A diagonal bar reads as "not orderable yet" without
                              relying on colour alone — on a colour control. */}
                          {!selectable && (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <span className="block h-px w-full rotate-45 bg-mid/70" />
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {product.variants && product.variants.length > 0 && (
                <div className="mt-8">
                  <div className="flex items-center mb-3">
                    <div className="font-body text-[10px] tracking-[0.15em] text-text uppercase">Size</div>
                    <SizeGuideModal />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.variants.map((v) => {
                      const oos = (v.inventory_quantity ?? 0) <= 0
                      return (
                        <button
                          key={v.id}
                          type="button"
                          disabled={oos}
                          onClick={() => setVariantId(v.id)}
                          className={`px-4 py-2 text-xs font-body tracking-[0.05em] uppercase rounded-sm border transition-colors duration-300 ${
                            variantId === v.id
                              ? 'bg-forest text-paper border-forest'
                              : oos
                              ? 'border-rule text-light/50 cursor-not-allowed line-through'
                              : 'border-rule text-mid hover:border-forest hover:text-forest'
                          }`}
                        >
                          {v.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="mt-8 flex items-center gap-6">
                <div className="flex items-center border border-rule rounded-sm">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-9 h-9 flex items-center justify-center text-mid hover:text-forest transition-colors"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-body text-sm tabular-nums">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="w-9 h-9 flex items-center justify-center text-mid hover:text-forest transition-colors"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>

                {product.is_customizable ? (
                  <Link
                    href={`/products/${product.slug}/customize?${new URLSearchParams({
                      ...(variantId ? { variant: variantId } : {}),
                      ...(colorName ? { color: colorName } : {}),
                    })}`}
                    data-cursor="magnetic"
                    data-cursor-text="Design"
                    className="flex-1 bg-forest text-paper px-8 py-3.5 text-[10px] tracking-[0.12em] uppercase font-body font-medium rounded-sm hover:bg-forest-mid transition-colors duration-300 text-center"
                  >
                    Customize This Shirt →
                  </Link>
                ) : (
                  <motion.button
                    ref={addBtn.ref as React.RefObject<HTMLButtonElement>}
                    onMouseMove={addBtn.onMouseMove}
                    onMouseLeave={addBtn.onMouseLeave}
                    style={{ x: addBtn.x, y: addBtn.y }}
                    onClick={handleAddToCart}
                    disabled={!inStock}
                    data-cursor="magnetic"
                    data-cursor-text="Add"
                    type="button"
                    className="flex-1 bg-forest text-paper px-8 py-3.5 text-[10px] tracking-[0.12em] uppercase font-body font-medium rounded-sm hover:bg-forest-mid transition-colors duration-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-forest"
                  >
                    {!inStock ? 'Out of Stock' : added ? 'Added to cart ✓' : 'Add to Cart'}
                  </motion.button>
                )}

                <button
                  type="button"
                  onClick={() => toggleItem(product.slug)}
                  aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
                  aria-pressed={saved}
                  data-cursor="magnetic"
                  data-cursor-text={saved ? 'Saved' : 'Save'}
                  className="w-[52px] h-[52px] flex-shrink-0 flex items-center justify-center border border-rule rounded-sm hover:border-forest transition-colors duration-300"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={mounted && saved ? 'var(--forest)' : 'none'} stroke={mounted && saved ? 'var(--forest)' : 'currentColor'} strokeWidth="1.5" className="text-mid">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </button>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-4">
                {PAYMENT_METHODS.map(({ label, icon: Icon }) => (
                  <div key={label} className="flex items-center gap-1.5 text-mid">
                    <Icon className="h-4 w-4" strokeWidth={1.5} />
                    <span className="font-body text-[11px]">{label}</span>
                  </div>
                ))}
              </div>

              <ProductDeliveryCheck subtotal={price * quantity} weightGrams={product.weight ?? 500} />

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Built from the real setting, so changing the threshold in
                    admin changes what the product page promises. */}
                <div className="flex items-start gap-2.5">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-forest mt-0.5 flex-shrink-0">
                    <path d={SHIP_ICON} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="font-body text-[11px] text-mid leading-snug">
                    Free shipping over {formatPrice(freeShippingThreshold)}
                  </span>
                </div>
                {TRUST_BADGES.map((badge) => (
                  <div key={badge.label} className="flex items-start gap-2.5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-forest mt-0.5 flex-shrink-0">
                      <path d={badge.icon} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="font-body text-[11px] text-mid leading-snug">{badge.label}</span>
                  </div>
                ))}
              </div>
              </motion.div>

              <div className="mt-8">
                {product.attributes && product.attributes.length > 0 && (
                  <Accordion
                    title="Specifications"
                    defaultOpen
                    content={
                      <dl className="space-y-2">
                        {product.attributes.map((a) => (
                          <div key={a.attribute_id} className="flex justify-between gap-4">
                            <dt className="text-mid">{a.attribute.name}</dt>
                            <dd className="text-text text-right">{a.value?.value ?? a.text_value}</dd>
                          </div>
                        ))}
                      </dl>
                    }
                  />
                )}
                <Accordion
                  title="Care"
                  content={product.care_instructions || 'Care varies by material — check the product label. When in doubt, cold wash and air dry.'}
                  defaultOpen={!(product.attributes && product.attributes.length > 0)}
                />
                <Accordion
                  title="Shipping"
                  content="Dispatched within 2 business days from our Dehradun facility. Delivery across India in 4–7 business days."
                />
                {collection?.tagline && (
                  <Accordion
                    title="Field Testing"
                    content={`Tested on the same trails behind ${collection.name} — ${collection.tagline.toLowerCase()} — before it ever reached a cart.`}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {product.story_blocks && product.story_blocks.length > 0 && (
        <section className="bg-paper">
          {product.story_blocks.map((block, i) => (
            <div key={i} className="py-16 md:py-28">
              <div
                className={`grid gap-1 md:gap-2 ${
                  block.images.length >= 3 ? 'grid-cols-3' : block.images.length === 2 ? 'grid-cols-2' : 'grid-cols-1'
                }`}
              >
                {block.images.map((img, j) => (
                  <div key={j} className="relative aspect-[3/4] md:aspect-auto md:h-[88vh]">
                    <Image
                      src={img}
                      alt={block.heading}
                      fill
                      sizes="(max-width: 768px) 100vw, 34vw"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
              <div className="max-w-xl mx-auto text-center px-6 mt-10">
                <h3 className="font-display font-light text-[clamp(26px,3.2vw,40px)] text-text leading-tight">
                  {block.heading}
                </h3>
                <p className="mt-4 font-body text-sm text-mid leading-relaxed">{block.body}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-4xl w-full bg-transparent border-none shadow-none p-0 [&>button]:text-paper">
          <div className="relative aspect-[3/4] md:aspect-[4/3] w-full">
            {images[activeImage] ? (
              <Image
                key={images[activeImage]}
                src={images[activeImage]}
                alt={product.name}
                fill
                sizes="90vw"
                className="object-contain"
              />
            ) : null}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => showImage(activeImage - 1)}
                  aria-label="Previous image"
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-black/50 text-paper rounded-full hover:bg-black/70 transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => showImage(activeImage + 1)}
                  aria-label="Next image"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-black/50 text-paper rounded-full hover:bg-black/70 transition-colors"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 text-paper text-xs font-body px-2.5 py-1 rounded-sm">
                  {activeImage + 1} / {images.length}
                </span>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {related.length > 0 && (
        <section className="bg-paper px-6 md:px-10 pb-24">
          <div className="max-w-7xl mx-auto">
            <div className="mb-10 font-body text-xs tracking-[0.18em] text-forest uppercase">You Might Also Like</div>
            <div ref={relatedGridRef} className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-8 sm:gap-y-12 lg:grid-cols-3">
              {related.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      <RecentlyViewed
        excludeSlug={product.slug}
        className={`bg-paper px-6 md:px-10 pb-24 ${related.length > 0 ? 'pt-8 border-t border-rule' : ''}`}
      />
    </>
  )
}
