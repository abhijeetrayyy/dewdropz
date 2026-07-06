'use client'

import { useWishlist } from '@/providers/WishlistProvider'
import { PRODUCTS } from '@/lib/constants'
import ProductCard from '@/components/ProductCard'
import Link from 'next/link'

export default function WishlistPage() {
  const { items } = useWishlist()
  
  const wishlistProducts = PRODUCTS.filter((p) => items.includes(p.slug))

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl text-text mb-6">Your Wishlist</h2>
      </div>

      {wishlistProducts.length === 0 ? (
        <div className="p-12 border border-dashed border-rule rounded-sm text-center bg-paper">
          <p className="font-body text-sm text-mid mb-4">You haven't saved any gear yet.</p>
          <Link href="/shop" className="font-body text-xs tracking-widest uppercase text-forest hover:underline">
            Explore Collection
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
          {wishlistProducts.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      )}
    </div>
  )
}
