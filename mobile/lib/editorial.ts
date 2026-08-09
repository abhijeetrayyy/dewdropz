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
