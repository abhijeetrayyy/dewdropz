'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  facetCount, bandMatches, sizesOf, inStock,
  type ShopFilters, type PriceBand, type CategoryGroup,
} from '@/lib/shop-filter'
import type { ProductWithCollection, Collection, Category } from '@/types/database'

// ── The filter rail ──────────────────────────────────────────────────────────
//
// A left rail, which is what a shopper coming from any other store expects, and
// what makes a catalogue with several facets legible without hiding them behind
// a disclosure.
//
// The rail this is NOT is the one the codebase had originally: a column of
// radio lists, single-select, with no counts, and a separate modal on phones so
// the two form factors behaved differently. Everything here is multi-select,
// every value carries the number of pieces it would actually return, and the
// phone gets the same rail in a sheet rather than a different control.
//
// TWO THINGS THE CLIENT SENT BACK, 2026-08-31
//
// 1 · The shop council gated three facets on whether their values could
//     actually partition the catalogue, and on ten products that hid Collection
//     entirely. The reasoning was sound and the result was not: a rail that
//     removes the dimension the brand merchandises by is not a cleaner rail, it
//     is a rail missing its most interesting column. Every facet with values now
//     renders. If a dimension is weak, that is information about the catalogue
//     and the shopper is allowed to see it.
//
// 2 · The rail was 200px and read as an afterthought. It is 280px, and the
//     Collection rows carry the collection — its photograph, its tagline, its
//     count — instead of a checkbox and a word. That is the one facet on this
//     page with art behind it, and spending it on a 15px tick box was the reason
//     the column looked like scaffolding.

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
        className="group flex min-h-[44px] w-full items-center justify-between gap-2 py-4 text-left xl:min-h-0 xl:py-3.5"
      >
        <span className="font-body text-[11px] font-medium uppercase tracking-[0.12em] text-mid transition-colors group-hover:text-text">
          {title}
          {count ? (
            <span className="ml-2 font-mono tabular-nums text-forest">{count}</span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-mid transition-transform duration-200 ease-[var(--ease-out)]',
            !open && '-rotate-90'
          )}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>
      {/* The disclosure used to unmount its content in one frame while the
          chevron took 200ms to turn — the indicator animated and the thing it
          indicated did not. A 1fr/0fr grid row is the one reliable way to
          transition to an unknown height. */}
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-200 ease-[var(--ease-out)]',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <div className="pb-4">{children}</div>
        </div>
      </div>
    </div>
  )
}

/** A value row. Checkbox semantics, a count, and a state for a choice that
 *  would return nothing.
 *
 *  That state used to be `opacity-40` on the whole row, which composited the
 *  label to 1.96:1, the count to 1.50:1 and the checkbox edge to 1.23:1 — three
 *  RGB steps out of 255. The rail's argument for greying rather than hiding is
 *  that it does not reflow under the pointer AND that you can still read what
 *  has emptied; at 1.20:1 it achieved the first and quietly abandoned the
 *  second. So the row keeps its type legible and moves the "off" meaning into a
 *  filled checkbox, where it belongs. */
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
        // 44px on the phone, where this is the primary target inside a modal
        // that locks body scroll; 34px in the desktop rail, where a pointer is
        // driving. The breakpoint IS the context: the rail is `hidden xl:block`
        // and the sheet is `xl:hidden`.
        'group flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[var(--r-input)] px-1.5 py-2 transition-colors hover:bg-paper xl:min-h-[34px] xl:py-1.5',
        empty && 'cursor-not-allowed hover:bg-transparent'
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
          'flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-[var(--r-stamp)] border transition-colors duration-200',
          checked
            ? 'border-forest bg-forest text-paper'
            : empty
              ? 'border-rule bg-paper-warm'
              : 'border-rule-warm bg-surface group-hover:border-forest/50',
          // /40 composited to 2.12:1 against the panel's white — under the 3:1
          // a focus indicator needs, and the input is `sr-only`, so this ring
          // was the ONLY thing a keyboard user had on every checkbox in the rail.
          'peer-focus-visible:ring-2 peer-focus-visible:ring-forest peer-focus-visible:ring-offset-1'
        )}
      >
        {checked && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
      </span>
      <span
        className={cn(
          'flex-1 font-body text-[13px] leading-snug transition-colors',
          checked ? 'text-text' : empty ? 'text-light' : 'text-mid'
        )}
      >
        {label}
      </span>
      <span className="font-mono text-[11px] tabular-nums text-mid">{count}</span>
    </label>
  )
}

/** A collection, as itself.
 *
 *  The one facet on this page with photography, a name and a line of the
 *  brand's own writing behind it — and it was rendering as a tick box and a
 *  word, which is why the rail looked like scaffolding and why the client could
 *  not find the collections in it. */
function CollectionRow({
  collection,
  count,
  checked,
  onChange,
}: {
  collection: Collection
  count: number
  checked: boolean
  onChange: () => void
}) {
  const empty = count === 0 && !checked
  return (
    <label
      className={cn(
        'group flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[var(--r-input)] px-1.5 py-2 transition-colors',
        checked ? 'bg-sage-soft' : 'hover:bg-paper',
        empty && 'cursor-not-allowed opacity-60 hover:bg-transparent'
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
          'relative h-10 w-10 shrink-0 overflow-hidden rounded-[var(--r-input)] bg-paper-deep transition-shadow duration-200',
          checked
            ? 'ring-2 ring-forest ring-offset-1'
            : 'group-hover:shadow-[var(--shadow-card)]',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-forest peer-focus-visible:ring-offset-1'
        )}
      >
        {collection.image_url ? (
          <Image
            src={collection.image_url}
            alt=""
            fill
            sizes="40px"
            className="object-cover"
          />
        ) : (
          <span className="absolute inset-0" style={{ background: collection.gradient ?? '#2A3B31' }} />
        )}
        {checked && (
          <span className="absolute inset-0 flex items-center justify-center bg-forest/70 text-paper">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate font-body text-[13px] leading-snug', checked ? 'text-text' : 'text-mid')}>
          {collection.name}
        </span>
        {collection.tagline && (
          // The line the homepage prints under each collection photograph, and
          // the most brand-carrying copy in the data. The shop had been
          // printing the stock level in its place.
          <span className="mt-0.5 block truncate font-body text-[11px] italic leading-snug text-light">
            {collection.tagline}
          </span>
        )}
      </span>
      <span className="font-mono text-[11px] tabular-nums text-mid">{count}</span>
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
  const inStockCount = facetCount(products, filters, ctx, 'inStock', (p) => inStock(p))

  return (
    // A panel, not a bordered card. `--r-panel` is defined in globals.css as
    // "a rail card", so the codebase had already decided the species; Law 02
    // then fails a card that carries both a border and a shadow, and binds a
    // panel to --shadow-panel. The border was doing no work either: --rule at
    // 70% over the panel's own white composites to a value 2.3 L* DARKER than
    // the ground it sat on — 1.06:1, a smudge rather than a hairline.
    <div className="overflow-hidden rounded-[var(--r-panel)] bg-surface shadow-[var(--shadow-panel)]">
      {/* A hairline of first light across the top of the instrument. The same
          gesture as the masthead and the empty state — it is what stops a white
          panel on cream reading as a blank rectangle. */}
      <span
        aria-hidden="true"
        className="block h-px bg-gradient-to-r from-transparent via-dawn/60 to-transparent"
      />
      <div className="px-5">
        <h2 className="sr-only">Filter products</h2>
        {/* Header: what is on, and the one control that undoes all of it. */}
        <div className="flex min-h-[52px] items-center justify-between gap-2 border-b border-rule py-3">
          <span className="font-body text-[11px] font-medium uppercase tracking-[0.12em] text-text">
            Filter
            {activeCount > 0 && (
              <span className="ml-2 rounded-full bg-forest px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-paper">
                {activeCount}
              </span>
            )}
          </span>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="-m-2 inline-flex items-center gap-1 p-2 font-body text-[11px] text-mid transition-colors hover:text-clay-deep"
            >
              Clear
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Collections lead the rail. They are how the brand organises the
            range, they are the only facet carrying photography, and they were
            the thing the client went looking for and could not find. */}
        {collections.length > 0 && (
          <Section title="Collection" count={filters.collections.length}>
            <div className="space-y-1">
              {collections.map((c) => (
                <CollectionRow
                  key={c.id}
                  collection={c}
                  checked={filters.collections.includes(c.slug)}
                  count={facetCount(products, filters, ctx, 'collections', (p) => p.collection?.slug === c.slug)}
                  onChange={() => onToggle('collections', c.slug)}
                />
              ))}
            </div>
          </Section>
        )}

        {groups.length > 0 && (
          <Section title="Category" count={filters.categories.length}>
            <div className="space-y-5">
              {groups.map((group, gi) => (
                <div key={group.heading || `ungrouped-${gi}`}>
                  {/* The department heading. In the old top rail this lived
                      inside a horizontal scroller, so it was off-screen exactly
                      when you had scrolled to the group it named. A rail holds
                      still.

                      When the department itself holds products, the heading IS
                      the row — one control named "Apparel", rather than a
                      heading and a separate checkbox that share a name and look
                      unrelated. */}
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
                      <p className="mb-1 px-1.5 font-body text-[11px] font-medium uppercase tracking-[0.1em] text-mid">
                        {group.heading}
                      </p>
                    )
                  )}
                  {/* Children are indented under their department, so the rail
                      shows the shape of the range rather than a flat list. */}
                  <div className={group.self ? 'ml-3 border-l border-rule-soft pl-2' : ''}>
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

        {/* Size and Availability open closed. Not to hide them — the client was
            explicit that this rail should stop hiding things — but because the
            rail no longer has its own scrollbar, so its HEIGHT is now the
            constraint: a rail taller than the viewport is a rail whose last
            facet you cannot see without scrolling the whole page. Closed by
            default these two cost 44px each instead of 80 and 78, which brings
            the whole instrument inside a 800px viewport. They stay open once
            opened, and a section with an active filter shows its count in the
            header while closed, so nothing is ever silently on. */}
        {sizes.length > 0 && (
          <Section title="Size" count={filters.sizes.length} defaultOpen={filters.sizes.length > 0}>
            {/* Sizes are a swatch grid, not a checkbox list — it is the control
                every apparel shop uses, it fits four to a row instead of one,
                and a size is a label short enough to read inside its own
                target. */}
            <div className="grid grid-cols-4 gap-2">
              {sizes.map((size) => {
                const on = filters.sizes.includes(size)
                const n = facetCount(products, filters, ctx, 'sizes', (p) => sizesOf(p).includes(size))
                const empty = n === 0 && !on
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => onToggle('sizes', size)}
                    aria-pressed={on}
                    disabled={empty}
                    // `title` is a mouse-only affordance, so the one facet whose
                    // count is not printed was also the one whose count a touch
                    // or keyboard user could never reach.
                    aria-label={`${size} — ${n} ${n === 1 ? 'piece' : 'pieces'}`}
                    className={cn(
                      'flex h-11 items-center justify-center rounded-[var(--r-input)] border font-body text-[12px] transition-colors duration-200 xl:h-9',
                      on
                        ? 'border-forest bg-forest text-paper'
                        : empty
                          ? 'cursor-not-allowed border-rule bg-paper-warm text-light'
                          : 'border-rule-warm bg-surface text-mid hover:border-forest/50 hover:text-forest'
                    )}
                  >
                    {size}
                  </button>
                )
              })}
            </div>
          </Section>
        )}

        <Section title="Availability" count={filters.inStock ? 1 : 0} defaultOpen={filters.inStock}>
          <Row
            label="In stock only"
            checked={filters.inStock}
            // Was computed by hand instead of through `facetCount`, so it was
            // the one number in the rail that disagreed with the grid: on a
            // filtered view it printed "In stock only — 10" beside "0 results".
            count={inStockCount}
            onChange={() => onSetInStock(!filters.inStock)}
          />
        </Section>
      </div>
    </div>
  )
}
