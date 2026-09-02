import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import * as app from './rental-filter.ts'
import * as web from '../../lib/rental-filter.ts'

/**
 * THE DRIFT GUARD.
 *
 * `mobile/lib/rental-filter.ts` is a deliberate port of the web's copy; its
 * header explains why an import would typecheck and then fail on a device.
 * The risk a port carries is silent divergence — somebody fixes the capacity
 * asymmetry on the web and the phone quietly keeps hiding trekking poles from
 * anybody outfitting a trip for two.
 *
 * So this imports BOTH and asserts they agree, on identical fixtures, across
 * every dimension and every sort. It runs in the root suite (`npm test` already
 * globs `mobile/lib/**` — see package.json), where node can resolve both.
 *
 * The URL functions are deliberately absent from the app copy and are therefore
 * not compared; everything that decides WHICH GEAR A CUSTOMER SEES is.
 */

// ── One fixture, shaped for both type systems ───────────────────────────────
// The two `RentalItem` types are structurally different (the web's carries
// database columns the app never selects), so the fixtures are built once as
// plain objects and cast at each call site. If a real field diverged, the
// assertions below would fail rather than the types silently papering over it.

const shelf = (slug: string, name: string, sort: number) =>
  ({ id: slug, slug, name, blurb: null, sort, is_active: true, created_at: '', updated_at: '' })

const SHELVES = [shelf('shelter', 'Shelter', 1), shelf('sleep', 'Sleeping', 2), shelf('traction', 'Trail hardware', 5)]

function item(over: Record<string, unknown> & { id: string; daily_rate: number }) {
  return {
    slug: over.id, name: over.id, summary: null, description: null, images: [],
    deposit: 0, weekly_discount_pct: 0, min_days: 1, max_days: 30, buffer_days: 1,
    sac_code: null, gst_rate: 18, allows_pickup: true, allows_shipping: false,
    is_active: true, sort: 100, created_at: '', updated_at: '',
    category_id: null, category: null, weight_grams: null, capacity: null, specs: {},
    ...over,
  }
}

const ITEMS = [
  item({ id: 'tent', name: 'Four-Season Tent (2P)', daily_rate: 45000, capacity: 2, weight_grams: 3200, category: SHELVES[0], allows_shipping: true, summary: 'A proper mountain tent for two.' }),
  item({ id: 'bag', name: 'Down Sleeping Bag (−10°C)', daily_rate: 25000, capacity: 1, weight_grams: 1100, category: SHELVES[1] }),
  item({ id: 'spikes', name: 'Microspikes', daily_rate: 12000, category: SHELVES[2], allows_shipping: true, allows_pickup: false }),
  item({ id: 'poles', name: 'Trekking Poles (pair)', daily_rate: 15000, category: SHELVES[2] }),
  item({ id: 'bundle', name: 'Weekend Camp Bundle (2P)', daily_rate: 85000, capacity: 2, description: 'Tent, two bags, two mats.' }),
]

const AVAIL = {
  tent: { free: 0, total: 4 }, bag: { free: 2, total: 6 }, spikes: { free: 1, total: 6 },
  poles: { free: 3, total: 8 }, bundle: { free: 0, total: 3 },
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const A = ITEMS as any
const S = SHELVES as any

const filters = (over: Record<string, unknown> = {}) => ({ ...app.EMPTY_RENTAL_FILTERS, ...over }) as any

/** Compared by id and order — the two things a customer actually experiences. */
const ids = (list: { id: string }[]) => list.map((i) => i.id)

describe('the two copies agree on what is shown', () => {
  const cases: [string, Record<string, unknown>][] = [
    ['nothing chosen', {}],
    ['a search', { q: 'tent' }],
    ['a multi-token search', { q: 'four season' }],
    ['a substring search', { q: 'spike' }],
    ['one shelf', { categories: ['traction'] }],
    ['two shelves', { categories: ['traction', 'sleep'] }],
    ['posted only', { fulfilment: ['ship'] }],
    ['either fulfilment', { fulfilment: ['pickup', 'ship'] }],
    ['a capacity', { capacities: ['2'] }],
    ['two capacities', { capacities: ['1', '2'] }],
    ['a rate band', { bands: ['low'] }],
    ['composed', { categories: ['shelter', 'traction'], fulfilment: ['ship'], q: 'e' }],
    ['available only, no dates', { availableOnly: true }],
    ['available only, with dates', { availableOnly: true, from: '2026-09-01', to: '2026-09-04' }],
  ]

  for (const [name, over] of cases) {
    test(name, () => {
      const f = filters(over)
      const webBands = web.rateBands(A)
      const appBands = app.rateBands(A)
      assert.deepEqual(appBands, webBands, 'the rate bands themselves diverged')

      const ctxWeb = { bands: webBands, availability: AVAIL }
      const ctxApp = { bands: appBands, availability: AVAIL }
      assert.deepEqual(
        ids(app.applyRentalFilters(A, f, ctxApp)),
        ids(web.applyRentalFilters(A, f, ctxWeb) as { id: string }[]),
      )
    })
  }
})

describe('the two copies agree on order', () => {
  for (const key of ['featured', 'rate-asc', 'rate-desc', 'lightest', 'name'] as const) {
    test(key, () => {
      assert.deepEqual(ids(app.sortRentalItems(A, key)), ids(web.sortRentalItems(A, key) as { id: string }[]))
      assert.deepEqual(
        ids(app.sortRentalItems(A, key, AVAIL)),
        ids(web.sortRentalItems(A, key, AVAIL) as { id: string }[]),
      )
    })
  }
})

describe('the two copies agree on the facets', () => {
  test('shelving puts the same items under the same headings', () => {
    const a = app.shelve(A, S).map((s) => [s.category?.slug ?? null, ids(s.items)])
    const w = (web.shelve(A, S) as { category: { slug: string } | null; items: { id: string }[] }[])
      .map((s) => [s.category?.slug ?? null, ids(s.items)])
    assert.deepEqual(a, w)
  })

  test('capacity buckets offered are the same', () => {
    assert.deepEqual(app.capacityBuckets(A).map((b) => b.key), web.capacityBuckets(A).map((b) => b.key))
  })

  test('facet counts are the same, including the relaxed dimension', () => {
    const f = filters({ categories: ['shelter'] })
    const ctxA = { bands: app.rateBands(A) }
    const ctxW = { bands: web.rateBands(A) }
    const pA = (i: { category?: { slug: string } | null }) => i.category?.slug === 'sleep'
    assert.equal(
      app.rentalFacetCount(A, f, ctxA, 'categories', pA as never),
      web.rentalFacetCount(A, f, ctxW, 'categories', pA as never),
    )
  })

  test('the active count is the same, and neither counts the dates', () => {
    const f = filters({ q: 'x', categories: ['a'], availableOnly: true, from: '2026-09-01', to: '2026-09-04' })
    assert.equal(app.countActiveRental(f), web.countActiveRental(f))
    assert.equal(app.countActiveRental(f), 3)
  })

  test('the sort lists are identical, key for key and label for label', () => {
    assert.deepEqual(app.RENTAL_SORTS, web.RENTAL_SORTS)
  })
})

describe('the asymmetries survived the port', () => {
  test('gear with no capacity is not hidden by a capacity filter, on BOTH', () => {
    const f = filters({ capacities: ['2'] })
    for (const [label, out] of [
      ['app', ids(app.applyRentalFilters(A, f, { bands: app.rateBands(A) }))],
      ['web', ids(web.applyRentalFilters(A, f, { bands: web.rateBands(A) }) as { id: string }[])],
    ] as const) {
      assert.ok(out.includes('poles'), `${label} hid the poles`)
      assert.ok(!out.includes('bag'), `${label} kept a solo bag under "two of you"`)
    }
  })

  test('unweighed gear sorts LAST under lightest, on BOTH', () => {
    assert.deepEqual(ids(app.sortRentalItems(A, 'lightest')).slice(0, 2), ['bag', 'tent'])
    assert.deepEqual(ids(web.sortRentalItems(A, 'lightest') as { id: string }[]).slice(0, 2), ['bag', 'tent'])
  })

  test('"only what is free" is inert without dates, on BOTH', () => {
    const f = filters({ availableOnly: true })
    assert.equal(app.applyRentalFilters(A, f, { bands: [], availability: AVAIL }).length, 5)
    assert.equal((web.applyRentalFilters(A, f, { bands: [], availability: AVAIL }) as unknown[]).length, 5)
  })
})
