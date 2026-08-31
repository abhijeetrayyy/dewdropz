'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
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
// It holds still. Every facet that can actually separate this catalogue is
// visible at once, with its values and its counts, so choosing is reading
// rather than opening — which is the argument a disclosure bar can never win.
//
// And it is the same control on a phone. The rail moves into a sheet rather
// than becoming a different, simpler thing, because the device most people shop
// on should not get the weaker instrument.
//
// The filtering itself lives in `lib/shop-filter.ts` as pure functions with
// tests behind them; this file is layout and state. The URL remains the single
// source of truth — there is no local mirror to fall out of step, the back
// button works because it changes the thing being read, and a filtered shop is
// shareable by construction.
//
// THE MASTHEAD IS NOT IN THIS FILE. It is server-rendered in `app/shop/page.tsx`
// and the reason is written there: this component calls `useSearchParams()`, so
// everything inside its Suspense boundary is replaced by the fallback in the
// built HTML.

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
  // The grid used to change with no indication that anything had been received:
  // `filters` is derived from the URL, `router.replace` is a transition, and
  // until it committed the checkbox did not tick, the count did not move and
  // the chips did not appear. On a slow device the page's answer to "did that
  // register?" was, for the duration, no.
  const [pending, startTransition] = useTransition()

  const bands = useMemo(() => priceBands(products), [products])
  const groups = useMemo(() => groupCategories(products, categories), [products, categories])
  const stockedCols = useMemo(() => stockedCollections(products, collections), [products, collections])
  const sizes = useMemo(() => catalogueSizes(products), [products])
  const ctx = useMemo(() => ({ categories, bands }), [categories, bands])

  const filtered = useMemo(() => applyFilters(products, filters, ctx), [products, filters, ctx])
  const activeCount = countActive(filters)

  // Every stocked collection gets a tile. The council gated this on whether the
  // dimension could partition the catalogue, which on ten products meant it did
  // not render at all — and the client sent it straight back: the collections
  // ARE the merchandising, they are the only thing on the page carrying
  // photography, and a shop that hides them to save 275px of scroll has
  // optimised the wrong number. It costs the fold and it is worth the fold.
  const plateCols = useMemo(
    () =>
      stockedCols.map((c) => ({
        c,
        n: products.filter((p) => p.collection?.slug === c.slug).length,
      })),
    [stockedCols, products]
  )

  const commit = useCallback(
    (next: ShopFilters) => {
      const qs = filtersToParams(next).toString()
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      })
    },
    [router, pathname]
  )

  const toggleValue = (dimension: 'categories' | 'collections' | 'bands' | 'sizes', value: string) =>
    commit({ ...filters, [dimension]: toggle(filters[dimension], value) })

  const clearAll = () => commit({ ...EMPTY_FILTERS, sort: filters.sort })

  // ── The sheet ─────────────────────────────────────────────────────────────
  // It was a `fixed inset-0` div with a scrim: no role, no name, nothing
  // focused on open, no trap, no return. Pressing Filter left focus on a button
  // now underneath the scrim, and Tab then walked the sort control, the chips
  // and all ten cards — every one of them visually covered — before reaching
  // the sheet. On close the focused element unmounted and focus fell to <body>,
  // so the next Tab restarted at the top of the document. It was the only
  // unrecoverable state on the page, on the one control the phone cannot shop
  // without.
  // ── The rail's sticky geometry ────────────────────────────────────────────
  // The rail used to be `sticky` with `max-h-[calc(100dvh…)]` and its own
  // `overflow-y-auto`, which produced three separate complaints and one real
  // bug:
  //
  //   · taller than the viewport, so its last facets were simply unreachable
  //     while reading the grid;
  //   · reaching them meant moving the pointer over the rail and scrolling a
  //     second, independent scroller — two scroll regions on one screen;
  //   · and scrolling that region scrolled the PAGE instead, because
  //     `providers/LenisProvider.tsx` constructs Lenis with no `prevent`
  //     option. Lenis calls preventDefault() on wheel events and drives
  //     window.scrollTo itself, so the inner element never scrolls natively and
  //     `overscroll-contain` — which only governs native scroll chaining — was
  //     inert. No amount of CSS on the rail could have fixed that.
  //
  // So the rail no longer scrolls. It has no max-height and no overflow, and
  // instead its sticky `top` is computed: when it fits, it pins below the nav
  // like any sticky column; when it is taller than the viewport, `top` goes
  // negative so the rail rides up with the page until its LAST facet sits at
  // the bottom of the screen, and pins there. Scrolling back up releases it and
  // walks back to the top of the rail, because that is what sticky does.
  //
  // One scroll region on the page. Everything reachable with the wheel you are
  // already using.
  const railRef = useRef<HTMLDivElement>(null)
  const [railTop, setRailTop] = useState<number | null>(null)

  useEffect(() => {
    const el = railRef.current
    if (!el) return
    const GAP = 16
    const measure = () => {
      const navH =
        parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'), 10) || 72
      const height = el.offsetHeight
      const available = window.innerHeight - navH - GAP * 2
      setRailTop(height <= available ? navH + GAP : window.innerHeight - height - GAP)
    }
    measure()
    // Sections open and close, so the height is not a constant.
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  const sheetRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<HTMLButtonElement>(null)
  const sortRef = useRef<HTMLDivElement>(null)
  const sortTriggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!sheetOpen) return
    const prior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSheetOpen(false)
        return
      }
      if (e.key !== 'Tab') return
      // Two-element trap. Everything behind the sheet is `inert`, so the only
      // reachable stops are inside it; this keeps Tab from leaving for the
      // browser chrome and coming back at the top of the document.
      const focusables = sheetRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (!focusables?.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    // Captured now, not read in the cleanup: by the time the sheet closes the
    // ref may point at a different node (or none), and the whole purpose of the
    // cleanup is to return focus to the element that was the trigger.
    const opener = openerRef.current

    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prior
      document.removeEventListener('keydown', onKey)
      // Hand focus back to the control that opened it. Without this the next
      // Tab starts at "Skip to content".
      opener?.focus()
    }
  }, [sheetOpen])

  // Crossing 1024px with the sheet open used to display:none it while
  // `sheetOpen` stayed true — so `overflow: hidden` remained on <body> with no
  // visible control left to clear it, and the page could not scroll again.
  useEffect(() => {
    if (!sheetOpen) return
    const mq = window.matchMedia('(min-width: 1280px)')
    const onChange = () => mq.matches && setSheetOpen(false)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [sheetOpen])

  useEffect(() => {
    if (!sortOpen) return
    // Containment test against the menu's own ref, on pointerdown. The previous
    // form leaned on a React synthetic `stopPropagation` beating a listener
    // registered directly on `document` — which works today and depends on
    // registration order, not on anything guaranteed.
    const onDown = (e: PointerEvent) => {
      if (!sortRef.current?.contains(e.target as Node)) setSortOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSortOpen(false)
        sortTriggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
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
    <>
      {/* Everything except the sheet, so the sheet can make it inert. */}
      <div inert={sheetOpen || undefined}>
        {/* ── The collections plate ─────────────────────────────────────────
            Renders only when the dimension can actually separate the range —
            see `plateCols`. When it does, the tiles are LINKS, not buttons: the
            file's own principle is that the URL is the single source of truth,
            which makes a link the honest control, and it gives the shop four
            crawlable internal routes into filtered views. */}
        {plateCols.length > 0 && (
          // ── The warm band ────────────────────────────────────────────────
          // The client's note was that the page reads too creamy. It is an area
          // problem, not a hue one: the catalogue band is the tallest surface on
          // the page by a wide margin and it was sitting on --paper-warm, the
          // SECOND rung — so the largest thing a visitor saw was the beige one.
          //
          // The ladder now runs paper (masthead) → paper-deep (this band) →
          // paper (catalogue) → forest-deep (CTA). Every adjacent pair is a real
          // step, the golden-hour rung is spent on the one band that carries
          // photography and wants a warm ground under it, and the acres of
          // cream become one deliberate stripe.
          <div className="bg-paper-deep">
            <div className="mx-auto max-w-measure-catalogue px-6 py-10 md:px-10 md:py-12">
              <div className="mb-6 flex items-baseline justify-between gap-4">
                <h2 className="font-display text-[clamp(23px,2.4vw,31px)] font-light leading-tight text-text">
                  Collections
                </h2>
                {filters.collections.length > 0 && (
                  <button
                    type="button"
                    onClick={() => commit({ ...filters, collections: [] })}
                    className="-m-2 p-2 font-body text-[11px] font-medium uppercase tracking-[0.08em] text-forest hover:underline"
                  >
                    Show all
                  </button>
                )}
              </div>
              {/* Three tiles never filled a four-column track, so a quarter of
                  the band was an empty cell at lg and the third tile sat alone
                  beside one at sm. */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {plateCols.map(({ c, n }) => {
                  const on = filters.collections.includes(c.slug)
                  return (
                    <Link
                      key={c.id}
                      href={`/shop?collection=${c.slug}`}
                      scroll={false}
                      aria-current={on ? 'true' : undefined}
                      className={cnx(
                        'shop-tile group relative block aspect-[16/10] overflow-hidden rounded-[var(--r-card)] text-left transition-shadow duration-200',
                        on ? 'shadow-[var(--shadow-lift)] ring-2 ring-forest' : 'hover:shadow-[var(--shadow-card)]'
                      )}
                    >
                      {c.image_url ? (
                        <Image
                          src={c.image_url}
                          alt=""
                          fill
                          sizes="(min-width:640px) 33vw, 45vw"
                          placeholder="blur"
                          blurDataURL={BLUR_DATA_URL}
                          className="object-cover transition-transform duration-[260ms] ease-[var(--ease-out)] group-hover:scale-[1.03]"
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
                      <span className="absolute inset-x-0 bottom-0 p-4">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="font-display text-[17px] leading-tight text-paper">{c.name}</span>
                          {/* A bare figure in --dawn-soft. It was "N pieces" in
                              paper/60 — a mono SENTENCE, at 3.83:1 over a bright
                              photograph, standing in the slot where the homepage
                              prints the collection's tagline. */}
                          <span className="shrink-0 font-mono text-[11px] tabular-nums text-dawn-soft">{n}</span>
                        </span>
                        {c.tagline && (
                          <span className="mt-1 line-clamp-1 block font-body text-[11px] italic text-paper/80">
                            {c.tagline}
                          </span>
                        )}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Rail + results ─────────────────────────────────────────────── */}
        {/* --paper, the brightest ground, because this band is several screens
            tall and it is what "too creamy" was actually describing. When there
            is no plate above it there is no step between it and the masthead, so
            it falls back to --paper-warm rather than break Law 01. */}
        <div className={cnx(plateCols.length > 0 ? 'bg-paper' : 'bg-paper-warm')}>
        <div className="mx-auto max-w-measure-catalogue px-6 pb-24 pt-12 md:px-10">
          <div className="xl:grid xl:grid-cols-[280px_1fr] xl:gap-8">
            {/* Sticky, and scrollable within its own height so a long facet
                list never runs past the bottom of the viewport with no way to
                reach it. The offset reads the height the nav actually
                publishes; `top-24` was 96px against a bar that is 56px once
                solid, so 40px of ground was reserved above a rail that was
                clipping at the bottom. `-mx-2 px-2` lets the panel's shadow out
                of what is otherwise a clipping box. */}
            {/* The rail appears at xl (1280), not lg (1024). At 1024 a 280px
                rail plus its gutter leaves 632px of grid, which is two columns
                — so widening a window from 900 to 1024 LOST a column, cards
                jumping 257 → 304 while the shopper saw fewer of them. You can
                have a 280px rail or three columns at that width, not both; it
                is arithmetic, not taste. Below xl the sheet carries the same
                rail, which is this file's own principle: the smaller screen
                gets the same instrument, not a weaker one. */}
            <aside className="hidden xl:block" aria-label="Filters">
              {/* The inline `top` is written by the effect above once the rail
                  has been measured; the class is the pre-measurement fallback,
                  which is also the correct answer whenever the rail fits. */}
              <div
                ref={railRef}
                className="sticky top-[calc(var(--nav-h,72px)+1rem)]"
                style={railTop !== null ? { top: `${railTop}px` } : undefined}
              >
                {rail}
              </div>
            </aside>

            <div className="min-w-0">
              <h2 className="sr-only">Products</h2>

              {/* Not sticky. It was, so that the count and the sort survived a
                  filter collapsing the grid underneath them — a real problem,
                  and the cure was worse: a translucent blurred strip riding over
                  the catalogue on every scroll, which is the one gesture that
                  makes a quiet page feel like an app chrome. The collapse is
                  handled by the live region and the chip row instead, both of
                  which are attached to the thing that changed. */}
              <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-rule-warm pb-4">
                <button
                  ref={openerRef}
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  aria-haspopup="dialog"
                  aria-expanded={sheetOpen}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-rule bg-surface px-4 font-body text-[11px] uppercase tracking-[0.1em] text-text transition-colors hover:border-forest xl:hidden"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                  Filter
                  {activeCount > 0 && (
                    <span className="rounded-full bg-forest px-1.5 py-1 font-mono text-[11px] tabular-nums leading-none text-paper">
                      {activeCount}
                    </span>
                  )}
                </button>

                <span className="font-mono text-[11px] uppercase tabular-nums tracking-[0.12em] text-mid">
                  {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
                  {activeCount > 0 && products.length !== filtered.length && (
                    <span className="text-light"> of {products.length}</span>
                  )}
                </span>

                <div className="relative ml-auto" ref={sortRef}>
                  <button
                    ref={sortTriggerRef}
                    type="button"
                    onClick={() => setSortOpen(!sortOpen)}
                    aria-expanded={sortOpen}
                    aria-haspopup="listbox"
                    aria-controls="shop-sort"
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-rule bg-surface px-4 font-body text-[11px] uppercase tracking-[0.1em] text-text transition-colors hover:border-forest"
                  >
                    <ArrowUpDown className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                    <span className="hidden sm:inline">{SORTS.find((s) => s.key === filters.sort)?.label}</span>
                    <span className="sm:hidden">Sort</span>
                  </button>
                  {sortOpen && (
                    <div
                      id="shop-sort"
                      role="listbox"
                      aria-label="Sort products"
                      tabIndex={-1}
                      onKeyDown={(e) => {
                        // A listbox is a promise about keyboard behaviour. It
                        // used to be four loose buttons under a listbox role
                        // with no arrow keys at all, so a screen reader
                        // announced "listbox, 4 items", the user pressed Down,
                        // and the PAGE scrolled.
                        const items = Array.from(
                          e.currentTarget.querySelectorAll<HTMLElement>('[role="option"]')
                        )
                        const i = items.indexOf(document.activeElement as HTMLElement)
                        if (e.key === 'ArrowDown') {
                          e.preventDefault()
                          items[Math.min(i + 1, items.length - 1)]?.focus()
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault()
                          items[Math.max(i - 1, 0)]?.focus()
                        } else if (e.key === 'Home') {
                          e.preventDefault()
                          items[0]?.focus()
                        } else if (e.key === 'End') {
                          e.preventDefault()
                          items[items.length - 1]?.focus()
                        }
                      }}
                      className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-[var(--r-panel)] bg-surface py-1 shadow-[var(--shadow-float)]"
                    >
                      {SORTS.map((s) => (
                        <button
                          key={s.key}
                          type="button"
                          role="option"
                          aria-selected={filters.sort === s.key}
                          onClick={() => {
                            commit({ ...filters, sort: s.key as SortKey })
                            // Focus first, then unmount — otherwise the focused
                            // element disappears and focus falls to <body>.
                            sortTriggerRef.current?.focus()
                            setSortOpen(false)
                          }}
                          className={cnx(
                            'flex w-full items-center gap-2 px-4 py-3 text-left font-body text-[13px] transition-colors duration-200',
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

              {/* Filtering changed the result count, all the facet counts, the
                  chips and the grid, and announced none of it. */}
              <p aria-live="polite" aria-atomic="true" className="sr-only">
                {filtered.length} {filtered.length === 1 ? 'product' : 'products'}
                {activeCount > 0 ? ` matching ${activeCount} ${activeCount === 1 ? 'filter' : 'filters'}` : ''}
              </p>

              {/* What is currently narrowing the list. The rail already shows
                  it, but next to the grid is where you are looking when you
                  wonder why something is missing. */}
              {activeChips.length > 0 && (
                <div className="mb-8 flex flex-wrap items-center gap-2">
                  {activeChips.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={chip.clear}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-sage-soft px-3 font-body text-[11px] text-forest transition-colors duration-200 hover:bg-forest hover:text-paper"
                    >
                      {chip.label}
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={clearAll}
                    className="-m-2 ml-1 p-2 font-body text-[11px] font-medium uppercase tracking-[0.08em] text-mid transition-colors hover:text-forest"
                  >
                    Clear all
                  </button>
                </div>
              )}

              {/* `opacity` here is legal and the distinction matters: this is a
                  state transition on content that is already on screen, not an
                  entrance. A stalled animation leaves a readable grid at 60%,
                  not a hole. */}
              <div className={cnx('transition-opacity duration-200', pending && 'opacity-60')}>
                {filtered.length > 0 ? (
                  // An intrinsic grid, so the column count follows the space
                  // rather than a breakpoint guessing at it. The stepped version
                  // had two cliffs — the card lost 33% at 1024 and another 35%
                  // at 1280 — and the largest cards on the site were at 1023px,
                  // the narrowest desktop. `minmax(240px,1fr)` bounds the card
                  // to 240–372px at every width instead.
                  <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] sm:gap-x-6">
                    {filtered.map((p) => (
                      <ProductCard key={p.slug} product={p} />
                    ))}
                  </div>
                ) : (
                  <NoResults
                    products={products}
                    filters={filters}
                    ctx={ctx}
                    onClear={clearAll}
                    onRelax={commit}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
        </div>

        {products.some((p) => p.is_customizable) && (
          // `.on-dark` was missing, so the global focus ring drew --forest on
          // --forest-deep at 1.50:1 around this band's only control — the exact
          // failure globals.css's focus block was written to prevent, on the
          // page its comment names. With it: 5.44:1.
          //
          // py-24/32 because this is the page's one dark anchor and it was
          // 33–44% shorter than every other dark band on the site.
          <section className="on-dark bg-forest-deep">
            <div className="mx-auto flex max-w-measure flex-col gap-8 px-6 py-24 sm:flex-row sm:items-end sm:justify-between md:px-10 md:py-32">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-dawn">Made yours</p>
                <p className="mt-4 max-w-md font-display text-[clamp(26px,3vw,40px)] font-light leading-tight text-paper">
                  Bring your own artwork, or set it in type.
                </p>
                <p className="mt-4 max-w-md font-body text-sm leading-relaxed text-paper/60">
                  Front, back, or both — previewed on the piece before anything is printed.
                </p>
              </div>
              <Link
                href="/customize"
                className="inline-flex min-h-[46px] flex-shrink-0 items-center gap-2 self-start rounded-full bg-paper px-8 font-body text-[11px] font-medium uppercase tracking-[0.14em] text-ink transition-colors duration-200 hover:bg-sage sm:self-auto"
              >
                Open the studio ↗
              </Link>
            </div>
          </section>
        )}
      </div>

      {/* ── The phone's rail ─────────────────────────────────────────────────
          The same component in a sheet, not a reduced version of it. */}
      {sheetOpen && (
        <div
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="filter-sheet-title"
          className="fixed inset-0 z-[60] xl:hidden"
        >
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setSheetOpen(false)}
            className="shop-sheet-scrim absolute inset-0 bg-ink/50 backdrop-blur-sm"
          />
          {/* h-[100dvh], matching the nav's own sheet. `inset-y-0` against iOS
              Safari's toolbar can put the footer — which holds the only confirm
              control — underneath the browser bar. */}
          <div className="shop-sheet absolute left-0 top-0 flex h-[100dvh] w-[86%] max-w-sm flex-col bg-paper-warm shadow-[var(--shadow-float)]">
            <div className="flex items-center justify-between border-b border-rule bg-surface px-4 py-3">
              <span
                id="filter-sheet-title"
                className="font-body text-[11px] font-medium uppercase tracking-[0.12em] text-text"
              >
                Filter
              </span>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setSheetOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full text-mid transition-colors hover:bg-paper-warm hover:text-text"
                aria-label="Close filters"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            {/* `data-lenis-prevent` is not decoration: without it Lenis eats the
                wheel event and scrolls the page behind the sheet instead of the
                sheet. Touch is unaffected (Lenis leaves touch native by
                default), so this is the trackpad case — a narrow window on a
                laptop. */}
            <div
              data-lenis-prevent
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3"
            >
              {rail}
            </div>
            <div
              className="border-t border-rule bg-surface p-3"
              style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
            >
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="w-full rounded-full bg-forest py-4 font-body text-[11px] font-medium uppercase tracking-[0.14em] text-paper transition-colors duration-200 hover:bg-forest-mid"
              >
                Show {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
  const active = countActive(filters)

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
      const on = d.key === 'inStock' ? filters.inStock : (filters[d.key] as string[]).length > 0
      if (!on) return false
      const relaxed = { ...filters, [d.key]: d.key === 'inStock' ? false : [] } as ShopFilters
      return applyFilters(products, relaxed, ctx).length > 0
    })
    return rescuers.length === 1 ? rescuers[0] : null
  }, [products, filters, ctx])

  // The whole catalogue is empty — a new department, or a sell-out. Nothing
  // has been narrowed, so "try widening one of the filters" was advice about a
  // filter the visitor never set, and "See everything" linked to the page they
  // were already standing on.
  if (products.length === 0) {
    return (
      <EmptyState
        className="xl:min-h-[420px] xl:flex xl:flex-col xl:justify-center"
        title="The next run is still on the press."
        body="Everything here is cut and printed to order in Dehradun, so the shelf empties between runs."
        secondary={{ label: 'See the collections', href: '/collections' }}
        action={{ label: 'Design your own', href: '/customize' }}
      />
    )
  }

  // Exactly one filter, and it is empty: this is what a nav link to a
  // department with nothing in it produces, and it is the likeliest empty state
  // on the site. The culprit machinery is right but its sentence was written
  // for a combination — "everything else you have chosen" referred to nothing,
  // and the two buttons were the same action twice.
  if (active === 1) {
    return (
      <EmptyState
        className="xl:min-h-[420px] xl:flex xl:flex-col xl:justify-center"
        title="Nothing on this shelf yet."
        body="This part of the range is still on its way."
        action={{ label: 'See everything', href: '/shop' }}
      />
    )
  }

  return (
    <EmptyState
      className="xl:min-h-[420px] xl:flex xl:flex-col xl:justify-center"
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
