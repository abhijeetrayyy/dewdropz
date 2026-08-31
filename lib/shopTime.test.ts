import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { shopToday, shopAddDays, shopTomorrow, isPastShopDay } from './shopTime.ts'

/**
 * Ported from `mobile/lib/rent/dates.test.ts`, which has guarded the client half
 * of this bug since the app was written. The server never had the equivalent.
 *
 * These are property assertions, not fixed strings: a test that hardcodes
 * "2026-08-31" passes for one day and then lies.
 */
describe('the shop day', () => {
  test('THE BUG THIS GUARDS: the shop day is IST, not UTC', () => {
    // 2026-09-14T22:30Z is 2026-09-15T04:00 IST — a different date. The old
    // `toISOString().slice(0,10)` returned the 14th here, which is how a return
    // taken on the early shift got a free day of lateness.
    const instant = new Date('2026-09-14T22:30:00Z')
    assert.equal(shopToday(instant), '2026-09-15')
    assert.notEqual(shopToday(instant), instant.toISOString().slice(0, 10))
  })

  test('and it agrees with UTC during the rest of the day', () => {
    const instant = new Date('2026-09-15T09:00:00Z') // 14:30 IST, same date
    assert.equal(shopToday(instant), '2026-09-15')
    assert.equal(shopToday(instant), instant.toISOString().slice(0, 10))
  })

  test('the boundary is 18:30Z exactly', () => {
    assert.equal(shopToday(new Date('2026-09-14T18:29:59Z')), '2026-09-14')
    assert.equal(shopToday(new Date('2026-09-14T18:30:00Z')), '2026-09-15')
  })

  test('it does not depend on the machine running the test', () => {
    // Whatever TZ node was started in, the answer is the shop's.
    const instant = new Date('2026-01-01T20:00:00Z') // 01:30 IST on the 2nd
    assert.equal(shopToday(instant), '2026-01-02')
  })

  test('adding days crosses months, years and a leap day', () => {
    assert.equal(shopAddDays('2026-01-31', 1), '2026-02-01')
    assert.equal(shopAddDays('2026-12-31', 1), '2027-01-01')
    assert.equal(shopAddDays('2028-02-28', 1), '2028-02-29') // 2028 is a leap year
    assert.equal(shopAddDays('2026-03-01', -1), '2026-02-28')
    assert.equal(shopAddDays('2026-09-15', 0), '2026-09-15')
  })

  test('tomorrow is today plus one, across the IST boundary', () => {
    assert.equal(shopTomorrow(new Date('2026-09-14T22:30:00Z')), '2026-09-16')
    assert.equal(shopTomorrow(new Date('2026-09-15T09:00:00Z')), '2026-09-16')
  })

  test('the past is the shop’s past', () => {
    const instant = new Date('2026-09-14T22:30:00Z') // the 15th, in IST
    assert.equal(isPastShopDay('2026-09-14', instant), true)
    assert.equal(isPastShopDay('2026-09-15', instant), false, 'today is not past')
    assert.equal(isPastShopDay('2026-09-16', instant), false)
    // The case the floor exists for.
    assert.equal(isPastShopDay('2025-01-10', instant), true)
  })
})
