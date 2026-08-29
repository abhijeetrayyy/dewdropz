import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { todayLocal, daysBetween, addDays, monthCells, stepMonth, prettyDate } from './dates.ts'

describe('the rental calendar', () => {
  test('a month grid puts the 1st under the right weekday, for four years', () => {
    for (let y = 2026; y <= 2029; y++) {
      for (let m = 0; m < 12; m++) {
        const cells = monthCells(y, m)
        const lead = cells.findIndex((c) => c !== null)
        const first = new Date(Date.UTC(y, m, 1))
        assert.equal(lead, (first.getUTCDay() + 6) % 7, `lead for ${y}-${m + 1}`)
        assert.equal(cells[lead], `${y}-${String(m + 1).padStart(2, '0')}-01`)
        assert.equal(
          cells.filter(Boolean).length,
          new Date(Date.UTC(y, m + 1, 0)).getUTCDate(),
          `day count for ${y}-${m + 1}`,
        )
      }
    }
  })

  test('February has 29 days in a leap year and 28 otherwise', () => {
    assert.equal(monthCells(2028, 1).filter(Boolean).length, 29)
    assert.equal(monthCells(2026, 1).filter(Boolean).length, 28)
  })

  test('stepping months wraps December in both directions', () => {
    assert.deepEqual(stepMonth({ year: 2026, month: 11 }, 1), { year: 2027, month: 0 })
    assert.deepEqual(stepMonth({ year: 2026, month: 0 }, -1), { year: 2025, month: 11 })
    assert.deepEqual(stepMonth({ year: 2026, month: 5 }, 30), { year: 2028, month: 11 })
  })

  test('days are counted inclusively, matching the server', () => {
    assert.equal(daysBetween('2026-09-12', '2026-09-14'), 3)
    assert.equal(daysBetween('2026-09-12', '2026-09-12'), 1)
    assert.equal(daysBetween('2026-09-14', '2026-09-12'), 0)
    assert.equal(daysBetween('2028-02-27', '2028-03-01'), 4)
  })

  test('addDays crosses months, years and a leap day', () => {
    assert.equal(addDays('2026-08-31', 1), '2026-09-01')
    assert.equal(addDays('2026-12-31', 1), '2027-01-01')
    assert.equal(addDays('2028-02-28', 1), '2028-02-29')
    assert.equal(addDays('2026-09-05', -6), '2026-08-30')
  })

  test('THE BUG THIS GUARDS: today is the LOCAL date, not UTC', () => {
    // `toISOString()` is UTC, so for anybody in IST between midnight and 05:30
    // it reports yesterday — and the calendar would show today as already past
    // and unbookable.
    //
    // Asserted as a PROPERTY, not a fixed string: what todayLocal guarantees is
    // that it reads the machine's local calendar fields, so the expectation has
    // to be computed the same way or the test only passes in one timezone.
    // (An earlier version of this test hardcoded a date and passed only under
    // TZ=UTC — the test was wrong, not the function.)
    const localDate = (d: Date) => d.toLocaleDateString('en-CA') // en-CA is YYYY-MM-DD

    for (const iso of [
      '2026-08-27T19:00:00Z', // 00:30 IST on the 28th
      '2026-01-01T00:30:00Z',
      '2026-06-15T12:00:00Z',
      '2026-12-31T23:59:00Z',
    ]) {
      const d = new Date(iso)
      assert.equal(todayLocal(d), localDate(d), `local date for ${iso}`)
    }
  })

  test('a UTC-based reading really can differ from the local one', () => {
    // The failure mode in one line: somewhere east of UTC, an instant late in
    // the UTC day is already tomorrow locally.
    const d = new Date('2026-08-27T19:00:00Z')
    const utc = d.toISOString().slice(0, 10)
    const local = d.toLocaleDateString('en-CA')
    if (utc !== local) {
      assert.notEqual(todayLocal(d), utc, 'todayLocal must follow the local date, not UTC')
    } else {
      // Machine is at or west of UTC for this instant; nothing to contrast.
      assert.equal(todayLocal(d), utc)
    }
  })

  test('prettyDate is stable regardless of the machine timezone', () => {
    assert.equal(prettyDate('2026-09-14'), '14 Sep')
    assert.equal(prettyDate('2026-01-01'), '1 Jan')
  })
})
