import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  costLabel, effortGloss, lightForTime, dotColor, hourInk, HOUR_BANDS,
} from './trek.ts'

// The pure layer of Trek Buddy.
//
// Eighty-two server actions, sixteen tables and thirty-four migrations rested on
// one test file about one function. These are the rest of the decisions that can
// be checked without a database — and every one of them has a note in the source
// saying which bug it was written to stop, so a regression here is a return of a
// bug somebody already paid for once.

describe('costLabel — the difference between free and unanswered', () => {
  // W-03. Six surfaces were rendering a missing cost as "Free" and "No cost",
  // which asserts on the host's behalf that a walk costs nothing when what
  // actually happened is that nobody asked and nobody said. On a board where
  // the taxi gets split at the trailhead, that is the difference between a
  // pleasant surprise and an argument in a car park.
  test('null is "not stated", never "free"', () => {
    const c = costLabel(null)
    assert.equal(c.stated, false)
    assert.equal(c.text, 'Not stated')
    assert.match(c.text, /not stated/i)
    assert.doesNotMatch(c.text, /free|no cost/i)
  })

  test('undefined behaves as null', () => {
    assert.deepEqual(costLabel(undefined), costLabel(null))
  })

  test('zero IS an answer, and says so differently', () => {
    const c = costLabel(0)
    assert.equal(c.stated, true, 'zero is a host answering "nothing", not a host staying silent')
    assert.equal(c.text, 'Nothing to split')
  })

  test('a real amount is a figure; the prose cases are not', () => {
    assert.equal(costLabel(35000).isFigure, true)
    assert.equal(costLabel(0).isFigure, false)
    assert.equal(costLabel(null).isFigure, false)
  })

  test('the short form stays short enough for a four-tag phone row', () => {
    // Measured in W-03: "₹350 each" put a four-tag row 20px over a 295px card
    // and the bare figure brought it 7px under.
    const c = costLabel(35000)
    assert.ok(c.short.length < c.text.length)
    assert.doesNotMatch(c.short, /each/)
  })

  test('an unstated cost renders nothing on a card', () => {
    // `short` is empty precisely so a compact surface draws no tag at all.
    assert.equal(costLabel(null).short, '')
  })
})

describe('effortGloss — Naismith, and when to keep quiet', () => {
  test('no distance means no guess', () => {
    assert.equal(effortGloss(null, 500), null)
    assert.equal(effortGloss(0, 500), null)
    assert.equal(effortGloss(undefined, undefined), null)
  })

  test('flat walking is one hour per 5km', () => {
    const g = effortGloss(10, 0)
    assert.ok(g)
    assert.match(g.total, /2 hours/)
    assert.equal(g.uphill, null, 'no climb means no uphill sentence')
  })

  test('climb is one hour per 600m, added on', () => {
    // 5km flat = 1h, 600m up = 1h, so about two hours with half of it uphill.
    const g = effortGloss(5, 600)
    assert.ok(g)
    assert.match(g.total, /2 hours/)
    assert.ok(g.uphill)
    assert.match(g.uphill, /an hour/)
  })

  test('every string hedges, because Naismith is an estimate', () => {
    const g = effortGloss(12, 900)
    assert.ok(g)
    assert.match(g.total, /^about /)
    assert.match(g.uphill!, /^roughly /)
  })

  test('a stroll gets no gloss at all', () => {
    // Under fifteen minutes there is nothing useful to say.
    assert.equal(effortGloss(0.5, 0), null)
  })

  test('minutes are rounded to five, never reported exactly', () => {
    // A walking estimate quoted to the minute claims a precision from 1892
    // that it does not have.
    for (const km of [1, 2.3, 3.7, 6.1, 9.4, 11.8]) {
      const g = effortGloss(km, 0)
      if (!g) continue
      const mins = g.total.match(/(\d+) minutes/)
      if (mins) assert.equal(Number(mins[1]) % 5, 0, `${km}km gave ${g.total}`)
    }
  })
})

describe('the hour system', () => {
  test('the five bands, at their boundaries', () => {
    assert.equal(lightForTime('04:59').key, 'predawn')
    assert.equal(lightForTime('05:00').key, 'dawn')
    assert.equal(lightForTime('07:59').key, 'dawn')
    assert.equal(lightForTime('08:00').key, 'day')
    assert.equal(lightForTime('16:59').key, 'day')
    assert.equal(lightForTime('17:00').key, 'dusk')
    assert.equal(lightForTime('19:59').key, 'dusk')
    assert.equal(lightForTime('20:00').key, 'night')
    assert.equal(lightForTime('23:59').key, 'night')
  })

  test('seconds are tolerated — Postgres time comes back as HH:MM:SS', () => {
    assert.equal(lightForTime('06:30:00').key, lightForTime('06:30').key)
  })

  test('no stated hour falls to dawn, because that is what multi-day trips do', () => {
    assert.equal(lightForTime(null).key, 'dawn')
    assert.equal(lightForTime(undefined).key, 'dawn')
    assert.equal(lightForTime('').key, 'dawn')
  })

  test('nonsense does not throw and does not return undefined', () => {
    assert.equal(lightForTime('not a time').key, 'dawn')
  })

  test('HOUR_BANDS runs in the order a day actually passes', () => {
    assert.deepEqual(
      HOUR_BANDS.map((b) => b.key),
      ['predawn', 'dawn', 'day', 'dusk', 'night']
    )
  })

  // THE BUG THIS GUARDS. `light.bg` is correct for four of the five bands and
  // wrong for night, which is exactly the kind of bug that ships: it looks fine
  // on every screen you check and vanishes on the one you do not.
  test('night is lifted on an ink ground, and only night', () => {
    const night = lightForTime('21:00')
    assert.notEqual(
      dotColor(night, 'dark'),
      night.bg,
      'night on dark must not be its own near-black background'
    )
    assert.equal(dotColor(night, 'light'), night.bg)

    for (const t of ['03:00', '06:00', '12:00', '18:00']) {
      const l = lightForTime(t)
      assert.equal(dotColor(l, 'dark'), l.bg, `${l.key} should not be lifted`)
      assert.equal(dotColor(l, 'light'), l.bg)
    }
  })

  test('hourInk swaps by ground for every band', () => {
    for (const b of HOUR_BANDS) {
      assert.equal(hourInk(b, 'dark'), b.color)
      assert.equal(hourInk(b, 'light'), b.ink)
    }
  })

  test('every band is a complete, usable token set', () => {
    for (const b of HOUR_BANDS) {
      for (const k of ['key', 'label', 'color', 'ink', 'tint', 'bg', 'fg', 'bar', 'onDark', 'wash'] as const) {
        assert.ok(b[k], `${b.key} is missing ${k}`)
      }
      assert.match(b.bg, /^#|^rgb/, `${b.key}.bg must be a colour`)
    }
  })
})
