import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { expandUnitCodes, MAX_UNITS_PER_PASTE } from './unitCodes.ts'

const ok = (input: string) => {
  const r = expandUnitCodes(input)
  assert.ok(r.ok, `expected ok, got: ${r.ok ? '' : r.error}`)
  return r.codes
}
const err = (input: string) => {
  const r = expandUnitCodes(input)
  assert.ok(!r.ok, 'expected a refusal')
  return r.error
}

describe('lists', () => {
  test('a single code is a list of one', () => {
    assert.deepEqual(ok('FST-001'), ['FST-001'])
  })

  test('commas, spaces, tabs and newlines all separate', () => {
    const expected = ['FST-001', 'FST-002', 'FST-003']
    assert.deepEqual(ok('FST-001, FST-002, FST-003'), expected)
    assert.deepEqual(ok('FST-001 FST-002 FST-003'), expected)
    assert.deepEqual(ok('FST-001\nFST-002\nFST-003'), expected)
    assert.deepEqual(ok('FST-001,,  FST-002 ,\n FST-003 '), expected)
  })

  test('nothing typed is a refusal, not an empty batch', () => {
    assert.match(err(''), /at least one/)
    assert.match(err('   ,  \n '), /at least one/)
  })
})

describe('ranges', () => {
  test('THE OFF-BY-ONE: 001..006 is six units, inclusive at both ends', () => {
    const codes = ok('FST-001..006')
    assert.equal(codes.length, 6)
    assert.deepEqual(codes, ['FST-001', 'FST-002', 'FST-003', 'FST-004', 'FST-005', 'FST-006'])
  })

  test('a range of one is one', () => {
    assert.deepEqual(ok('FST-003..003'), ['FST-003'])
  })

  test('the width comes from the START, so 001..6 means the same as 001..006', () => {
    assert.deepEqual(ok('FST-001..6'), ok('FST-001..006'))
  })

  test('an unpadded range stays unpadded', () => {
    assert.deepEqual(ok('T1..3'), ['T1', 'T2', 'T3'])
  })

  test('it carries across a width boundary without re-padding wrongly', () => {
    assert.deepEqual(ok('P-008..011'), ['P-008', 'P-009', 'P-010', 'P-011'])
  })

  test('a backwards range is refused rather than silently empty', () => {
    assert.match(err('FST-006..001'), /backwards/)
  })

  test('lists and ranges mix', () => {
    assert.deepEqual(ok('FST-001..003, CKK-001'), ['FST-001', 'FST-002', 'FST-003', 'CKK-001'])
  })
})

describe('the guards', () => {
  test('a runaway range is refused, not inserted', () => {
    const e = err('A-1..99999')
    assert.match(e, new RegExp(String(MAX_UNITS_PER_PASTE)))
  })

  test('too many codes in one paste is refused', () => {
    const many = Array.from({ length: MAX_UNITS_PER_PASTE + 1 }, (_, i) => `U-${i}`).join(',')
    assert.match(err(many), /most at once/)
  })

  test('exactly the maximum is allowed', () => {
    const many = Array.from({ length: MAX_UNITS_PER_PASTE }, (_, i) => `U-${i}`).join(',')
    assert.equal(ok(many).length, MAX_UNITS_PER_PASTE)
  })

  test('a duplicate is added once rather than failing the batch', () => {
    // (item_id, code) is UNIQUE; sending the same code twice would fail the
    // whole insert and lose the other five tents with it.
    assert.deepEqual(ok('FST-001, FST-001, FST-002'), ['FST-001', 'FST-002'])
    assert.deepEqual(ok('FST-001..003, FST-002'), ['FST-001', 'FST-002', 'FST-003'])
  })

  test('an absurdly long code is refused', () => {
    assert.match(err('X'.repeat(41)), /too long/)
  })
})
