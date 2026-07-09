'use client'

import { Suspense, useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import ProductCard from '@/components/ProductCard'
import { PRODUCTS, COLLECTIONS, CATEGORY_TILES } from '@/lib/constants'

function ShopContent() {
  // Homepage category tiles land here as /shop?category=layers etc.
  const searchParams = useSearchParams()
  const categoryParam = searchParams.get('category')
  const initialCategory = CATEGORY_TILES.some((t) => t.id === categoryParam) ? categoryParam! : 'all'

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCollection, setSelectedCollection] = useState<string>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory)
  const [priceRange, setPriceRange] = useState<number>(5000)

  // Filter logic
  const filteredProducts = useMemo(() => {
    return PRODUCTS.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.desc.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesCollection = selectedCollection === 'all' || product.collectionId === selectedCollection

      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory

      const matchesPrice = product.price <= priceRange

      return matchesSearch && matchesCollection && matchesCategory && matchesPrice
    })
  }, [searchQuery, selectedCollection, selectedCategory, priceRange])

  return (
    <main className="pt-32 pb-24 px-6 md:px-10 bg-paper min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-14 border-b border-rule pb-10">
          <h1 className="font-display text-[clamp(40px,6vw,72px)] text-text leading-none uppercase mb-6">
            Catalogue
          </h1>
          <p className="font-body text-mid max-w-lg">
            Equipment for the miles that turn into stories. Browse our full range of field-tested gear.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-12">
          {/* Filter Sidebar */}
          <aside className="space-y-10">
            {/* Search */}
            <div>
              <h3 className="font-body text-xs tracking-[0.18em] text-forest uppercase mb-4">Search</h3>
              <input
                type="text"
                placeholder="Search gear..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-b border-rule pb-2 font-body text-sm text-text focus:outline-none focus:border-forest transition-colors"
              />
            </div>

            {/* Categories */}
            <div>
              <h3 className="font-body text-xs tracking-[0.18em] text-forest uppercase mb-4">Categories</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center w-4 h-4 border border-rule rounded-sm group-hover:border-forest transition-colors">
                    {selectedCategory === 'all' && <div className="w-2 h-2 bg-forest rounded-sm" />}
                  </div>
                  <span className="font-body text-sm text-text">All Categories</span>
                  <input
                    type="radio"
                    name="category"
                    className="sr-only"
                    checked={selectedCategory === 'all'}
                    onChange={() => setSelectedCategory('all')}
                  />
                </label>
                {CATEGORY_TILES.map((t) => (
                  <label key={t.id} className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center w-4 h-4 border border-rule rounded-sm group-hover:border-forest transition-colors">
                      {selectedCategory === t.id && <div className="w-2 h-2 bg-forest rounded-sm" />}
                    </div>
                    <span className="font-body text-sm text-text">{t.name}</span>
                    <input
                      type="radio"
                      name="category"
                      className="sr-only"
                      checked={selectedCategory === t.id}
                      onChange={() => setSelectedCategory(t.id)}
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Collections */}
            <div>
              <h3 className="font-body text-xs tracking-[0.18em] text-forest uppercase mb-4">Collections</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center w-4 h-4 border border-rule rounded-sm group-hover:border-forest transition-colors">
                    {selectedCollection === 'all' && <div className="w-2 h-2 bg-forest rounded-sm" />}
                  </div>
                  <span className="font-body text-sm text-text">All Gear</span>
                  <input
                    type="radio"
                    name="collection"
                    className="sr-only"
                    checked={selectedCollection === 'all'}
                    onChange={() => setSelectedCollection('all')}
                  />
                </label>
                {COLLECTIONS.map((c) => (
                  <label key={c.id} className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center w-4 h-4 border border-rule rounded-sm group-hover:border-forest transition-colors">
                      {selectedCollection === c.id && <div className="w-2 h-2 bg-forest rounded-sm" />}
                    </div>
                    <span className="font-body text-sm text-text">{c.name}</span>
                    <input
                      type="radio"
                      name="collection"
                      className="sr-only"
                      checked={selectedCollection === c.id}
                      onChange={() => setSelectedCollection(c.id)}
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Price Range */}
            <div>
              <h3 className="font-body text-xs tracking-[0.18em] text-forest uppercase mb-4">Max Price: Rs. {priceRange.toLocaleString()}</h3>
              <input
                type="range"
                min="500"
                max="5000"
                step="100"
                value={priceRange}
                onChange={(e) => setPriceRange(Number(e.target.value))}
                className="w-full accent-forest"
              />
              <div className="flex justify-between mt-2 font-body text-xs text-mid">
                <span>Rs. 500</span>
                <span>Rs. 5,000</span>
              </div>
            </div>
          </aside>

          {/* Product Grid */}
          <div>
            <div className="mb-8 flex justify-between items-center text-sm font-body text-mid">
              <span>Showing {filteredProducts.length} results</span>
            </div>

            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-12">
                {filteredProducts.map((p) => (
                  <ProductCard key={p.slug} product={p} />
                ))}
              </div>
            ) : (
              <div className="py-20 text-center border border-dashed border-rule rounded-sm">
                <p className="font-body text-mid">No gear found matching your criteria.</p>
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setSelectedCollection('all')
                    setSelectedCategory('all')
                    setPriceRange(5000)
                  }}
                  className="mt-4 text-xs font-body tracking-widest uppercase text-forest hover:underline"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

export default function ShopPage() {
  return (
    <>
      <NavBar />
      {/* useSearchParams requires a Suspense boundary for prerendering */}
      <Suspense fallback={<main className="pt-32 pb-24 px-6 md:px-10 bg-paper min-h-screen" />}>
        <ShopContent />
      </Suspense>
      <FooterSection />
    </>
  )
}
