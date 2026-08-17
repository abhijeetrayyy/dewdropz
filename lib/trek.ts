// What Trek Buddy knows about the kinds of outing, in one place.
//
// The database is the authority on what is legal — migration 053 has a CHECK
// per kind, and it will refuse anything that disagrees with this file. These
// are the same rules restated for the browser so a host is guided into a valid
// plan instead of being told off after submitting one, and so the quick-start
// buttons can prefill sensible hours.
//
// If the two ever drift, the database wins and the form shows its message.

export type TrekActivity =
  | 'trekking' | 'bird_watching' | 'cycling' | 'running' | 'stargazing' | 'camping'

export type DayPart = 'day' | 'evening' | 'overnight'

export type ActivitySpec = {
  key: TrekActivity
  label: string
  /** Shown on the quick-start button — what this outing actually is. */
  blurb: string
  dayPart: DayPart
  /** Earliest and latest permitted start, IST, matching the CHECK constraint. */
  startMin: string
  startMax: string
  /** Sensible defaults the quick-start button fills in. */
  defaultStart: string
  defaultBackBy: string
  /** True when the plan ends on the day after it starts. */
  endsNextDay: boolean
  /** People who must be going before the exact meeting point is released. */
  minParty: number
  /** Whether the host must write how everyone gets back in the dark. */
  needsNightNote: boolean
}

export const ACTIVITIES: ActivitySpec[] = [
  {
    key: 'trekking', label: 'Trekking', blurb: 'A day walk, out and back',
    dayPart: 'day', startMin: '04:30', startMax: '16:00',
    defaultStart: '07:00', defaultBackBy: '16:00',
    endsNextDay: false, minParty: 3, needsNightNote: false,
  },
  {
    key: 'bird_watching', label: 'Bird watching', blurb: 'Early start, slow pace',
    dayPart: 'day', startMin: '04:30', startMax: '16:00',
    // Birds are up before dawn and so is this, which is why the day window
    // starts at 04:30 rather than 06:00.
    defaultStart: '05:20', defaultBackBy: '09:00',
    endsNextDay: false, minParty: 3, needsNightNote: false,
  },
  {
    key: 'cycling', label: 'Cycling', blurb: 'On wheels, on road or trail',
    dayPart: 'day', startMin: '04:30', startMax: '16:00',
    defaultStart: '06:30', defaultBackBy: '12:00',
    endsNextDay: false, minParty: 3, needsNightNote: false,
  },
  {
    key: 'running', label: 'Running', blurb: 'Trail running, at a stated pace',
    dayPart: 'day', startMin: '04:30', startMax: '16:00',
    defaultStart: '06:00', defaultBackBy: '09:00',
    endsNextDay: false, minParty: 3, needsNightNote: false,
  },
  {
    key: 'stargazing', label: 'Stargazing', blurb: 'After dark, back the same night',
    dayPart: 'evening', startMin: '17:00', startMax: '22:00',
    defaultStart: '21:40', defaultBackBy: '00:30',
    endsNextDay: true, minParty: 4, needsNightNote: true,
  },
  {
    key: 'camping', label: 'Camping', blurb: 'One night out, back next morning',
    dayPart: 'overnight', startMin: '12:00', startMax: '19:00',
    defaultStart: '17:30', defaultBackBy: '11:00',
    endsNextDay: true, minParty: 4, needsNightNote: true,
  },
]

export const ACTIVITY_BY_KEY = Object.fromEntries(
  ACTIVITIES.map((a) => [a.key, a])
) as Record<TrekActivity, ActivitySpec>

// The Indian trekking market's vocabulary, and the proposal's: easy, moderate,
// difficult. `effort` (easy/moderate/hard) is the older column and is kept only
// so existing rows still read.
export const DIFFICULTY_LABEL: Record<string, string> = {
  easy: 'Easy', moderate: 'Moderate', difficult: 'Difficult',
}

/** How the whole party gets described in one word on a card. */
export const DAY_PART_LABEL: Record<DayPart, string> = {
  day: 'Daylight', evening: 'After dark', overnight: 'Overnight',
}

/**
 * The things a person should actually do before meeting strangers outdoors.
 *
 * Kept as data rather than prose baked into one page, because the same list has
 * to appear at three different moments — signing up, posting, and being
 * confirmed — and three drifting copies of safety guidance is how the wrong one
 * ends up being the one somebody reads.
 */
export const SAFETY_NOTES: { title: string; body: string }[] = [
  {
    title: 'Tell someone who is not coming',
    body: 'Before you set off, send a person at home the place, the start time and when you expect to be back. It is the single most useful thing you can do, and it costs one message.',
  },
  {
    title: 'Nobody here has been checked',
    body: 'DEWDROPZ does not verify identity, experience or fitness, and does not lead or supervise any of this. Treat everyone as what they are — a stranger on the internet who likes the outdoors.',
  },
  {
    title: 'Meet where there are people',
    body: 'The rendezvous should be a bus stand, a car park, a chai stall — somewhere public with others around. Walk in as a group from there. Never agree to be picked up alone from an isolated spot.',
  },
  {
    title: 'You can leave at any point',
    body: 'If the group, the pace or the weather feels wrong, turn back. You owe nobody an explanation, and no plan on this board is worth pushing through a bad feeling for.',
  },
  {
    title: 'Carry your own way out',
    body: 'Water, a layer, a charged phone and a torch, whatever the forecast says. Phone signal in these hills is unreliable, so do not plan around having it.',
  },
  {
    title: 'In an emergency, call 112',
    body: 'That is the national emergency number and it works from any phone. DEWDROPZ does not receive it and cannot help you on a hillside.',
  },
]

// ── The hour rail ────────────────────────────────────────────────────────────
//
// The one visual idea the board is built on: an outing is defined by when you
// leave. 05:20 and 21:40 are not two rows in a list, they are two completely
// different undertakings, and the board should say so before you read a word.
//
// So every plan carries a vertical bar coloured by its departure hour, and
// scanning the board reads as scanning a day — the early starts are indigo, the
// middle of the day is paper, the evening is clay, the dark is ink. It is the
// same day-arc the homepage hero already tells, reused as an index.
//
// Not decoration: it is the fastest possible answer to "is there anything early
// this week?", which is the question people actually arrive with.
export type HourLight = {
  key: 'predawn' | 'morning' | 'midday' | 'dusk' | 'night'
  label: string
  /** The rail itself. */
  bar: string
  /** Type colour that survives on the card's own ground. */
  ink: string
  /** A wash behind the card for the two ends of the day. */
  wash: string
}

const LIGHTS: Record<HourLight['key'], HourLight> = {
  predawn: { key: 'predawn', label: 'Before light', bar: '#2E3A56', ink: '#2E3A56', wash: 'rgba(46,58,86,0.05)' },
  morning: { key: 'morning', label: 'First light',  bar: '#7FA471', ink: '#3C6A33', wash: 'transparent' },
  midday:  { key: 'midday',  label: 'Full day',     bar: '#27481F', ink: '#27481F', wash: 'transparent' },
  dusk:    { key: 'dusk',    label: 'Last light',   bar: '#B8826B', ink: '#8A5A44', wash: 'rgba(184,130,107,0.06)' },
  night:   { key: 'night',   label: 'After dark',   bar: '#0C100D', ink: '#0C100D', wash: 'rgba(12,16,13,0.05)' },
}

/** Which light a departure falls in. Takes 'HH:MM' or 'HH:MM:SS'. */
export function lightForTime(time: string): HourLight {
  const h = Number(time.slice(0, 2))
  if (h < 6) return LIGHTS.predawn
  if (h < 9) return LIGHTS.morning
  if (h < 16) return LIGHTS.midday
  if (h < 19) return LIGHTS.dusk
  return LIGHTS.night
}
