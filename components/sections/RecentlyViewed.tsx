'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getProductsBySlugs } from '@/actions/products'
import ProductCard from '@/components/ProductCard'
import type { ProductWithCollection } from '@/types/database'

// Shared across the account page, product page, and cart — each mounts it in
// a different layout context, so the outer section styling is caller-supplied
// (className) rather than hardcoded; the data-fetch/grid logic is identical
// everywhere. excludeSlug drops the product a shopper is currently looking
// at out of its own "recently viewed" rail, since it's redundant there.
export default function RecentlyViewed({
  className = 'mt-16 pt-16 border-t border-rule',
  excludeSlug,
}: {
  className?: string
  excludeSlug?: string
} = {}) {
  const [products, setProducts] = useState<ProductWithCollection[]>([])

  useEffect(() => {
    const stored = localStorage.getItem('dewdropz_recently_viewed')
    if (!stored) return
    let slugs: string[] = []
    try {
      slugs = JSON.parse(stored)
    } catch {
      return
    }
    if (excludeSlug) slugs = slugs.filter((s) => s !== excludeSlug)
    if (slugs.length === 0) return
    getProductsBySlugs(slugs)
      .then((fetched) => {
        // Preserve most-recently-viewed-first order — the query doesn't guarantee it.
        const bySlug = new Map(fetched.map((p) => [p.slug, p]))
        setProducts(slugs.map((s) => bySlug.get(s)).filter((p): p is ProductWithCollection => Boolean(p)))
      })
      .catch(() => setProducts([]))
  }, [excludeSlug])

  if (products.length === 0) return null

  return (
    <section className={className}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-display text-2xl text-text">Recently Viewed</h2>
          <Link href="/shop" className="font-body text-[10px] tracking-widest uppercase text-mid hover:text-forest transition-colors">
            View All Gear
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
          {products.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </div>
    </section>
  )
}
