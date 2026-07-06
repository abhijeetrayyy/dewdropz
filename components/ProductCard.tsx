'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, useMotionValue, useSpring } from 'motion/react'
import { useCart } from '@/providers/CartProvider'
import { useWishlist } from '@/providers/WishlistProvider'
import { BLUR_DATA_URL } from '@/lib/constants'
import type { PRODUCTS } from '@/lib/constants'

export default function ProductCard({ product }: { product: (typeof PRODUCTS)[number] }) {
  const { addItem } = useCart()
  const ref = useRef<HTMLDivElement>(null)
  const rotateX = useMotionValue(0)
  const rotateY = useMotionValue(0)
  const springRotateX = useSpring(rotateX, { stiffness: 200, damping: 20 })
  const springRotateY = useSpring(rotateY, { stiffness: 200, damping: 20 })

  const [holoX, setHoloX] = useState(50)
  const [holoY, setHoloY] = useState(50)
  const [holoOpacity, setHoloOpacity] = useState(0)
  const [added, setAdded] = useState(false)

  const handleMouseMove = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    rotateY.set(px * 14)
    rotateX.set(py * -14)

    const xPercent = ((e.clientX - rect.left) / rect.width) * 100
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100
    setHoloX(xPercent)
    setHoloY(yPercent)
    setHoloOpacity(0.48)
  }

  const handleMouseLeave = () => {
    rotateX.set(0)
    rotateY.set(0)
    setHoloOpacity(0)
  }

  const handleAddToCart = () => {
    addItem({
      slug: product.slug,
      name: product.name,
      price: product.price,
      gradient: product.gradient,
      size: product.sizes[0],
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 1600)
  }

  const { toggleItem, hasItem } = useWishlist()
  
  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault()
    toggleItem(product.slug)
  }

  return (
    <div className="product-card group relative">
      <button 
        onClick={handleWishlist}
        className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center bg-paper/80 backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-paper"
      >
        <svg 
          width="16" height="16" viewBox="0 0 24 24" 
          fill={hasItem(product.slug) ? "var(--forest)" : "none"} 
          stroke={hasItem(product.slug) ? "var(--forest)" : "currentColor"} 
          strokeWidth="1.5"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
        </svg>
      </button>

      <Link href={`/products/${product.slug}`} data-cursor="image" data-cursor-text="View">
        <motion.div
          ref={ref}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ rotateX: springRotateX, rotateY: springRotateY, transformPerspective: 800 }}
          className="product-image aspect-[3/4] rounded-sm overflow-hidden relative"
        >
          <div className="h-full w-full relative" style={{ background: product.gradient }}>
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, 25vw"
              placeholder="blur"
              blurDataURL={BLUR_DATA_URL}
              className="object-cover"
            />
          </div>

          <div
            className="absolute inset-0 pointer-events-none mix-blend-color-dodge transition-opacity duration-300 z-10"
            style={{
              opacity: holoOpacity,
              background: `
                radial-gradient(
                  circle at ${holoX}% ${holoY}%,
                  rgba(255, 255, 255, 0.35) 0%,
                  rgba(123, 164, 111, 0.12) 30%,
                  rgba(246, 243, 230, 0.08) 60%,
                  rgba(0, 0, 0, 0) 90%
                ),
                linear-gradient(
                  ${holoX + holoY}deg,
                  rgba(255, 255, 255, 0) 0%,
                  rgba(123, 164, 111, 0.08) 35%,
                  rgba(184, 130, 107, 0.08) 65%,
                  rgba(255, 255, 255, 0) 100%
                )
              `,
            }}
          />

          <div className="absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-overlay bg-[radial-gradient(ellipse_at_center,_var(--paper)_1px,_transparent_1px)] bg-[size:12px_12px]" />
        </motion.div>
      </Link>

      <Link href={`/products/${product.slug}`}>
        <h3 className="font-display text-xl mt-4 mb-1 hover:text-forest transition-colors duration-300">
          {product.name}
        </h3>
      </Link>
      <p className="font-body text-sm text-mid">{product.desc}</p>
      <div className="mt-2 overflow-hidden relative h-6">
        <div
          className={`transition-transform duration-300 ${added ? '-translate-y-full' : 'group-hover:-translate-y-full'}`}
        >
          <span className="font-body text-sm font-medium text-forest block h-6">
            Rs. {product.price.toLocaleString('en-IN')}
          </span>
          <button
            type="button"
            onClick={handleAddToCart}
            data-cursor="magnetic"
            className="font-body text-sm font-medium text-forest block h-6 cursor-pointer hover:underline text-left"
          >
            {added ? 'Added ✓' : 'Add to cart'}
          </button>
        </div>
      </div>
    </div>
  )
}
