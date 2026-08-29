'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowUpDown, Check, SlidersHorizontal, X } from 'lucide-react'
import ProductCard from '@/components/ProductCard'
import FilterSidebar from '@/components/shop/FilterSidebar'
import EmptyState from '@/components/ui/empty-state'
import { BLUR_DATA_URL } from '@/lib/constants'
import {
  SORTS, EMPTY_FILTERS, applyFilters, priceBands, groupCategories,
  stockedCollections, catalogueSizes, filtersToParams, filtersFromParams,
  countActive, toggle,
  type ShopFilters, type SortKey,
} from '@/lib/shop-filter'
import type { ProductWithCollection, Collection, Category } from '@/types/database'

// ── The shop ─────────────────────────────────────────────────────────────────
//
// A left rail, per the brief. Two things make it worth the column it costs.
//
// It holds still. Every facet is visible at once, with its values and its
// counts, so choosing is reading rather than opening — which is the argument a
// disclosure bar can never win once a catalogue has five dimensions.
//
// And it is the same control on a phone. The rail moves into a sheet rather
// than becoming a different, simpler thing, because the device most people shop
// on should not get the weaker instrument.
//
// The filtering itself lives in `lib/shop-filter.ts` as pure functions with 37
// tests behind them; this file is layout and state. The URL remains the single
// source of truth — there is no local mirror to fall out of step, the back
// button works because it changes the thing being read, and a filtered shop is
// shareable by construction.

export default function ShopContent({
  products,
  collections,
  categories,
}: {
  products: ProductWithCollection[]
  collections: Collection[]
  categories: Category[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const filters = useMemo<ShopFilters>(() => filtersFromParams(searchParams), [searchParams])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)

  const bands = useMemo(() => priceBands(products), [products])
  const groups = useMemo(() => groupCategories(products, categories), [products, categories])
  const stockedCols = useMemo(() => stockedCollections(products, collections), [products, collections])
  const sizes = useMemo(() => catalogueSizes(products), [products])
  const ctx = useMemo(() => ({ categories, bands }), [categories, bands])

  const filtered = useMemo(() => applyFilters(products, filters, ctx), [products, filters, ctx])
  const activeCount = countActive(filters)

  const commit = useCallback(
    (next: ShopFilters) => {
      const qs = filtersToParams(next).toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname]
  )

  const toggleValue = (dimension: 'categories' | 'collections' | 'bands' | 'sizes', value: string) =>
    commit({ ...filters, [dimension]: toggle(filters[dimension], value) })

  const clearAll = () => commit({ ...EMPTY_FILTERS, sort: filters.sort })

  // A sheet that traps the page behind it must not let that page scroll, and it
  // must close on Escape like every other dismissible thing on the site.
  useEffect(() => {
    if (!sheetOpen) return
    const prior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSheetOpen(false)
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prior
      document.removeEventListener('keydown', onKey)
    }
  }, [sheetOpen])

  useEffect(() => {
    if (!sortOpen) return
    const onDown = () => setSortOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSortOpen(false)
    document.addEventListener('click', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [sortOpen])

  const activeChips = [
    ...filters.categories.map((slug) => ({
      key: `c:${slug}`,
      label: categories.find((c) => c.slug === slug)?.name ?? slug,
      clear: () => toggleValue('categories', slug),
    })),
    ...filters.collections.map((slug) => ({
      key: `k:${slug}`,
      label: collections.find((c) => c.slug === slug)?.name ?? slug,
      clear: () => toggleValue('collections', slug),
    })),
    ...filters.bands.map((key) => ({
      key: `b:${key}`,
      label: bands.find((b) => b.key === key)?.label ?? key,
      clear: () => toggleValue('bands', key),
    })),
    ...filters.sizes.map((size) => ({
      key: `s:${size}`,
      label: `Size ${size}`,
      clear: () => toggleValue('sizes', size),
    })),
    ...(filters.inStock
      ? [{ key: 'stock', label: 'In stock', clear: () => commit({ ...filters, inStock: false }) }]
      : []),
  ]

  const rail = (
    <FilterSidebar
      products={products}
      filters={filters}
      ctx={ctx}
      groups={groups}
      collections={stockedCols}
      bands={bands}
      sizes={sizes}
      onToggle={toggleValue}
      onSetInStock={(next) => commit({ ...filters, inStock: next })}
      onClear={clearAll}
      activeCount={activeCount}
    />
  )

  return (
    <main className="min-h-screen bg-paper-warm">
      {/* ── Masthead ─────────────────────────────────────────────────────────
          On its own ground, so the catalogue below reads as a separate thing
          rather than a continuation of the copy. */}
      <div className="bg-paper pt-32">
        <div className="mx-auto max-w-[1400px] px-6 pb-10 md:px-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-forest">
            Made to order · Printed in Dehradun
          </p>
          <h1 className="mt-4 font-display text-[clamp(38px,5.5vw,68px)] leading-[0.92] text-text">
            The DEWDROPZ Collection.
          </h1>
          <p className="mt-4 max-w-lg font-body text-sm leading-relaxed text-mid md:text-base">
            Apparel and everyday essentials inspired by mountains, trails and slow travel.
          </p>
          {products.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-2 font-mono text-[10px] uppercase tracking-[0.18em] text-mid">
              <span>{products.length} {products.length === 1 ? 'piece' : 'pieces'}</span>
              <span>
                ₹{Math.round(Math.min(...products.map((p) => p.price)) / 100).toLocaleString('en-IN')} — ₹
                {Math.round(Math.max(...products.map((p) => p.price)) / 100).toLocaleString('en-IN')}
              </span>
              <span>Fast dispatch across India</span>
            </div>
          )}
        </div>

        {/* Collections stay: they are the one control on this page that can
            actually sell, because they carry photography. Wired to the same
            state as the rail, so a tile and its checkbox always agree. */}
        {stockedCols.length > 0 && (
          <div className="mx-auto max-w-[1400px] px-6 pb-12 md:px-10">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-mid">Collections</h2>
              {filters.collections.length > 0 && (
                <button
                  type="button"
                  onClick={() => commit({ ...filters, collections: [] })}
                  className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest hover:underline"
                >
                  Show all
                </button>
              )}
            </div>
            {/* A wide, shallow plate. The tall portrait tiles this replaces
                pushed the actual catalogue a full screen down the page. */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {stockedCols.map((c) => {
                const on = filters.collections.includes(c.slug)
                const n = products.filter((p) => p.collection?.slug === c.slug).length
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleValue('collections', c.slug)}
                    aria-pressed={on}
                    className={cnx(
                      'group relative aspect-[16/10] overflow-hidden rounded-[var(--r-card)] border text-left transition-[border-color,box-shadow] duration-300',
                      on
                        ? 'border-forest shadow-[var(--shadow-lift)]'
                        : 'border-transparent hover:border-rule hover:shadow-[var(--shadow-card)]'
                    )}
                  >
                    {c.image_url ? (
                      <Image
                        src={c.image_url}
                        alt=""
                        fill
                        sizes="(min-width:1024px) 320px, 45vw"
                        placeholder="blur"
                        blurDataURL={BLUR_DATA_URL}
                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                    ) : (
                      <span className="absolute inset-0" style={{ background: c.gradient ?? '#2A3B31' }} />
                    )}
                    <span className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/25 to-transparent" />
                    {on && (
                      <span className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-forest text-paper">
                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                      </span>
                    )}
                    <span className="absolute inset-x-0 bottom-0 p-3.5">
                      <span className="block font-display text-[17px] leading-tight text-paper">{c.name}</span>
                      <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.14em] text-paper/60">
                        {n} {n === 1 ? 'piece' : 'pieces'}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Rail + results ───────────────────────────────────────────────── */}
      <div className="mx-auto max-w-[1400px] px-6 pb-24 pt-10 md:px-10">
        <div className="lg:grid lg:grid-cols-[264px_1fr] lg:gap-10">
          {/* Sticky, and scrollable within its own height so a long facet list
              never runs past the bottom of the viewport with no way to reach it. */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto [scrollbar-width:thin]">
              {rail}
            </div>
          </aside>

          <div className="min-w-0">
            {/* Results bar */}
            <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-rule pb-4">
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-rule bg-surface px-4 font-body text-[11px] uppercase tracking-[0.1em] text-text shadow-[var(--shadow-card)] transition-colors hover:border-forest lg:hidden"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                Filter
                {activeCount > 0 && (
                  <span className="rounded-full bg-forest px-1.5 py-0.5 font-mono text-[9px] text-paper">
                    {activeCount}
                  </span>
                )}
              </button>

              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-mid">
                {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
                {activeCount > 0 && products.length !== filtered.length && (
                  <span className="text-light"> of {products.length}</span>
                )}
              </span>

              <div className="relative ml-auto" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setSortOpen(!sortOpen)}
                  aria-expanded={sortOpen}
                  className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-rule bg-surface px-4 font-body text-[11px] uppercase tracking-[0.1em] text-text transition-colors hover:border-forest"
                >
                  <ArrowUpDown className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                  <span className="hidden sm:inline">{SORTS.find((s) => s.key === filters.sort)?.label}</span>
                  <span className="sm:hidden">Sort</span>
                </button>
                {sortOpen && (
                  <div
                    role="listbox"
                    className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-[var(--r-panel)] border border-rule bg-surface py-1 shadow-[var(--shadow-panel)]"
                  >
                    {SORTS.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        role="option"
                        aria-selected={filters.sort === s.key}
                        onClick={() => { commit({ ...filters, sort: s.key as SortKey }); setSortOpen(false) }}
                        className={cnx(
                          'flex w-full items-center gap-2 px-4 py-2.5 text-left font-body text-[13px] transition-colors',
                          filters.sort === s.key
                            ? 'bg-sage-soft text-forest'
                            : 'text-mid hover:bg-paper-warm hover:text-text'
                        )}
                      >
                        <Check
                          className={cnx('h-3.5 w-3.5 shrink-0', filters.sort === s.key ? 'opacity-100' : 'opacity-0')}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* What is currently narrowing the list. The rail already shows it,
                but next to the grid is where you are looking when you wonder
                why something is missing. */}
            {activeChips.length > 0 && (
              <div className="mb-6 flex flex-wrap items-center gap-2">
                {activeChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.clear}
                    className="inline-flex items-center gap-1.5 rounded-full bg-sage-soft px-3 py-1.5 font-body text-[11px] text-forest transition-colors hover:bg-forest hover:text-paper"
                  >
                    {chip.label}
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearAll}
                  className="ml-1 font-mono text-[10px] uppercase tracking-[0.16em] text-light transition-colors hover:text-forest"
                >
                  Clear all
                </button>
              </div>
            )}

            {filtered.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 xl:grid-cols-3">
                {filtered.map((p) => (
                  <ProductCard key={p.slug} product={p} />
                ))}
              </div>
            ) : (
              <NoResults products={products} filters={filters} ctx={ctx} onClear={clearAll} onRelax={commit} />
            )}
          </div>
        </div>
      </div>

      {/* ── The phone's rail ───────────────────────────────────────────────
          The same component in a sheet, not a reduced version of it. */}
      {sheetOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-paper-warm shadow-[var(--shadow-float)]">
            <div className="flex items-center justify-between border-b border-rule bg-surface px-4 py-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-text">Filter</span>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-mid transition-colors hover:bg-paper-warm hover:text-text"
                aria-label="Close filters"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">{rail}</div>
            <div className="border-t border-rule bg-surface p-3">
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="w-full rounded-full bg-forest py-3 font-body text-[11px] font-medium uppercase tracking-[0.14em] text-paper transition-colors hover:bg-forest-mid"
              >
                Show {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
              </button>
            </div>
          </div>
        </div>
      )}

      {products.some((p) => p.is_customizable) && (
        <section className="bg-forest-deep">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-8 px-6 py-16 sm:flex-row sm:items-end sm:justify-between md:px-10 md:py-20">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-dawn">Made yours</p>
              <p className="mt-4 max-w-md font-display text-[clamp(26px,3vw,40px)] font-light leading-tight text-paper">
                Bring your own artwork, or set it in type.
              </p>
              <p className="mt-4 max-w-md font-body text-sm leading-relaxed text-paper/60">
                Front, back, or both — previewed on the piece before anything is printed.
              </p>
            </div>
            <Link
              href="/customize"
              className="inline-flex min-h-[46px] flex-shrink-0 items-center gap-2 self-start rounded-full bg-paper px-8 font-body text-[11px] font-medium uppercase tracking-[0.14em] text-ink transition-colors duration-300 hover:bg-sage sm:self-auto"
            >
              Open the studio ↗
            </Link>
          </div>
        </section>
      )}
    </main>
  )
}

/** Local class joiner — this file has no other need for `cn`'s tailwind-merge. */
function cnx(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

// ── Nothing matched ──────────────────────────────────────────────────────────
function NoResults({
  products,
  filters,
  ctx,
  onClear,
  onRelax,
}: {
  products: ProductWithCollection[]
  filters: ShopFilters
  ctx: { categories: Category[]; bands: ReturnType<typeof priceBands> }
  onClear: () => void
  onRelax: (next: ShopFilters) => void
}) {
  // Which single filter is responsible? Drop one dimension at a time and see
  // which removal brings results back. If exactly one does, it can be named.
  const culprit = useMemo(() => {
    const dims: { key: keyof ShopFilters; label: string }[] = [
      { key: 'categories', label: 'category' },
      { key: 'collections', label: 'collection' },
      { key: 'bands', label: 'price' },
      { key: 'sizes', label: 'size' },
      { key: 'inStock', label: 'in-stock' },
    ]
    const rescuers = dims.filter((d) => {
      const active = d.key === 'inStock' ? filters.inStock : (filters[d.key] as string[]).length > 0
      if (!active) return false
      const relaxed = { ...filters, [d.key]: d.key === 'inStock' ? false : [] } as ShopFilters
      return applyFilters(products, relaxed, ctx).length > 0
    })
    return rescuers.length === 1 ? rescuers[0] : null
  }, [products, filters, ctx])

  return (
    <EmptyState
      title="Nothing matches that combination."
      body={
        culprit
          ? `Everything else you have chosen has pieces behind it — it is the ${culprit.label} filter that empties the shelf.`
          : 'Try widening one of the filters, or start again.'
      }
      secondary={
        culprit
          ? {
              label: `Drop the ${culprit.label} filter`,
              onClick: () =>
                onRelax({
                  ...filters,
                  [culprit.key]: culprit.key === 'inStock' ? false : [],
                } as ShopFilters),
            }
          : { label: 'Clear all filters', onClick: onClear }
      }
      action={{ label: 'See everything', href: '/shop' }}
    />
  )
}
