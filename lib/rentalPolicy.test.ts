import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { cancellationRefund, RENTAL_POLICY } from './rentalPolicy.ts'

describe('cancelling a rental', () => {
  const base = { rentPaid: 400000, depositHeld: 600000, today: '2026-09-01' }

  test('a week or more out, all the rent comes back', () => {
    const r = cancellationRefund({ ...base, startsOn: '2026-09-08' }) // 7 days
    assert.equal(r.rentRefund, 400000)
    assert.equal(r.depositRefund, 600000)
    assert.equal(r.total, 1000000)
  })

  test('inside a week, half the rent', () => {
    const r = cancellationRefund({ ...base, startsOn: '2026-09-05' }) // 4 days
    assert.equal(r.rentRefund, 200000)
    assert.equal(r.depositRefund, 600000)
  })

  test('inside two days, none of the rent — and all of the deposit', () => {
    const r = cancellationRefund({ ...base, startsOn: '2026-09-02' }) // 1 day
    assert.equal(r.rentRefund, 0)
    assert.equal(
      r.depositRefund,
      600000,
      'the deposit is the customer’s money held, not consideration — it always comes back'
    )
  })

  test('a hire starting today refunds no rent but still the deposit', () => {
    const r = cancellationRefund({ ...base, startsOn: '2026-09-01' })
    assert.equal(r.rentRefund, 0)
    assert.equal(r.depositRefund, 600000)
  })

  test('THE INVARIANT: a refund can never exceed what was actually paid', () => {
    for (const rentPaid of [0, 1, 99, 100000, 400001]) {
      for (const startsOn of ['2026-09-01', '2026-09-03', '2026-09-20']) {
        const r = cancellationRefund({ ...base, rentPaid, startsOn })
        assert.ok(r.rentRefund <= rentPaid, `${rentPaid} on ${startsOn}`)
        assert.ok(r.rentRefund >= 0)
      }
    }
  })

  test('an unpaid booking refunds nothing and does not go negative', () => {
    const r = cancellationRefund({ rentPaid: 0, depositHeld: 0, startsOn: '2026-09-20', today: '2026-09-01' })
    assert.equal(r.total, 0)
  })

  test('the odd paise rounds to the shop, never past the customer', () => {
    // 50% of 401 paise is 200.5 — floor, so the customer gets 200 and never 201.
    const r = cancellationRefund({ ...base, rentPaid: 401, startsOn: '2026-09-05' })
    assert.equal(r.rentRefund, 200)
  })

  test('the bands are ordered, so the first match is the most generous one that applies', () => {
    const days = RENTAL_POLICY.cancellation.map((b) => b.daysBefore)
    assert.deepEqual(days, [...days].sort((a, b) => b - a), 'bands must run widest-notice first')
  })
})
