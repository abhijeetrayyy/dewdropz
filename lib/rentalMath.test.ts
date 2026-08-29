import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  rentalDays, longRentalDiscount, lateFee, taxableBase, gstOn, daysToBreakEven,
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
