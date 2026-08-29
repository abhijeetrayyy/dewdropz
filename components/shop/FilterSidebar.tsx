'use client'

import { useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  facetCount, bandMatches, sizesOf,
  type ShopFilters, type PriceBand, type CategoryGroup,
} from '@/lib/shop-filter'
import type { ProductWithCollection, Collection, Category } from '@/types/database'

// ── The filter rail ──────────────────────────────────────────────────────────
//
// A left rail, which is what a shopper coming from any other store expects, and
// what makes a catalogue with five facets legible without hiding four of them
// behind a disclosure.
//
// The rail this is NOT is the one the codebase had originally: a column of
// radio lists, single-select, with no counts, and a separate modal on phones so
// the two form factors behaved differently. Everything here is multi-select,
// every value carries the number of pieces it would actually return, and the
// phone gets the same rail in a sheet rather than a different control.

function Section({
  title,
  count,
  children,
  defaultOpen = true,
}: {
  title: string
  count?: number
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-rule-soft last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 py-3.5 text-left"
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mid">
          {title}
          {/* How many of THIS facet are on, so a collapsed section still tells
              you it is doing something. */}
          {count ? <span className="ml-2 text-forest">{count}</span> : null}
        </span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 shrink-0 text-light transition-transform duration-200', !open && '-rotate-90')}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  )
}

/** A value row. Checkbox semantics, a count, and a disabled state for a choice
 *  that would return nothing — greyed rather than hidden, so the rail does not
 *  reflow under the pointer as you tick things. */
function Row({
  label,
  count,
  checked,
  onChange,
}: {
  label: string
  count: number
  checked: boolean
  onChange: () => void
}) {
  const empty = count === 0 && !checked
  return (
    <label
      className={cn(
        'group flex cursor-pointer items-center gap-2.5 py-1.5 pl-0.5 pr-1',
        empty && 'cursor-not-allowed opacity-40'
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={empty}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          'flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[3px] border transition-colors',
          checked
            ? 'border-forest bg-forest text-paper'
            : 'border-rule-warm bg-surface group-hover:border-forest/50',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-forest/40 peer-focus-visible:ring-offset-1'
        )}
      >
        {checked && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
      </span>
      <span className={cn('flex-1 font-body text-[13px] leading-snug', checked ? 'text-text' : 'text-mid')}>
        {label}
      </span>
      <span className="font-mono text-[10px] tabular-nums text-light">{count}</span>
    </label>
  )
}

export default function FilterSidebar({
  products,
  filters,
  ctx,
  groups,
  collections,
  bands,
  sizes,
  onToggle,
  onSetInStock,
  onClear,
  activeCount,
}: {
  products: ProductWithCollection[]
  filters: ShopFilters
  ctx: { categories: Category[]; bands: PriceBand[] }
  groups: CategoryGroup[]
  collections: Collection[]
  bands: PriceBand[]
  sizes: string[]
  onToggle: (dimension: 'categories' | 'collections' | 'bands' | 'sizes', value: string) => void
  onSetInStock: (next: boolean) => void
  onClear: () => void
  activeCount: number
}) {
  return (
    <div className="rounded-[var(--r-panel)] border border-rule/70 bg-surface px-4 shadow-[var(--shadow-card)]">
      {/* Header: what is on, and the one control that undoes all of it. */}
      <div className="flex items-center justify-between gap-2 border-b border-rule py-3.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-text">
          Filter
          {activeCount > 0 && (
            <span className="ml-2 rounded-full bg-forest px-1.5 py-0.5 text-[9px] text-paper">
              {activeCount}
            </span>
          )}
        </span>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 font-body text-[11px] text-light transition-colors hover:text-clay-deep"
          >
            Clear
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
      </div>

      {groups.length > 0 && (
        <Section title="Category" count={filters.categories.length}>
          <div className="space-y-3">
            {groups.map((group, gi) => (
              <div key={group.heading || `ungrouped-${gi}`}>
                {/* The department heading. In the old top rail this lived inside
                    a horizontal scroller, so it was off-screen exactly when you
                    had scrolled to the group it named. A rail holds still.

                    When the department itself holds products, the heading IS the
                    row — one control named "Apparel", rather than a heading and
                    a separate checkbox that share a name and look unrelated. */}
                {group.self ? (
                  <Row
                    label={group.self.name}
                    checked={filters.categories.includes(group.self.slug)}
                    count={facetCount(products, filters, ctx, 'categories', (p) =>
                      !!p.categories?.some((pc) => pc.category_id === group.self!.id)
                    )}
                    onChange={() => onToggle('categories', group.self!.slug)}
                  />
                ) : (
                  group.heading && (
                    <p className="mb-1 font-body text-[11px] font-medium uppercase tracking-[0.1em] text-light">
                      {group.heading}
                    </p>
                  )
                )}
                {/* Children are indented under their department, so the rail
                    shows the shape of the range rather than a flat list. */}
                <div className={group.self ? 'ml-3 border-l border-rule-soft pl-3' : ''}>
                {group.items.map((c) => (
                  <Row
                    key={c.id}
                    label={c.name}
                    checked={filters.categories.includes(c.slug)}
                    count={facetCount(products, filters, ctx, 'categories', (p) =>
                      !!p.categories?.some((pc) => pc.category_id === c.id)
                    )}
                    onChange={() => onToggle('categories', c.slug)}
                  />
                ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {collections.length > 1 && (
        <Section title="Collection" count={filters.collections.length}>
          {collections.map((c) => (
            <Row
              key={c.id}
              label={c.name}
              checked={filters.collections.includes(c.slug)}
              count={facetCount(products, filters, ctx, 'collections', (p) => p.collection?.slug === c.slug)}
              onChange={() => onToggle('collections', c.slug)}
            />
          ))}
        </Section>
      )}

      {bands.length > 0 && (
        <Section title="Price" count={filters.bands.length}>
          {bands.map((b) => (
            <Row
              key={b.key}
              label={b.label}
              checked={filters.bands.includes(b.key)}
              count={facetCount(products, filters, ctx, 'bands', (p) => bandMatches(b, p.price))}
              onChange={() => onToggle('bands', b.key)}
            />
          ))}
        </Section>
      )}

      {sizes.length > 0 && (
        <Section title="Size" count={filters.sizes.length}>
          {/* Sizes are a swatch grid, not a checkbox list — it is the control
              every apparel shop uses, it fits four to a row instead of one, and
              a size is a label short enough to read inside its own target. */}
          <div className="grid grid-cols-4 gap-1.5">
            {sizes.map((size) => {
              const on = filters.sizes.includes(size)
              const n = facetCount(products, filters, ctx, 'sizes', (p) => sizesOf(p).includes(size))
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => onToggle('sizes', size)}
                  aria-pressed={on}
                  disabled={n === 0 && !on}
                  title={`${n} ${n === 1 ? 'piece' : 'pieces'}`}
                  className={cn(
                    'flex h-9 items-center justify-center rounded-[var(--r-input)] border font-body text-[12px] transition-colors',
                    on
                      ? 'border-forest bg-forest text-paper'
                      : 'border-rule-warm bg-surface text-mid hover:border-forest/50 hover:text-forest',
                    n === 0 && !on && 'cursor-not-allowed opacity-35 hover:border-rule-warm hover:text-mid'
                  )}
                >
                  {size}
                </button>
              )
            })}
          </div>
        </Section>
      )}

      <Section title="Availability" count={filters.inStock ? 1 : 0}>
        <Row
          label="In stock only"
          checked={filters.inStock}
          count={products.filter((p) => (p.variants ?? []).some((v) => (v.inventory_quantity ?? 0) > 0) || !(p.variants ?? []).length).length}
          onChange={() => onSetInStock(!filters.inStock)}
        />
      </Section>
    </div>
  )
}
