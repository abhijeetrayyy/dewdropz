import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyRentalFilters, rateBands, rateBandMatches, capacityBuckets, matchesSearch,
  sortRentalItems, shelve, rentalFacetCount, rentalFiltersToParams, rentalFiltersFromParams,
  countActiveRental, toggle, EMPTY_RENTAL_FILTERS,
  type RentalFilters, type RentalItemListed, type AvailabilityMap,
} from './rental-filter.ts'
import type { RentalCategory } from '../types/database.ts'

/**
 * Finding gear in the locker, held to account.
 *
 * The two things worth testing here are the ones a reader cannot verify by
 * looking: that the URL round-trips (so a filtered locker is shareable and the
 * back button works — the exact bug `shop-filter` was extracted to fix), and
 * that the three deliberate asymmetries are real rather than intentions in a
 * comment. Those are: gear with no capacity is never hidden by a capacity
 * filter, unweighed gear sorts LAST under "lightest", and "only what's free" is
 * inert without dates instead of emptying the page.
 */

// ── Fixtures ────────────────────────────────────────────────────────────────

const shelf = (slug: string, name: string, sort: number): RentalCategory =>
  ({ id: slug, slug, name, blurb: null, sort, is_active: true,
     created_at: '', updated_at: '' })

const SHELTER = shelf('shelter', 'Shelter', 1)
const SLEEP = shelf('sleep', 'Sleeping', 2)
const TRACTION = shelf('traction', 'Trail hardware', 5)
const SHELVES = [SHELTER, SLEEP, TRACTION]

function item(over: Partial<RentalItemListed> & { id: string; daily_rate: number }): RentalItemListed {
  return {
    slug: over.id, name: over.id, summary: null, description: null, images: [],
    deposit: 0, weekly_discount_pct: 0, min_days: 1, max_days: 30, buffer_days: 1,
    sac_code: null, gst_rate: 18, allows_pickup: true, allows_shipping: false,
    is_active: true, sort: 100, created_at: '', updated_at: '',
    category_id: null, category: null, weight_grams: null, capacity: null, specs: {},
    ...over,
  } as RentalItemListed
}

const TENT = item({
  id: 'tent', name: 'Four-Season Tent (2P)', daily_rate: 45000, capacity: 2,
  weight_grams: 3200, category: SHELTER, allows_shipping: true,
  summary: 'A proper mountain tent for two.',
})
const BAG = item({
  id: 'bag', name: 'Down Sleeping Bag (−10°C)', daily_rate: 25000, capacity: 1,
  weight_grams: 1100, category: SLEEP,
})
const SPIKES = item({
  id: 'spikes', name: 'Microspikes', daily_rate: 12000, category: TRACTION,
  allows_shipping: true, allows_pickup: false,
})
const POLES = item({
  id: 'poles', name: 'Trekking Poles (pair)', daily_rate: 15000, category: TRACTION,
})
const BUNDLE = item({
  id: 'bundle', name: 'Weekend Camp Bundle (2P)', daily_rate: 85000, capacity: 2,
  description: 'Tent, two bags, two mats.',
})
const ITEMS = [TENT, BAG, SPIKES, POLES, BUNDLE]

const F = (over: Partial<RentalFilters> = {}): RentalFilters => ({ ...EMPTY_RENTAL_FILTERS, ...over })
const BANDS = rateBands(ITEMS)
const CTX = { bands: BANDS }

// ── Search ──────────────────────────────────────────────────────────────────

describe('the search box', () => {
  test('an empty query matches everything, rather than nothing', () => {
    assert.equal(ITEMS.filter((i) => matchesSearch(i, '')).length, 5)
    assert.equal(ITEMS.filter((i) => matchesSearch(i, '   ')).length, 5)
  })

  test('punctuation is flattened, so "four-season" finds "Four-Season"', () => {
    assert.ok(matchesSearch(TENT, 'four-season'))
    assert.ok(matchesSearch(TENT, 'four season'))
    assert.ok(matchesSearch(TENT, 'FourSeason') === false) // one token, no boundary
    assert.ok(matchesSearch(BAG, '-10°C'))
  })

  test('substring, so "spike" finds "Microspikes"', () => {
    assert.ok(matchesSearch(SPIKES, 'spike'))
  })

  test('every token must appear, so adding a word always narrows', () => {
    assert.ok(matchesSearch(TENT, 'tent season'))
    assert.equal(matchesSearch(TENT, 'tent spikes'), false)
    const one = ITEMS.filter((i) => matchesSearch(i, 'tent')).length
    const two = ITEMS.filter((i) => matchesSearch(i, 'tent two')).length
    assert.ok(two <= one)
  })

  test('the shelf name is searchable, so "hardware" finds the poles', () => {
    assert.ok(matchesSearch(POLES, 'hardware'))
  })

  test('the description is searchable, so "mats" finds the bundle', () => {
    assert.ok(matchesSearch(BUNDLE, 'mats'))
  })
})

// ── Bands ───────────────────────────────────────────────────────────────────

describe('rate bands', () => {
  test('a catalogue too small to split gets no bands at all', () => {
    assert.deepEqual(rateBands([TENT, BAG]), [])
  })

  test('a flat catalogue gets no bands rather than three identical ones', () => {
    const flat = [1, 2, 3, 4, 5].map((n) => item({ id: `f${n}`, daily_rate: 20000 }))
    assert.deepEqual(rateBands(flat), [])
  })

  test('the bands partition the catalogue — every item lands in exactly one', () => {
    for (const i of ITEMS) {
      const hits = BANDS.filter((b) => rateBandMatches(b, i.daily_rate))
      assert.equal(hits.length, 1, `${i.name} landed in ${hits.length} bands`)
    }
  })
})

// ── The asymmetries ─────────────────────────────────────────────────────────

describe('gear where capacity does not apply', () => {
  test('is offered as a facet value only where something has one', () => {
    assert.deepEqual(capacityBuckets(ITEMS).map((b) => b.key), ['1', '2'])
    assert.deepEqual(capacityBuckets([POLES, SPIKES]), [])
  })

  test('THE ASYMMETRY: choosing "two of you" does not hide the poles', () => {
    // A person outfitting a trip for two still needs poles. Excluding gear with
    // no capacity would hide exactly what they came for.
    const out = applyRentalFilters(ITEMS, F({ capacities: ['2'] }), CTX)
    const ids = out.map((i) => i.id)
    assert.ok(ids.includes('tent'))
    assert.ok(ids.includes('bundle'))
    assert.ok(ids.includes('poles'), 'poles were hidden by a capacity filter')
    assert.ok(ids.includes('spikes'))
    assert.ok(!ids.includes('bag'), 'a 1-person bag survived a "two of you" filter')
  })
})

describe('sorting', () => {
  test('THE ASYMMETRY: unweighed gear sorts LAST under "lightest first"', () => {
    const out = sortRentalItems(ITEMS, 'lightest').map((i) => i.id)
    assert.deepEqual(out.slice(0, 2), ['bag', 'tent'])
    // The three with no weight are at the end, in their original order.
    assert.deepEqual(out.slice(2), ['spikes', 'poles', 'bundle'])
  })

  test('rate sorts both ways and is stable underneath', () => {
    assert.deepEqual(sortRentalItems(ITEMS, 'rate-asc').map((i) => i.daily_rate),
      [12000, 15000, 25000, 45000, 85000])
    assert.deepEqual(sortRentalItems(ITEMS, 'rate-desc').map((i) => i.daily_rate),
      [85000, 45000, 25000, 15000, 12000])
  })

  test('with dates chosen, gear with nothing free sinks but does not vanish', () => {
    const avail: AvailabilityMap = {
      tent: { free: 0, total: 4 }, bag: { free: 2, total: 6 }, spikes: { free: 1, total: 6 },
      poles: { free: 3, total: 8 }, bundle: { free: 0, total: 3 },
    }
    const out = sortRentalItems(ITEMS, 'featured', avail).map((i) => i.id)
    assert.equal(out.length, 5, 'an unavailable item was dropped instead of sunk')
    assert.deepEqual(out.slice(3), ['tent', 'bundle'])
  })

  test('sorting never drops or duplicates an item', () => {
    for (const key of ['featured', 'rate-asc', 'rate-desc', 'lightest', 'name'] as const) {
      const out = sortRentalItems(ITEMS, key)
      assert.equal(new Set(out.map((i) => i.id)).size, ITEMS.length, key)
    }
  })
})

describe('"only what is free"', () => {
  const avail: AvailabilityMap = {
    tent: { free: 0, total: 4 }, bag: { free: 2, total: 6 }, spikes: { free: 1, total: 6 },
    poles: { free: 3, total: 8 }, bundle: { free: 0, total: 3 },
  }

  test('THE ASYMMETRY: it is inert without dates, not an empty page', () => {
    // A bookmarked URL carrying `free=1` but no dates must show the locker, not
    // hide all of it.
    const out = applyRentalFilters(ITEMS, F({ availableOnly: true }), { ...CTX, availability: avail })
    assert.equal(out.length, 5)
  })

  test('with dates, it removes what has nothing free', () => {
    const f = F({ availableOnly: true, from: '2026-09-01', to: '2026-09-04' })
    const out = applyRentalFilters(ITEMS, f, { ...CTX, availability: avail })
    assert.deepEqual(out.map((i) => i.id).sort(), ['bag', 'poles', 'spikes'])
  })

  test('an item missing from the availability map counts as nothing free', () => {
    const f = F({ availableOnly: true, from: '2026-09-01', to: '2026-09-04' })
    const out = applyRentalFilters(ITEMS, f, { ...CTX, availability: {} })
    assert.deepEqual(out, [])
  })
})

// ── Dimensions ──────────────────────────────────────────────────────────────

describe('the rail', () => {
  test('fulfilment is OR within the dimension', () => {
    // "Either is fine", not "must offer both".
    const both = applyRentalFilters(ITEMS, F({ fulfilment: ['pickup', 'ship'] }), CTX)
    assert.equal(both.length, 5)
    const posted = applyRentalFilters(ITEMS, F({ fulfilment: ['ship'] }), CTX)
    assert.deepEqual(posted.map((i) => i.id).sort(), ['spikes', 'tent'])
  })

  test('shelves filter by slug and stack', () => {
    const out = applyRentalFilters(ITEMS, F({ categories: ['traction', 'sleep'] }), CTX)
    assert.deepEqual(out.map((i) => i.id).sort(), ['bag', 'poles', 'spikes'])
  })

  test('an uncategorised item survives every filter that is not about shelves', () => {
    assert.ok(applyRentalFilters(ITEMS, F({ q: 'bundle' }), CTX).map((i) => i.id).includes('bundle'))
    assert.equal(applyRentalFilters(ITEMS, F({ categories: ['shelter'] }), CTX)
      .map((i) => i.id).includes('bundle'), false)
  })

  test('dimensions compose — each one narrows', () => {
    const f = F({ categories: ['shelter', 'sleep', 'traction'], fulfilment: ['ship'] })
    assert.deepEqual(applyRentalFilters(ITEMS, f, CTX).map((i) => i.id).sort(), ['spikes', 'tent'])
  })

  test('a facet count answers "if I click this, what do I get"', () => {
    // With Shelter already chosen, the count on Sleeping must be what choosing
    // Sleeping AS WELL would return — not how many sleeping items exist under
    // the current filter, which is zero.
    const f = F({ categories: ['shelter'] })
    const n = rentalFacetCount(ITEMS, f, CTX, 'categories', (i) => i.category?.slug === 'sleep')
    assert.equal(n, 1)
  })
})

describe('shelving', () => {
  test('shelves come out in their own sort order, empty ones dropped', () => {
    const out = shelve(ITEMS, SHELVES)
    assert.deepEqual(out.map((s) => s.category?.slug ?? '(loose)'),
      ['shelter', 'sleep', 'traction', '(loose)'])
  })

  test('an unfiled item lands in a loose group rather than disappearing', () => {
    const out = shelve(ITEMS, SHELVES)
    assert.deepEqual(out.at(-1)!.items.map((i) => i.id), ['bundle'])
  })

  test('every item appears exactly once across all shelves', () => {
    const all = shelve(ITEMS, SHELVES).flatMap((s) => s.items.map((i) => i.id))
    assert.equal(all.length, ITEMS.length)
    assert.equal(new Set(all).size, ITEMS.length)
  })

  test('an item whose shelf is inactive and absent still shows up', () => {
    const out = shelve(ITEMS, [SHELTER])
    assert.equal(out.flatMap((s) => s.items).length, ITEMS.length)
  })
})

// ── The URL ─────────────────────────────────────────────────────────────────

describe('the query string', () => {
  test('THE ROUND TRIP: everything chosen survives a lap through the URL', () => {
    const chosen = F({
      q: 'four season', categories: ['shelter', 'sleep'], fulfilment: ['ship'],
      bands: ['low'], capacities: ['2'], availableOnly: true,
      from: '2026-09-12', to: '2026-09-16', sort: 'lightest',
    })
    const back = rentalFiltersFromParams(new URLSearchParams(rentalFiltersToParams(chosen).toString()))
    assert.deepEqual(back, chosen)
  })

  test('defaults are not written into the URL', () => {
    assert.equal(rentalFiltersToParams(EMPTY_RENTAL_FILTERS).toString(), '')
  })

  test('the dates are shareable on their own', () => {
    const p = rentalFiltersToParams(F({ from: '2026-09-12', to: '2026-09-16' }))
    assert.equal(p.get('from'), '2026-09-12')
    assert.equal(p.get('to'), '2026-09-16')
  })

  test('a malformed date becomes no date, rather than reaching the database', () => {
    const back = rentalFiltersFromParams(new URLSearchParams('from=yesterday&to=2026-13-45'))
    assert.equal(back.from, '')
    assert.equal(back.to, '')
  })

  test('an inverted range drops the end and keeps the start that was typed', () => {
    const back = rentalFiltersFromParams(new URLSearchParams('from=2026-09-16&to=2026-09-12'))
    assert.equal(back.from, '2026-09-16')
    assert.equal(back.to, '')
  })

  test('an unknown sort falls back rather than reaching the sorter', () => {
    assert.equal(rentalFiltersFromParams(new URLSearchParams('sort=cheapest')).sort, 'featured')
  })

  test('an unknown fulfilment value is discarded', () => {
    assert.deepEqual(rentalFiltersFromParams(new URLSearchParams('get=ship,drone')).fulfilment, ['ship'])
  })

  test('a very long query is truncated rather than carried', () => {
    const back = rentalFiltersFromParams(new URLSearchParams(`q=${'a'.repeat(500)}`))
    assert.equal(back.q.length, 80)
  })
})

describe('the active count', () => {
  test('counts choices', () => {
    assert.equal(countActiveRental(EMPTY_RENTAL_FILTERS), 0)
    assert.equal(countActiveRental(F({ categories: ['a', 'b'], q: 'tent', availableOnly: true })), 4)
  })

  test('does NOT count the dates — they are the errand, not a filter', () => {
    assert.equal(countActiveRental(F({ from: '2026-09-12', to: '2026-09-16' })), 0)
  })

  test('sorting is not a filter either', () => {
    assert.equal(countActiveRental(F({ sort: 'lightest' })), 0)
  })
})

describe('toggle', () => {
  test('adds, removes, and leaves the rest alone', () => {
    assert.deepEqual(toggle([], 'a'), ['a'])
    assert.deepEqual(toggle(['a'], 'a'), [])
    assert.deepEqual(toggle(['a', 'b'], 'c'), ['a', 'b', 'c'])
    assert.deepEqual(toggle(['a', 'b'], 'a'), ['b'])
  })
})
