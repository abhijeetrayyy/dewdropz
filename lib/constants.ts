import type { HomeTrail } from '@/types/database'

/**
 * What to assume a product weighs when nothing is recorded, in grams.
 *
 * There were two answers to this and they disagreed: the delivery estimate on
 * the product page assumed 500g, `createOrder` assumed 0. With a weight-based
 * rate that is a quote and an invoice computed on different bases — the exact
 * thing the pricing path is otherwise careful to avoid, since the checkout
 * preview and the charge deliberately run the same resolver.
 *
 * 500 rather than 0, because a missing weight is missing data, not a weightless
 * product. Assuming zero drops a heavy parcel into the cheapest band and the
 * shop silently absorbs the courier's difference; assuming a plausible figure
 * keeps quote and charge in the same band, which is the property that matters.
 * It also leaves the customer-facing estimate behaving exactly as it did, and
 * moves only the charge into line with it.
 *
 * This is a backstop, not a substitute for a weight. Every product in the
 * catalogue has one today.
 */
export const ASSUMED_PRODUCT_WEIGHT_GRAMS = 500

export const BLUR_DATA_URL =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiMxYTJlMTciLz48L3N2Zz4='

export const BRAND_STORY_IMAGE =
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05'

// Reused across About / Journal detail pages — already verified working Unsplash sources.
export const ADVENTURE_IMAGE_1 = 'https://images.unsplash.com/photo-1501555088652-021faa106b9b'
export const ADVENTURE_IMAGE_2 = 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b'
// Aerial shot of Ama Dablam en route to Everest Base Camp — used as the trail map backdrop.
export const TRAIL_MAP_AERIAL_IMAGE = 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606'
// Volcanic peak above a cloud sea at dawn — backdrop for the stats band.
export const STATS_BG_IMAGE = 'https://images.unsplash.com/photo-1761566333643-bf7d2c94f0ed'

// ─────────────────────────────────────────────────────────────────────────────
// The day arc — imagery for the homepage story
// ─────────────────────────────────────────────────────────────────────────────
// Each URL carries explicit Unsplash transform params. Without them Unsplash
// returns the full-size original (frequently 5000px+ and several MB) and
// next/image dutifully requests w=3840 of it — which made the hero's LCP a
// multi-megabyte decode. `w=2400` is still retina-sharp on a 1440 display.
//
// Grouped in one place, and referenced by name everywhere, so swapping in a
// real DEWDROPZ shoot later is a one-line change per slot rather than a hunt
// through ten section components.
//
// Every one of these has PEOPLE in it, deliberately. The page previously ran on
// 23 images of empty landscapes and flat-lay product, which is precisely why it
// looked expensive and felt like nothing — there was nobody in the frame to
// feel it with.
export const DAY_ARC = {
  /** 04:40 — two figures leaving the treeline by headlamp. The hero. */
  theStart: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=2400&q=80&auto=format&fit=crop',
  /** 05:55 — first light breaking over a ridge. The emotional peak. */
  firstLight: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=2400&q=80&auto=format&fit=crop',
  /** 05:55 detail — a second pair of eyes on the same sunrise. */
  firstLightPair: 'https://images.unsplash.com/photo-1454372182658-c712e4c5a1db?w=2400&q=80&auto=format&fit=crop',
  /** 11:00 — the ridge walk, two on the line. */
  theRidge: 'https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?w=2400&q=80&auto=format&fit=crop',
  /** 16:30 — coming down, together. */
  theWayDown: 'https://images.unsplash.com/photo-1533240332313-0db49b459ad6?w=2400&q=80&auto=format&fit=crop',
  /** 19:30 — camp, headtorches, the day retold. */
  basecamp: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=2400&q=80&auto=format&fit=crop',
} as const

export const STATS = [
  { value: 12000, suffix: '+', label: 'Trekkers geared up', plain: false },
  { value: 40, suffix: '+', label: 'Trails mapped across the Himalaya', plain: false },
  { value: 5200, suffix: 'm', label: 'Highest altitude tested', plain: false },
  { value: 2019, suffix: '', label: 'Est. in Dehradun', plain: true },
]

export const JOURNAL = [
  {
    id: 'above-the-clouds',
    title: 'Field Notes: Above the Clouds',
    excerpt: 'Three days on the Roopkund ridge, where the fog never quite lifts — and neither do you.',
    tag: 'Trail Notes',
    image: 'https://images.unsplash.com/photo-1733744237781-6eed02c60b8a',
    author: 'Aarav Bhatt',
    date: '2026-04-12',
    readTime: '6 min read',
    body: [
      'We left the tree line at 4:40am, headlamps cutting thin cones through fog thick enough to taste. By the time the sun found a gap in the cloud, we were already above 4,200 metres, and the world below had simply stopped existing.',
      "That's the strange gift of Roopkund in early spring — the mountain doesn't reveal itself all at once. It shows you a boulder, a ridge line, a single startled monal pheasant, and then swallows it back into white. You stop trying to see the whole trail and start trusting your feet.",
      'On the second day, the fog lifted for eleven minutes. We know because we counted. Eleven minutes of the entire Trishul massif laid out above a sea of cloud, close enough to touch, gone before anyone thought to say something profound about it.',
      "We didn't come back with a summit photo. We came back understanding why people keep returning to a mountain that mostly refuses to be seen.",
    ],
  },
  {
    id: 'packing-for-monsoon',
    title: 'Packing for the Monsoon',
    excerpt: "What actually stays dry, what doesn't, and why we redesigned the Altitude Pack twice.",
    tag: 'Field Guide',
    image: 'https://images.unsplash.com/photo-1566341013452-946caa457784',
    author: 'Meher Sood',
    date: '2026-03-02',
    readTime: '5 min read',
    body: [
      "Monsoon trekking in the Himalaya punishes bad gear decisions faster than any other season. We learned this the hard way on the first prototype run of the Altitude Pack — great in a lab shower test, useless against sideways rain on an exposed ridge for six hours straight.",
      'The redesign came down to seams, not fabric. Most waterproof packs fail at the stitch lines long before the material itself gives up. Version two moved every seam under a welded flap and dropped the roll-top by four centimetres so water sheets off instead of pooling at the closure.',
      "What actually stays dry: your sleep system, your spare base layer, anything electronic, sealed in that order, closest to your back. What doesn't, no matter what anyone tells you: your boots, by the end of day two, regardless of gear. Plan your socks accordingly.",
    ],
  },
  {
    id: 'why-we-go',
    title: 'Voices: Why We Go',
    excerpt: 'Five DEWDROPZ regulars on why they keep coming back to altitude. The answers surprised us.',
    tag: 'Community',
    image: 'https://images.unsplash.com/photo-1587547131116-a0655a526190',
    author: 'DEWDROPZ Community',
    date: '2026-01-18',
    readTime: '7 min read',
    body: [
      "We asked five people who trek with us at least twice a year the same question: why do you keep going back up? None of them mentioned the view first.",
      '"It\'s the only place my head goes quiet," said one, a software engineer from Bengaluru who does the Kedarkantha trail every winter. "Down here I\'m never actually finished with anything. Up there, the only task is the next step."',
      'A second regular, a physiotherapist from Pune, comes for the opposite reason — the body. "You find out exactly what you\'re made of around hour six of day three. It\'s the most honest feedback I get all year."',
      "The pattern across all five answers wasn't scenery, or fitness, or even adventure. It was the quiet. Every one of them, in their own words, said some version of the same thing: they go up to hear themselves think.",
    ],
  },
]


// Real logistics facts (see CONTACT_FAQS + store settings) surfaced as a single
// trust strip — the "will it arrive, can I return it" anxieties answered up front.
// Four logistics answers, placed right after the hero in the order the doubts
// actually arrive: can I pay my way, what will it cost, what if it's wrong, and
// is it any good. Split into label + value so the band can set them with real
// hierarchy instead of four identical uppercase strings in a row.
export const TRUST_POINTS = [
  { label: 'Payment', value: 'Cash on delivery, India-wide' },
  { label: 'Shipping', value: 'Free over ₹2,000' },
  { label: 'Returns', value: '7 days, unused with tags' },
  { label: 'Tested', value: 'On the range at 5,200 m' },
]


export const FOUNDER_QUOTE = {
  quote:
    "We didn't set out to build a brand. We set out to stop apologizing to our clients for gear that failed them halfway up a ridge. Everything else followed from that.",
  name: 'Swastik Ghosh Dastidar',
  role: 'Founder & Owner',
}

export const PHILOSOPHY_VALUES = [
  {
    title: 'Tested at altitude, not in a lab',
    body: 'Every prototype goes up a real mountain before it goes into a real cart. If it fails on the ridge, it doesn\'t ship.',
  },
  {
    title: 'Built to disappear',
    body: 'The best gear is the gear you forget you\'re wearing. We chase fit and weight obsessively so the trail gets your full attention.',
  },
  {
    title: 'Small batches, honest pricing',
    body: 'We manufacture close to home in Dehradun, in small runs, and price for the cost of good materials — not the cost of a marketing budget.',
  },
  {
    title: 'The community comes first',
    body: 'Our regulars shape our roadmap. Half of what we\'ve shipped in the last two years started as a complaint from someone on the trail.',
  },
]

export const TIMELINE = [
  { year: '2019', label: 'Founded in Dehradun by three trekking guides tired of gear that didn\'t survive the monsoon.' },
  { year: '2021', label: 'First in-house factory run: 200 units of the original Altitude Pack, sold out in nine days.' },
  { year: '2023', label: 'Crossed 5,000 trekkers geared up across 40+ mapped Himalayan trails.' },
  { year: '2026', label: 'Testing gear above 5,200m and building the next decade of DEWDROPZ from the same ridge we started on.' },
]

// PLACEHOLDERS, all of them, and they are live on the site right now.
//
// `instagram` points at instagram.com's front page, not an account. `phone` and
// `whatsapp` are 98765 43210 — the number Indian form examples use, which is
// not a real line. A customer who taps any of these gets nowhere, and the
// footer presents them as the way to reach the shop.
//
// `address` is marketing copy for the site footer. It is NOT the registered
// place of business, and the GST invoice deliberately reads its address from
// store_settings instead (see migration 048) — do not point anything legal here.
export const SITE = {
  email: 'hello@dewdropz.shop',
  phone: '+91 98765 43210',
  address: 'Rajpur Road, Dehradun, Uttarakhand 248009, India',
  instagram: 'https://instagram.com',
  facebook: 'https://facebook.com',
  linkedin: 'https://linkedin.com',
  whatsapp: 'https://wa.me/919876543210',
}

export const CONTACT_FAQS = [
  {
    question: 'How long does shipping take?',
    answer: 'Orders dispatch within 2 business days from our Dehradun facility. Delivery across India typically takes 4–7 business days, longer for remote hill regions.',
  },
  {
    question: "What's your returns policy?",
    answer: 'Unused items in original packaging can be returned within 7 days of delivery for a full refund. Gear that has clearly been field-tested is handled case by case — email us first.',
  },
  {
    question: 'How do I know which size to order?',
    answer: 'Most of our pieces run true to size. Check the size selector on each product page — if you\'re between sizes, we generally recommend sizing up for layering room.',
  },
  {
    question: 'Do you ship internationally?',
    answer: "Not yet — we currently ship within India only. We're working on it for trekkers further afield.",
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// The trail guide — reference, not a booking product
// ─────────────────────────────────────────────────────────────────────────────
// This replaced a list of four "guided treks" carrying invented departure
// dates, prices and live "spots left" counters — a booking funnel for a
// business line that doesn't run. Everything below is instead public,
// verifiable information about real Uttarakhand trails: where they are, how
// high they go, when they're worth walking, and what you actually pass on the
// way. No dates, no prices, no scarcity.
//
// `access` exists because some of these are genuinely restricted, and a guide
// that quietly omits that is worse than no guide.
//
// Imagery is representative Himalayan photography, not claimed to be the exact
// trail — captions never assert otherwise.
export const TRAILS = [
  {
    slug: 'kedarkantha',
    name: 'Kedarkantha',
    region: 'Uttarkashi, Uttarakhand',
    base: 'Sankri',
    altitude: '3,800m',
    difficulty: 'Moderate',
    duration: '4–6 days',
    bestMonths: ['Dec', 'Jan', 'Feb', 'Mar', 'Apr'],
    season: 'A winter trail first and foremost — deep snow from late December through March.',
    image: 'https://images.unsplash.com/photo-1769631417306-a1da09f42b20',
    why: 'The one most people in India walk first. It gives you a genuine snow summit without needing technical skill, and the treeline sits low enough that you camp among pines rather than on bare rock.',
    sights: [
      { name: 'Juda ka Talab', note: 'A small lake that freezes solid in deep winter, ringed by pine.' },
      { name: 'Kedarkantha summit', note: 'Sunrise from the top opens onto Swargarohini and Bandarpoonch.' },
      { name: 'Sankri', note: 'The base village, and the last place with a proper shop.' },
    ],
  },
  {
    slug: 'har-ki-dun',
    name: 'Har Ki Dun',
    region: 'Govind Pashu Vihar, Uttarkashi',
    base: 'Sankri',
    altitude: '3,566m',
    difficulty: 'Moderate',
    duration: '6–8 days',
    bestMonths: ['Apr', 'May', 'Jun', 'Sep', 'Oct', 'Nov'],
    season: 'Green and full of water after the snow melts; crisp and clear post-monsoon.',
    image: 'https://images.unsplash.com/photo-1689825422854-8e3083c2fb82',
    why: 'A cradle-shaped valley walk rather than a summit push, following the Supin through some of the oldest continuously inhabited villages in the range.',
    sights: [
      { name: 'Osla & Seema', note: 'Villages built in traditional Garhwali wood-and-stone.' },
      { name: 'Swargarohini', note: 'The peak that closes the head of the valley.' },
      { name: 'Supin river', note: 'The trail follows it almost the whole way in.' },
    ],
  },
  {
    slug: 'valley-of-flowers',
    name: 'Valley of Flowers',
    region: 'Chamoli, Uttarakhand',
    base: 'Govindghat / Ghangaria',
    altitude: '3,658m',
    difficulty: 'Easy–Moderate',
    duration: '4–6 days',
    bestMonths: ['Jul', 'Aug'],
    season: 'The park opens roughly June to October; the bloom peaks through July and August.',
    image: 'https://images.unsplash.com/photo-1722410141874-5494d14deeca',
    why: 'A UNESCO World Heritage site and a national park, carpeted with hundreds of alpine flowering species for a few weeks a year. It is the rare Himalayan walk where the reason to go is underfoot rather than on the horizon.',
    sights: [
      { name: 'The valley floor', note: 'Several hundred flowering species recorded here.' },
      { name: 'Hemkund Sahib', note: 'A glacial lake and gurudwara at 4,300m, a day trip from Ghangaria.' },
      { name: 'Pushpawati river', note: 'Runs the length of the valley.' },
    ],
    access: 'National park entry fee and permit required; camping inside the valley is not allowed — you stay at Ghangaria.',
  },
  {
    slug: 'kuari-pass',
    name: 'Kuari Pass',
    region: 'Chamoli, Uttarakhand',
    base: 'Joshimath / Auli',
    altitude: '4,264m',
    difficulty: 'Moderate',
    duration: '5–7 days',
    bestMonths: ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Sep', 'Oct', 'Nov'],
    season: 'Walkable most of the year — snow-bound and quiet in winter, wide open in autumn.',
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b',
    why: 'Often called the Curzon Trail. It buys you one of the closest, most unobstructed views of Nanda Devi available to a walker, and the meadows on the way up are enormous.',
    sights: [
      { name: 'Gorson Bugyal', note: 'High meadow above Auli, endless in every direction.' },
      { name: 'Nanda Devi', note: "India's second-highest peak, in full view from the pass." },
      { name: 'Auli', note: 'Ski slopes and a cable car, at the trailhead.' },
    ],
  },
  {
    slug: 'brahmatal',
    name: 'Brahmatal',
    region: 'Chamoli, Uttarakhand',
    base: 'Lohajung',
    altitude: '3,734m',
    difficulty: 'Easy–Moderate',
    duration: '4–6 days',
    bestMonths: ['Dec', 'Jan', 'Feb', 'Mar'],
    season: 'A winter trail — the draw is snow and frozen lakes.',
    image: 'https://images.unsplash.com/photo-1733744237781-6eed02c60b8a',
    image_alt: 'Snow-covered ridge under cloud',
    why: 'A gentler winter alternative to Kedarkantha, through oak and rhododendron forest, with two lakes and a ridge that looks straight across at Trishul.',
    sights: [
      { name: 'Bekaltal', note: 'The lower of the two lakes, in dense forest.' },
      { name: 'Brahmatal', note: 'Frozen through most of the winter season.' },
      { name: 'Trishul & Nanda Ghunti', note: 'Both visible from the ridge for much of the walk.' },
    ],
  },
  {
    slug: 'chandrashila',
    name: 'Chandrashila & Tungnath',
    region: 'Rudraprayag, Uttarakhand',
    base: 'Chopta',
    altitude: '3,690m',
    difficulty: 'Easy',
    duration: '2–3 days',
    bestMonths: ['Mar', 'Apr', 'May', 'Jun', 'Sep', 'Oct', 'Nov', 'Dec'],
    season: 'Rhododendrons in spring, clearest skies after the monsoon.',
    image: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b',
    why: 'The shortest way to a genuine Himalayan summit view. You can start after breakfast and be on top for sunrise the next morning, which makes it the usual first trek for anyone testing whether they like this at all.',
    sights: [
      { name: 'Tungnath', note: 'The highest Shiva temple in the world, on the way up.' },
      { name: 'Chandrashila summit', note: 'Panorama from Chaukhamba across to Nanda Devi.' },
      { name: 'Deoriatal', note: 'A lake that mirrors Chaukhamba on a still morning.' },
    ],
  },
  {
    slug: 'nag-tibba',
    name: 'Nag Tibba',
    region: 'Tehri Garhwal, Uttarakhand',
    base: 'Pantwari',
    altitude: '3,022m',
    difficulty: 'Easy',
    duration: '2 days',
    bestMonths: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'],
    season: 'Walkable nearly year-round; a light dusting of snow in deep winter.',
    image: 'https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd',
    why: "The closest real trek to Dehradun and Mussoorie — a weekend that ends with Bandarpoonch on the skyline. It's the trail that talks people into booking a harder one.",
    sights: [
      { name: 'Nag Tibba summit', note: "The 'Serpent's Peak', with a small shrine below the top." },
      { name: 'Bandarpoonch', note: 'Fills the northern skyline from the ridge.' },
      { name: 'Pantwari', note: 'Roadhead village, a few hours from Dehradun.' },
    ],
  },
  {
    slug: 'roopkund',
    name: 'Roopkund',
    region: 'Chamoli, Uttarakhand',
    base: 'Lohajung',
    altitude: '5,029m',
    difficulty: 'Hard',
    duration: '7–9 days',
    bestMonths: ['May', 'Jun', 'Sep', 'Oct'],
    season: 'Pre-monsoon and post-monsoon only; the approach is snow-bound otherwise.',
    image: 'https://images.unsplash.com/photo-1454372182658-c712e4c5a1db',
    why: 'The glacial lake known for the human skeletal remains found at its edge, reached across two of the largest high meadows in the Indian Himalaya.',
    sights: [
      { name: 'Ali & Bedni Bugyal', note: 'Vast alpine meadows above 3,300m.' },
      { name: 'Trishul & Nanda Ghunti', note: 'Both directly overhead for the upper half.' },
      { name: 'Roopkund lake', note: 'Small, shallow, and frozen for much of the year.' },
    ],
    access: 'Access to the lake has been restricted by order of the Uttarakhand High Court to protect the site. Check the current position with the forest department before planning anything.',
  },
]

export const SUSTAINABILITY_INTRO =
  "We're not a zero-impact company — nobody making physical gear honestly is. But every material and manufacturing decision below is one we can actually stand behind, not one written for a marketing page."

export const SUSTAINABILITY_COMMITMENTS = [
  {
    title: 'Fabric sourced within 200km',
    body: 'Our merino-cotton and ripstop nylon come from mills in Ludhiana and Panipat — close enough that we\'ve visited every one of them in person.',
  },
  {
    title: 'Small batches, not warehouses',
    body: 'We manufacture in runs of 200–500 units based on actual demand, not forecasts. Less overproduction, less unsold stock ending up discounted or discarded.',
  },
  {
    title: 'Repair over replace',
    body: 'Every Altitude Pack ships with a spare buckle and a repair guide. We\'d rather fix your pack for the cost of postage than sell you a new one.',
  },
  {
    title: 'Packaging that breaks down',
    body: 'No plastic polybags. Orders ship in recycled kraft paper and compostable mailers, tested to survive Indian monsoon transit.',
  },
]


/** Days after delivery a customer may still open a return. Lives here rather
 *  than in actions/returns.ts because a 'use server' file may only export async
 *  functions — and because the copy that promises it (product page, FAQ) reads
 *  from constants too, so the promise and the enforcement cannot drift. */
export const RETURN_WINDOW_DAYS = 7

/**
 * WHAT THE HOMEPAGE'S TRAILS SECTION SHOWS, BEFORE ANYBODY EDITS IT.
 *
 * The brief asks for "options so that DEWDROPZ team can add more treks etc in
 * this section with the current layout — Easy-Moderate, Season, days and
 * writeup". That means the section can no longer read `TRAILS` directly: that
 * array is a code constant, so adding a route meant a deploy.
 *
 * It now reads `store_settings.home_config.trails`, edited at /admin/homepage.
 * This is the fallback for a settings row written before migration 092 added
 * the key — the same four routes, in the same order, that used to be picked by
 * slug inside the component. `TRAILS` itself is untouched and still owns the
 * full guide at /treks, which carries the long-form fields (why, sights,
 * access) this card layout has never shown.
 */
export const DEFAULT_HOME_TRAILS: HomeTrail[] = ['kedarkantha', 'har-ki-dun', 'valley-of-flowers', 'kuari-pass']
  .map((slug) => TRAILS.find((t) => t.slug === slug))
  .filter((t): t is (typeof TRAILS)[number] => Boolean(t))
  .map((t) => ({
    slug: t.slug,
    name: t.name,
    altitude: t.altitude,
    difficulty: t.difficulty,
    duration: t.duration,
    bestMonths: [...t.bestMonths],
    season: t.season,
    image: t.image,
  }))
