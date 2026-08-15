'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'
import ProductCard from '@/components/ProductCard'
import { BLUR_DATA_URL } from '@/lib/constants'
import type { ProductWithCollection, Collection, Category } from '@/types/database'

// ── The shop ─────────────────────────────────────────────────────────────────
// Built for the catalogue this is becoming — bottles, mugs, packs, many
// collections — not for the three blanks that happen to be in it today.
//
// The rail this replaces was a 280px sidebar of radio lists plus a modal for
// phones. That shape gets worse as a catalogue grows: it costs a column on every
// screen, it hides the choices behind a button on the device most people shop
// on, and it can only ever be a flat list. Filtering lives across the top now —
// chips a thumb can reach, the same control on every breakpoint, and it stays
// legible whether there are four categories or forty.
//
// Everything here is driven by what is actually in the backend. Categories and
// collections with nothing behind them never render, so a control can never
// promise a result it cannot deliver; the moment stock is attached they appear
// on their own, with no change here.

type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'newest'

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'featured', label: 'Featured' },
  { key: 'newest', label: 'Newest' },
  { key: 'price-asc', label: 'Price ↑' },
  { key: 'price-desc', label: 'Price ↓' },
]

/** Price bands, derived from the catalogue rather than hardcoded, so they stay
 *  meaningful when a ₹399 bottle and a ₹4,000 shell are both on the shelf. */
function priceBands(products: ProductWithCollection[]) {
  if (products.length < 4) return []
  const prices = products.map((p) => p.price).sort((a, b) => a - b)
  const lo = prices[Math.floor(prices.length / 3)]
  const hi = prices[Math.floor((prices.length * 2) / 3)]
  const r = (paise: number) => Math.round(paise / 100)
  if (r(lo) === r(hi)) return []
  return [
    { key: 'low', label: `Under ₹${r(lo).toLocaleString('en-IN')}`, test: (p: number) => p < lo },
    { key: 'mid', label: `₹${r(lo).toLocaleString('en-IN')} – ₹${r(hi).toLocaleString('en-IN')}`, test: (p: number) => p >= lo && p <= hi },
    { key: 'high', label: `Over ₹${r(hi).toLocaleString('en-IN')}`, test: (p: number) => p > hi },
  ]
}

export default function ShopContent({
  products,
  collections,
  categories,
}: {
  products: ProductWithCollection[]
  collections: Collection[]
  categories: Category[]
}) {
  const searchParams = useSearchParams()
  const categoryParam = searchParams.get('category')
  const collectionParam = searchParams.get('collection')

  // Only ever offer a filter that can return something.
  const stockedCategories = useMemo(
    () => categories.filter((c) => products.some((p) => p.categories?.some((pc) => pc.category_id === c.id))),
    [categories, products]
  )
  const stockedCollections = useMemo(
    () => collections.filter((c) => products.some((p) => p.collection?.slug === c.slug)),
    [collections, products]
  )

  const [category, setCategory] = useState<string>(
    stockedCategories.some((c) => c.slug === categoryParam) ? categoryParam! : 'all'
  )
  const [collection, setCollection] = useState<string>(
    stockedCollections.some((c) => c.slug === collectionParam) ? collectionParam! : 'all'
  )
  const [band, setBand] = useState<string>('all')
  const [sort, setSort] = useState<SortKey>('featured')

  const bands = useMemo(() => priceBands(products), [products])

  const countFor = (predicate: (p: ProductWithCollection) => boolean) => products.filter(predicate).length

  const filtered = useMemo(() => {
    const activeBand = bands.find((b) => b.key === band)
    const out = products.filter((p) => {
      const okCategory =
        category === 'all' ||
        p.categories?.some((pc) => stockedCategories.find((c) => c.id === pc.category_id)?.slug === category)
      const okCollection = collection === 'all' || p.collection?.slug === collection
      const okBand = !activeBand || activeBand.test(p.price)
      return okCategory && okCollection && okBand
    })

    const sorted = [...out]
    if (sort === 'price-asc') sorted.sort((a, b) => a.price - b.price)
    if (sort === 'price-desc') sorted.sort((a, b) => b.price - a.price)
    if (sort === 'newest')
      sorted.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
    return sorted
  }, [products, stockedCategories, category, collection, band, bands, sort])

  const activeChips = [
    category !== 'all' && {
      label: stockedCategories.find((c) => c.slug === category)?.name ?? category,
      clear: () => setCategory('all'),
    },
    collection !== 'all' && {
      label: stockedCollections.find((c) => c.slug === collection)?.name ?? collection,
      clear: () => setCollection('all'),
    },
    band !== 'all' && { label: bands.find((b) => b.key === band)?.label ?? '', clear: () => setBand('all') },
  ].filter(Boolean) as { label: string; clear: () => void }[]

  function clearAll() {
    setCategory('all')
    setCollection('all')
    setBand('all')
  }

  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-full border px-4 py-2 font-body text-[11px] uppercase tracking-[0.1em] transition-colors duration-200 ${
      active
        ? 'border-forest bg-forest text-paper'
        : 'border-rule text-mid hover:border-forest hover:text-forest'
    }`

  return (
    <main className="min-h-screen bg-paper pb-24 pt-32">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        {/* Masthead. Short, because a shop is for scanning — the facts under it
            are read from the catalogue so they cannot drift as stock lands. */}
        <div className="border-b border-rule pb-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-forest">
            Made to order · Printed in Dehradun
          </p>
          <h1 className="mt-4 font-display text-[clamp(38px,5.5vw,68px)] leading-[0.92] text-text">The shop.</h1>
          {products.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-2 font-mono text-[10px] uppercase tracking-[0.18em] text-mid">
              <span>
                {products.length} {products.length === 1 ? 'piece' : 'pieces'}
              </span>
              <span>
                ₹{Math.round(Math.min(...products.map((p) => p.price)) / 100).toLocaleString('en-IN')} — ₹
                {Math.round(Math.max(...products.map((p) => p.price)) / 100).toLocaleString('en-IN')}
              </span>
              <span>Ships from Dehradun in 2 days</span>
            </div>
          )}
        </div>

        {/* Browse by world before browsing by filter. Collections carry real
            photography, so they are the one part of this page that can sell
            something on its own — a filter chip never will. Hidden entirely
            until collections actually hold stock. */}
        {stockedCollections.length > 0 && (
          <div className="mt-12">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-mid">Collections</h2>
              {collection !== 'all' && (
                <button
                  type="button"
                  onClick={() => setCollection('all')}
                  className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest hover:underline"
                >
                  Show all
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {stockedCollections.map((c) => {
                const on = collection === c.slug
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCollection(on ? 'all' : c.slug)}
                    aria-pressed={on}
                    className={`group relative aspect-[16/9] overflow-hidden rounded-sm border text-left transition-colors duration-300 ${
                      on ? 'border-forest' : 'border-transparent hover:border-rule'
                    }`}
                  >
                    {c.image_url ? (
                      <Image
                        src={c.image_url}
                        alt=""
                        fill
                        sizes="(min-width:1024px) 300px, 45vw"
                        placeholder="blur"
                        blurDataURL={BLUR_DATA_URL}
                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                    ) : (
                      <span className="absolute inset-0" style={{ background: c.gradient ?? '#2A3B31' }} />
                    )}
                    <span className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
                    <span className="absolute inset-x-0 bottom-0 p-3">
                      <span className="block font-display text-sm text-paper">{c.name}</span>
                      <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.14em] text-paper/60">
                        {countFor((p) => p.collection?.slug === c.slug)} pieces
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* The control bar. Sticky, because on a long grid the filters have to
            stay in reach — and identical on every breakpoint, so a phone is not
            sent to a modal to do what a desktop does inline. */}
        <div className="sticky top-14 z-30 -mx-6 mt-12 border-y border-rule bg-paper/95 px-6 py-3 backdrop-blur-sm md:-mx-10 md:px-10">
          <div className="flex items-center gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {stockedCategories.length > 0 && (
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setCategory('all')} className={chip(category === 'all')}>
                  All
                </button>
                {stockedCategories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(category === c.slug ? 'all' : c.slug)}
                    className={chip(category === c.slug)}
                  >
                    {c.name}
                    <span className="ml-2 opacity-50">
                      {countFor((p) => !!p.categories?.some((pc) => pc.category_id === c.id))}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {bands.length > 0 && (
              <div className="flex items-center gap-2 border-l border-rule pl-4">
                {bands.map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => setBand(band === b.key ? 'all' : b.key)}
                    className={chip(band === b.key)}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            )}

            <div className="ml-auto flex flex-shrink-0 items-center gap-3 pl-4">
              <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.16em] text-mid">
                {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
              </span>
              <label className="sr-only" htmlFor="shop-sort">
                Sort products
              </label>
              <select
                id="shop-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="cursor-pointer rounded-full border border-rule bg-paper px-3 py-2 font-body text-[11px] uppercase tracking-[0.1em] text-text transition-colors hover:border-forest focus:border-forest focus:outline-none"
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* What is currently narrowing the list, and how to undo it — the old
              rail gave no way to see or remove one filter at a time. */}
          {activeChips.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {activeChips.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={c.clear}
                  className="inline-flex items-center gap-1.5 rounded-full bg-forest/10 px-3 py-1.5 font-body text-[11px] text-forest transition-colors hover:bg-forest/20"
                >
                  {c.label}
                  <X className="h-3 w-3" />
                </button>
              ))}
              <button
                type="button"
                onClick={clearAll}
                className="font-mono text-[10px] uppercase tracking-[0.16em] text-mid hover:text-forest"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {filtered.length > 0 ? (
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-sm border border-dashed border-rule py-20 text-center">
            <p className="font-body text-mid">Nothing matches that combination.</p>
            <button
              type="button"
              onClick={clearAll}
              className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-forest hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* The shop's own argument, at the end of the scroll where a grid would
            otherwise just stop. */}
        {products.some((p) => p.is_customizable) && (
          <div className="mt-20 flex flex-col gap-6 border-t border-rule pt-10 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-forest">Made yours</p>
              <p className="mt-3 max-w-md font-display text-[clamp(22px,2.4vw,32px)] leading-tight text-text">
                Bring your own artwork, or set it in type.
              </p>
              <p className="mt-3 max-w-md font-body text-sm text-mid">
                Front, back, or both — previewed on the piece before anything is printed.
              </p>
            </div>
            <Link
              href="/customize"
              className="inline-flex flex-shrink-0 items-center gap-2 self-start rounded-full bg-forest px-7 py-3.5 font-body text-[11px] uppercase tracking-[0.14em] text-paper transition-colors duration-300 hover:bg-forest-mid sm:self-auto"
            >
              Open the studio ↗
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
