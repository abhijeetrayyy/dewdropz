#!/usr/bin/env node
/**
 * Demo walks for the Trek Buddy board.
 *
 * The board is real and it is empty, which makes it impossible to look at: a
 * seat meter with nothing in it, a face pile with no faces and a day arc with
 * five zeroes tell you nothing about whether the design works. This fills it
 * with enough of a board to judge — walks across every hour band, rosters with
 * people on them, a queue of requests waiting on you, and a walk that is full.
 *
 * EVERYTHING IT WRITES IS REVERSIBLE AND MARKED.
 *
 *   node scripts/seed-trek-demo.mjs          seed (idempotent — re-running
 *                                            replaces the walks, not the people)
 *   node scripts/seed-trek-demo.mjs --undo   remove every trace of it
 *
 * The mark is the email domain: every demo member is `demo-<name>@dewdropz.test`,
 * which matches the convention already in this database and can never collide
 * with a real address. Undo deletes those auth users, and `trek_plans.host_id`
 * references `profiles(id) ON DELETE CASCADE`, so their walks, rosters,
 * requests, meeting points and vouches all go with them in one step.
 *
 * It refuses to run against anything that looks like production — see the guard
 * below. Seeding a live board with invented people would be considerably worse
 * than an empty one.
 */
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APP = process.env.NEXT_PUBLIC_APP_URL ?? ''

if (!URL || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

// The guard. `--force` exists so a deliberate run against a staging URL is
// possible, but it has to be typed on purpose.
if (!APP.includes('localhost') && !process.argv.includes('--force')) {
  console.error(
    `Refusing to run: NEXT_PUBLIC_APP_URL is "${APP}", which is not localhost.\n` +
    `This writes invented people and walks. Pass --force only if you are certain.`
  )
  process.exit(1)
}

const db = createClient(URL, KEY, { auth: { persistSession: false } })
const UNDO = process.argv.includes('--undo')
const DOMAIN = 'dewdropz.test'
const PREFIX = 'demo-'

// ── The people ───────────────────────────────────────────────────────────────
// Deliberately not seven variations of the same person. The board's whole claim
// is that it is legible to a beginner, to a woman weighing up a 4am cab, to
// somebody in their sixties and to somebody with twenty years on the hill — so
// the demo roster has all four, and the screens have to hold up for each.
const PEOPLE = [
  {
    slug: 'meera', name: 'Meera Joshi', gender: 'woman', base: 'Dehradun',
    dob: '1986-07-14', pace: 'steady', experience: 'seasoned', years: 12, mentor: true,
    intro: 'Twelve years of the same three hills. I will not race you and I will not leave you behind — if you are the slowest on the day, you walk with me.',
    activities: ['trekking', 'bird_watching', 'forest_walk'],
    languages: ['Hindi', 'English', 'Garhwali'],
    carries: ['First aid kit', 'Spare torch', 'Extra water'],
    highest: 4600, days: ['sat', 'sun'],
  },
  {
    slug: 'aarav', name: 'Aarav Mehta', gender: 'man', base: 'Dehradun',
    dob: '1994-02-02', pace: 'brisk', experience: 'seasoned', years: 8, mentor: false,
    intro: 'Early starts, honest gradients, back before the heat. I say what a walk actually is — if I have called it difficult, it is difficult.',
    activities: ['trekking', 'running', 'sunrise_point'],
    languages: ['Hindi', 'English'],
    carries: ['Headlamp', 'Power bank'],
    highest: 5100, days: ['sat', 'sun'],
  },
  {
    slug: 'priya', name: 'Priya Negi', gender: 'woman', base: 'Chamba',
    dob: '1990-11-23', pace: 'steady', experience: 'seasoned', years: 9, mentor: true,
    intro: 'Overnights mostly. I carry the stove and I check everyone has a warm layer before we leave the road — it gets cold faster than people expect.',
    activities: ['camping', 'trekking', 'stargazing'],
    languages: ['Hindi', 'Garhwali'],
    carries: ['Stove', 'Spare warm layer', 'First aid kit'],
    highest: 4200, days: ['fri', 'sat'],
  },
  {
    slug: 'rohan', name: 'Rohan Bisht', gender: 'man', base: 'Mussoorie',
    dob: '1997-05-09', pace: 'steady', experience: 'some', years: 4, mentor: false,
    intro: 'After dark. I know where the light pollution stops and I will not take a group anywhere I have not walked in daylight first.',
    activities: ['stargazing', 'night_walk', 'photography'],
    languages: ['Hindi', 'English'],
    carries: ['Red torch', 'Spare batteries'],
    highest: 2800, days: ['fri', 'sat'],
  },
  {
    slug: 'ananya', name: 'Ananya Rawat', gender: 'woman', base: 'Dehradun',
    dob: '1993-09-30', pace: 'brisk', experience: 'seasoned', years: 7, mentor: false,
    intro: 'Trail running, women only, no-drop. We regroup at every junction and nobody finishes alone.',
    activities: ['running', 'trekking'],
    languages: ['Hindi', 'English'],
    carries: ['First aid kit', 'Whistle'],
    highest: 3400, days: ['sun'],
  },
  {
    slug: 'devika', name: 'Devika Sharma', gender: 'woman', base: 'Dehradun',
    dob: '1959-04-18', pace: 'steady', experience: 'veteran', years: 20, mentor: true,
    intro: 'Sixty-seven, and still out most weekends. I post walks that suit knees like mine — short days, real breaks, a road never far away.',
    activities: ['heritage_walk', 'forest_walk', 'bird_watching'],
    languages: ['Hindi', 'English'],
    carries: ['Walking poles', 'First aid kit'],
    highest: 3100, days: ['sat', 'sun'],
  },
  {
    slug: 'kabir', name: 'Kabir Thapa', gender: 'man', base: 'Rishikesh',
    dob: '2001-01-12', pace: 'steady', experience: 'new', years: 1, mentor: false,
    intro: 'Started last winter and have not stopped. Still learning — I ask a lot of questions and I would rather turn back early than push it.',
    activities: ['trekking', 'waterfall', 'monsoon_walk'],
    languages: ['Hindi', 'English', 'Nepali'],
    carries: ['Rain shell'],
    highest: 3800, days: ['sun'],
  },
]

const KIND = {
  trekking: { min: 3, night: false },
  bird_watching: { min: 3, night: false },
  running: { min: 3, night: false },
  camping: { min: 4, night: true },
  stargazing: { min: 4, night: true },
  sunrise_point: { min: 3, night: false },
  heritage_walk: { min: 3, night: false },
  forest_walk: { min: 3, night: false },
  photography: { min: 3, night: false },
  night_walk: { min: 4, night: true },
  waterfall: { min: 3, night: false },
}

const IMG = (id) => `https://images.unsplash.com/photo-${id}?w=1600&q=80&auto=format&fit=crop`
const COVERS = {
  headlamp: IMG('1551632811-561732d1e306'),
  ridgeDawn: IMG('1464822759023-fed622ff2c3b'),
  pair: IMG('1454372182658-c712e4c5a1db'),
  ridgeWalk: IMG('1506197603052-3cc9c3a201bd'),
  descent: IMG('1533240332313-0db49b459ad6'),
  camp: IMG('1504280390367-361c6d9f38f4'),
  lake: IMG('1501555088652-021faa106b9b'),
  mist: IMG('1470071459604-3b5ec3a7fe05'),
}

/** N days from today, as an IST calendar date. */
function dayFromNow(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

// ── The walks ────────────────────────────────────────────────────────────────
// Spread deliberately: across all five hour bands so the day arc has something
// in every column, across the next three weeks so every bucket fills, two
// inside 48 hours so the leaving-soon rail exists, one full so the waitlist
// state is visible, and a mix of women-only, senior-friendly and cost-share so
// the provisions the product is built around are actually on screen.
const WALKS = [
  {
    host: 'aarav', activity: 'trekking', place: 'Nag Tibba',
    meet: 'Dehradun ISBT', region: 'Uttarakhand',
    inDays: 1, start: '05:10', back: '17:30', cap: 8, difficulty: 'moderate',
    km: 16, gain: 1100, cost: 35000, cover: COVERS.ridgeDawn,
    note: 'Out of the treeline by headlamp, summit for first light, maggi at the temple hut on the way down. Shared cab from ISBT, roughly ₹300 each way.',
    bring: ['Two litres of water', 'A warm layer', 'A head torch', 'Lunch'],
    itinerary: [
      { at: '05:10', label: 'Meet at ISBT gate 2', detail: 'Behind the tea stall. We leave at 05:20 whether or not everyone is there.' },
      { at: '07:30', label: 'Pantwari, and we start walking' },
      { at: '10:15', label: 'Summit', detail: 'Twenty minutes, no more — it is cold standing still.' },
      { at: '17:30', label: 'Back at the cars' },
    ],
    point: 'Gate 2, Dehradun ISBT — behind the tea stall',
    logistics: 'Shared cab to Pantwari, roughly ₹300 each way, split at face value.',
    confirmed: ['meera', 'kabir', 'priya'],
  },
  {
    host: 'meera', activity: 'bird_watching', place: 'Benog Wildlife Sanctuary',
    meet: 'Mussoorie Library', region: 'Uttarakhand',
    inDays: 2, start: '05:40', back: '09:15', cap: 6, difficulty: 'easy',
    km: 6, gain: 220, cost: null, cover: COVERS.mist, senior: true,
    note: 'Slow pace and a lot of standing still. Bring binoculars if you have them, and a flask if you feel the cold — we stop for twenty minutes at the water tank.',
    bring: ['Binoculars if you have them', 'A flask', 'Something to sit on'],
    itinerary: [
      { at: '05:40', label: 'Meet at the Library bus stand' },
      { at: '06:15', label: 'Barrier, and in on foot', detail: 'Quiet from here — this is the whole point.' },
      { at: '09:15', label: 'Back at the road' },
    ],
    point: 'Mussoorie Library bus stand, by the ticket window',
    logistics: 'Walk in from the barrier. No vehicles past it.',
    confirmed: ['devika', 'kabir'],
  },
  {
    host: 'devika', activity: 'heritage_walk', place: 'Old Mussoorie, end to end',
    meet: 'Picture Palace', region: 'Uttarakhand',
    inDays: 4, start: '09:00', back: '13:00', cap: 8, difficulty: 'easy',
    km: 5, gain: 160, cost: null, cover: COVERS.descent, senior: true,
    note: 'Flat where I can find flat, and we sit down properly twice. Anyone who wants to turn back early can — the road is never more than ten minutes away.',
    bring: ['Walking shoes', 'A hat', 'Water'],
    itinerary: [
      { at: '09:00', label: 'Picture Palace' },
      { at: '10:30', label: 'Sit-down at the bakery', detail: 'A proper twenty minutes, not a photo stop.' },
      { at: '13:00', label: 'Back where we started' },
    ],
    point: 'Picture Palace, under the clock',
    logistics: 'All on tarmac. Taxis available at both ends if you want to stop.',
    confirmed: ['meera'],
  },
  {
    host: 'ananya', activity: 'running', place: 'Sahastradhara loop',
    meet: 'Sahastradhara car park', region: 'Uttarakhand',
    inDays: 5, start: '06:00', back: '08:30', cap: 6, difficulty: 'difficult',
    km: 14, gain: 620, cost: null, cover: COVERS.pair, women: true,
    note: 'Steady 6:30/km on the flat, walking the steep bits. We regroup at every junction and nobody finishes alone.',
    bring: ['Trail shoes', 'A soft flask', 'Something with sugar in it'],
    itinerary: [
      { at: '06:00', label: 'Car park, warm up together' },
      { at: '06:15', label: 'Off, and first regroup at the second bridge' },
      { at: '08:30', label: 'Back at the cars' },
    ],
    point: 'Sahastradhara main car park, by the gate',
    logistics: 'Park anywhere along the road. No cost.',
    confirmed: ['meera', 'priya'],
  },
  {
    host: 'priya', activity: 'camping', place: 'Kanatal Ridge',
    meet: 'Chamba Bypass', region: 'Uttarakhand',
    inDays: 6, start: '17:30', back: '11:00', cap: 6, difficulty: 'moderate',
    km: 9, gain: 480, cost: 90000, cover: COVERS.camp,
    note: 'One night out. Carry your own bag and one warm layer more than you think you need — it drops fast once the light goes.',
    night: 'We are up before it is dark and nobody walks down at night. If the weather turns we stay put until first light and walk out in daylight.',
    bring: ['Sleeping bag', 'Warm layer', 'Head torch', 'Two litres of water'],
    itinerary: [
      { at: '17:30', label: 'Chamba Bypass, load up' },
      { at: '19:00', label: 'Camp, tents up before dark' },
      { at: '06:30', label: 'First light on the ridge' },
      { at: '11:00', label: 'Back at the road' },
    ],
    point: 'Chamba Bypass, at the fruit stall',
    logistics: 'Shared jeep, ₹900 a head covers the jeep and the site fee.',
    confirmed: ['meera', 'aarav', 'rohan', 'kabir'], // fills it
  },
  {
    host: 'rohan', activity: 'stargazing', place: 'George Everest',
    meet: 'Hathipaon', region: 'Uttarakhand',
    inDays: 3, start: '21:40', back: '00:30', cap: 6, difficulty: 'easy',
    km: 4, gain: 160, cost: null,
    note: 'Perseids are still going. Red torches only once we are up — it takes twenty minutes to get your night vision back and one white beam costs it for everybody.',
    night: 'We walk down together on the same track we came up, all torches on, nobody ahead and nobody behind.',
    bring: ['A red torch', 'A warm layer', 'Something to lie on'],
    itinerary: [
      { at: '21:40', label: 'Hathipaon, last turning' },
      { at: '22:20', label: 'Up top, lights off' },
      { at: '00:30', label: 'Back at the cars, together' },
    ],
    point: 'Hathipaon, the last turning before the estate gate',
    logistics: 'Drive up. Park facing downhill.',
    confirmed: ['aarav'],
  },
  {
    host: 'kabir', activity: 'waterfall', place: 'Neer Garh falls',
    meet: 'Laxman Jhula', region: 'Uttarakhand',
    inDays: 9, start: '07:30', back: '13:00', cap: 8, difficulty: 'easy',
    km: 5, gain: 260, cost: 12000, cover: COVERS.lake,
    note: 'Short walk up to the water and back. I have done this one four times — it is the walk I would take somebody on their first day out.',
    bring: ['Water', 'A towel', 'Shoes you do not mind getting wet'],
    itinerary: [
      { at: '07:30', label: 'Laxman Jhula, east side' },
      { at: '09:00', label: 'Upper falls' },
      { at: '13:00', label: 'Back down' },
    ],
    point: 'Laxman Jhula, east side, by the first chai stall',
    logistics: 'Entry ticket ₹120 each, paid at the gate.',
    confirmed: ['devika'],
  },
  {
    host: 'meera', activity: 'sunrise_point', place: 'Flag Hill, before light',
    meet: 'Dhanaulti', region: 'Uttarakhand',
    inDays: 12, start: '04:30', back: '09:00', cap: 7, difficulty: 'moderate',
    km: 8, gain: 540, cost: 25000, cover: COVERS.headlamp,
    note: 'Up in the dark so we are on the top before the sun is. Head torch is not optional on this one.',
    bring: ['Head torch', 'Warm layer', 'Breakfast for the top'],
    itinerary: [
      { at: '04:30', label: 'Dhanaulti, and straight up' },
      { at: '06:05', label: 'On the top for first light' },
      { at: '09:00', label: 'Back down' },
    ],
    point: 'Dhanaulti eco-park gate',
    logistics: 'Shared cab from Dehradun, ₹250 each way.',
    confirmed: ['ananya', 'aarav'],
  },
  {
    host: 'aarav', activity: 'trekking', place: 'Nagtibba to Pantwari traverse',
    meet: 'Pantwari', region: 'Uttarakhand',
    inDays: 17, start: '06:00', back: '16:00', cap: 8, difficulty: 'difficult',
    km: 21, gain: 1450, cost: 55000, cover: COVERS.ridgeWalk,
    note: 'A long day, and I mean long. If 21 km with 1,450 m of climb is more than you have done, this is not the one to find out on — I post an easier version most months.',
    bring: ['Three litres of water', 'Lunch and snacks', 'Warm layer', 'Head torch'],
    itinerary: [
      { at: '06:00', label: 'Pantwari' },
      { at: '10:00', label: 'Ridge' },
      { at: '16:00', label: 'Down at the road' },
    ],
    point: 'Pantwari village, by the school',
    logistics: 'Jeep both ways, ₹550 a head.',
    confirmed: ['priya'],
  },
  {
    host: 'devika', activity: 'forest_walk', place: 'Rajaji, the quiet side',
    meet: 'Mohand', region: 'Uttarakhand',
    inDays: 20, start: '07:00', back: '11:00', cap: 8, difficulty: 'easy',
    km: 7, gain: 180, cost: null, cover: COVERS.mist, senior: true,
    note: 'No summit, no hurry. We walk in the trees for four hours and stop whenever somebody wants to look at something.',
    bring: ['Water', 'Full sleeves', 'Insect repellent'],
    itinerary: [
      { at: '07:00', label: 'Mohand checkpost' },
      { at: '11:00', label: 'Back out the same way' },
    ],
    point: 'Mohand forest checkpost',
    logistics: 'Own transport. Nothing to pay.',
    confirmed: [],
  },
]

// ── What already happened ────────────────────────────────────────────────────
// Every trust figure on this product is counted from completed walks: the
// vouches on a profile, the "walks joined" on a card, the rung that decides who
// may ask to come. All of it is refused unless the walk is in the past — the
// database is explicit about it ("you can vouch for someone after the walk, not
// before"), which is exactly the rule the product advertises.
//
// So the demo needs a history, or every member reads as somebody who has never
// been anywhere and the whole trust model renders as a row of zeroes.
const HISTORY = [
  {
    host: 'meera', activity: 'trekking', place: 'Nag Tibba, in the mist',
    meet: 'Dehradun ISBT', region: 'Uttarakhand',
    agoDays: 12, start: '05:30', back: '17:00', cap: 8, difficulty: 'moderate',
    km: 16, gain: 1100, cost: 30000, cover: COVERS.mist,
    note: 'Cloud the whole way up and then twenty minutes of clear sky at the top. Worth it.',
    bring: ['Water', 'Warm layer', 'Head torch'],
    itinerary: [{ at: '05:30', label: 'ISBT' }, { at: '17:00', label: 'Back' }],
    point: 'Gate 2, Dehradun ISBT',
    logistics: 'Shared cab, ₹300 each way.',
    confirmed: ['aarav', 'kabir', 'priya', 'devika'],
  },
  {
    host: 'aarav', activity: 'sunrise_point', place: 'Kanatal, first light',
    meet: 'Chamba', region: 'Uttarakhand',
    agoDays: 26, start: '04:40', back: '10:00', cap: 6, difficulty: 'easy',
    km: 7, gain: 380, cost: null, cover: COVERS.ridgeDawn,
    note: 'Short one. Up in the dark, down before the day got hot.',
    bring: ['Head torch', 'Warm layer'],
    itinerary: [{ at: '04:40', label: 'Chamba' }, { at: '10:00', label: 'Back' }],
    point: 'Chamba bus stand',
    logistics: 'Own transport.',
    confirmed: ['meera', 'ananya', 'rohan'],
  },
  {
    host: 'priya', activity: 'camping', place: 'Kanatal Ridge, the first one',
    meet: 'Chamba Bypass', region: 'Uttarakhand',
    agoDays: 40, start: '17:00', back: '10:30', cap: 6, difficulty: 'moderate',
    km: 9, gain: 480, cost: 85000, cover: COVERS.camp,
    note: 'Cold, clear, and nobody wanted to leave in the morning.',
    night: 'Nobody walked down in the dark. We waited for light.',
    bring: ['Sleeping bag', 'Warm layer', 'Head torch'],
    itinerary: [{ at: '17:00', label: 'Chamba Bypass' }, { at: '10:30', label: 'Back' }],
    point: 'Chamba Bypass, at the fruit stall',
    logistics: 'Shared jeep, ₹850 a head.',
    confirmed: ['meera', 'aarav', 'kabir', 'ananya'],
  },
]

// Requests left pending, so the host's "decide who comes" queue is not empty.
// These land on YOUR walk — the one the seed posts as you — because that queue
// is the most consequential control in the product and an empty one shows
// nothing.
// Somebody asking to come on a walk a DEMO member hosts.
//
// The first version only put pending requests on YOUR walk, which meant the
// host console and the "waiting on you" panel were empty for every other
// account on the board — and those two are the screens where a host decides
// about a stranger, which is the most consequential thing this product does.
// You cannot judge that screen against nobody.
// Nobody here is already on the walk they are asking for — the primary key is
// (plan_id, user_id), so an asker who is already confirmed is a collision, not
// a request. Meera hosts two of these, which is deliberate: she is the account
// with the fullest board, and the host console is judged against hers.
const ASKS = [
  ['Benog Wildlife Sanctuary', 'rohan', 'I have binoculars and no idea what I am looking at. Is that alright?'],
  ['Benog Wildlife Sanctuary', 'ananya', 'I usually run this stretch. Happy to go at whatever pace the group wants.'],
  ['Flag Hill, before light', 'devika', 'I have done this one at dawn before. Happy to sweep at the back if that helps.'],
  ['Flag Hill, before light', 'kabir', 'First time out with a group. I walk steadily and would rather be at the back than hold anyone up.'],
  ['Nag Tibba', 'devika', 'Carrying my own food and a spare layer. Is the cab still splitting from ISBT?'],
  ['George Everest', 'priya', 'Bringing a flask and a spare red torch if anybody forgets theirs.'],
]

// What a group actually says to each other between joining and going. Every
// line is the kind of thing that gets said the night before — logistics, a
// forecast, one nervous question — because a messaging screen with lorem in it
// tells you nothing about whether the screen works.
const CHAT = [
  ['Nag Tibba', [
    ['meera', 'Forecast holds — clear from 03:00, about 4°C at the top. Bring a layer more than you think.', true],
    ['priya', 'Cab from ISBT gate 2, I will be there from 04:40. Room for three.'],
    ['ananya', 'Taking that if there is space. Coming from Rajpur.'],
    ['priya', 'Space for you.'],
    ['meera', 'We leave at 05:10 whether or not everyone is there — sorry, but the light does not wait.'],
  ]],
  ['Benog Wildlife Sanctuary', [
    ['meera', 'Slow morning, lots of standing still. Flask is a good idea.'],
    ['kabir', 'Is it alright if I am rubbish at this? I can barely tell a myna from a crow.'],
    ['meera', 'That is most of us on the first one. Come.'],
  ]],
]

const YOUR_WALK = {
  activity: 'trekking', place: 'Mussoorie ridge, the long way round',
  meet: 'Library bus stand, Mussoorie', region: 'Uttarakhand',
  inDays: 8, start: '06:30', back: '15:00', cap: 8, difficulty: 'moderate',
  km: 12, gain: 700, cost: 20000, cover: COVERS.descent,
  note: 'Out along the ridge and back through the bazaar. Nothing technical, but it is a full day on your feet.',
  bring: ['Two litres of water', 'Lunch', 'A warm layer'],
  itinerary: [
    { at: '06:30', label: 'Library bus stand' },
    { at: '09:30', label: 'Top of the ridge' },
    { at: '15:00', label: 'Back in the bazaar' },
  ],
  point: 'Library bus stand, Mussoorie — by the ticket window',
  logistics: 'Shared cab up from Dehradun, roughly ₹200 each way.',
  confirmed: ['meera'],
  pending: [
    ['kabir', 'I have done Nag Tibba twice and the Neer Garh walk. Happy to be at the back — I just do not want to do a full day on my own yet.'],
    ['ananya', 'I run this ridge most weeks but never the bazaar side. Can bring a first aid kit.'],
    ['rohan', 'Free that Saturday and I have not done a proper daylight walk in a while.'],
  ],
}

const email = (slug) => `${PREFIX}${slug}@${DOMAIN}`

async function findDemoUsers() {
  const found = new Map()
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    for (const u of data.users) {
      if (u.email?.startsWith(PREFIX) && u.email.endsWith('@' + DOMAIN)) found.set(u.email, u.id)
    }
    if (data.users.length < 200) break
  }
  return found
}

async function undo() {
  const found = await findDemoUsers()
  if (found.size === 0) {
    console.log('Nothing to remove — no demo members found.')
    return
  }
  const ids = [...found.values()]
  const { count: planCount } = await db
    .from('trek_plans').select('id', { count: 'exact', head: true }).in('host_id', ids)

  // Deleting the member is enough. `profiles` cascades from `auth.users`, and
  // every reference to a profile in this schema either cascades with it or
  // nulls itself out — including `trek_plan_requests.decided_by`, which used to
  // block the delete outright until 086.
  //
  // The earlier version of this function hand-cleared a dozen tables first,
  // because it had to. That workaround is gone: if this ever starts failing
  // again, the schema has regressed and hiding it here would be the wrong fix.
  let removed = 0
  const stuck = []
  for (const [mail, id] of found) {
    const { error } = await db.auth.admin.deleteUser(id)
    if (error) stuck.push(`${mail} (${error.message || 'unknown error'})`)
    else removed++
  }

  // The one walk posted as YOU is hosted by a real account, so nothing cascades
  // it away. It is found by its place name, which nothing else uses.
  const { error: mineErr } = await db.from('trek_plans').delete().eq('place', YOUR_WALK.place)
  if (mineErr) console.error('  could not remove your demo walk:', mineErr.message)

  console.log(`Removed ${removed} of ${found.size} demo members, and ${planCount ?? 0} walks they hosted.`)
  if (stuck.length) {
    console.log('\nCould not remove:')
    for (const s of stuck) console.log('  ' + s)
    process.exitCode = 1
  }
}

async function ensurePerson(p) {
  const mail = email(p.slug)
  const existing = await findDemoUsers()
  let id = existing.get(mail)

  if (!id) {
    const { data, error } = await db.auth.admin.createUser({
      email: mail,
      email_confirm: true,
      // Never signed into. The board is read through the service role here.
      password: crypto.randomUUID() + crypto.randomUUID(),
      user_metadata: { full_name: p.name, demo: true },
    })
    if (error) throw new Error(`createUser ${mail}: ${error.message}`)
    id = data.user.id
  }

  const { error } = await db.from('profiles').update({
    full_name: p.name,
    trek_display_name: p.name,
    trek_dob: p.dob,
    trek_terms_at: new Date().toISOString(),
    trek_can_host: true,
    trek_home_base: p.base,
    trek_intro: p.intro,
    trek_pace: p.pace,
    trek_activities: p.activities,
    trek_languages: p.languages,
    trek_gender: p.gender,
    trek_mentor: p.mentor,
    trek_mentor_since: p.mentor ? '2024-01-01' : null,
    trek_experience: p.experience,
    trek_years_out: p.years,
    trek_highest_m: p.highest,
    trek_usual_days: p.days,
    trek_carries: p.carries,
    trek_phone_verified_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw new Error(`profile ${mail}: ${error.message}`)

  return id
}

function planRow(w, hostId, hostName) {
  const kind = KIND[w.activity] ?? { min: 3, night: false }
  const startsOn = dayFromNow(w.agoDays != null ? -w.agoDays : w.inDays)
  const overnight = w.back < w.start
  const endsOn = overnight
    ? dayFromNow(w.agoDays != null ? -w.agoDays + 1 : w.inDays + 1)
    : startsOn
  return {
    host_id: hostId,
    host_name: hostName,
    activity: w.activity,
    place: w.place,
    meet_area: w.meet,
    region: w.region,
    country: 'India',
    starts_on: startsOn,
    ends_on: endsOn,
    start_time: w.start,
    back_by: w.back,
    // starts_at / ends_at are written by trek_plans_10_set_times(); these are
    // sent only because the column is NOT NULL and the trigger fires after the
    // row is formed. The trigger's values win.
    starts_at: new Date(`${startsOn}T${w.start}:00+05:30`).toISOString(),
    ends_at: new Date(`${endsOn}T${w.back}:00+05:30`).toISOString(),
    capacity: w.cap,
    effort: w.difficulty === 'difficult' ? 'hard' : w.difficulty,
    difficulty: w.difficulty,
    min_party: kind.min,
    night_note: kind.night ? w.night : null,
    women_only: Boolean(w.women),
    senior_friendly: Boolean(w.senior),
    languages: ['Hindi', 'English'],
    cover_urls: w.cover ? [w.cover] : [],
    distance_km: w.km,
    gain_m: w.gain,
    cost_paise: w.cost,
    bring: w.bring,
    itinerary: w.itinerary,
    note: w.note,
    status: 'open',
  }
}

/**
 * A direct connection, used for exactly one thing: back-dating the walks that
 * are meant to have already happened. Everything else goes through PostgREST
 * and the application's own rules, on purpose — a seed that bypasses the guards
 * produces a board the product could never have produced.
 */
let sql = null
async function withDirect(fn) {
  sql = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await sql.connect()
  try { return await fn() } finally { await sql.end(); sql = null }
}

async function seed() {
  console.log('Creating demo members…')
  const ids = {}
  for (const p of PEOPLE) {
    ids[p.slug] = await ensurePerson(p)
    console.log(`  ${p.name.padEnd(16)} ${p.mentor ? 'mentor' : ''}`)
  }
  const nameOf = Object.fromEntries(PEOPLE.map((p) => [p.slug, p.name]))

  // Re-running replaces the walks rather than duplicating them. The people are
  // kept, because their ids are what the rosters and follows point at.
  const hostIds = Object.values(ids)
  await db.from('trek_plans').delete().in('host_id', hostIds)
  await db.from('trek_plans').delete().eq('place', YOUR_WALK.place)

  console.log('\nPosting walks…')
  const planIds = {}
  const hostOf = {}
  for (const w of WALKS) {
    const row = planRow(w, ids[w.host], nameOf[w.host])
    const { data, error } = await db.from('trek_plans').insert(row).select('id').single()
    if (error) {
      console.error(`  ✗ ${w.place}: ${error.message}`)
      continue
    }
    planIds[w.place] = data.id
    hostOf[w.place] = ids[w.host]
    await db.from('trek_plan_details').insert({
      plan_id: data.id, meeting_point: w.point, logistics: w.logistics,
    })
    // The roster. Inserted as confirmed; trek_requests_recount() maintains
    // trek_plans.confirmed_count from these rows, which is what drives the seat
    // meter, the face pile and whether the meeting point is released.
    for (const slug of w.confirmed) {
      if (slug === w.host) continue
      await db.from('trek_plan_requests').insert({
        plan_id: data.id, user_id: ids[slug], plan_host_id: ids[w.host],
        display_name: nameOf[slug], status: 'confirmed',
        decided_at: new Date().toISOString(), decided_by: ids[w.host],
      })
    }
    console.log(`  ${w.place.padEnd(34)} ${w.start}  ${w.confirmed.length + 1}/${w.cap}`)
  }

  // ── The walk posted as you ────────────────────────────────────────────────
  const { data: me } = await db
    .from('profiles')
    .select('id, trek_display_name')
    .not('trek_display_name', 'is', null)
    .not('email', 'like', `${PREFIX}%`)
    .limit(1)
    .maybeSingle()

  if (me) {
    const row = planRow(YOUR_WALK, me.id, me.trek_display_name)
    const { data, error } = await db.from('trek_plans').insert(row).select('id').single()
    if (error) {
      console.error(`  ✗ your walk: ${error.message}`)
    } else {
      await db.from('trek_plan_details').insert({
        plan_id: data.id, meeting_point: YOUR_WALK.point, logistics: YOUR_WALK.logistics,
      })
      for (const slug of YOUR_WALK.confirmed) {
        await db.from('trek_plan_requests').insert({
          plan_id: data.id, user_id: ids[slug], plan_host_id: me.id,
          display_name: nameOf[slug], status: 'confirmed',
          decided_at: new Date().toISOString(), decided_by: me.id,
        })
      }
      for (const [slug, message] of YOUR_WALK.pending) {
        await db.from('trek_plan_requests').insert({
          plan_id: data.id, user_id: ids[slug], plan_host_id: me.id,
          display_name: nameOf[slug], status: 'requested', message,
        })
      }
      console.log(`\n  ${YOUR_WALK.place} — posted as you, ${YOUR_WALK.pending.length} people waiting on a decision`)
    }
  }

  // ── Who is asking, and what the group is saying ──────────────────────────
  // Both go in with the service-role client rather than through the actions,
  // for the same reason the rest of the seed does: there is no session here.
  // The rows are shaped exactly as the app writes them.
  console.log('\nPeople asking to come, and the groups talking…')
  let asked = 0
  for (const [slug, who, message] of ASKS) {
    const planId = planIds[slug]
    if (!planId || !ids[who]) continue
    const { error } = await db.from('trek_plan_requests').insert({
      plan_id: planId, user_id: ids[who], plan_host_id: hostOf[slug],
      display_name: nameOf[who], status: 'requested', message,
    })
    // A duplicate here means that person is already on the walk, which is a
    // fixture problem rather than a failure worth stopping for.
    if (error && !error.message.includes('duplicate key')) {
      console.error(`  ✗ ${who} → ${slug}: ${error.message}`)
    } else if (!error) asked++
  }

  let said = 0
  for (const [slug, lines] of CHAT) {
    const planId = planIds[slug]
    if (!planId) continue
    // Spread backwards from now so the thread reads as a conversation with a
    // last-message time, not as five things posted in the same second.
    const base = Date.now() - lines.length * 47 * 60_000
    for (const [who, body, announcement] of lines) {
      if (!ids[who]) continue
      const { error } = await db.from('trek_messages').insert({
        plan_id: planId, user_id: ids[who], display_name: nameOf[who], body,
        is_announcement: Boolean(announcement),
        created_at: new Date(base + said * 47 * 60_000).toISOString(),
      })
      if (error) console.error(`  ✗ chat ${slug}: ${error.message}`)
      else said++
    }
  }
  console.log(`  ${asked} people waiting on a decision, ${said} messages across ${CHAT.length} walks`)

  // ── The record ────────────────────────────────────────────────────────────
  // Vouches are what every trust figure on the product is counted from, and a
  // board of people with zero of them cannot show the model working. Each one
  // is attached to a walk both people were on.
  console.log('\nRecording walks that already happened…')
  let vouched = 0
  for (const h of HISTORY) {
    // trek_plans_10_set_times() refuses an INSERT that starts less than two
    // hours from now — correct, and it means a completed walk cannot be posted
    // directly. The guard is INSERT-only (it branches on TG_OP), and the join
    // guard likewise refuses a walk that has already left. So the walk is
    // posted for the near future, filled while it is still joinable, and only
    // then moved into the past. The UPDATE re-runs set_times, which recomputes
    // starts_at from starts_on + start_time exactly as it would for any edit.
    const future = { ...h, agoDays: null, inDays: 3 }
    const row = planRow(future, ids[h.host], nameOf[h.host])
    const { data, error } = await db.from('trek_plans').insert(row).select('id').single()
    if (error) { console.error(`  ✗ ${h.place}: ${error.message}`); continue }
    await db.from('trek_plan_details').insert({
      plan_id: data.id, meeting_point: h.point, logistics: h.logistics,
    })
    for (const slug of h.confirmed) {
      await db.from('trek_plan_requests').insert({
        plan_id: data.id, user_id: ids[slug], plan_host_id: ids[h.host],
        display_name: nameOf[slug], status: 'confirmed',
        decided_at: new Date().toISOString(), decided_by: ids[h.host],
        checked_in_at: new Date().toISOString(), checked_in_by: ids[h.host],
      })
    }

    // And now it is in the past.
    //
    // `trek_plans_20_immutable()` refuses to let the time, activity or place of
    // a posted plan move — "cancel and repost" — which is the right rule for a
    // board where people have already arranged their day around a date. It also
    // means there is no route through the API to a walk that has already
    // happened, and the entire trust model is counted from walks that have.
    //
    // So this one step goes around the application, on a direct connection,
    // with replica mode set for the transaction. That suspends user triggers
    // for these two statements only, and it is the reason this script needs a
    // Postgres client at all.
    const past = planRow(h, ids[h.host], nameOf[h.host])
    try {
      await sql.query('begin')
      await sql.query(`set local session_replication_role = replica`)
      await sql.query(
        `update trek_plans set starts_on=$2, ends_on=$3, starts_at=$4, ends_at=$5 where id=$1`,
        [data.id, past.starts_on, past.ends_on, past.starts_at, past.ends_at]
      )
      await sql.query('commit')
    } catch (e) {
      await sql.query('rollback')
      console.error(`  ✗ ${h.place} (dating): ${e.message}`)
      continue
    }

    // Everybody who was on it vouches for the host, and the host for them.
    // The guard refuses any pair that was not actually confirmed together on
    // this walk, which is the whole point of it — so this only writes the ones
    // the product itself would allow.
    const party = [h.host, ...h.confirmed]
    for (const from of party) {
      for (const to of party) {
        if (from === to) continue
        const { error: vErr } = await db.from('trek_vouches').insert({
          voucher_id: ids[from], vouchee_id: ids[to], plan_id: data.id,
        })
        if (!vErr) vouched++
      }
    }
    console.log(`  ${h.place.padEnd(34)} ${h.agoDays}d ago  ${h.confirmed.length + 1} people`)
  }

  // A follow graph, so Basecamp's "from people you follow" has something in it.
  const follows = [['meera', 'aarav'], ['kabir', 'meera'], ['kabir', 'aarav'], ['ananya', 'meera'], ['rohan', 'priya']]
  for (const [a, b] of follows) {
    await db.from('trek_follows').insert({ follower_id: ids[a], followed_id: ids[b] })
  }
  if (me) {
    for (const slug of ['meera', 'aarav', 'priya']) {
      await db.from('trek_follows').insert({ follower_id: me.id, followed_id: ids[slug] })
    }
  }

  // Counted the way the board itself counts: open, not hidden, and still to
  // come. The completed walks are deliberately not in this number — they are
  // history, and they show up on profiles and in recaps rather than on the board.
  const { count } = await db
    .from('trek_plans').select('id', { count: 'exact', head: true })
    .eq('status', 'open').is('hidden_at', null).gt('starts_at', new Date().toISOString())

  console.log(`\nDone. ${count} walks on the board, ${HISTORY.length} already walked, ${PEOPLE.length} members, ${vouched} vouches.`)
  console.log('Undo with:  node scripts/seed-trek-demo.mjs --undo')
}

await (UNDO ? undo() : withDirect(seed))
