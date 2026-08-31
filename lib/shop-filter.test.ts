import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyFilters, priceBands, bandMatches, filtersToParams, filtersFromParams,
  groupCategories, catalogueSizes, inStock, toggle, countActive, facetCount, sortProducts,
  EMPTY_FILTERS, type ShopFilters,
} from './shop-filter.ts'
import type { ProductWithCollection, Category } from '../types/database.ts'

/**
 * The shop's filtering, held to account.
 *
 * None of this could be tested before: it lived inside a 443-line client
 * component, tangled with useState and JSX. The bug that mattered most — that
 * chosen filters were read from the URL on mount and then never written back,
 * so no filtered view was shareable, bookmarkable or reversible — is now a
 * round-trip assertion rather than something you had to notice by hand.
 */

// ── Fixtures ────────────────────────────────────────────────────────────────
const cat = (id: string, slug: string, name: string, parent_id: string | null = null, sort_order = 0) =>
  ({ id, slug, name, parent_id, sort_order } as unknown as Category)

const APPAREL = cat('d1', 'apparel', 'Apparel', null, 0)
const DRINK = cat('d2', 'drinkware', 'Drinkware', null, 1)
const TEES = cat('c1', 't-shirts', 'T-Shirts', 'd1', 0)
const HOODIES = cat('c2', 'hoodies', 'Hoodies', 'd1', 1)
const BOTTLES = cat('c3', 'bottles', 'Bottles', 'd2', 0)
const ORPHAN = cat('c4', 'stickers', 'Stickers', null, 5)
const CATEGORIES = [APPAREL, DRINK, TEES, HOODIES, BOTTLES, ORPHAN]

function product(over: Partial<ProductWithCollection> & { id: string; price: number }): ProductWithCollection {
  return {
    slug: over.id, name: over.id, created_at: '2026-01-01T00:00:00Z',
    collection: null, categories: [], variants: [],
    ...over,
  } as unknown as ProductWithCollection
}

const variant = (name: string, qty: number | null) =>
  ({ name, inventory_quantity: qty } as never)

const TEE = product({
  id: 'tee', price: 89900,
  categories: [{ category_id: 'c1' } as never],
  collection: { slug: 'summit' } as never,
  variants: [variant('S', 4), variant('M', 0), variant('L', 2)],
})
const HOODIE = product({
  id: 'hoodie', price: 249900, created_at: '2026-06-01T00:00:00Z',
  categories: [{ category_id: 'c2' } as never],
  collection: { slug: 'summit' } as never,
  variants: [variant('M', 0), variant('L', 0)],
})
const BOTTLE = product({
  id: 'bottle', price: 39900,
  categories: [{ category_id: 'c3' } as never],
  collection: { slug: 'trail' } as never,
  variants: [],
})
const SHELL = product({
  id: 'shell', price: 480000,
  categories: [{ category_id: 'c2' } as never],
  variants: [variant('L', 1)],
})
const ALL = [TEE, HOODIE, BOTTLE, SHELL]
const BANDS = priceBands(ALL)
const CTX = { categories: CATEGORIES, bands: BANDS }

const withFilters = (over: Partial<ShopFilters>): ShopFilters => ({ ...EMPTY_FILTERS, ...over })

// ── Multi-select ────────────────────────────────────────────────────────────
describe('multi-select within a dimension', () => {
  test('one category narrows to that category', () => {
    const out = applyFilters(ALL, withFilters({ categories: ['t-shirts'] }), CTX)
    assert.deepEqual(out.map((p) => p.id), ['tee'])
  })

  test('two categories return the UNION, not the last one clicked', () => {
    // The old control replaced the selection instead of adding to it, so this
    // returned only hoodies. A chip that looks multi-select must behave so.
    const out = applyFilters(ALL, withFilters({ categories: ['t-shirts', 'hoodies'] }), CTX)
    assert.deepEqual(out.map((p) => p.id).sort(), ['hoodie', 'shell', 'tee'])
  })

  test('dimensions compose as AND', () => {
    const out = applyFilters(
      ALL,
      withFilters({ categories: ['t-shirts', 'hoodies'], collections: ['summit'] }),
      CTX
    )
    assert.deepEqual(out.map((p) => p.id).sort(), ['hoodie', 'tee'])
  })

  test('no filters returns everything', () => {
    assert.equal(applyFilters(ALL, EMPTY_FILTERS, CTX).length, 4)
  })
})

// ── Price bands ─────────────────────────────────────────────────────────────
describe('price bands', () => {
  test('a catalogue of fewer than four gets no bands', () => {
    assert.deepEqual(priceBands([TEE, BOTTLE]), [])
  })

  test('bands partition the catalogue with no gaps and no double-counting', () => {
    for (const p of ALL) {
      const hits = BANDS.filter((b) => bandMatches(b, p.price))
      assert.equal(hits.length, 1, `${p.id} at ${p.price} matched ${hits.length} bands`)
    }
  })

  test('bands union rather than intersect', () => {
    const out = applyFilters(ALL, withFilters({ bands: ['low', 'high'] }), CTX)
    assert.ok(out.length >= 2, 'two disjoint bands should return both sets')
  })

  test('a catalogue where the thirds collapse yields no bands', () => {
    const flat = [1, 2, 3, 4, 5].map((i) => product({ id: `p${i}`, price: 50000 }))
    assert.deepEqual(priceBands(flat), [])
  })
})

// ── Stock ───────────────────────────────────────────────────────────────────
describe('availability', () => {
  test('a product with no variants tracks no stock and is never hidden', () => {
    // Hiding it would silently remove a whole class of product from the shop.
    assert.equal(inStock(BOTTLE), true)
  })

  test('a product whose every variant is at zero is out of stock', () => {
    assert.equal(inStock(HOODIE), false)
  })

  test('the in-stock filter drops it', () => {
    const out = applyFilters(ALL, withFilters({ inStock: true }), CTX)
    assert.ok(!out.some((p) => p.id === 'hoodie'))
    assert.ok(out.some((p) => p.id === 'tee'))
  })
})

// ── Sizes ───────────────────────────────────────────────────────────────────
describe('sizes', () => {
  test('catalogue sizes keep variant order, not alphabetical order', () => {
    assert.deepEqual(catalogueSizes(ALL), ['S', 'M', 'L'])
  })

  test('filtering by size matches a product with that variant', () => {
    const out = applyFilters(ALL, withFilters({ sizes: ['S'] }), CTX)
    assert.ok(out.map((p) => p.id).includes('tee'))
  })

  test('a product with no variants is NOT returned by a size filter', () => {
    // This is the strict behaviour, and it is deliberate — see the long note on
    // the predicate in shop-filter.ts. The council filed the opposite as a bug,
    // the relaxed version was built, and `?size=L` then returned all ten
    // products including a four-person tent, because six of ten products in
    // this catalogue are equipment with no sizes. "Declares no sizes" is not
    // "comes in every size".
    //
    // The finding underneath it is real and is a DATA defect: an apparel
    // product with no size variants is correctly excluded by a size filter, and
    // the fix is to give it variants. The shopper is protected today by the
    // Size facet not rendering unless its values partition the catalogue.
    const out = applyFilters(ALL, withFilters({ sizes: ['S'] }), CTX)
    assert.ok(!out.map((p) => p.id).includes('bottle'))
  })

  test('a product that declares sizes is still excluded by one it lacks', () => {
    // SHELL has only L.
    const out = applyFilters(ALL, withFilters({ sizes: ['S'] }), CTX)
    assert.ok(!out.map((p) => p.id).includes('shell'))
  })
})

// ── Sort ────────────────────────────────────────────────────────────────────
describe('sort', () => {
  test('featured lifts flagged products and is otherwise stable', () => {
    // `featured` had no branch at all, so it was the identity function over
    // `created_at desc` — which made it byte-identical to `newest`, and made
    // the shop's default order "most recently seeded first".
    const flagged = product({ id: 'flagged', price: 100, is_featured: true } as never)
    const out = sortProducts([...ALL, flagged], 'featured')
    assert.equal(out[0].id, 'flagged')
    // Everything unflagged keeps the order it arrived in.
    assert.deepEqual(out.slice(1).map((p) => p.id), ALL.map((p) => p.id))
  })

  test('featured no longer equals newest', () => {
    const featured = sortProducts(ALL, 'featured').map((p) => p.id)
    const newest = sortProducts(ALL, 'newest').map((p) => p.id)
    // HOODIE is the newest fixture but is not flagged, so the two orders differ.
    assert.notDeepEqual(featured, newest)
  })
})

// ── Categories ──────────────────────────────────────────────────────────────
describe('category grouping', () => {
  const groups = groupCategories(ALL, CATEGORIES)

  test('departments become headings, in sort_order', () => {
    assert.deepEqual(groups.map((g) => g.heading), ['Apparel', 'Drinkware'])
  })

  test('a department with no stock behind it does not render', () => {
    const groups = groupCategories([BOTTLE], CATEGORIES)
    assert.deepEqual(groups.map((g) => g.heading), ['Drinkware'])
  })

  test('a department that also holds products of its own is not duplicated', () => {
    // The live catalogue does this: products sit directly on "Apparel" AND on
    // its children. Before the fix the department fell into the ungrouped
    // bucket, so the rail rendered "APPAREL" as a heading and "Apparel" as a
    // loose checkbox underneath — two controls with the same name.
    const onDepartment = product({
      id: 'apparel-direct', price: 129900,
      categories: [{ category_id: 'd1' } as never],
    })
    const groups = groupCategories([TEE, HOODIE, onDepartment], CATEGORIES)
    assert.equal(groups.length, 1, 'one group, not a group plus an ungrouped row')
    assert.equal(groups[0].heading, 'Apparel')
    assert.equal(groups[0].self?.slug, 'apparel', 'the department is attached to its own group')
    assert.deepEqual(groups[0].items.map((c) => c.slug), ['t-shirts', 'hoodies'])
  })

  test('a category with no parent still appears, ungrouped', () => {
    const orphaned = product({ id: 'sticker', price: 9900, categories: [{ category_id: 'c4' } as never] })
    const groups = groupCategories([orphaned], CATEGORIES)
    assert.equal(groups.length, 1)
    assert.equal(groups[0].heading, '')
    assert.deepEqual(groups[0].items.map((c) => c.slug), ['stickers'])
  })
})

// ── Facet counts ────────────────────────────────────────────────────────────
describe('facet counts', () => {
  test('a count answers "what would I get", with sibling dimensions still applied', () => {
    const filters = withFilters({ collections: ['summit'] })
    const n = facetCount(ALL, filters, CTX, 'categories', (p) =>
      !!p.categories?.some((c) => c.category_id === 'c2')
    )
    // Hoodies ∩ Summit = the hoodie only; the shell is a hoodie but not Summit.
    assert.equal(n, 1)
  })

  test('a count ignores its own dimension, so picking a second value is not shown as zero', () => {
    const filters = withFilters({ categories: ['t-shirts'] })
    const n = facetCount(ALL, filters, CTX, 'categories', (p) =>
      !!p.categories?.some((c) => c.category_id === 'c2')
    )
    assert.equal(n, 2, 'hoodie + shell')
  })
})

// ── The URL round-trip ──────────────────────────────────────────────────────
describe('URL state', () => {
  test('filters survive a round-trip through the query string', () => {
    const filters = withFilters({
      categories: ['t-shirts', 'hoodies'], collections: ['summit'],
      bands: ['low'], sizes: ['S', 'M'], inStock: true, sort: 'price-asc',
    })
    assert.deepEqual(filtersFromParams(filtersToParams(filters)), filters)
  })

  test('an empty selection writes an empty query string', () => {
    assert.equal(filtersToParams(EMPTY_FILTERS).toString(), '')
  })

  test('the default sort is omitted rather than restated', () => {
    assert.equal(filtersToParams(withFilters({ sort: 'featured' })).has('sort'), false)
    assert.equal(filtersToParams(withFilters({ sort: 'newest' })).get('sort'), 'newest')
  })

  test('a junk sort in the URL falls back to the default instead of breaking', () => {
    assert.equal(filtersFromParams(new URLSearchParams('sort=DROP+TABLE')).sort, 'featured')
  })

  test('empty and whitespace values are dropped, not kept as blank filters', () => {
    assert.deepEqual(filtersFromParams(new URLSearchParams('category=,,+,')).categories, [])
  })
})

// ── Small helpers ───────────────────────────────────────────────────────────
describe('helpers', () => {
  test('toggle adds then removes', () => {
    assert.deepEqual(toggle([], 'a'), ['a'])
    assert.deepEqual(toggle(['a', 'b'], 'a'), ['b'])
  })

  test('countActive ignores sort, which is not a filter', () => {
    assert.equal(countActive(withFilters({ sort: 'newest' })), 0)
    assert.equal(countActive(withFilters({ categories: ['a'], inStock: true })), 2)
  })
})

// ── Sorting ─────────────────────────────────────────────────────────────────
describe('sorting', () => {
  test('price ascending and descending are exact mirrors', () => {
    const asc = applyFilters(ALL, withFilters({ sort: 'price-asc' }), CTX).map((p) => p.id)
    const desc = applyFilters(ALL, withFilters({ sort: 'price-desc' }), CTX).map((p) => p.id)
    assert.deepEqual(asc, [...desc].reverse())
    assert.deepEqual(asc, ['bottle', 'tee', 'hoodie', 'shell'])
  })

  test('newest sorts by created_at, descending', () => {
    const out = applyFilters(ALL, withFilters({ sort: 'newest' }), CTX)
    assert.equal(out[0].id, 'hoodie')
  })

  test('sorting does not mutate the input array', () => {
    const before = ALL.map((p) => p.id)
    applyFilters(ALL, withFilters({ sort: 'price-desc' }), CTX)
    assert.deepEqual(ALL.map((p) => p.id), before)
  })
})
