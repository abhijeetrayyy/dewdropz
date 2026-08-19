import type { TrekPlanRow } from '@/actions/trekBuddy'
import { DAY_ARC } from '@/lib/constants'

// Fabricated walks, for looking at the design with.
//
// The board is new and empty, and an empty board cannot tell you whether a
// card works — whether the seat meter reads at a glance, whether a 05:10 walk
// and a 21:40 one are obviously different objects, whether a coverless walk
// still looks composed. This is the fixture that answers those questions.
//
// It is DATA ONLY and it is never written anywhere. `/trek-buddy/preview`
// renders it and returns a 404 outside development, so nothing here can reach
// a member, a crawler or the database.
//
// Every field is shaped exactly like a real `trek_plans` row, so if the row
// changes shape this file stops compiling — which is the point of putting it
// in TypeScript rather than in a JSON blob nobody type-checks.

/** N days from now, at the given IST hour, as the row's two stored forms. */
function when(days: number, hhmm: string) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const [h, m] = hhmm.split(':').map(Number)
  // The stored instant is IST; the server may be anywhere, so it is built from
  // the offset rather than from the local clock.
  const day = d.toISOString().slice(0, 10)
  const at = new Date(`${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+05:30`)
  return { on: day, at: at.toISOString() }
}

type Seed = {
  id: string
  host: [string, string]
  activity: string
  label: string
  place: string
  meet: string
  inDays: number
  start: string
  back: string
  cap: number
  going: number
  difficulty: 'easy' | 'moderate' | 'difficult'
  km: number | null
  gain: number | null
  cost: number | null
  cover?: string
  women?: boolean
  senior?: boolean
  note?: string
}

const SEEDS: Seed[] = [
  {
    id: 'pv-nag-tibba', host: ['h-aarav', 'Aarav Mehta'],
    activity: 'trekking', label: 'Trekking', place: 'Nag Tibba', meet: 'Dehradun ISBT',
    inDays: 1, start: '05:10', back: '17:30', cap: 12, going: 9,
    difficulty: 'moderate', km: 16, gain: 1100, cost: 35000, cover: DAY_ARC.firstLight,
    note: 'Out of the treeline by headlamp, summit for first light, maggi at the temple hut on the way down. Shared cab from ISBT, roughly ₹300 each way.',
  },
  {
    id: 'pv-benog', host: ['h-meera', 'Meera Joshi'],
    activity: 'bird_watching', label: 'Bird watching', place: 'Benog Wildlife Sanctuary',
    meet: 'Mussoorie Library', inDays: 2, start: '05:40', back: '09:15', cap: 8, going: 5,
    difficulty: 'easy', km: 6, gain: 220, cost: null, cover: DAY_ARC.firstLightPair,
    senior: true,
    note: 'Slow pace, a lot of standing still. Bring binoculars if you have them and a flask if you feel the cold.',
  },
  {
    id: 'pv-kanatal', host: ['h-priya', 'Priya Negi'],
    activity: 'camping', label: 'Camping', place: 'Kanatal Ridge', meet: 'Chamba Bypass',
    inDays: 5, start: '17:30', back: '11:00', cap: 10, going: 10,
    difficulty: 'moderate', km: 9, gain: 480, cost: 90000, cover: DAY_ARC.basecamp,
    note: 'One night out. Carry your own bag and a warm layer more than you think you need — it drops fast after the light goes.',
  },
  {
    id: 'pv-mussoorie-stars', host: ['h-rohan', 'Rohan Bisht'],
    activity: 'stargazing', label: 'Stargazing', place: 'George Everest', meet: 'Hathipaon',
    inDays: 3, start: '21:40', back: '00:30', cap: 6, going: 2,
    difficulty: 'easy', km: 4, gain: 160, cost: null,
    note: 'Perseids are still going. Red torches only once we are up — it takes twenty minutes to get your eyes back.',
  },
  {
    id: 'pv-sahastradhara', host: ['h-ananya', 'Ananya Rawat'],
    activity: 'running', label: 'Trail running', place: 'Sahastradhara loop',
    meet: 'Sahastradhara car park', inDays: 4, start: '06:00', back: '08:30', cap: 8, going: 3,
    difficulty: 'difficult', km: 14, gain: 620, cost: null, women: true,
    note: 'Steady 6:30/km on the flat, walking the steep bits. Nobody gets dropped.',
  },
  {
    id: 'pv-rajaji', host: ['h-devika', 'Devika Sharma'],
    activity: 'cycling', label: 'Cycling', place: 'Rajaji fire line', meet: 'Clock Tower',
    inDays: 9, start: '06:30', back: '12:00', cap: 10, going: 4,
    difficulty: 'moderate', km: 42, gain: 380, cost: 12000, cover: DAY_ARC.theWayDown,
  },
  {
    id: 'pv-mist', host: ['h-kabir', 'Kabir Thapa'],
    activity: 'trekking', label: 'Trekking', place: 'Chandrabani mist walk',
    meet: 'Prem Nagar', inDays: 11, start: '04:40', back: '10:00', cap: 14, going: 6,
    difficulty: 'easy', km: 8, gain: 240, cost: null, cover: DAY_ARC.theStart,
  },
  {
    id: 'pv-ridge', host: ['h-imran', 'Imran Qureshi'],
    activity: 'trekking', label: 'Trekking', place: 'Nagtibba to Pantwari traverse',
    meet: 'Pantwari', inDays: 16, start: '07:00', back: '16:00', cap: 9, going: 1,
    difficulty: 'difficult', km: 21, gain: 1450, cost: 55000, cover: DAY_ARC.theRidge,
  },
]

export const PREVIEW_PLANS: TrekPlanRow[] = SEEDS.map((s) => {
  const t = when(s.inDays, s.start)
  const back = when(s.inDays, s.back)
  const overnight = s.back < s.start
  return {
    id: s.id,
    host_id: s.host[0],
    host_name: s.host[1],
    activity: s.activity,
    activity_other: null,
    activity_label: s.label,
    place: s.place,
    meet_area: s.meet,
    starts_on: t.on,
    ends_on: overnight ? back.on : t.on,
    start_time: s.start,
    back_by: s.back,
    starts_at: t.at,
    ends_at: back.at,
    day_part: s.activity === 'camping' ? 'overnight' : s.activity === 'stargazing' ? 'evening' : 'day',
    min_party: s.activity === 'camping' || s.activity === 'stargazing' ? 4 : 3,
    night_note: null,
    capacity: s.cap,
    going_count: s.going,
    spots_left: Math.max(s.cap - s.going, 0),
    effort: s.difficulty === 'difficult' ? 'hard' : s.difficulty,
    difficulty: s.difficulty,
    women_only: Boolean(s.women),
    senior_friendly: Boolean(s.senior),
    languages: ['Hindi', 'English'],
    cover_urls: s.cover ? [s.cover] : [],
    distance_km: s.km,
    gain_m: s.gain,
    cost_paise: s.cost,
    bring: ['Two litres of water', 'A warm layer', 'A head torch', 'Something to eat'],
    itinerary: [
      { at: s.start, label: 'Meet and set off', detail: 'Roll call, then straight on to the trail.' },
      { at: '07:20', label: 'Out of the treeline', detail: 'First proper view, and the wind finds you.' },
      { at: '09:30', label: 'Top', detail: 'Twenty minutes up there, no more — it gets cold standing still.' },
      { at: s.back, label: 'Back at the cars' },
    ],
    is_live: false,
    note: s.note ?? null,
    status: 'open',
    cancelled_at: null,
    cancel_reason: null,
    hidden_at: null,
  } as TrekPlanRow
})

export const PREVIEW_PEOPLE = [
  { id: 'h-meera', name: 'Meera Joshi', base: 'Dehradun', mentor: true, events: 38, vouches: 23, streak: 6, pace: 'steady', intro: 'Twelve years of the same three hills. I will not race you and I will not leave you.' },
  { id: 'h-aarav', name: 'Aarav Mehta', base: 'Dehradun', mentor: false, events: 31, vouches: 19, streak: 4, pace: 'brisk', intro: 'Early starts, honest gradients, back before the heat.' },
  { id: 'h-priya', name: 'Priya Negi', base: 'Chamba', mentor: true, events: 27, vouches: 21, streak: 3, pace: 'steady', intro: 'Overnights mostly. I carry the stove, you carry the stories.' },
  { id: 'h-rohan', name: 'Rohan Bisht', base: 'Mussoorie', mentor: false, events: 14, vouches: 9, streak: 2, pace: 'slow', intro: 'After dark. I know where the light pollution stops.' },
  { id: 'h-ananya', name: 'Ananya Rawat', base: 'Dehradun', mentor: false, events: 22, vouches: 12, streak: 8, pace: 'brisk', intro: 'Trail running, women-only, no drop policy.' },
  { id: 'h-kabir', name: 'Kabir Thapa', base: 'Rishikesh', mentor: false, events: 11, vouches: 6, streak: 1, pace: 'steady', intro: 'New to hosting. Walks I was going on anyway.' },
]
