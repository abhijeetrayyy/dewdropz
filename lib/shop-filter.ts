import type { ProductWithCollection, Collection, Category } from '@/types/database'

// ── The shop's filtering, as data ────────────────────────────────────────────
//
// All of this used to live inside ShopContent as a 443-line client component:
// the band maths, the department grouping, the predicate, the counting. That
// made three things impossible — testing any of it, sharing it with the
// wishlist and collection grids, and reasoning about the URL round-trip, which
// is where the real bug was (state was read from the query string on mount and
// then never written back, so no filtered view was shareable or reversible).
//
// Pure functions over plain data, so `npm test` can hold them to account.

export type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'newest'

export const SORTS: { key: SortKey; label: string }[] = [
  { key: 'featured', label: 'Featured' },
  { key: 'newest', label: 'Newest' },
  { key: 'price-asc', label: 'Price: low to high' },
  { key: 'price-desc', label: 'Price: high to low' },
]

/** Multi-select throughout. The old shape held one string per dimension and a
 *  literal `'all'` sentinel; an empty array says the same thing without a magic
 *  value, and it is what makes "T-Shirts AND Hoodies" expressible at all. */
export type ShopFilters = {
  categories: string[]
  collections: string[]
  bands: string[]
  sizes: string[]
  inStock: boolean
  sort: SortKey
}

export const EMPTY_FILTERS: ShopFilters = {
  categories: [], collections: [], bands: [], sizes: [], inStock: false, sort: 'featured',
}

export type PriceBand = { key: string; label: string; min: number; max: number | null }

/** Bands derived from the catalogue rather than hardcoded, so they stay
 *  meaningful when a ₹399 bottle and a ₹4,000 shell are both on the shelf. */
export function priceBands(products: ProductWithCollection[]): PriceBand[] {
  if (products.length < 4) return []
  const prices = products.map((p) => p.price).sort((a, b) => a - b)
  const lo = prices[Math.floor(prices.length / 3)]
  const hi = prices[Math.floor((prices.length * 2) / 3)]
  const r = (paise: number) => Math.round(paise / 100)
  if (r(lo) === r(hi)) return []
  const inr = (paise: number) => `₹${r(paise).toLocaleString('en-IN')}`
  return [
    { key: 'low',  label: `Under ${inr(lo)}`,          min: 0,  max: lo },
    { key: 'mid',  label: `${inr(lo)} – ${inr(hi)}`,   min: lo, max: hi },
    { key: 'high', label: `Over ${inr(hi)}`,           min: hi, max: null },
  ]
}

export function bandMatches(band: PriceBand, price: number): boolean {
  if (band.max === null) return price > band.min
  if (band.min === 0) return price < band.max
  return price >= band.min && price <= band.max
}

/** A product's size options, from its variants. */
export function sizesOf(product: ProductWithCollection): string[] {
  return (product.variants ?? []).map((v) => v.name).filter(Boolean)
}

export function inStock(product: ProductWithCollection): boolean {
  const variants = product.variants ?? []
  // A product with no variants at all is not "out of stock" — it is a product
  // that does not track stock per variant, and hiding it behind an availability
  // filter would silently remove it from the shop.
  if (!variants.length) return true
  return variants.some((v) => (v.inventory_quantity ?? 0) > 0)
}

/** Every size in the catalogue, in the order the variants were sorted by
 *  `sort_order` — so the row reads S M L XL, not alphabetically. */
export function catalogueSizes(products: ProductWithCollection[]): string[] {
  const seen = new Map<string, number>()
  for (const p of products) {
    (p.variants ?? []).forEach((v, i) => {
      if (v.name && !seen.has(v.name)) seen.set(v.name, i)
    })
  }
  return [...seen.entries()].sort((a, b) => a[1] - b[1]).map(([name]) => name)
}

/** Categories that actually have stock behind them. A control must never
 *  promise a result it cannot deliver. */
export function stockedCategories(products: ProductWithCollection[], categories: Category[]) {
  return categories.filter((c) =>
    products.some((p) => p.categories?.some((pc) => pc.category_id === c.id))
  )
}

export function stockedCollections(products: ProductWithCollection[], collections: Collection[]) {
  return collections.filter((c) => products.some((p) => p.collection?.slug === c.slug))
}

export type CategoryGroup = {
  heading: string
  order: number
  items: Category[]
  /** The department itself, when it holds products directly rather than only
   *  through its children. Rendered as a selectable row at the head of its own
   *  group — otherwise it lands in the ungrouped bucket and the rail shows
   *  "APPAREL" as a heading and "Apparel" as a loose checkbox underneath it,
   *  which reads as two different things with the same name. */
  self?: Category
}

/** Grouped under their department, because that is how the range is organised:
 *  Apparel and Drinkware, each holding its garments.
 *
 *  Parents are found by id from the FULL list, not from the stocked subset — a
 *  department holds no products of its own, so it never survives the stocked
 *  filter and would otherwise lose its label. */
export function groupCategories(
  products: ProductWithCollection[],
  categories: Category[]
): CategoryGroup[] {
  const stocked = stockedCategories(products, categories)
  const byParent = new Map<string, CategoryGroup>()
  const ungrouped: Category[] = []

  // Which parents will render a heading at all. Needed before the ungrouped
  // pass, so a stocked department is attached to its own group rather than
  // being dropped in with the genuinely parentless.
  const parentIds = new Set(
    stocked.map((c) => c.parent_id).filter((id): id is string => !!id)
  )

  for (const c of stocked) {
    const parent = c.parent_id ? categories.find((p) => p.id === c.parent_id) : null
    if (!parent) {
      if (parentIds.has(c.id)) {
        // A department that also holds products of its own.
        const g = byParent.get(c.id) ?? { heading: c.name, order: c.sort_order ?? 0, items: [] }
        g.self = c
        byParent.set(c.id, g)
      } else {
        ungrouped.push(c)
      }
      continue
    }
    const g = byParent.get(parent.id) ?? { heading: parent.name, order: parent.sort_order ?? 0, items: [] }
    g.items.push(c)
    byParent.set(parent.id, g)
  }

  const groups = [...byParent.values()].sort((a, b) => a.order - b.order)
  for (const g of groups) g.items.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  // A category added in admin without a parent and with no children still
  // shows, under no heading, rather than silently disappearing from the shop.
  if (ungrouped.length) groups.push({ heading: '', order: 99, items: ungrouped })
  return groups
}

/** The predicate, split out per dimension so counts can ask "how many would
 *  match if I ALSO picked this?" without duplicating the logic. */
export function matches(
  product: ProductWithCollection,
  filters: ShopFilters,
  ctx: { categories: Category[]; bands: PriceBand[] },
  /** Dimensions to ignore — used for facet counts. */
  skip: (keyof ShopFilters)[] = []
): boolean {
  const on = (k: keyof ShopFilters) => !skip.includes(k)

  if (on('categories') && filters.categories.length) {
    const slugs = new Set(filters.categories)
    const hit = product.categories?.some((pc) => {
      const cat = ctx.categories.find((c) => c.id === pc.category_id)
      return cat ? slugs.has(cat.slug) : false
    })
    if (!hit) return false
  }

  if (on('collections') && filters.collections.length) {
    if (!product.collection?.slug || !filters.collections.includes(product.collection.slug)) return false
  }

  if (on('bands') && filters.bands.length) {
    const chosen = ctx.bands.filter((b) => filters.bands.includes(b.key))
    // Bands are a union: "Under ₹1,500" OR "Over ₹3,000" is a legitimate ask.
    if (chosen.length && !chosen.some((b) => bandMatches(b, product.price))) return false
  }

  if (on('sizes') && filters.sizes.length) {
    const has = sizesOf(product)
    // STRICT, and deliberately not the same rule as `inStock()` twenty lines
    // above. The shop council filed the difference as an inconsistency — two
    // policies for one silence — and it is not one. The two questions are
    // different questions:
    //
    //   inStock  asks "can this be bought?"  A product with no variant rows
    //            does not track stock per size, and it is buyable. Don't hide it.
    //   size=L   asks "does this come in L?" A product with no variant rows
    //            does not come in L. It has no sizes at all.
    //
    // Relaxing this so a variant-less product survives any size filter was
    // tried and reverted the same day: `?size=L` then returned all ten
    // products, including a four-person tent and a sleeping bag, because six of
    // ten products in this catalogue are equipment and none of them has sizes.
    // A size facet that returns tents is worse than the defect it was fixing.
    //
    // The real finding underneath it stands and is a DATA defect, not a
    // predicate one: `garhwal-ridgeline-tee` is apparel with 25 in stock and no
    // size variants at all, so a size filter correctly excludes a tee that
    // almost certainly does come in L. That is fixed in admin by giving the tee
    // its variants — not here. What protects a shopper today is that the Size
    // facet no longer renders unless its values actually partition the
    // catalogue; see `partitions` in ShopContent.
    if (!filters.sizes.some((s) => has.includes(s))) return false
  }

  if (on('inStock') && filters.inStock && !inStock(product)) return false

  return true
}

export function sortProducts(products: ProductWithCollection[], sort: SortKey): ProductWithCollection[] {
  const out = [...products]
  // `featured` had no branch at all, so it was the identity function over
  // whatever `getProducts()` returned — which is `created_at desc`. That made
  // the shop's DEFAULT order "most recently seeded first", and it made
  // `?sort=newest` return a byte-identical list: a menu of four choices of
  // which three were distinct. It also meant a page headed "Apparel and
  // everyday essentials" opened with six pieces of trekking hardware, because
  // the equipment was seeded last.
  //
  // Array.prototype.sort is stable (spec, ES2019), so unflagged products keep
  // `created_at desc` underneath and nothing moves until someone actually
  // curates. Which products lead is the owner's call, not this function's.
  // `?? false` because a comparator that returns NaN — which `Number(undefined)`
  // gives on any row without the column — is unspecified behaviour, not a no-op.
  if (sort === 'featured')
    out.sort((a, b) => Number(b.is_featured ?? false) - Number(a.is_featured ?? false))
  if (sort === 'price-asc') out.sort((a, b) => a.price - b.price)
  if (sort === 'price-desc') out.sort((a, b) => b.price - a.price)
  if (sort === 'newest')
    out.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
  return out
}

export function applyFilters(
  products: ProductWithCollection[],
  filters: ShopFilters,
  ctx: { categories: Category[]; bands: PriceBand[] }
): ProductWithCollection[] {
  return sortProducts(products.filter((p) => matches(p, filters, ctx)), filters.sort)
}

/** How many products a given value WOULD return, with every other dimension
 *  still applied but this one relaxed. That is what makes a count useful: it
 *  answers "if I click this, what do I get", not "how many exist in total". */
export function facetCount(
  products: ProductWithCollection[],
  filters: ShopFilters,
  ctx: { categories: Category[]; bands: PriceBand[] },
  dimension: keyof ShopFilters,
  predicate: (p: ProductWithCollection) => boolean
): number {
  return products.filter((p) => predicate(p) && matches(p, filters, ctx, [dimension])).length
}

// ── The URL ──────────────────────────────────────────────────────────────────
// Filters belong in the query string. Without this, a filtered shop cannot be
// linked, bookmarked or backed out of, and returning from a product page resets
// everything the visitor had chosen.

export function filtersToParams(f: ShopFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.categories.length) p.set('category', f.categories.join(','))
  if (f.collections.length) p.set('collection', f.collections.join(','))
  if (f.bands.length) p.set('price', f.bands.join(','))
  if (f.sizes.length) p.set('size', f.sizes.join(','))
  if (f.inStock) p.set('stock', 'in')
  // 'featured' is the default, so it is omitted — a URL should carry choices,
  // not restate defaults.
  if (f.sort !== 'featured') p.set('sort', f.sort)
  return p
}

export function filtersFromParams(params: URLSearchParams | ReadonlyURLSearchParamsLike): ShopFilters {
  const list = (key: string) =>
    (params.get(key) ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const sort = params.get('sort')
  return {
    categories: list('category'),
    collections: list('collection'),
    bands: list('price'),
    sizes: list('size'),
    inStock: params.get('stock') === 'in',
    sort: SORTS.some((s) => s.key === sort) ? (sort as SortKey) : 'featured',
  }
}

/** Next's ReadonlyURLSearchParams is structurally this, but is not exported as
 *  a type we can depend on here without pulling next/navigation into a module
 *  that must stay testable in plain node. */
type ReadonlyURLSearchParamsLike = { get(name: string): string | null }

export function countActive(f: ShopFilters): number {
  return f.categories.length + f.collections.length + f.bands.length + f.sizes.length + (f.inStock ? 1 : 0)
}

/** Toggle one value within one multi-select dimension. */
export function toggle(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
}
