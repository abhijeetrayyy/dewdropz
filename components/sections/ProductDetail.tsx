'use client'

import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, useMotionValue, useSpring } from 'motion/react'
import { useCart } from '@/providers/CartProvider'
import { useMagneticHover } from '@/hooks/useMagneticHover'
import ProductCard from '@/components/ProductCard'
import Accordion from '@/components/Accordion'
import SizeGuideModal from '@/components/SizeGuideModal'
import { trackEvent } from '@/lib/analytics'
import type { COLLECTIONS, PRODUCTS } from '@/lib/constants'

interface ProductDetailProps {
  product: (typeof PRODUCTS)[number]
  collection: (typeof COLLECTIONS)[number] | undefined
  related: (typeof PRODUCTS)[number][]
}

const VIEWS = ['Front', 'Detail', 'Texture'] as const

const TRUST_BADGES = [
  { label: 'Free shipping over Rs. 3,000', icon: 'M3 12h18M3 12l4-4m-4 4l4 4M21 12l-4-4m4 4l-4 4' },
  { label: '7-day easy returns', icon: 'M4 4v6h6M4 10a8 8 0 1 0 2.3-5.7L4 7' },
  { label: 'Field tested at altitude', icon: 'M12 3l9 18H3L12 3z' },
]

export default function ProductDetail({ product, collection, related }: ProductDetailProps) {
  const { addItem } = useCart()
  const [size, setSize] = useState(product.sizes[0])
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const [view, setView] = useState<(typeof VIEWS)[number]>('Front')

  const imgRef = useRef<HTMLDivElement>(null)
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
    trackEvent('add_to_cart', { currency: 'INR', value: product.price, items: [{ item_id: product.slug, item_name: product.name }] })
    addItem(
      { slug: product.slug, name: product.name, price: product.price, gradient: product.gradient, size },
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
      } catch (e) {}
    }
    items = items.filter((s) => s !== product.slug)
    items.unshift(product.slug)
    if (items.length > 6) items = items.slice(0, 6)
    localStorage.setItem('dewdropz_recently_viewed', JSON.stringify(items))
  }, [product.slug])

  return (
    <>
      <section className="bg-paper px-6 md:px-10 pt-32 pb-24 md:pt-40">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 font-body text-xs text-mid">
            <Link href="/collections" className="hover:text-forest transition-colors">
              Collections
            </Link>
            {collection && (
              <>
                {' / '}
                <Link href={`/collections/${collection.id}`} className="hover:text-forest transition-colors">
                  {collection.name}
                </Link>
              </>
            )}
            {' / '}
            <span className="text-text">{product.name}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            <div>
              <motion.div
                ref={imgRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                style={{ rotateX: springRotateX, rotateY: springRotateY, transformPerspective: 900 }}
                className="aspect-[3/4] rounded-sm overflow-hidden relative"
              >
                <div
                  className="h-full w-full transition-transform duration-500"
                  style={{
                    background: product.gradient,
                    transform: view === 'Detail' ? 'scale(1.6)' : view === 'Texture' ? 'scale(1.15) rotate(6deg)' : 'scale(1)',
                  }}
                />
                {view === 'Texture' && (
                  <div className="absolute inset-0 opacity-[0.12] pointer-events-none mix-blend-overlay bg-[radial-gradient(ellipse_at_center,_var(--paper)_1.5px,_transparent_1.5px)] bg-[size:8px_8px]" />
                )}
                {view === 'Front' && (
                  <div className="absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-overlay bg-[radial-gradient(ellipse_at_center,_var(--paper)_1px,_transparent_1px)] bg-[size:12px_12px]" />
                )}
              </motion.div>

              <div className="mt-4 flex gap-3">
                {VIEWS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={`flex-1 aspect-square rounded-sm overflow-hidden relative border transition-colors duration-300 ${
                      view === v ? 'border-forest' : 'border-rule hover:border-mid'
                    }`}
                  >
                    <div className="absolute inset-0" style={{ background: product.gradient }} />
                    <div className="absolute inset-0 bg-ink/10" />
                    <span className="absolute bottom-1 left-0 right-0 text-center font-body text-[9px] tracking-[0.1em] uppercase text-white drop-shadow">
                      {v}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              {collection && (
                <div className="font-body text-xs tracking-[0.18em] text-forest uppercase">{collection.name}</div>
              )}
              <h1 className="mt-3 font-display font-light text-[clamp(32px,4.5vw,52px)] text-text leading-[1.05]">
                {product.name}
              </h1>
              <div className="mt-4 font-body text-xl text-forest font-medium">
                Rs. {product.price.toLocaleString('en-IN')}
              </div>

              <p className="mt-6 font-body text-sm text-mid leading-relaxed max-w-md">{product.longDescription}</p>

              <div className="mt-8">
                <div className="flex items-center mb-3">
                  <div className="font-body text-[10px] tracking-[0.15em] text-text uppercase">Size</div>
                  <SizeGuideModal />
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSize(s)}
                      className={`px-4 py-2 text-xs font-body tracking-[0.05em] uppercase rounded-sm border transition-colors duration-300 ${
                        size === s
                          ? 'bg-forest text-paper border-forest'
                          : 'border-rule text-mid hover:border-forest hover:text-forest'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

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

                <motion.button
                  ref={addBtn.ref as React.RefObject<HTMLButtonElement>}
                  onMouseMove={addBtn.onMouseMove}
                  onMouseLeave={addBtn.onMouseLeave}
                  style={{ x: addBtn.x, y: addBtn.y }}
                  onClick={handleAddToCart}
                  data-cursor="magnetic"
                  data-cursor-text="Add"
                  type="button"
                  className="flex-1 bg-forest text-paper px-8 py-3.5 text-[10px] tracking-[0.12em] uppercase font-body font-medium rounded-sm hover:bg-forest-mid transition-colors duration-300"
                >
                  {added ? 'Added to cart ✓' : 'Add to Cart'}
                </motion.button>
              </div>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {TRUST_BADGES.map((badge) => (
                  <div key={badge.label} className="flex items-start gap-2.5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-forest mt-0.5 flex-shrink-0">
                      <path d={badge.icon} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="font-body text-[11px] text-mid leading-snug">{badge.label}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <Accordion title="Materials" content={product.materials} defaultOpen />
                <Accordion title="Care" content={product.care} />
                <Accordion
                  title="Shipping"
                  content="Dispatched within 2 business days from our Dehradun facility. Delivery across India in 4–7 business days."
                />
                {collection && (
                  <Accordion
                    title="Field Testing"
                    content={`Tested on the same trails behind ${collection.name} — ${collection.bestFor.toLowerCase()} — before it ever reached a cart.`}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="bg-paper px-6 md:px-10 pb-24">
          <div className="max-w-7xl mx-auto">
            <div className="mb-10 font-body text-xs tracking-[0.18em] text-forest uppercase">You Might Also Like</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
              {related.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}
