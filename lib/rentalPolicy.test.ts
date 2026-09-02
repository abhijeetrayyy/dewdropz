import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { cancellationQuote, fullRefundDeadline, RENTAL_POLICY } from './rentalPolicy.ts'

/**
 * The cancellation policy, held to account.
 *
 * This matters more than most tests in the repo, because every number it
 * guards is real money leaving or staying in a real account, and because the
 * figure quoted to the customer BEFORE they pay, the figure in the confirm
 * dialog and the figure actually refunded are all this one function. If they
 * ever disagree, the shop is quoting a promise it does not keep.
 *
 * The four rules the policy is built on each get a block named after them.
 */

const DAY = 86_400_000
const HOUR = 3_600_000
/** A booking made long enough ago that the grace window is not in play, so a
 *  test about BANDS is only about bands. */
const LONG_AGO = new Date('2026-01-01T00:00:00Z')
const NOW = new Date('2026-09-01T10:00:00Z')
const TODAY = '2026-09-01'

const q = (over: Partial<Parameters<typeof cancellationQuote>[0]> = {}) =>
  cancellationQuote({
    rentPaid: 100_000, depositHeld: 900_000,
    startsOn: '2026-09-20', today: TODAY,
    bookedAt: LONG_AGO, now: NOW,
    ...over,
  })

/** The start date that is exactly `d` days after TODAY. */
const startIn = (d: number) => new Date(Date.parse(`${TODAY}T00:00:00Z`) + d * DAY).toISOString().slice(0, 10)

// ── The bands ───────────────────────────────────────────────────────────────

describe('the bands', () => {
  test('a week or more out returns all of the rent', () => {
    for (const d of [7, 8, 30, 365]) {
      const r = q({ startsOn: startIn(d) })
      assert.equal(r.rentRefund, 100_000, `${d} days out`)
      assert.equal(r.rentRetained, 0)
    }
  })

  test('three to six days out returns three quarters', () => {
    for (const d of [3, 4, 5, 6]) {
      const r = q({ startsOn: startIn(d) })
      assert.equal(r.rentRefund, 75_000, `${d} days out`)
      assert.equal(r.rentRetained, 25_000)
    }
  })

  test('two days out returns half', () => {
    const r = q({ startsOn: startIn(2) })
    assert.equal(r.rentRefund, 50_000)
    assert.equal(r.rentRetained, 50_000)
  })

  test('inside two days returns a quarter — NEVER nothing', () => {
    // The rule the whole rewrite turns on. Under pay-to-reserve a zero band
    // means the shop keeps 100% of money already taken from a card, which is
    // the most reliable way to earn a chargeback.
    for (const d of [1, 0, -1, -5]) {
      const r = q({ startsOn: startIn(d) })
      assert.equal(r.rentRefund, 25_000, `${d} days out`)
      assert.ok(r.rentRefund > 0, 'a band returned nothing')
    }
  })

  test('NO BAND EVER RETURNS ZERO', () => {
    for (const b of RENTAL_POLICY.cancellation.bands) {
      assert.ok(b.refundShare > 0, `band at ${b.daysBefore} days returns nothing`)
    }
  })

  test('the bands slope the right way — later notice never returns more', () => {
    let last = Infinity
    for (const d of [30, 7, 6, 3, 2, 1, 0]) {
      const r = q({ startsOn: startIn(d) }).rentRefund
      assert.ok(r <= last, `${d} days out returned more than the band before it`)
      last = r
    }
  })

  test('a floor band exists, so a same-day cancellation always has a rule', () => {
    assert.equal(RENTAL_POLICY.cancellation.bands.at(-1)!.daysBefore, 0)
  })
})

// ── Rule 1: the grace window ────────────────────────────────────────────────

describe('the grace window', () => {
  test('inside 24 hours of booking, everything comes back however close the hire', () => {
    const r = q({ startsOn: startIn(0), bookedAt: new Date(NOW.getTime() - 2 * HOUR) })
    assert.equal(r.rentRefund, 100_000)
    assert.ok(r.underGrace)
  })

  test('it applies right up to the boundary and not past it', () => {
    const near = q({ startsOn: startIn(1), bookedAt: new Date(NOW.getTime() - 23.9 * HOUR) })
    assert.ok(near.underGrace)
    assert.equal(near.rentRefund, 100_000)

    const past = q({ startsOn: startIn(1), bookedAt: new Date(NOW.getTime() - 24.1 * HOUR) })
    assert.ok(!past.underGrace)
    assert.equal(past.rentRefund, 25_000)
  })

  test('it is not needed when the band is already whole, and does not double up', () => {
    const r = q({ startsOn: startIn(30), bookedAt: new Date(NOW.getTime() - HOUR) })
    assert.equal(r.rentRefund, 100_000)
  })

  test('an unparseable or backwards clock does NOT grant grace by accident', () => {
    // Failing open here would hand a full refund to anybody whose booking row
    // carried a bad timestamp. The bands still apply, which is the safe answer.
    const bad = q({ startsOn: startIn(0), bookedAt: 'not-a-date' })
    assert.ok(!bad.underGrace)
    assert.equal(bad.rentRefund, 25_000)

    const backwards = q({ startsOn: startIn(0), bookedAt: new Date(NOW.getTime() + 5 * HOUR) })
    assert.ok(!backwards.underGrace)
  })
})

// ── Rule 3: the deposit ─────────────────────────────────────────────────────

describe('the deposit', () => {
  test('comes back in full in EVERY case — the line with no exception', () => {
    const cases = [
      q({ startsOn: startIn(30) }),
      q({ startsOn: startIn(3) }),
      q({ startsOn: startIn(0) }),
      q({ startsOn: startIn(-3) }),
      q({ startsOn: startIn(0), cancelledBy: 'shop' }),
      q({ startsOn: startIn(0), bookedAt: NOW }),
    ]
    for (const c of cases) assert.equal(c.depositRefund, 900_000)
  })

  test('a deposit that was never lodged refunds nothing, not a negative', () => {
    assert.equal(q({ depositHeld: 0 }).depositRefund, 0)
    assert.equal(q({ depositHeld: -500 }).depositRefund, 0)
  })
})

// ── Rule 4: who cancelled ───────────────────────────────────────────────────

describe('when the SHOP cancels', () => {
  test('everything comes back, at any notice', () => {
    for (const d of [30, 5, 1, 0, -2]) {
      const r = q({ startsOn: startIn(d), cancelledBy: 'shop' })
      assert.equal(r.rentRefund, 100_000, `${d} days out`)
      assert.equal(r.rentRetained, 0)
      assert.ok(r.shopCancelled)
    }
  })

  test('THE BUG THIS CLOSES: the old code could not tell who cancelled', () => {
    // An admin calling off a booking the night before — a tent came back
    // damaged — applied the customer band and the shop kept the money. The
    // shop must never profit from its own failure.
    const shop = q({ startsOn: startIn(1), cancelledBy: 'shop' })
    const customer = q({ startsOn: startIn(1), cancelledBy: 'customer' })
    assert.equal(shop.rentRefund, 100_000)
    assert.equal(customer.rentRefund, 25_000)
  })

  test('the default is the CHARGED case, so a missing parameter costs the shop nothing it should not pay', () => {
    // …but note the direction: defaulting to 'customer' means a caller that
    // forgets the flag under-refunds, which is why every shop path passes it
    // explicitly and there is a test above that proves it does.
    assert.equal(q({ startsOn: startIn(1) }).rentRefund, 25_000)
  })
})

// ── The arithmetic ──────────────────────────────────────────────────────────

describe('the arithmetic', () => {
  test('THE INVARIANT: refunded plus retained is exactly what was paid', () => {
    // Rounding both independently is how a rupee goes missing from a
    // reconciliation. Swept across awkward amounts and every band.
    for (const paid of [0, 1, 3, 7, 99, 101, 1_475_00, 33_333, 999_999]) {
      for (const d of [30, 5, 2, 0]) {
        const r = q({ rentPaid: paid, startsOn: startIn(d) })
        assert.equal(r.rentRefund + r.rentRetained, paid, `₹${paid} at ${d} days`)
        assert.ok(r.rentRefund >= 0 && r.rentRetained >= 0)
      }
    }
  })

  test('the refund never exceeds what was paid', () => {
    for (const d of [30, 5, 2, 0]) {
      assert.ok(q({ rentPaid: 1_000, startsOn: startIn(d) }).rentRefund <= 1_000)
    }
  })

  test('nothing paid means nothing back and nothing kept', () => {
    const r = q({ rentPaid: 0, depositHeld: 0, startsOn: startIn(0) })
    assert.equal(r.total, 0)
    assert.equal(r.rentRetained, 0)
  })

  test('rounding goes DOWN on the refund, so the shop keeps at most a paise', () => {
    // 3 paise at 75% is 2.25 → 2 back, 1 kept.
    const r = q({ rentPaid: 3, depositHeld: 0, startsOn: startIn(4) })
    assert.equal(r.rentRefund, 2)
    assert.equal(r.rentRetained, 1)
  })
})

// ── What the customer is told ───────────────────────────────────────────────

describe('the sentence shown to a person', () => {
  test('every case produces a summary that is not empty', () => {
    const cases = [
      q({ startsOn: startIn(30) }), q({ startsOn: startIn(4) }),
      q({ startsOn: startIn(2) }), q({ startsOn: startIn(1) }),
      q({ startsOn: startIn(0) }), q({ startsOn: startIn(0), cancelledBy: 'shop' }),
      q({ startsOn: startIn(0), bookedAt: NOW }),
    ]
    for (const c of cases) assert.ok(c.summary.length > 10, c.summary)
  })

  test('the shop-cancelled and grace cases say WHY it was made whole', () => {
    assert.match(q({ startsOn: startIn(1), cancelledBy: 'shop' }).summary, /we cancelled/i)
    assert.match(q({ startsOn: startIn(1), bookedAt: NOW }).summary, /within a day/i)
  })

  test('singular and plural are both right in the countdown', () => {
    assert.match(q({ startsOn: startIn(1) }).summary, /1 day before/)
    assert.match(q({ startsOn: startIn(2) }).summary, /2 days before/)
    assert.match(q({ startsOn: startIn(0) }).summary, /on the day/)
  })
})

describe('the free-cancellation deadline, said upfront', () => {
  test('is exactly the top band before the hire starts', () => {
    assert.equal(fullRefundDeadline('2026-09-20', TODAY), '2026-09-13')
  })

  test('crosses a month and a leap day correctly', () => {
    assert.equal(fullRefundDeadline('2026-10-03', TODAY), '2026-09-26')
    assert.equal(fullRefundDeadline('2028-03-05', TODAY), '2028-02-27')
  })

  test('THE BUG THIS GUARDS: a deadline already in the past is not named', () => {
    // Found by running the app. A hire starting 5 Sep has a deadline of 29 Aug,
    // and on 1 Sep both storefronts printed "Cancel free until 29 Aug." — a
    // promise about money, made before payment, that had already expired.
    // Invisible in review because any start more than a week out hides it.
    assert.equal(fullRefundDeadline('2026-09-05', '2026-09-01'), null)
    assert.equal(fullRefundDeadline('2026-09-02', '2026-09-01'), null)
    // The caller falls back to the grace window, which is genuinely applicable.
  })

  test('the deadline is named right up to and including today', () => {
    assert.equal(fullRefundDeadline('2026-09-08', '2026-09-01'), '2026-09-01')
    assert.equal(fullRefundDeadline('2026-09-09', '2026-09-01'), '2026-09-02')
  })

  test('a malformed date names no deadline rather than an invented one', () => {
    assert.equal(fullRefundDeadline('soon', TODAY), null)
    assert.equal(fullRefundDeadline('2026-09-20', 'today'), null)
  })

  test('the deadline agrees with the quote — a cancellation ON it is still whole', () => {
    // The promise on the page and the arithmetic behind it must not be one day
    // apart, which is exactly the kind of drift this file exists to prevent.
    const starts = '2026-09-20'
    const deadline = fullRefundDeadline(starts, TODAY)!
    const onIt = cancellationQuote({
      rentPaid: 100_000, depositHeld: 0, startsOn: starts, today: deadline,
      bookedAt: LONG_AGO, now: NOW,
    })
    assert.equal(onIt.rentRefund, 100_000, 'the advertised deadline did not give a full refund')
  })
})

// ── The footgun that is not there ───────────────────────────────────────────

describe('there is no band-only wrapper, on purpose', () => {
  test('the module does not export one', async () => {
    // A wrapper existed for about ten minutes and this suite caught it handing
    // out a 100% refund on every cancellation: it passed epoch 0 for both
    // timestamps to mean "ignore the grace window", and zero hours apart is
    // inside a 24-hour grace window. It was deleted rather than fixed, because
    // its safe use depended on remembering a sentinel.
    const mod = await import('./rentalPolicy.ts')
    assert.equal('cancellationRefund' in mod, false)
  })

  test('real timestamps a moment apart DO grant grace — which is why the sentinel was wrong', () => {
    const r = q({ startsOn: startIn(0), bookedAt: NOW, now: NOW })
    assert.ok(r.underGrace)
    assert.equal(r.rentRefund, 100_000)
  })
})

describe('the payment hold', () => {
  test('is a real number of minutes, and the label says the same thing', () => {
    assert.ok(RENTAL_POLICY.payment.holdMinutes > 0)
    assert.match(RENTAL_POLICY.payment.holdLabel, new RegExp(String(RENTAL_POLICY.payment.holdMinutes)))
  })

  test('an unpaid hold is cancellable, because there is nothing to charge for', () => {
    assert.ok(RENTAL_POLICY.cancellableWhile.includes('pending_payment'))
  })
})
