// Long-form brand content, mirrored from the web app's lib/constants.ts.
//
// These live in a constant rather than the database for the same reason they
// do on web: they're written copy on a publishing cadence, not catalogue rows.
// Keep the two files in sync by hand when the copy changes — the shapes are
// identical so a block can be pasted across.
//
// Note: TREKS is deliberately absent. The web app has the data and a full
// page for it, but app/treks/page.tsx gates on `TREKS_PAUSED = true` and
// redirects to /collections, so guided treks are a paused business line.
// Shipping a mobile Treks screen would un-pause it by accident.

export type JournalArticle = {
  id: string;
  title: string;
  excerpt: string;
  tag: string;
  image: string;
  author: string;
  date: string;
  readTime: string;
  body: string[];
};

export const JOURNAL: JournalArticle[] = [
  {
    id: "above-the-clouds",
    title: "Field Notes: Above the Clouds",
    excerpt: "Three days on the Roopkund ridge, where the fog never quite lifts — and neither do you.",
    tag: "Trail Notes",
    image: "https://images.unsplash.com/photo-1733744237781-6eed02c60b8a",
    author: "Aarav Bhatt",
    date: "2026-04-12",
    readTime: "6 min read",
    body: [
      "We left the tree line at 4:40am, headlamps cutting thin cones through fog thick enough to taste. By the time the sun found a gap in the cloud, we were already above 4,200 metres, and the world below had simply stopped existing.",
      "That's the strange gift of Roopkund in early spring — the mountain doesn't reveal itself all at once. It shows you a boulder, a ridge line, a single startled monal pheasant, and then swallows it back into white. You stop trying to see the whole trail and start trusting your feet.",
      "On the second day, the fog lifted for eleven minutes. We know because we counted. Eleven minutes of the entire Trishul massif laid out above a sea of cloud, close enough to touch, gone before anyone thought to say something profound about it.",
      "We didn't come back with a summit photo. We came back understanding why people keep returning to a mountain that mostly refuses to be seen.",
    ],
  },
  {
    id: "packing-for-monsoon",
    title: "Packing for the Monsoon",
    excerpt: "What actually stays dry, what doesn't, and why we redesigned the Altitude Pack twice.",
    tag: "Field Guide",
    image: "https://images.unsplash.com/photo-1566341013452-946caa457784",
    author: "Meher Sood",
    date: "2026-03-02",
    readTime: "5 min read",
    body: [
      "Monsoon trekking in the Himalaya punishes bad gear decisions faster than any other season. We learned this the hard way on the first prototype run of the Altitude Pack — great in a lab shower test, useless against sideways rain on an exposed ridge for six hours straight.",
      "The redesign came down to seams, not fabric. Most waterproof packs fail at the stitch lines long before the material itself gives up. Version two moved every seam under a welded flap and dropped the roll-top by four centimetres so water sheets off instead of pooling at the closure.",
      "What actually stays dry: your sleep system, your spare base layer, anything electronic, sealed in that order, closest to your back. What doesn't, no matter what anyone tells you: your boots, by the end of day two, regardless of gear. Plan your socks accordingly.",
    ],
  },
  {
    id: "why-we-go",
    title: "Voices: Why We Go",
    excerpt: "Five DEWDROPZ regulars on why they keep coming back to altitude. The answers surprised us.",
    tag: "Community",
    image: "https://images.unsplash.com/photo-1587547131116-a0655a526190",
    author: "DEWDROPZ Community",
    date: "2026-01-18",
    readTime: "7 min read",
    body: [
      "We asked five people who trek with us at least twice a year the same question: why do you keep going back up? None of them mentioned the view first.",
      "\"It's the only place my head goes quiet,\" said one, a software engineer from Bengaluru who does the Kedarkantha trail every winter. \"Down here I'm never actually finished with anything. Up there, the only task is the next step.\"",
      "A second regular, a physiotherapist from Pune, comes for the opposite reason — the body. \"You find out exactly what you're made of around hour six of day three. It's the most honest feedback I get all year.\"",
      "The pattern across all five answers wasn't scenery, or fitness, or even adventure. It was the quiet. Every one of them, in their own words, said some version of the same thing: they go up to hear themselves think.",
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Season windows
// ─────────────────────────────────────────────────────────────────────────────
// Ported from the web's SEASON_KITS. `months` are 1-12 and the component picks
// by calendar month, so the front page re-merchandises itself four times a year
// with no code change and no CMS.
//
// `products` holds REAL catalogue slugs (verified against the products table),
// not the web file's older ids — the web copy still says `altitude-pack` where
// this store actually ships `altitude-pack-40l`, and a mismatched slug here
// fails silently as a missing card rather than an error.
export type SeasonKit = {
  id: string;
  months: number[];
  seasonLabel: string;
  headline: string;
  line: string;
  collectionSlug: string;
  products: string[];
  /** Shown as mono field data under the headline. */
  conditions: { label: string; value: string }[];
};

export const SEASON_KITS: SeasonKit[] = [
  {
    id: "winter",
    months: [12, 1, 2],
    seasonLabel: "Winter window",
    headline: "Snow on Kedarkantha.",
    line: "Minus-eight nights, blue-sky summit mornings. This is the kit that keeps you out there.",
    collectionSlug: "silent-altitude",
    products: ["summit-shell", "altitude-pack-40l", "summit-flask", "o-merino-tee"],
    conditions: [
      { label: "Temp", value: "−8°C – 6°C" },
      { label: "Terrain", value: "Snow, ridge" },
      { label: "Nights", value: "4" },
    ],
  },
  {
    id: "pre-monsoon",
    months: [3, 4, 5, 6],
    seasonLabel: "Pre-monsoon window",
    headline: "Roopkund before the rains.",
    line: "The high routes open for eight short weeks. Wind-sealed and insulated, or turned back at the ridge.",
    collectionSlug: "silent-altitude",
    products: ["altitude-pack-40l", "summit-shell", "summit-flask", "trail-cap"],
    conditions: [
      { label: "Temp", value: "2°C – 18°C" },
      { label: "Terrain", value: "Scree, snowfield" },
      { label: "Nights", value: "6" },
    ],
  },
  {
    id: "monsoon",
    months: [7, 8, 9],
    seasonLabel: "Monsoon window",
    headline: "The valley is blooming.",
    line: "Valley of Flowers only happens in the rain. Welded seams and fast-dry layers make it worth it.",
    collectionSlug: "mist-and-morning",
    products: ["altitude-pack-40l", "mist-tee", "dawn-jogger", "trail-cap"],
    conditions: [
      { label: "Temp", value: "8°C – 22°C" },
      { label: "Terrain", value: "Wet pine" },
      { label: "Nights", value: "3" },
    ],
  },
  {
    id: "post-monsoon",
    months: [10, 11],
    seasonLabel: "Post-monsoon window",
    headline: "Har Ki Dun, washed clean.",
    line: "The clearest air of the year. Cold mornings, warm miles — layer for both.",
    collectionSlug: "mist-and-morning",
    products: ["mist-tee", "o-field-shirt", "trail-cap", "altitude-pack-40l"],
    conditions: [
      { label: "Temp", value: "1°C – 16°C" },
      { label: "Terrain", value: "Meadow, pine" },
      { label: "Nights", value: "5" },
    ],
  },
];

/** The kit for the month we're actually in. Never returns undefined. */
export function currentSeasonKit(now = new Date()): SeasonKit {
  const m = now.getMonth() + 1;
  return SEASON_KITS.find((k) => k.months.includes(m)) ?? SEASON_KITS[0];
}

// Per-collection field conditions, keyed by the collection's real slug. Shown
// as a spec table on the collection screen — this data has existed in
// lib/constants.ts since launch and has never been rendered on mobile.
export const COLLECTION_CONDITIONS: Record<string, { key: string; value: string }[]> = {
  "mist-and-morning": [
    { key: "Temperature", value: "8°C – 22°C" },
    { key: "Terrain", value: "Wet pine, switchbacks" },
    { key: "Best season", value: "Spring & post-monsoon" },
    { key: "Tested on", value: "Nag Tibba ridge" },
  ],
  "silent-altitude": [
    { key: "Temperature", value: "−15°C – 5°C" },
    { key: "Terrain", value: "Alpine, scree, summit ridge" },
    { key: "Best season", value: "Pre-monsoon & autumn" },
    { key: "Tested on", value: "Above 4,500 m" },
  ],
  "o-collection": [
    { key: "Temperature", value: "18°C – 40°C" },
    { key: "Terrain", value: "Desert ridge, long hauls" },
    { key: "Best season", value: "Winter & early spring" },
    { key: "Tested on", value: "Thar crossing" },
  ],
};

export const STATS = [
  { value: "12,000+", label: "Trekkers geared up" },
  { value: "40+", label: "Trails mapped" },
  { value: "5,200m", label: "Highest tested" },
  { value: "2019", label: "Est. in Dehradun" },
];

export const TRUST_POINTS = [
  "COD available across India",
  "Free shipping over ₹2,000",
  "7-day easy returns",
  "Field-tested at 5,200m",
];

export const FOUNDER_QUOTE = {
  quote:
    "We didn't set out to build a brand. We set out to stop apologizing to our clients for gear that failed them halfway up a ridge. Everything else followed from that.",
  name: "Swastik Ghosh Dastidar",
  role: "Founder & Owner",
};

export const PHILOSOPHY_VALUES = [
  {
    title: "Tested at altitude, not in a lab",
    body: "Every prototype goes up a real mountain before it goes into a real cart. If it fails on the ridge, it doesn't ship.",
  },
  {
    title: "Built to disappear",
    body: "The best gear is the gear you forget you're wearing. We chase fit and weight obsessively so the trail gets your full attention.",
  },
  {
    title: "Small batches, honest pricing",
    body: "We manufacture close to home in Dehradun, in small runs, and price for the cost of good materials — not the cost of a marketing budget.",
  },
  {
    title: "The community comes first",
    body: "Our regulars shape our roadmap. Half of what we've shipped in the last two years started as a complaint from someone on the trail.",
  },
];

export const TIMELINE = [
  { year: "2019", label: "Founded in Dehradun by three trekking guides tired of gear that didn't survive the monsoon." },
  { year: "2021", label: "First in-house factory run: 200 units of the original Altitude Pack, sold out in nine days." },
  { year: "2023", label: "Crossed 5,000 trekkers geared up across 40+ mapped Himalayan trails." },
  { year: "2026", label: "Testing gear above 5,200m and building the next decade of DEWDROPZ from the same ridge we started on." },
];

export const SUSTAINABILITY_INTRO =
  "We're not a zero-impact company — nobody making physical gear honestly is. But every material and manufacturing decision below is one we can actually stand behind, not one written for a marketing page.";

export const SUSTAINABILITY_COMMITMENTS = [
  {
    title: "Fabric sourced within 200km",
    body: "Our merino-cotton and ripstop nylon come from mills in Ludhiana and Panipat — close enough that we've visited every one of them in person.",
  },
  {
    title: "Small batches, not warehouses",
    body: "We manufacture in runs of 200–500 units based on actual demand, not forecasts. Less overproduction, less unsold stock ending up discounted or discarded.",
  },
  {
    title: "Repair over replace",
    body: "Every Altitude Pack ships with a spare buckle and a repair guide. We'd rather fix your pack for the cost of postage than sell you a new one.",
  },
  {
    title: "Packaging that breaks down",
    body: "No plastic polybags. Orders ship in recycled kraft paper and compostable mailers, tested to survive Indian monsoon transit.",
  },
];

export const TESTIMONIALS = [
  {
    quote:
      "The Altitude Pack survived a five-day crossing in sideways rain and didn't let a single drop through. I've never trusted a piece of gear more.",
    name: "Karan M.",
    trail: "Roopkund Ridge, 2025",
  },
  {
    quote:
      "Wore the Mist Tee through 18km of wet pine switchbacks above Mussoorie. It dried faster than my boots. That's not an exaggeration.",
    name: "Priya S.",
    trail: "Nag Tibba Trail, 2025",
  },
  {
    quote:
      "I packed the Trail Cap flat for a week in the Thar, pulled it out, and the brim held its shape perfectly. Desert gear that actually works.",
    name: "Rohan D.",
    trail: "Thar Crossing, 2026",
  },
];

export const SITE = {
  email: "hello@dewdropz.shop",
  phone: "+91 98765 43210",
  address: "Rajpur Road, Dehradun, Uttarakhand 248009, India",
  coords: "30.3165° N, 78.0322° E",
};

export const STORY_IMAGE = "https://images.unsplash.com/photo-1501555088652-021faa106b9b";
export const SUSTAINABILITY_IMAGE = "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b";

export function journalById(id: string) {
  return JOURNAL.find((a) => a.id === id);
}

export function formatArticleDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}
