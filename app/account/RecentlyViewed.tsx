'use client'

import { useEffect, useState } from 'react'
import { PRODUCTS } from '@/lib/constants'
import ProductCard from '@/components/ProductCard'
import Link from 'next/link'

export default function RecentlyViewed() {
  const [items, setItems] = useState<string[]>([])

  useEffect(() => {
    const stored = localStorage.getItem('dewdropz_recently_viewed')
    if (stored) {
      try {
        setItems(JSON.parse(stored))
      } catch (e) {}
    }
  }, [])

  if (items.length === 0) return null

  const products = items.map((slug) => PRODUCTS.find((p) => p.slug === slug)).filter(Boolean)

  return (
    <section className="mt-16 pt-16 border-t border-rule">
      <div className="flex items-center justify-between mb-8">
        <h2 className="font-display text-2xl text-text">Recently Viewed</h2>
        <Link href="/shop" className="font-body text-[10px] tracking-widest uppercase text-mid hover:text-forest transition-colors">
          View All Gear
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((p) => (
          p && <ProductCard key={p.slug} product={p} />
        ))}
      </div>
    </section>
  )
}
