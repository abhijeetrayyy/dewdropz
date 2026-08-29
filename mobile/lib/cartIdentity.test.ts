import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { sameLine, noSize } from './cartIdentity.ts'

describe('cart line identity', () => {
  test('THE BUG THIS GUARDS: the three spellings of "no size" are one line', () => {
    // Quick-add sent `undefined`, the product screen sent `""`, older carts
    // hold `null`. Comparing with === split one line into two rows of quantity
    // 1, neither showing a size, because "" is falsy.
    const base = { productId: 'p' }
    assert.ok(sameLine(base, { productId: 'p', size: undefined }))
    assert.ok(sameLine(base, { productId: 'p', size: '' }))
    assert.ok(sameLine(base, { productId: 'p', size: null }))
    assert.ok(sameLine({ productId: 'p', size: '' }, { productId: 'p', size: '   ' }))
  })

  test('a real size is still a distinct line', () => {
    assert.ok(sameLine({ productId: 'p', size: 'M' }, { productId: 'p', size: 'M' }))
    assert.ok(!sameLine({ productId: 'p', size: 'M' }, { productId: 'p', size: 'L' }))
    assert.ok(!sameLine({ productId: 'p', size: 'M' }, { productId: 'p' }))
  })

  test('different products never merge', () => {
    assert.ok(!sameLine({ productId: 'a', size: 'M' }, { productId: 'b', size: 'M' }))
  })

  test('a customised line only ever merges with itself', () => {
    assert.ok(!sameLine({ productId: 'p', customDesignId: 'd1' }, { productId: 'p' }))
    assert.ok(!sameLine({ productId: 'p', customDesignId: 'd1' }, { productId: 'p', customDesignId: 'd2' }))
    assert.ok(sameLine({ productId: 'p', customDesignId: 'd1' }, { productId: 'p', customDesignId: 'd1' }))
  })

  test('noSize collapses every empty spelling to one value', () => {
    assert.equal(noSize(undefined), null)
    assert.equal(noSize(null), null)
    assert.equal(noSize(''), null)
    assert.equal(noSize('  '), null)
    assert.equal(noSize('M'), 'M')
    assert.equal(noSize(' M '), 'M')
  })
})
