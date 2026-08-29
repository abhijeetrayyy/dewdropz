import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  lifecycleOf, isJoinable, isCurrent, isFinished, askStateOf, isAnswerable,
  durationDays, dayNumber,
} from './trek-lifecycle.ts'

/**
 * The six-day trek, held to account.
 *
 * Every bug this module fixes had the same shape: a call site asked "has this
 * happened yet" and answered it with `starts_at`, which is only correct when a
 * trek lasts no time at all. These tests are written around one six-day trip,
 * because that is the case where an instant and an interval disagree.
 */

// Monday 06:00 IST → Saturday 18:00 IST.
const START = '2026-03-02T00:30:00.000Z'  // 06:00 IST Mon 2 Mar
const END   = '2026-03-07T12:30:00.000Z'  // 18:00 IST Sat 7 Mar
const TRIP = { starts_at: START, ends_at: END, status: 'open', hidden_at: null }

const at = (iso: string) => new Date(iso)
const BEFORE   = at('2026-03-01T12:00:00.000Z') // Sunday
const DAY_ONE  = at('2026-03-02T04:00:00.000Z') // Monday, after the 06:00 start
const DAY_FOUR = at('2026-03-05T06:00:00.000Z')
const AFTER    = at('2026-03-09T06:00:00.000Z') // Monday following

describe('the interval, not the instant', () => {
  test('before it leaves, it is upcoming', () => {
    assert.equal(lifecycleOf(TRIP, BEFORE), 'upcoming')
  })

  test('on the first morning it is under way — not finished', () => {
    // This is the bug. Eleven call sites compared `starts_at` and concluded a
    // trek that had just left was over.
    assert.equal(lifecycleOf(TRIP, DAY_ONE), 'under_way')
    assert.equal(isFinished(TRIP, DAY_ONE), false)
  })

  test('on day four, still under way', () => {
    assert.equal(lifecycleOf(TRIP, DAY_FOUR), 'under_way')
  })

  test('after the last evening it is finished', () => {
    assert.equal(lifecycleOf(TRIP, AFTER), 'finished')
  })

  test('cancelled and hidden outrank the clock', () => {
    assert.equal(lifecycleOf({ ...TRIP, status: 'cancelled' }, BEFORE), 'cancelled')
    assert.equal(lifecycleOf({ ...TRIP, hidden_at: '2026-01-01' }, BEFORE), 'hidden')
  })
})

describe('the party keeps its own trek while they are on it', () => {
  test('a trek under way is still current — this is what getMyTreks dropped', () => {
    // The six-day trip vanished from the host's and every joiner's dashboard at
    // 06:01 on day one, for the five days they were actually out.
    assert.equal(isCurrent(TRIP, DAY_ONE), true)
    assert.equal(isCurrent(TRIP, DAY_FOUR), true)
  })

  test('and drops off once it is genuinely over', () => {
    assert.equal(isCurrent(TRIP, AFTER), false)
  })
})

describe('joining stays closed once it has left', () => {
  test('joinable only before the start — matching the row trigger', () => {
    assert.equal(isJoinable(TRIP, BEFORE), true)
    assert.equal(isJoinable(TRIP, DAY_ONE), false, 'the trigger refuses this too')
    assert.equal(isJoinable(TRIP, AFTER), false)
  })
})

describe('a day walk still behaves like a day walk', () => {
  const WALK = { starts_at: START, ends_at: null, status: 'open', hidden_at: null }

  test('with no ends_at it is finished as soon as it starts', () => {
    // Rows written before 053 backfilled ends_at, and partial selects that did
    // not ask for it, must not become permanently under way.
    assert.equal(lifecycleOf(WALK, DAY_ONE), 'finished')
    assert.equal(durationDays(WALK), 1)
  })
})

describe('the ask that nobody answered', () => {
  test('while the trek is upcoming it is pending', () => {
    assert.equal(askStateOf('requested', TRIP, BEFORE), 'pending')
    assert.equal(isAnswerable('requested', TRIP, BEFORE), true)
  })

  test('once it sets off, an unanswered ask has lapsed', () => {
    // The trigger can no longer let it become confirmed, so calling it
    // "pending" is the interface lying to the person who asked.
    assert.equal(askStateOf('requested', TRIP, DAY_ONE), 'lapsed')
    assert.equal(askStateOf('requested', TRIP, AFTER), 'lapsed')
  })

  test('and the host is no longer offered a decision on it', () => {
    // The console rendered Confirm and Decline with no time check; Confirm then
    // raised "this trek has already started" from underneath.
    assert.equal(isAnswerable('requested', TRIP, AFTER), false)
  })

  test('a waitlisted ask lapses the same way', () => {
    assert.equal(askStateOf('waitlisted', TRIP, BEFORE), 'waitlisted')
    assert.equal(askStateOf('waitlisted', TRIP, AFTER), 'lapsed')
  })

  test('a decided ask keeps its decision forever', () => {
    for (const s of ['confirmed', 'declined', 'withdrawn', 'removed']) {
      assert.equal(askStateOf(s, TRIP, AFTER), s, `${s} must not be rewritten by time`)
    }
  })
})

describe('duration and the day you are on', () => {
  test('a six-day trip counts six days inclusively', () => {
    assert.equal(durationDays(TRIP), 6)
  })

  test('dayNumber is null unless it is actually under way', () => {
    assert.equal(dayNumber(TRIP, BEFORE), null)
    assert.equal(dayNumber(TRIP, AFTER), null)
  })

  test('day one is 1 and day four is 4', () => {
    assert.equal(dayNumber(TRIP, DAY_ONE), 1)
    assert.equal(dayNumber(TRIP, DAY_FOUR), 4)
  })

  test('dayNumber never exceeds the duration', () => {
    const lastEvening = at('2026-03-07T12:00:00.000Z')
    const n = dayNumber(TRIP, lastEvening)
    assert.ok(n !== null && n <= durationDays(TRIP), `got ${n}`)
  })
})
