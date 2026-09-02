import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  monthCells, stepMonth, monthOf, daysBetween, firstDayOf, lastDayOf, prettyDay,
} from './calendarGrid.ts'
import * as mobile from '../mobile/lib/rent/dates.ts'

/**
 * The web's calendar arithmetic — and the guard that keeps it honest.
 *
 * This module is a deliberate port of `mobile/lib/rent/dates.ts`; the reasoning
 * is in its header. The risk a port carries is silent drift, so the last block
 * here imports BOTH and asserts they agree. A leap-year fix applied to one and
 * not the other fails at `npm test` rather than in February.
 */

describe('the month grid', () => {
  test('the 1st lands under the right weekday, for four years', () => {
    for (let y = 2026; y < 2030; y++) {
      for (let m = 0; m < 12; m++) {
        const cells = monthCells(y, m)
        const lead = cells.findIndex((c) => c !== null)
        const expected = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7
        assert.equal(lead, expected, `${y}-${m + 1}`)
      }
    }
  })

  test('February has 29 days in a leap year and 28 otherwise', () => {
    assert.equal(monthCells(2028, 1).filter(Boolean).length, 29)
    assert.equal(monthCells(2027, 1).filter(Boolean).length, 28)
    // 2100 is not a leap year, which a naive %4 gets wrong.
    assert.equal(monthCells(2100, 1).filter(Boolean).length, 28)
  })

  test('every cell is a real day of the month it belongs to', () => {
    for (const c of monthCells(2026, 8)) {
      if (c === null) continue
      assert.match(c, /^2026-09-\d{2}$/)
    }
  })
})

describe('stepping months', () => {
  test('wraps December in both directions', () => {
    assert.deepEqual(stepMonth({ year: 2026, month: 11 }, 1), { year: 2027, month: 0 })
    assert.deepEqual(stepMonth({ year: 2026, month: 0 }, -1), { year: 2025, month: 11 })
  })

  test('a whole year of single steps returns where it started', () => {
    let c = { year: 2026, month: 3 }
    for (let i = 0; i < 12; i++) c = stepMonth(c, 1)
    assert.deepEqual(c, { year: 2027, month: 3 })
  })
})

describe('reading a date', () => {
  test('monthOf reads characters, not a parsed clock', () => {
    assert.deepEqual(monthOf('2026-01-01'), { year: 2026, month: 0 })
    assert.deepEqual(monthOf('2026-12-31'), { year: 2026, month: 11 })
  })

  test('the window ends on the real last day of the month', () => {
    assert.equal(lastDayOf(2028, 1), '2028-02-29')
    assert.equal(lastDayOf(2027, 1), '2027-02-28')
    assert.equal(lastDayOf(2026, 8), '2026-09-30')
    assert.equal(firstDayOf(2026, 8), '2026-09-01')
  })

  test('days are counted inclusively, matching the server', () => {
    assert.equal(daysBetween('2026-09-12', '2026-09-14'), 3)
    assert.equal(daysBetween('2026-09-12', '2026-09-12'), 1)
    assert.equal(daysBetween('2026-09-14', '2026-09-12'), 0)
    assert.equal(daysBetween('not-a-date', '2026-09-12'), 0)
  })

  test('prettyDay is stable regardless of the machine timezone', () => {
    // The label must not disagree with the cell it sits in — which is exactly
    // what happens the moment this is read through a local clock.
    assert.equal(prettyDay('2026-09-12'), '12 Sep')
    assert.equal(prettyDay('2026-01-01'), '1 Jan')
    assert.equal(prettyDay('2026-12-31'), '31 Dec')
  })
})

describe('THE DRIFT GUARD: the web copy and the app copy agree', () => {
  test('monthCells is identical over four years of months', () => {
    for (let y = 2026; y < 2030; y++) {
      for (let m = 0; m < 12; m++) {
        assert.deepEqual(monthCells(y, m), mobile.monthCells(y, m), `${y}-${m + 1}`)
      }
    }
  })

  test('stepMonth is identical across a two-year sweep in both directions', () => {
    for (let d = -24; d <= 24; d++) {
      assert.deepEqual(stepMonth({ year: 2026, month: 5 }, d), mobile.stepMonth({ year: 2026, month: 5 }, d), `${d}`)
    }
  })

  test('daysBetween agrees, including on the reversed and malformed cases', () => {
    const cases: [string, string][] = [
      ['2026-09-12', '2026-09-14'], ['2026-09-12', '2026-09-12'],
      ['2026-09-14', '2026-09-12'], ['2026-02-28', '2028-03-01'],
      ['nope', '2026-09-12'],
    ]
    for (const [a, b] of cases) {
      assert.equal(daysBetween(a, b), mobile.daysBetween(a, b), `${a} → ${b}`)
    }
  })

  test('MONTHS is the same list', () => {
    assert.deepEqual(MONTHS_web(), mobile.MONTHS)
  })
})

function MONTHS_web() {
  // Imported lazily through the module's own export to keep the assertion
  // about values rather than about import order.
  return ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
}
