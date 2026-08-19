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
    title: 'Nobody here has had their identity checked',
    body: 'The board does check some things, and is precise about which — none of them is identity, experience or fitness. DEWDROPZ does not lead or supervise any of this. Everyone here is still a stranger you met on the internet.',
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

// ── What the board actually does ─────────────────────────────────────────────
//
// The take-care notes above are things a walker has to do. These are things the
// board does, and they were nowhere on the site: the only statement it made
// about safety was that it checked nothing, which was both an overstatement of
// its own helplessness and the first thing a cautious person read.
//
// Every line here describes a rule enforced in Postgres, not an intention. They
// are written as what they stop, because a promise is only worth reading if you
// can tell what it would have prevented.
//
// Nothing aspirational goes in this list. If a rule is not enforced yet it does
// not appear, and the limits below carry the rest.
export const BOARD_CHECKS: { title: string; body: string }[] = [
  {
    title: 'The meeting point is withheld',
    body: 'The exact spot is never on the public page. It reaches confirmed walkers only once enough people are going, so a walk nobody joins hands its address to nobody.',
  },
  {
    title: 'The host chooses who comes',
    body: 'You ask; you are not added. Every walk is a person deciding who they will spend the day with, and that decision is the only vetting a board like this can honestly offer.',
  },
  {
    title: 'A host can set a bar to ask',
    body: 'A walk can be limited to people with a verified phone number, or to people two others have vouched for after actually walking with them. The database refuses the request; it is not a note asking politely.',
  },
  {
    title: 'A vouch has to be earned',
    body: 'You can only vouch for somebody you were confirmed alongside on a walk that has already happened. Two accounts cannot vouch for each other into credibility.',
  },
  {
    title: 'Women-only walks are enforced',
    body: 'Only a woman can post one, and only women can ask to join. This is checked when the request is written, not when the page is drawn.',
  },
  {
    title: 'Phone numbers stay off the board',
    body: 'Numbers, emails and handles are refused in every free-text field, and anything caught goes to a person to look at. Arrangements stay on the walk’s own page, which is what keeps them reviewable.',
  },
]

// The other half, and it is not the small print. Somebody deciding whether to
// rely on a badge needs to know exactly how far it reaches, and every line here
// is a limit a reasonable person would otherwise assume away.
export const BOARD_LIMITS: { title: string; body: string }[] = [
  {
    title: 'A verified phone is not a verified person',
    body: 'It proves somebody holds that SIM. Not their name, not their age, not that they are who the profile says. It makes a throwaway account cost money and effort, and that is the whole of the claim.',
  },
  {
    title: 'Women-only rests on a self-declared field',
    body: 'The board enforces the rule strictly, but it enforces it against what people said about themselves, because the alternative is collecting identity documents. Choose who you accept accordingly.',
  },
  {
    title: 'No one checks experience or fitness',
    body: 'Years out, altitude and pace on a profile are typed in by the person whose profile it is. A hard walk with a confident stranger is still a hard walk with a stranger.',
  },
  {
    title: 'DEWDROPZ is not on the walk',
    body: 'Nobody organises, leads, supervises or follows up on any of this, and no one is watching a screen while you are out. In an emergency, call 112.',
  },
]

// ── The hour rail ────────────────────────────────────────────────────────────
//
// The one visual idea the board is built on: an outing is defined by when you
// leave. 05:20 and 21:40 are not two rows in a list, they are two completely
// different undertakings, and the board should say so before you read a word.
//
// This is now the whole system rather than a stripe. One departure time drives
// SIX values, and between them they colour every surface the walk appears on:
//
//   color  — type and dots on an INK ground
//   ink    — type and dots on a PAPER ground
//   tint   — the foot of the photograph, so a sunrise card is warm and a
//            midnight one is cold before you have read the hour
//   bg/fg  — a filled pill, a meter segment, a timeline node
//   bar    — the rail down the side of a row (ink, night-substituted)
//
// Scanning the board is therefore scanning a day: indigo before light, amber at
// first light, green through the middle, clay at dusk, pale blue after dark.
//
// THE NIGHT PROBLEM, and why `dotColor` exists. Night's natural fill is #0C100D
// — the same near-black as the ink bands and the card scrims. Painted straight,
// a night walk's dot vanishes on a dark surface and its pill vanishes on a
// light one. So the substitution is a function, called at every site, rather
// than a ternary re-derived by hand in fifteen components:
//
//   on a light ground → #142536 (the blue hour, dark enough to read as night)
//   on a dark ground  → #C9D6EC (starlight, and the only pale value here)
export type HourGround = 'light' | 'dark'

export type HourLight = {
  key: 'predawn' | 'dawn' | 'day' | 'dusk' | 'night'
  label: string
  /** Type and dots on an ink ground. */
  color: string
  /** Type and dots on a paper ground. */
  ink: string
  /** The scrim over the foot of a photograph. */
  tint: string
  /** A filled pill, a meter segment, a timeline node. */
  bg: string
  /** Type on that fill. */
  fg: string

  // ── Kept from the first version so nothing has to migrate in one commit ──
  /** The rail down the side of a row. Night-substituted for paper. */
  bar: string
  /** The hour, legible on ink. Same value as `color`. */
  onDark: string
  /** A wash behind a card at the two ends of the day. */
  wash: string
}

const LIGHTS: Record<HourLight['key'], HourLight> = {
  // Every value is pulled back from the first pass, which took the prototype's
  // hues at full chroma and painted card feet and pill fills with them. At that
  // saturation the hour stopped being an index and became a mood: a board of
  // eight walks was eight different bright colours, which is a paint chart, not
  // information. These sit at roughly four-fifths of that, they are checked
  // against both grounds, and they are used SMALL — a dot, a 4px rail, a thin
  // meter fill, a bordered pill. The photograph is allowed to be the bright
  // thing on the card; the hour is allowed to be legible.
  predawn: {
    key: 'predawn', label: 'Before light',
    color: '#9FB1CE', ink: '#3A4A66', tint: 'rgba(24,34,52,0.72)',
    bg: '#2C3A54', fg: '#DCE4F0',
    bar: '#3A4A66', onDark: '#9FB1CE', wash: 'rgba(58,74,102,0.06)',
  },
  dawn: {
    key: 'dawn', label: 'First light',
    color: '#D9A560', ink: '#8A5A17', tint: 'rgba(122,80,28,0.55)',
    bg: '#A76F1E', fg: '#FBF3E4',
    bar: '#8A5A17', onDark: '#D9A560', wash: 'rgba(167,111,30,0.06)',
  },
  day: {
    key: 'day', label: 'Full day',
    color: '#8FB394', ink: '#1F4A2E', tint: 'rgba(24,58,36,0.55)',
    bg: '#1F4A2E', fg: '#F2F7F3',
    bar: '#1F4A2E', onDark: '#8FB394', wash: 'rgba(31,74,46,0.05)',
  },
  dusk: {
    key: 'dusk', label: 'Last light',
    color: '#C09A85', ink: '#7A5140', tint: 'rgba(96,64,50,0.6)',
    bg: '#8A5D48', fg: '#F7EFEA',
    bar: '#7A5140', onDark: '#C09A85', wash: 'rgba(122,81,64,0.06)',
  },
  night: {
    key: 'night', label: 'After dark',
    color: '#B9C4D8', ink: '#22303F', tint: 'rgba(14,18,22,0.78)',
    bg: '#1A222D', fg: '#D7DEE9',
    bar: '#22303F', onDark: '#B9C4D8', wash: 'rgba(26,34,45,0.05)',
  },
}

/**
 * Which light a departure falls in. Takes 'HH:MM' or 'HH:MM:SS'.
 *
 * The boundaries are the design's, not the clock's: 05:00 is when the sky in
 * the foothills starts to go, 08:00 is when the light stops being an event,
 * 17:00 is when it starts being one again, 20:00 is dark.
 */
export function lightForTime(time: string | null | undefined): HourLight {
  // A walk with no stated hour is almost always a multi-day one, and those
  // leave in the morning. 06:00 puts it in `dawn`, which is honest.
  const h = Number((time ?? '06:00').slice(0, 2))
  if (Number.isNaN(h)) return LIGHTS.dawn
  if (h < 5) return LIGHTS.predawn
  if (h < 8) return LIGHTS.dawn
  if (h < 17) return LIGHTS.day
  if (h < 20) return LIGHTS.dusk
  return LIGHTS.night
}

/** Every band, in the order a day passes. For the day-arc index. */
export const HOUR_BANDS: HourLight[] = [
  LIGHTS.predawn, LIGHTS.dawn, LIGHTS.day, LIGHTS.dusk, LIGHTS.night,
]

/**
 * A solid fill that will actually be visible on the ground you are painting on.
 *
 * Use this for every dot, meter segment, timeline node and pill fill. Calling
 * `light.bg` directly is a bug for night, and only for night, which is exactly
 * the kind of bug that ships.
 */
export function dotColor(light: HourLight, ground: HourGround): string {
  // Night's fill is a deep slate rather than the near-black it used to be, so
  // it no longer disappears into an ink band — but it is still the one band
  // dark enough to need lifting when it lands on one.
  if (light.key !== 'night') return light.bg
  return ground === 'dark' ? '#8797AE' : light.bg
}

/** Type colour for the hour, on whichever ground it lands. */
export function hourInk(light: HourLight, ground: HourGround): string {
  return ground === 'dark' ? light.color : light.ink
}

/** The scrim laid over the foot of a photograph, so the card carries its hour. */
export function scrimForHour(light: HourLight, from = 40): string {
  return `linear-gradient(180deg, transparent ${from}%, ${light.tint} 100%)`
}

/**
 * The field a card falls back to when the host has not given a photograph.
 *
 * Deliberately handsome rather than apologetic: a board of coverless walks
 * should still look composed, so a host is tempted into adding a picture rather
 * than shamed into it.
 */
export function coverlessField(light: HourLight): string {
  // Mixed most of the way to ink rather than used at full strength. A card
  // with no photograph should read as a quiet field in the hour's colour, not
  // as the loudest tile on the board — which is what happened when the raw
  // hue ran to 0%: a coverless dawn walk out-shouted six real photographs.
  return `linear-gradient(158deg, color-mix(in srgb, ${light.bar} 48%, #101311) 0%, #101311 74%)`
}
