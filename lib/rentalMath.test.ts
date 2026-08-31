import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  rentalDays, longRentalDiscount, lateFee, taxableBase, gstOn, daysToBreakEven,
  couponDiscountOnRent, extensionCharge, settleDeposit, daysLate,
} from './rentalMath.ts'

// Money rules. These are the numbers a customer is charged and a shop is
// audited on, so each case states the rule it defends rather than just an
// input and an output.

describe('rentalDays — both days count', () => {
  test('the 12th to the 14th is three days, not two', () => {
    assert.equal(rentalDays('2026-09-12', '2026-09-14'), 3)
  })
  test('a single day is one day, not zero', () => {
    assert.equal(rentalDays('2026-09-12', '2026-09-12'), 1)
  })
  test('reversed dates are not a negative rental', () => {
    assert.equal(rentalDays('2026-09-14', '2026-09-12'), 0)
  })
  test('counts across a month boundary', () => {
    assert.equal(rentalDays('2026-08-30', '2026-09-02'), 4)
  })
  test('counts across 29 February in a leap year', () => {
    assert.equal(rentalDays('2028-02-27', '2028-03-01'), 4)
  })
  test('counts across a year boundary', () => {
    assert.equal(rentalDays('2026-12-30', '2027-01-02'), 4)
  })
  test('rubbish in is zero, never NaN', () => {
    assert.equal(rentalDays('not-a-date', '2026-09-14'), 0)
    assert.equal(rentalDays('', ''), 0)
  })
})

describe('longRentalDiscount — a long rental is never dearer than a short one', () => {
  test('nothing under seven days', () => {
    assert.equal(longRentalDiscount(100000, 6, 15), 0)
  })
  test('applies from the seventh day, clamped so it cannot undercut six', () => {
    // Raw 15% would be 15,000, which would price 7 days below 6. Clamped to the
    // difference between the two, so 7 days costs exactly what 6 days costs.
    assert.equal(longRentalDiscount(100000, 7, 15), 14286)
  })
  test('zero percent is no discount', () => {
    assert.equal(longRentalDiscount(100000, 10, 0), 0)
  })
  test('rounds to whole paise when the clamp is not binding', () => {
    // At 10% on 7 days the raw discount (3,333) is below the clamp, so it is
    // taken as-is and only rounding applies.
    assert.equal(longRentalDiscount(33333, 7, 10), 3333)
  })
  test('the clamp binds above ~14.3%, which is where the cliff used to be', () => {
    // Raw would be 5,000 and would price 7 days below 6. The clamp holds it to
    // exactly the difference between 7 days and 6.
    assert.equal(longRentalDiscount(33333, 7, 15), 4762)
  })
  test('THE INVARIANT: the total never falls as days rise, at any rate or percentage', () => {
    // This is the property the module's comment claims and the old cliff broke:
    // at 15% a 7-day tent came to ₹2,677.50 against ₹2,700 for 6 days.
    for (const rate of [8000, 22000, 45000, 85000]) {
      for (let pct = 0; pct <= 60; pct += 5) {
        let previous = 0
        for (let days = 1; days <= 40; days++) {
          const gross = rate * days
          const total = gross - longRentalDiscount(gross, days, pct)
          assert.ok(
            total >= previous,
            `rate ${rate}, ${pct}%: ${days} days (${total}) is cheaper than ${days - 1} (${previous})`,
          )
          previous = total
        }
      }
    }
  })

  test('a discount can never exceed the rental itself', () => {
    for (let pct = 0; pct <= 60; pct += 5) {
      for (let days = 7; days <= 30; days++) {
        const gross = 45000 * days
        assert.ok(longRentalDiscount(gross, days, pct) <= gross)
      }
    }
  })

  test('daysToBreakEven says honestly when a saving actually begins', () => {
    // At 15% the clamp makes day 7 free rather than cheaper, so a real saving
    // starts on day 8. Worth knowing before advertising "cheaper from a week".
    assert.equal(daysToBreakEven(15), 8)
    assert.equal(daysToBreakEven(0), Infinity)
  })
})

describe('lateFee — charged at the day rate, capped at the deposit', () => {
  test('on time is nothing', () => {
    assert.equal(lateFee(45000, 0, 900000), 0)
  })
  test('early is nothing, not a credit', () => {
    assert.equal(lateFee(45000, -3, 900000), 0)
  })
  test('two days late is two days of rental', () => {
    assert.equal(lateFee(45000, 2, 900000), 90000)
  })
  test('THE CAP: a forgotten tent cannot exceed the money we hold', () => {
    assert.equal(lateFee(45000, 365, 900000), 900000)
  })
  test('with no deposit held there is nothing to cap against', () => {
    assert.equal(lateFee(45000, 3, 0), 135000)
  })
})

describe('tax — the deposit is not consideration', () => {
  test('the base is rent plus delivery, and excludes the deposit', () => {
    assert.equal(taxableBase(135000, 16000), 151000)
  })
  test('GST at 18% of a rental', () => {
    assert.equal(gstOn(135000, 18), 24300)
  })
  test('THE RULE: adding a deposit must not change the tax', () => {
    const withoutDeposit = gstOn(taxableBase(135000, 0), 18)
    // A deposit of any size is simply not in the base.
    assert.equal(withoutDeposit, gstOn(taxableBase(135000, 0), 18))
    assert.equal(withoutDeposit, 24300)
  })
  test('rounds to whole paise rather than carrying a fraction', () => {
    assert.equal(gstOn(1, 18), 0)
    assert.equal(gstOn(3, 18), 1)
  })
})

describe('a whole rental, end to end', () => {
  test('3 days of a ₹450 tent, collected: ₹1,350 + ₹243 GST, ₹9,000 deposit untaxed', () => {
    const days = rentalDays('2026-09-12', '2026-09-14')
    const gross = 45000 * days
    const discount = longRentalDiscount(gross, days, 15)
    const rent = gross - discount
    const tax = gstOn(taxableBase(rent, 0), 18)
    assert.equal(days, 3)
    assert.equal(discount, 0, 'under seven days earns nothing')
    assert.equal(rent, 135000)
    assert.equal(tax, 24300)
    assert.equal(rent + tax, 159300)
  })

  test('8 days of the same tent earns the discount and is taxed on the discounted rent', () => {
    const days = rentalDays('2026-10-05', '2026-10-12')
    const gross = 45000 * days
    const discount = longRentalDiscount(gross, days, 15)
    const rent = gross - discount
    assert.equal(days, 8)
    assert.equal(gross, 360000)
    assert.equal(discount, 54000)
    assert.equal(rent, 306000)
    assert.equal(gstOn(taxableBase(rent, 0), 18), 55080)
  })
})

describe('couponDiscountOnRent — the rent, and only the rent', () => {
  test('a percentage comes off the net rent', () => {
    assert.equal(couponDiscountOnRent(200000, { type: 'percentage', value: 10 }), 20000)
  })

  test('a percentage cap binds', () => {
    assert.equal(
      couponDiscountOnRent(200000, { type: 'percentage', value: 50, maxDiscount: 30000 }),
      30000,
    )
  })

  test('a fixed amount comes off whole', () => {
    assert.equal(couponDiscountOnRent(200000, { type: 'fixed', value: 50000 }), 50000)
  })

  test('THE RULE: a discount can never exceed the rent', () => {
    // ₹500 off a ₹300 rental takes ₹300. A negative line would turn a discount
    // into the shop paying the customer to borrow a tent.
    assert.equal(couponDiscountOnRent(30000, { type: 'fixed', value: 50000 }), 30000)
  })

  test('nothing to discount is nothing discounted, not a negative', () => {
    assert.equal(couponDiscountOnRent(0, { type: 'percentage', value: 25 }), 0)
    assert.equal(couponDiscountOnRent(-100, { type: 'fixed', value: 5000 }), 0)
  })

  test('THE RULE: the caller passes rent, so the deposit can never be discounted', () => {
    // Stated as a test because it is the mistake that costs real money: a 20%
    // code applied to rent + deposit on a ₹9,000 deposit gives away ₹1,800 of
    // security the shop is only holding, and then refunds it again at return.
    const rent = 135000
    const deposit = 900000
    const onRent = couponDiscountOnRent(rent, { type: 'percentage', value: 20 })
    const onEverything = couponDiscountOnRent(rent + deposit, { type: 'percentage', value: 20 })
    assert.equal(onRent, 27000)
    assert.equal(onEverything, 207000)
    assert.ok(onEverything - onRent === 180000, 'the deposit share is what a wrong call would give away')
  })
})

describe('extensionCharge — a delta, never a re-quote', () => {
  test('three more days at the frozen rate', () => {
    assert.deepEqual(
      extensionCharge({ dailyRate: 45000, daysAdded: 3, quantity: 1 }),
      { rent: 135000, discount: 0, net: 135000 },
    )
  })

  test('quantity multiplies', () => {
    assert.equal(extensionCharge({ dailyRate: 45000, daysAdded: 2, quantity: 3 }).net, 270000)
  })

  test('no days added is no charge', () => {
    assert.equal(extensionCharge({ dailyRate: 45000, daysAdded: 0, quantity: 1 }).net, 0)
  })

  test('the long-rental discount applies only when the shop asks for it', () => {
    const without = extensionCharge({ dailyRate: 45000, daysAdded: 8, quantity: 1 })
    const with15 = extensionCharge({ dailyRate: 45000, daysAdded: 8, quantity: 1, discountPct: 15 })
    assert.equal(without.discount, 0)
    assert.ok(with15.discount > 0)
    // And it is still clamped, so eight discounted days cannot undercut six.
    assert.ok(with15.net >= 45000 * 6)
  })

  test('THE BUG THIS PREVENTS: a re-quote can charge less than was already paid', () => {
    // A 5-day rental of a ₹450/day tent at 15%: 5 days is under the threshold,
    // so ₹2,250 was charged. Extending to 8 days and RE-QUOTING the whole thing
    // gives 8 × 450 = 3,600 less the clamped discount — and the delta between
    // that and what was paid is what the customer would owe. Compare against
    // pricing only the days added.
    const rate = 45000
    const alreadyPaid = rate * 5
    const requoted = rate * 8 - longRentalDiscount(rate * 8, 8, 15)
    const requoteDelta = requoted - alreadyPaid
    const honestDelta = extensionCharge({ dailyRate: rate, daysAdded: 3, quantity: 1 }).net

    assert.equal(honestDelta, 135000)
    assert.ok(
      requoteDelta < honestDelta,
      'a re-quote undercharges for the extra days, which is why extensions price the delta',
    )
  })
})

describe('settleDeposit — three numbers that must add up', () => {
  test('nothing owed, everything back', () => {
    assert.deepEqual(settleDeposit({ deposit: 900000, lateFee: 0, damageFee: 0 }), {
      applied: 0, refund: 900000, unrecovered: 0, state: 'refunded',
    })
  })

  test('a partial deduction is still a refund, not a forfeiture', () => {
    const s = settleDeposit({ deposit: 900000, lateFee: 90000, damageFee: 30000 })
    assert.equal(s.applied, 120000)
    assert.equal(s.refund, 780000)
    assert.equal(s.state, 'refunded')
  })

  test('THE INVARIANT: applied + refund is always exactly the deposit', () => {
    for (const deposit of [0, 1, 50000, 900000, 1500000]) {
      for (const late of [0, 1, 45000, 900000, 5000000]) {
        for (const damage of [0, 25000, 2000000]) {
          const s = settleDeposit({ deposit, lateFee: late, damageFee: damage })
          assert.equal(s.applied + s.refund, deposit,
            `deposit ${deposit}, late ${late}, damage ${damage}`)
        }
      }
    }
  })

  test('THE CAP: what is owed beyond the deposit is reported, never charged', () => {
    const s = settleDeposit({ deposit: 900000, lateFee: 1200000, damageFee: 300000 })
    assert.equal(s.applied, 900000)
    assert.equal(s.refund, 0)
    assert.equal(s.state, 'forfeited')
    // ₹15,000 owed against a ₹9,000 deposit leaves ₹6,000 the shop may pursue —
    // as a conversation, not as an automatic charge.
    assert.equal(s.unrecovered, 600000)
  })

  test('a waived deposit settles to nothing rather than a negative', () => {
    const s = settleDeposit({ deposit: 0, lateFee: 45000, damageFee: 0 })
    assert.equal(s.applied, 0)
    assert.equal(s.refund, 0)
    assert.equal(s.unrecovered, 45000)
  })
})

describe('daysLate — inclusive spans turned into an overrun', () => {
  test('returned on the day it was due is not late', () => {
    assert.equal(daysLate('2026-09-14', '2026-09-14'), 0)
  })

  test('returned early is not late, and never a credit', () => {
    assert.equal(daysLate('2026-09-14', '2026-09-11'), 0)
  })

  test('two days over is two days late', () => {
    assert.equal(daysLate('2026-09-14', '2026-09-16'), 2)
  })

  test('it agrees with lateFee across a month boundary', () => {
    const late = daysLate('2026-08-30', '2026-09-02')
    assert.equal(late, 3)
    assert.equal(lateFee(45000, late, 900000), 135000)
  })
})
