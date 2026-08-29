import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { formatPrice as web } from './utils.ts'
import { formatPrice as mobile } from '../mobile/lib/utils.ts'

/**
 * Two implementations of the same rule, pinned against each other.
 *
 * The web and the app each carry their own `formatPrice`, and they HAD drifted:
 * the app dropped the trailing zero, so an 18% GST line rendered as "₹118.8"
 * and a total as "₹3,778.8" — a price ending in one decimal, which reads as a
 * typo rather than a price. The web had already fixed it and the app never got
 * the change.
 *
 * This is the cheapest possible guard against the same drift returning: the
 * two must agree on every value, so fixing one and forgetting the other fails
 * here rather than in a customer's cart.
 */
describe('formatPrice — web and app must agree', () => {
  const cases = [0, 1, 45, 100, 45000, 11880, 66000, 119900, 159300, 377880, 900000, 1200000, 99999999]

  for (const paise of cases) {
    test(`${paise} paise`, () => {
      assert.equal(mobile(paise), web(paise), `drifted at ${paise}`)
    })
  }

  test('whole rupees print bare; paise print both digits', () => {
    assert.equal(web(45000), '₹450')
    assert.equal(web(11880), '₹118.80')
    assert.equal(web(377880), '₹3,778.80')
    assert.equal(web(1), '₹0.01')
  })

  test('never one decimal place — the bug this exists for', () => {
    for (const paise of cases) {
      const out = web(paise)
      const decimals = out.split('.')[1]
      assert.ok(decimals === undefined || decimals.length === 2, `${out} has a lone decimal`)
    }
  })
})
