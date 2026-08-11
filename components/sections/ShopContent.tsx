'use client'

import { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { SlidersHorizontal } from 'lucide-react'
import ProductCard from '@/components/ProductCard'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import type { ProductWithCollection, Collection, Category } from '@/types/database'

// Real prices are paise; the slider still speaks whole rupees, so this is the
// one place that unit gets bridged for the UI control itself.
const MAX_PRICE_RUPEES = 5000

export default function ShopContent({
  products,
  collections,
  categories,
}: {
  products: ProductWithCollection[]
  collections: Collection[]
  categories: Category[]
}) {
  // Homepage category tiles land here as /shop?category=layers etc.
  const searchParams = useSearchParams()
  const categoryParam = searchParams.get('category')
  const initialCategory = categories.some((c) => c.slug === categoryParam) ? categoryParam! : 'all'

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCollection, setSelectedCollection] = useState<string>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory)
  const [priceRange, setPriceRange] = useState<number>(MAX_PRICE_RUPEES)
  // Below lg, filters live behind this instead of stacking above the grid —
  // the sidebar used to render inline on mobile too, so reaching the actual
  // products meant scrolling past a full screen of search box + every
  // category + every collection first.
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Filter logic
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.short_description ?? '').toLowerCase().includes(searchQuery.toLowerCase())

      const matchesCollection = selectedCollection === 'all' || product.collection?.slug === selectedCollection

      const matchesCategory =
        selectedCategory === 'all' ||
        product.categories?.some((pc) => categories.find((c) => c.id === pc.category_id)?.slug === selectedCategory)

      const matchesPrice = product.price <= priceRange * 100

      return matchesSearch && matchesCollection && matchesCategory && matchesPrice
    })
  }, [products, categories, searchQuery, selectedCollection, selectedCategory, priceRange])

  const activeFilterCount = [selectedCategory !== 'all', selectedCollection !== 'all', priceRange !== MAX_PRICE_RUPEES].filter(
    Boolean
  ).length

  function clearFilters() {
    setSearchQuery('')
    setSelectedCollection('all')
    setSelectedCategory('all')
    setPriceRange(MAX_PRICE_RUPEES)
  }

  // Rendered twice — once in the always-visible desktop sidebar, once inside
  // the mobile modal — so radio inputs get a per-instance name suffix. The
  // desktop copy stays in the DOM (just visually hidden) below lg, and two
  // same-named native radio groups mounted at once is invalid regardless of
  // which one is on screen.
  function renderFilterFields(idPrefix: string) {
    return (
      <>
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

        <div>
          <h3 className="font-body text-xs tracking-[0.18em] text-forest uppercase mb-4">Categories</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative flex items-center justify-center w-4 h-4 border border-rule rounded-sm group-hover:border-forest transition-colors flex-shrink-0">
                {selectedCategory === 'all' && <div className="w-2 h-2 bg-forest rounded-sm" />}
              </div>
              <span className="font-body text-sm text-text">All Categories</span>
              <input
                type="radio"
                name={`${idPrefix}-category`}
                className="sr-only"
                checked={selectedCategory === 'all'}
                onChange={() => setSelectedCategory('all')}
              />
            </label>
            {categories.map((t) => (
              <label key={t.id} className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center w-4 h-4 border border-rule rounded-sm group-hover:border-forest transition-colors flex-shrink-0">
                  {selectedCategory === t.slug && <div className="w-2 h-2 bg-forest rounded-sm" />}
                </div>
                <span className="font-body text-sm text-text">{t.name}</span>
                <input
                  type="radio"
                  name={`${idPrefix}-category`}
                  className="sr-only"
                  checked={selectedCategory === t.slug}
                  onChange={() => setSelectedCategory(t.slug)}
                />
              </label>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-body text-xs tracking-[0.18em] text-forest uppercase mb-4">Collections</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative flex items-center justify-center w-4 h-4 border border-rule rounded-sm group-hover:border-forest transition-colors flex-shrink-0">
                {selectedCollection === 'all' && <div className="w-2 h-2 bg-forest rounded-sm" />}
              </div>
              <span className="font-body text-sm text-text">All Gear</span>
              <input
                type="radio"
                name={`${idPrefix}-collection`}
                className="sr-only"
                checked={selectedCollection === 'all'}
                onChange={() => setSelectedCollection('all')}
              />
            </label>
            {collections.map((c) => (
              <label key={c.id} className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center w-4 h-4 border border-rule rounded-sm group-hover:border-forest transition-colors flex-shrink-0">
                  {selectedCollection === c.slug && <div className="w-2 h-2 bg-forest rounded-sm" />}
                </div>
                <span className="font-body text-sm text-text">{c.name}</span>
                <input
                  type="radio"
                  name={`${idPrefix}-collection`}
                  className="sr-only"
                  checked={selectedCollection === c.slug}
                  onChange={() => setSelectedCollection(c.slug)}
                />
              </label>
            ))}
          </div>
        </div>

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
      </>
    )
  }

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
          {/* Filter Sidebar — desktop only. Below lg the same controls live in
              the modal opened from the floating Filters button instead. */}
          <aside className="hidden lg:block space-y-10">{renderFilterFields('desktop')}</aside>

          {/* Product Grid */}
          <div>
            {/* Sticky so it stays reachable while scrolling a long grid — the
                one thing worth calling "floating" here — with the trigger
                that replaces the old always-stacked mobile filter list. */}
            <div className="sticky top-14 z-30 -mx-6 mb-8 flex items-center justify-between gap-4 border-b border-rule bg-paper/95 px-6 py-4 backdrop-blur-sm md:-mx-10 md:px-10 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
              <span className="font-body text-sm text-mid">Showing {filteredProducts.length} results</span>
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="flex flex-shrink-0 items-center gap-2 rounded-full border border-rule bg-paper px-4 py-2 font-body text-[11px] uppercase tracking-[0.1em] text-text transition-colors hover:border-forest lg:hidden"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-forest text-[10px] text-paper">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-8 sm:gap-y-12 xl:grid-cols-3">
                {filteredProducts.map((p) => (
                  <ProductCard key={p.slug} product={p} />
                ))}
              </div>
            ) : (
              <div className="py-20 text-center border border-dashed border-rule rounded-sm">
                <p className="font-body text-mid">No gear found matching your criteria.</p>
                <button onClick={clearFilters} className="mt-4 text-xs font-body tracking-widest uppercase text-forest hover:underline">
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-h-[85vh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-lg border border-rule bg-paper p-6 text-text shadow-xl sm:rounded-lg">
          <DialogTitle className="font-display text-xl text-text">Filter Gear</DialogTitle>
          <div className="mt-2 space-y-8">{renderFilterFields('modal')}</div>
          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={clearFilters}
              className="flex-1 rounded-sm border border-rule py-3 font-body text-[11px] uppercase tracking-[0.1em] text-mid transition-colors hover:border-forest hover:text-forest"
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="flex-1 rounded-sm bg-forest py-3 font-body text-[11px] uppercase tracking-[0.1em] text-paper transition-colors hover:bg-forest-mid"
            >
              Show {filteredProducts.length}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}
