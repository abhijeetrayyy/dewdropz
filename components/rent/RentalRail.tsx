'use client'

import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  rentalFacetCount, rateBandMatches, CAPACITY_BUCKETS,
  type RentalFilters, type RentalFilterCtx, type RentalItemListed, type RateBand,
} from '@/lib/rental-filter'
import type { RentalCategory } from '@/types/database'

// ── The locker's rail ────────────────────────────────────────────────────────
//
// Deliberately the same instrument as the shop's `FilterSidebar`: multi-select
// throughout, a count on every value that answers "if I click this, what do I
// get", and the same control on a phone rather than a weaker one. Somebody who
// has used /shop should not have to learn a second thing here.
//
// It is a separate component rather than a generalisation of that one because
// the two rails filter different nouns over different facets — the shop's is
// typed to `ProductWithCollection`, groups by department, and has a collections
// plate with photography behind it. Merging them would mean a props object that
// is a union of both and a body full of `if (kind === 'rental')`, which is how
// one good component becomes two bad ones.

function Section({
  title, children, defaultOpen = true,
}: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-rule last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="group flex min-h-[44px] w-full items-center justify-between gap-2 py-4 text-left xl:min-h-0 xl:py-3.5"
      >
        <span className="font-body text-[11px] font-medium uppercase tracking-[0.12em] text-mid transition-colors group-hover:text-ink">
          {title}
        </span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 shrink-0 text-mid transition-transform duration-200', !open && '-rotate-90')}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>
      {/* A 1fr/0fr grid row is the one reliable way to transition to an unknown
          height — the same reasoning as the shop's rail, and the reason the
          chevron and the content now move together. */}
      <div className={cn('grid transition-[grid-template-rows,opacity] duration-200',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
        <div className="overflow-hidden"><div className="pb-4">{children}</div></div>
      </div>
    </div>
  )
}

/** A value row: checkbox semantics, a count, and a legible "would return
 *  nothing" state. The label keeps full contrast when empty and the meaning
 *  moves into the box — greying the whole row is what made the shop's rail
 *  unreadable at 1.96:1. */
function Row({
  label, count, checked, onChange,
}: { label: string; count: number; checked: boolean; onChange: () => void }) {
  const empty = count === 0 && !checked
  return (
    <label
      className={cn(
        // 44px on the phone, where this sits in a modal and a thumb is driving;
        // 34px in the desktop rail, where a pointer is.
        'group flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[var(--r-input)] px-1.5 py-2 transition-colors hover:bg-paper-deep xl:min-h-[34px] xl:py-1.5',
        empty && 'cursor-not-allowed hover:bg-transparent',
      )}
    >
      <input type="checkbox" checked={checked} onChange={onChange} disabled={empty} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-200',
          checked ? 'border-forest bg-forest text-paper'
            : empty ? 'border-rule bg-paper-deep'
              : 'border-rule bg-surface peer-focus-visible:ring-2 peer-focus-visible:ring-forest peer-focus-visible:ring-offset-1',
        )}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className="flex-1 font-body text-[13px] text-ink">{label}</span>
      <span className="font-mono text-[11px] tabular-nums text-mid">{count}</span>
    </label>
  )
}

export default function RentalRail({
  items, filters, ctx, categories, bands, onToggle, onSetAvailableOnly, onClear, activeCount, datesChosen,
}: {
  items: RentalItemListed[]
  filters: RentalFilters
  ctx: RentalFilterCtx
  categories: RentalCategory[]
  bands: RateBand[]
  onToggle: (d: 'categories' | 'fulfilment' | 'bands' | 'capacities', v: string) => void
  onSetAvailableOnly: (next: boolean) => void
  onClear: () => void
  activeCount: number
  datesChosen: boolean
}) {
  const count = (d: keyof RentalFilters, p: (i: RentalItemListed) => boolean) =>
    rentalFacetCount(items, filters, ctx, d, p)

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-2 border-b border-rule pb-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-forest">Narrow it down</span>
        {activeCount > 0 && (
          <button
            type="button" onClick={onClear}
            className="font-mono text-[11px] uppercase tracking-[0.1em] text-mid underline underline-offset-4 hover:text-clay-deep"
          >
            Clear {activeCount}
          </button>
        )}
      </div>

      {/* Availability leads the rail, because once dates are set it is the
          facet that decides whether anything else matters. It is rendered even
          without dates — but says so, rather than offering a control that would
          silently do nothing. */}
      <Section title="Availability">
        {datesChosen ? (
          <Row
            label="Only what is free"
            count={count('availableOnly', (i) => (ctx.availability?.[i.id]?.free ?? 0) > 0)}
            checked={filters.availableOnly}
            onChange={() => onSetAvailableOnly(!filters.availableOnly)}
          />
        ) : (
          <p className="px-1.5 py-1 font-body text-[13px] leading-relaxed text-mid">
            Pick your dates above and the locker will show what is actually free.
          </p>
        )}
      </Section>

      <Section title="Kind of gear">
        {categories.map((c) => (
          <Row
            key={c.slug}
            label={c.name}
            count={count('categories', (i) => i.category?.slug === c.slug)}
            checked={filters.categories.includes(c.slug)}
            onChange={() => onToggle('categories', c.slug)}
          />
        ))}
      </Section>

      <Section title="How you get it">
        {([['pickup', 'Collect in Dehradun'], ['ship', 'Posted to you']] as const).map(([v, label]) => (
          <Row
            key={v}
            label={label}
            count={count('fulfilment', (i) => (v === 'pickup' ? i.allows_pickup : i.allows_shipping))}
            checked={filters.fulfilment.includes(v)}
            onChange={() => onToggle('fulfilment', v)}
          />
        ))}
      </Section>

      {bands.length > 0 && (
        <Section title="Daily rate">
          {bands.map((b) => (
            <Row
              key={b.key}
              label={b.label}
              count={count('bands', (i) => rateBandMatches(b, i.daily_rate))}
              checked={filters.bands.includes(b.key)}
              onChange={() => onToggle('bands', b.key)}
            />
          ))}
        </Section>
      )}

      {/* Only the buckets something falls into. And note what this facet does
          NOT do: gear where the question is meaningless — poles, spikes — is
          never removed by it, because a person outfitting a trip for two still
          needs poles. `lib/rental-filter.test.ts` holds that to account. */}
      {CAPACITY_BUCKETS.some((b) => items.some((i) => i.capacity != null && b.test(i.capacity))) && (
        <Section title="Who it is for">
          {CAPACITY_BUCKETS.filter((b) => items.some((i) => i.capacity != null && b.test(i.capacity))).map((b) => (
            <Row
              key={b.key}
              label={b.label}
              count={count('capacities', (i) => i.capacity != null && b.test(i.capacity))}
              checked={filters.capacities.includes(b.key)}
              onChange={() => onToggle('capacities', b.key)}
            />
          ))}
        </Section>
      )}
    </div>
  )
}
