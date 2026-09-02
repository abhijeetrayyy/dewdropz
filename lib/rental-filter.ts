import type { RentalItem, RentalCategory } from '@/types/database'

// ── Finding gear in the locker ───────────────────────────────────────────────
//
// The shop has had `lib/shop-filter.ts` since the 23 August brief: pure
// functions over plain data, the URL as the single source of truth, and a rail
// with a count on every value. The rental locker — which is the HARDER browse —
// had a flat grid and nothing else. This is the same instrument, shaped for the
// one thing renting has that selling does not.
//
// THE DIMENSION THAT DOES NOT EXIST IN THE SHOP: DATES
//
// A product is in stock or it is not, and the answer is a column. A tent is
// free *between the 12th and the 16th*, and the answer is a calendar. So the
// date range is part of the filter state and travels in the same query string,
// and availability arrives as a map computed by the database
// (`rental_items_availability`, migration 110) rather than by anything in this
// file. That is deliberate and it is the rule the whole rental system is built
// on: the shelf shown to a customer and the shelf booked against must be one
// opinion, and the database owns it.
//
// This module therefore never decides whether something is available. It is
// handed the counts and filters on them.
//
// ON HAVING A SEARCH BOX AT ALL
//
// The shop council killed one at ten products and it was right to: browsing
// apparel is looking at things, and a box that makes you name what you want
// first is a worse instrument for that. A gear locker is a different errand.
// People arrive knowing the word — "microspikes", "60L", "four season" — and
// the functional name IS the product. So there is a box, it narrows a list the
// page has already loaded, and it is honest about being exactly that: no index,
// no server round trip, no ranking. Revisit at fifty items.

export type RentalSortKey = 'featured' | 'rate-asc' | 'rate-desc' | 'lightest' | 'name'

export const RENTAL_SORTS: { key: RentalSortKey; label: string }[] = [
  { key: 'featured', label: 'Recommended' },
  { key: 'rate-asc', label: 'Rate: low to high' },
  { key: 'rate-desc', label: 'Rate: high to low' },
  { key: 'lightest', label: 'Lightest first' },
  { key: 'name', label: 'A–Z' },
]

/** What the storefront knows about the shelf, keyed by item id. Produced by
 *  `rental_items_availability`; never computed here. */
export type AvailabilityMap = Record<string, { free: number; total: number }>

export type RentalFilters = {
  /** Free text, matched against name, summary, description and shelf. */
  q: string
  /** `rental_categories.slug`. */
  categories: string[]
  /** 'pickup' | 'ship' — what the customer can actually do with it. */
  fulfilment: string[]
  /** Rate band keys, derived from the catalogue. */
  bands: string[]
  /** '1' | '2' | '3+' — how many people it serves. */
  capacities: string[]
  /** Hide anything with nothing free for the chosen dates. Inert without them. */
  availableOnly: boolean
  /** The hire being planned, `YYYY-MM-DD`, or '' for "just browsing". */
  from: string
  to: string
  sort: RentalSortKey
}

export const EMPTY_RENTAL_FILTERS: RentalFilters = {
  q: '', categories: [], fulfilment: [], bands: [], capacities: [],
  availableOnly: false, from: '', to: '', sort: 'featured',
}

/** An item with its shelf joined on, which is what every read in the storefront
 *  actually selects. */
export type RentalItemListed = RentalItem & {
  category?: Pick<RentalCategory, 'slug' | 'name'> | null
}

// ── Rate bands ──────────────────────────────────────────────────────────────

export type RateBand = { key: string; label: string; min: number; max: number | null }

/** Derived from the catalogue rather than hardcoded, so they stay meaningful
 *  when a ₹120/day pair of poles and an ₹850/day bundle are both on the shelf.
 *  The same tercile split `priceBands` uses, and it returns nothing rather than
 *  three bands that all say the same thing on a catalogue too small or too flat
 *  to separate — a control must never promise a distinction it cannot make. */
export function rateBands(items: RentalItemListed[]): RateBand[] {
  if (items.length < 4) return []
  const rates = items.map((i) => i.daily_rate).sort((a, b) => a - b)
  const lo = rates[Math.floor(rates.length / 3)]
  const hi = rates[Math.floor((rates.length * 2) / 3)]
  const r = (paise: number) => Math.round(paise / 100)
  if (r(lo) === r(hi)) return []
  const inr = (paise: number) => `₹${r(paise).toLocaleString('en-IN')}`
  return [
    { key: 'low', label: `Under ${inr(lo)}/day`, min: 0, max: lo },
    { key: 'mid', label: `${inr(lo)} – ${inr(hi)}/day`, min: lo, max: hi },
    { key: 'high', label: `Over ${inr(hi)}/day`, min: hi, max: null },
  ]
}

export function rateBandMatches(band: RateBand, rate: number): boolean {
  if (band.max === null) return rate > band.min
  if (band.min === 0) return rate < band.max
  return rate >= band.min && rate <= band.max
}

// ── Capacity ────────────────────────────────────────────────────────────────

export const CAPACITY_BUCKETS: { key: string; label: string; test: (c: number) => boolean }[] = [
  { key: '1', label: 'Solo', test: (c) => c === 1 },
  { key: '2', label: 'Two of you', test: (c) => c === 2 },
  { key: '3+', label: 'A group', test: (c) => c >= 3 },
]

/** Only the buckets something in the locker actually falls into. Gear with no
 *  meaningful capacity — poles, spikes — is not "capacity 0"; the question does
 *  not apply, so it is absent from the facet AND unaffected by it. Filtering it
 *  out when somebody picks "Two of you" would hide the poles they need for the
 *  same trip. */
export function capacityBuckets(items: RentalItemListed[]) {
  return CAPACITY_BUCKETS.filter((b) =>
    items.some((i) => typeof i.capacity === 'number' && i.capacity !== null && b.test(i.capacity)),
  )
}

// ── Search ──────────────────────────────────────────────────────────────────

/** Lowercased, punctuation flattened to spaces, so "four-season" finds "four
 *  season" and "60L" finds "60 l" — the difference between a box that works and
 *  a box people stop using after the second miss. */
function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function searchHaystack(item: RentalItemListed): string {
  return normalise(
    [item.name, item.summary ?? '', item.description ?? '', item.category?.name ?? '',
     ...Object.values(item.specs ?? {}).map(String)].join(' '),
  )
}

/** Every token must appear, in any order and anywhere — so "tent season" finds
 *  the four-season tent, and adding a word always narrows. Substring rather than
 *  word-boundary matching, because "spike" should find "microspikes"; on a
 *  locker this size the false positives that costs are not a real problem, and
 *  the miss it prevents is. */
export function matchesSearch(item: RentalItemListed, q: string): boolean {
  const tokens = normalise(q).split(' ').filter(Boolean)
  if (!tokens.length) return true
  const hay = searchHaystack(item)
  return tokens.every((t) => hay.includes(t))
}

// ── The predicate ───────────────────────────────────────────────────────────

export type RentalFilterCtx = { bands: RateBand[]; availability?: AvailabilityMap }

/** `except` relaxes named dimensions, which is what makes `facetCount` able to
 *  answer "if I click this, what do I get" rather than "how many exist". */
function matches(
  item: RentalItemListed,
  f: RentalFilters,
  ctx: RentalFilterCtx,
  except: (keyof RentalFilters)[] = [],
): boolean {
  const on = (d: keyof RentalFilters) => !except.includes(d)

  if (on('q') && !matchesSearch(item, f.q)) return false

  if (on('categories') && f.categories.length) {
    if (!item.category?.slug || !f.categories.includes(item.category.slug)) return false
  }

  // OR within the dimension: choosing both "Collect" and "Post it" means
  // "either is fine", not "must offer both".
  if (on('fulfilment') && f.fulfilment.length) {
    const offers = f.fulfilment.some(
      (v) => (v === 'pickup' && item.allows_pickup) || (v === 'ship' && item.allows_shipping),
    )
    if (!offers) return false
  }

  if (on('bands') && f.bands.length) {
    const chosen = ctx.bands.filter((b) => f.bands.includes(b.key))
    if (chosen.length && !chosen.some((b) => rateBandMatches(b, item.daily_rate))) return false
  }

  // See `capacityBuckets`: gear where capacity does not apply is never excluded
  // by a capacity choice.
  if (on('capacities') && f.capacities.length && item.capacity != null) {
    const chosen = CAPACITY_BUCKETS.filter((b) => f.capacities.includes(b.key))
    if (chosen.length && !chosen.some((b) => b.test(item.capacity as number))) return false
  }

  // Inert without a date range, and that is the correct behaviour rather than a
  // missing guard: "only what's free" has no meaning until there is a "when",
  // and silently hiding the whole locker because a checkbox survived in a
  // bookmarked URL would be the worst possible reading of it.
  if (on('availableOnly') && f.availableOnly && f.from && f.to && ctx.availability) {
    if ((ctx.availability[item.id]?.free ?? 0) < 1) return false
  }

  return true
}

export function sortRentalItems(
  items: RentalItemListed[],
  sort: RentalSortKey,
  availability?: AvailabilityMap,
): RentalItemListed[] {
  const out = [...items]
  // Array.prototype.sort is stable (spec, ES2019), so each of these keeps the
  // catalogue's own `sort, name` ordering underneath as the tiebreak.
  if (sort === 'rate-asc') out.sort((a, b) => a.daily_rate - b.daily_rate)
  if (sort === 'rate-desc') out.sort((a, b) => b.daily_rate - a.daily_rate)
  if (sort === 'name') out.sort((a, b) => a.name.localeCompare(b.name))
  // Unweighed gear sorts last rather than first. `?? 0` would put every item
  // the shop has not yet weighed at the head of a list headed "Lightest", which
  // is a confident answer to a question nobody has measured.
  if (sort === 'lightest')
    out.sort((a, b) => (a.weight_grams ?? Infinity) - (b.weight_grams ?? Infinity))
  // 'featured' keeps the catalogue's own order — except that when dates are
  // chosen, gear with nothing free sinks. A card that cannot be booked is still
  // worth showing (it says when it comes back) but it should not lead.
  if (sort === 'featured' && availability)
    out.sort((a, b) =>
      Number((availability[b.id]?.free ?? 1) > 0) - Number((availability[a.id]?.free ?? 1) > 0))
  return out
}

export function applyRentalFilters(
  items: RentalItemListed[],
  f: RentalFilters,
  ctx: RentalFilterCtx,
): RentalItemListed[] {
  return sortRentalItems(items.filter((i) => matches(i, f, ctx)), f.sort, ctx.availability)
}

/** How many items a value WOULD return, with every other dimension still
 *  applied but this one relaxed. */
export function rentalFacetCount(
  items: RentalItemListed[],
  f: RentalFilters,
  ctx: RentalFilterCtx,
  dimension: keyof RentalFilters,
  predicate: (i: RentalItemListed) => boolean,
): number {
  return items.filter((i) => predicate(i) && matches(i, f, ctx, [dimension])).length
}

// ── Shelves ─────────────────────────────────────────────────────────────────

export type RentalShelf = { category: RentalCategory | null; items: RentalItemListed[] }

/** Grouped for the browse view, in the shelves' own `sort` order, with anything
 *  uncategorised last under a null category. An item without a shelf still
 *  renders — losing a bookable tent from the storefront because nobody has
 *  filed it yet would be a worse failure than an untidy heading. */
export function shelve(items: RentalItemListed[], categories: RentalCategory[]): RentalShelf[] {
  const ordered = [...categories].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))
  const shelves: RentalShelf[] = ordered
    .map((c) => ({ category: c, items: items.filter((i) => i.category?.slug === c.slug) }))
    .filter((s) => s.items.length > 0)
  const loose = items.filter((i) => !i.category?.slug || !ordered.some((c) => c.slug === i.category?.slug))
  if (loose.length) shelves.push({ category: null, items: loose })
  return shelves
}

// ── The URL ─────────────────────────────────────────────────────────────────
//
// Everything a visitor chose lives in the query string, including the dates.
// That is what makes "here are the tents free that weekend" a link somebody can
// send to the person they are going with — which, for a rental, is the single
// most likely thing they will want to do with the page.

export function rentalFiltersToParams(f: RentalFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.q.trim()) p.set('q', f.q.trim())
  if (f.categories.length) p.set('shelf', f.categories.join(','))
  if (f.fulfilment.length) p.set('get', f.fulfilment.join(','))
  if (f.bands.length) p.set('rate', f.bands.join(','))
  if (f.capacities.length) p.set('for', f.capacities.join(','))
  if (f.availableOnly) p.set('free', '1')
  if (f.from) p.set('from', f.from)
  if (f.to) p.set('to', f.to)
  // Defaults are omitted: a URL should carry choices, not restate them.
  if (f.sort !== 'featured') p.set('sort', f.sort)
  return p
}

type ParamsLike = { get(name: string): string | null }

/** A shape test is not a validity test. `2026-13-45` matches the pattern and is
 *  not a date; parsed back it becomes 2027-02-14, so a regex alone would either
 *  send garbage to an RPC typed DATE — failing the whole page rather than one
 *  filter — or silently move the visitor's dates by five months. Round-tripping
 *  through Date is what makes "is this a real day" answerable. */
function isRealDay(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

export function rentalFiltersFromParams(params: URLSearchParams | ParamsLike): RentalFilters {
  const list = (key: string) =>
    (params.get(key) ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  // A malformed date in a hand-edited URL becomes "no date", not a request the
  // database has to reject — `from=yesterday` would otherwise reach an RPC
  // typed DATE and fail the whole page rather than one filter.
  const day = (key: string) => {
    const v = (params.get(key) ?? '').trim()
    return isRealDay(v) ? v : ''
  }
  const sort = params.get('sort')
  const from = day('from')
  let to = day('to')
  // An inverted range is not a range. Dropping the end rather than swapping
  // them keeps the start the visitor actually typed.
  if (from && to && to < from) to = ''
  return {
    q: (params.get('q') ?? '').slice(0, 80),
    categories: list('shelf'),
    fulfilment: list('get').filter((v) => v === 'pickup' || v === 'ship'),
    bands: list('rate'),
    capacities: list('for'),
    availableOnly: params.get('free') === '1',
    from,
    to,
    sort: RENTAL_SORTS.some((s) => s.key === sort) ? (sort as RentalSortKey) : 'featured',
  }
}

/** Dates are not counted: they are the errand, not a filter on it, and showing
 *  "2 filters active" for having said when you are going reads as something to
 *  clear. */
export function countActiveRental(f: RentalFilters): number {
  return (
    (f.q.trim() ? 1 : 0) + f.categories.length + f.fulfilment.length +
    f.bands.length + f.capacities.length + (f.availableOnly ? 1 : 0)
  )
}

export function toggle(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
}
