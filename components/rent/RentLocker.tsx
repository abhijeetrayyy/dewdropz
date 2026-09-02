'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowUpDown, CalendarDays, Loader2, Search, SlidersHorizontal, X } from 'lucide-react'
import RentalRail from './RentalRail'
import RentalCard from './RentalCard'
import { shopToday, shopAddDays } from '@/lib/shopTime'
import {
  applyRentalFilters, rateBands, rentalFiltersFromParams, rentalFiltersToParams,
  countActiveRental, toggle, shelve, RENTAL_SORTS, CAPACITY_BUCKETS,
  type RentalFilters, type RentalItemListed, type AvailabilityMap,
} from '@/lib/rental-filter'
import type { RentalCategory } from '@/types/database'

// ── The gear locker ──────────────────────────────────────────────────────────
//
// WHAT THIS PAGE IS FOR, WHICH IS NOT WHAT /shop IS FOR
//
// A shop is browsed. A locker is checked. Somebody arriving here is going
// somewhere on particular days and needs to know what they can have on those
// days — so the date range is the FIRST control on the page, it is part of the
// URL, and once it is set every card answers for itself. The old locker made
// you open an item and fill in two date fields to discover it was already
// booked, which is the whole transaction happening in the wrong order.
//
// THE URL IS THE STATE. There is no local mirror to fall out of step with it,
// the back button works because it changes the thing being read, and — the
// reason that matters most here — "the tents free that weekend" becomes a link
// somebody can send to the person they are going with.
//
// AVAILABILITY IS NOT COMPUTED HERE. It arrives as a prop, from
// `rental_items_availability` (migration 110), which is the same predicate
// `rental_available_units` uses at checkout. The shelf shown and the shelf
// booked against must be one opinion, and the database owns it.

export default function RentLocker({
  items,
  categories,
  availability,
}: {
  items: RentalItemListed[]
  categories: RentalCategory[]
  availability: AvailabilityMap
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const filters = useMemo<RentalFilters>(() => rentalFiltersFromParams(searchParams), [searchParams])
  const [pending, startTransition] = useTransition()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)

  const today = shopToday()
  const datesChosen = Boolean(filters.from && filters.to)

  const bands = useMemo(() => rateBands(items), [items])
  const ctx = useMemo(() => ({ bands, availability }), [bands, availability])
  const shown = useMemo(() => applyRentalFilters(items, filters, ctx), [items, filters, ctx])
  const activeCount = countActiveRental(filters)

  const commit = useCallback(
    (next: RentalFilters) => {
      const qs = rentalFiltersToParams(next).toString()
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      })
    },
    [router, pathname],
  )

  // ── The search box ────────────────────────────────────────────────────────
  //
  // Held locally and debounced into the URL. Writing on every keystroke would
  // push a server render per character; reading straight from the URL would make
  // the field lag the typing by a whole transition. So the input is local, the
  // truth is the URL, and the two are reconciled by ONE condition: `q` differs
  // from `filters.q`.
  //
  // That comparison is doing the work a `typing` ref used to do, and doing it
  // better. The ref version had to be read during render to build the chips,
  // which is exactly what `react-hooks/refs` forbids and for a real reason —
  // a value the render depends on that React cannot see change. Here there is
  // no hidden value: while somebody is typing the two differ, and the moment
  // the commit lands they are equal and everything settles.
  const [q, setQ] = useState(filters.q)
  useEffect(() => {
    if (q === filters.q) return
    const t = setTimeout(() => commit({ ...filters, q }), 250)
    return () => clearTimeout(t)
    // `filters` must be the current one — a stale closure would resurrect
    // filters the visitor has since cleared.
  }, [q, filters, commit])
  // The URL changing underneath — the back button, a cleared chip — must reach
  // the field. This cannot fight the typist: it only ever runs when `filters.q`
  // itself changes, which happens on the commit the typist caused (a no-op,
  // the two already agree) or on a navigation they asked for.
  useEffect(() => {
    // Syncing local state with an external system — the URL — which is what an
    // effect is for. The same exemption `RentBooking` takes for the same reason.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQ(filters.q)
  }, [filters.q])

  const toggleValue = (d: 'categories' | 'fulfilment' | 'bands' | 'capacities', v: string) =>
    commit({ ...filters, [d]: toggle(filters[d], v) })

  const clearAll = () => {
    setQ('')
    // The dates survive a Clear. They are the errand, not a filter on it, and
    // wiping the weekend somebody is planning because they unticked "Shelter"
    // is the single most annoying thing this control could do.
    commit({ ...rentalFiltersFromParams(new URLSearchParams()), from: filters.from, to: filters.to, sort: filters.sort })
  }

  const setDates = (from: string, to: string) => commit({ ...filters, from, to })

  // ── Presets ───────────────────────────────────────────────────────────────
  // Most hires in a trekking shop are a weekend. Computed from the SHOP's today
  // (`lib/shopTime.ts`), not the browser's — between midnight and 05:30 IST a
  // UTC clock reads yesterday, which is the bug that put "yesterday" in the
  // date inputs before `shopToday` existed.
  const presets = useMemo(() => {
    const dow = new Date(`${today}T00:00:00Z`).getUTCDay() // 0 Sun … 6 Sat
    const toSat = (6 - dow + 7) % 7 || 7
    const sat = shopAddDays(today, toSat)
    return [
      { label: 'This weekend', from: sat, to: shopAddDays(sat, 1) },
      { label: 'Next weekend', from: shopAddDays(sat, 7), to: shopAddDays(sat, 8) },
      { label: 'A week from tomorrow', from: shopAddDays(today, 1), to: shopAddDays(today, 7) },
    ]
  }, [today])

  // ── The sheet ─────────────────────────────────────────────────────────────
  // Body scroll locked, focus moved in, Tab trapped, focus returned on close —
  // the shop's rail had to learn each of these the hard way and there is no
  // reason for the locker to relearn them.
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
      if (e.key === 'Escape') { setSheetOpen(false); return }
      if (e.key !== 'Tab') return
      const f = sheetRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      if (!f?.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    // Captured now, not read in the cleanup: by then the ref may point at a
    // different node, and returning focus to the opener is the whole point.
    const opener = openerRef.current
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prior
      document.removeEventListener('keydown', onKey)
      opener?.focus()
    }
  }, [sheetOpen])

  // Crossing the breakpoint with the sheet open used to display:none it while
  // the state stayed true — leaving `overflow: hidden` on <body> with no
  // visible control left to clear it.
  useEffect(() => {
    if (!sheetOpen) return
    const mq = window.matchMedia('(min-width: 1280px)')
    const onChange = () => mq.matches && setSheetOpen(false)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [sheetOpen])

  useEffect(() => {
    if (!sortOpen) return
    const onDown = (e: PointerEvent) => {
      if (!sortRef.current?.contains(e.target as Node)) setSortOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSortOpen(false); sortTriggerRef.current?.focus() }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [sortOpen])

  // The dates, forwarded into every card so the item page opens with them
  // already chosen — the point of asking once at the top of the page.
  const carry = datesChosen ? `?from=${filters.from}&to=${filters.to}` : ''

  const chips = [
    ...(filters.q.trim() ? [{ key: 'q', label: `“${filters.q.trim()}”`, clear: () => { setQ(''); commit({ ...filters, q: '' }) } }] : []),
    ...filters.categories.map((slug) => ({
      key: `c:${slug}`,
      label: categories.find((c) => c.slug === slug)?.name ?? slug,
      clear: () => toggleValue('categories', slug),
    })),
    ...filters.fulfilment.map((v) => ({
      key: `f:${v}`, label: v === 'pickup' ? 'Collect' : 'Posted',
      clear: () => toggleValue('fulfilment', v),
    })),
    ...filters.bands.map((k) => ({
      key: `b:${k}`, label: bands.find((b) => b.key === k)?.label ?? k,
      clear: () => toggleValue('bands', k),
    })),
    ...filters.capacities.map((k) => ({
      key: `p:${k}`, label: CAPACITY_BUCKETS.find((b) => b.key === k)?.label ?? k,
      clear: () => toggleValue('capacities', k),
    })),
    ...(filters.availableOnly ? [{ key: 'free', label: 'Only what is free', clear: () => commit({ ...filters, availableOnly: false }) }] : []),
  ]

  const rail = (
    <RentalRail
      items={items} filters={filters} ctx={ctx} categories={categories} bands={bands}
      onToggle={toggleValue}
      onSetAvailableOnly={(next) => commit({ ...filters, availableOnly: next })}
      onClear={clearAll} activeCount={activeCount} datesChosen={datesChosen}
    />
  )

  // Grouped into shelves only when the visitor has not narrowed anything. Once
  // they have, headings are noise between them and the answer.
  const grouped = activeCount === 0 && filters.sort === 'featured'
  const shelves = useMemo(() => (grouped ? shelve(shown, categories) : []), [grouped, shown, categories])

  return (
    <>
      <div inert={sheetOpen || undefined}>
        {/* ── The dates ────────────────────────────────────────────────────
            First, and the width of the page, because it is the question the
            rest of the page answers. */}
        <section className="border-y border-rule bg-paper-deep/40">
          <div className="mx-auto max-w-6xl px-6 py-6">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
              <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-forest">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                When are you going?
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <label className="block">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-mid">From</span>
                  <input
                    type="date" value={filters.from} min={today}
                    onChange={(e) => setDates(e.target.value, filters.to && filters.to < e.target.value ? '' : filters.to)}
                    className="mt-1 block rounded-[var(--r-input)] border border-rule bg-surface px-3 py-2 font-body text-sm text-ink"
                  />
                </label>
                <label className="block">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-mid">Until</span>
                  <input
                    type="date" value={filters.to} min={filters.from || today}
                    onChange={(e) => setDates(filters.from || today, e.target.value)}
                    className="mt-1 block rounded-[var(--r-input)] border border-rule bg-surface px-3 py-2 font-body text-sm text-ink"
                  />
                </label>
                {datesChosen && (
                  <button
                    type="button" onClick={() => setDates('', '')}
                    className="pb-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-mid underline underline-offset-4 hover:text-clay-deep"
                  >
                    Clear dates
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {presets.map((p) => {
                  const on = filters.from === p.from && filters.to === p.to
                  return (
                    <button
                      key={p.label} type="button" onClick={() => setDates(p.from, p.to)}
                      aria-pressed={on}
                      className={`rounded-full border px-3.5 py-1.5 font-body text-[13px] transition-colors ${
                        on ? 'border-forest bg-forest text-paper' : 'border-rule text-mid hover:border-forest hover:text-forest'
                      }`}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Mounted empty and only its text changes, so the sentence the
                whole page turns on is actually announced — a live region
                inserted already populated is not reliably read out. */}
            <p className="mt-3 font-body text-[13px] text-mid" aria-live="polite" aria-atomic="true">
              {datesChosen
                ? `Showing what is free ${pretty(filters.from)} – ${pretty(filters.to)}. Both days count.`
                : ''}
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex flex-col gap-8 xl:flex-row xl:gap-10">
            <aside className="hidden w-[260px] shrink-0 xl:block">{rail}</aside>

            <div className="min-w-0 flex-1">
              {/* ── Search, sort, count ──────────────────────────────────── */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-0 flex-1 basis-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mid" aria-hidden="true" />
                  <input
                    type="search" value={q} onChange={(e) => setQ(e.target.value)}
                    placeholder="Search the locker — tent, pack, spikes…"
                    aria-label="Search the gear locker"
                    className="w-full rounded-full border border-rule bg-surface py-2.5 pl-9 pr-9 font-body text-sm text-ink placeholder:text-light"
                  />
                  {q && (
                    <button
                      type="button" onClick={() => setQ('')}
                      aria-label="Clear the search"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-mid hover:text-clay-deep"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <button
                  ref={openerRef} type="button" onClick={() => setSheetOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-rule px-4 py-2.5 font-body text-[13px] text-ink hover:border-forest xl:hidden"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                  Filter{activeCount > 0 && <span className="font-mono text-forest">{activeCount}</span>}
                </button>

                <div ref={sortRef} className="relative">
                  <button
                    ref={sortTriggerRef} type="button" onClick={() => setSortOpen((o) => !o)}
                    aria-expanded={sortOpen} aria-haspopup="menu"
                    className="inline-flex items-center gap-2 rounded-full border border-rule px-4 py-2.5 font-body text-[13px] text-ink hover:border-forest"
                  >
                    <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
                    {RENTAL_SORTS.find((s) => s.key === filters.sort)?.label}
                  </button>
                  {sortOpen && (
                    <div role="menu" className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-[var(--r-panel)] border border-rule bg-surface py-1 shadow-lg">
                      {RENTAL_SORTS.map((s) => (
                        <button
                          key={s.key} type="button" role="menuitemradio" aria-checked={filters.sort === s.key}
                          onClick={() => { commit({ ...filters, sort: s.key }); setSortOpen(false); sortTriggerRef.current?.focus() }}
                          className={`block w-full px-4 py-2 text-left font-body text-[13px] hover:bg-paper-deep ${
                            filters.sort === s.key ? 'text-forest' : 'text-ink'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Chips, and the count. `pending` is shown because `filters` is
                  derived from the URL through a transition — until it commits,
                  nothing on screen moves, and the page's answer to "did that
                  register?" was, for the duration, no. */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-mid" aria-live="polite">
                  {pending ? (
                    <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Looking…</span>
                  ) : (
                    `${shown.length} of ${items.length}`
                  )}
                </p>
                {chips.map((c) => (
                  <button
                    key={c.key} type="button" onClick={c.clear}
                    className="inline-flex items-center gap-1.5 rounded-full border border-forest/25 bg-forest/[0.06] px-3 py-1 font-body text-[12px] text-forest hover:bg-forest/10"
                  >
                    {c.label}
                    <X className="h-3 w-3" aria-hidden="true" />
                    <span className="sr-only">Remove this filter</span>
                  </button>
                ))}
              </div>

              {/* ── The grid ─────────────────────────────────────────────── */}
              {shown.length === 0 ? (
                <div className="mt-10 rounded-[var(--r-panel)] border border-dashed border-rule bg-paper-deep/40 p-10 text-center">
                  <p className="font-display text-xl text-ink">Nothing matches that.</p>
                  <p className="mx-auto mt-2 max-w-prose font-body text-sm text-mid">
                    {filters.availableOnly && datesChosen
                      ? 'Nothing in the locker is free for those dates with those filters. Try a different weekend, or untick "only what is free" to see when it comes back.'
                      : 'Try fewer filters, or a different word.'}
                  </p>
                  <button
                    type="button" onClick={clearAll}
                    className="mt-5 rounded-full border border-forest px-5 py-2 font-body text-[13px] text-forest hover:bg-forest hover:text-paper"
                  >
                    Clear the filters
                  </button>
                </div>
              ) : grouped ? (
                <div className="mt-8 space-y-12">
                  {shelves.map((s) => (
                    <section key={s.category?.slug ?? 'loose'}>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule pb-2">
                        <h2 className="font-display text-xl text-ink">{s.category?.name ?? 'Everything else'}</h2>
                        <span className="font-mono text-[11px] tabular-nums text-mid">{s.items.length}</span>
                      </div>
                      {s.category?.blurb && (
                        <p className="mt-2 max-w-prose font-body text-[13px] text-mid">{s.category.blurb}</p>
                      )}
                      <ul className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                        {s.items.map((it) => (
                          <li key={it.id}>
                            <RentalCard
                              item={it} shelf={carry} datesChosen={datesChosen}
                              free={availability[it.id]?.free} total={availability[it.id]?.total}
                            />
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              ) : (
                <ul className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                  {shown.map((it) => (
                    <li key={it.id}>
                      <RentalCard
                        item={it} shelf={carry} datesChosen={datesChosen}
                        free={availability[it.id]?.free} total={availability[it.id]?.total}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── The phone's rail, in a sheet ──────────────────────────────────── */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setSheetOpen(false)} aria-hidden="true" />
          <div
            ref={sheetRef} role="dialog" aria-modal="true" aria-label="Filter the locker"
            className="absolute inset-y-0 right-0 flex w-[min(360px,90vw)] flex-col bg-surface shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-rule px-5 py-4">
              <span className="font-display text-lg text-ink">Filter</span>
              <button ref={closeRef} type="button" onClick={() => setSheetOpen(false)} aria-label="Close the filters" className="text-mid hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5">{rail}</div>
            <div className="border-t border-rule p-4">
              <button
                type="button" onClick={() => setSheetOpen(false)}
                className="w-full rounded-full bg-forest px-6 py-3 font-body text-sm font-medium text-paper hover:bg-forest-mid"
              >
                Show {shown.length} {shown.length === 1 ? 'piece' : 'pieces'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** `YYYY-MM-DD` read as a plain day, never through the local clock — parsing at
 *  UTC midnight is the technique `lib/rentalMath.ts` uses and the reason its
 *  day counts are right. */
function pretty(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  })
}
