// ─────────────────────────────────────────────────────────────────────────────
// The trail guide
// ─────────────────────────────────────────────────────────────────────────────
// Mirrors lib/constants.ts TRAILS in the web app. Static reference content
// about real Uttarakhand trails — no departures, no prices, nothing to book.
// Kept as a local constant rather than a fetch because it is editorial copy
// that changes about once a year, and the guide should open instantly and work
// with no signal, which is exactly the situation someone reads it in.
//
// `access` carries genuine restrictions. Never drop it from a render.

export type Trail = {
  slug: string;
  name: string;
  region: string;
  base: string;
  altitude: string;
  difficulty: string;
  duration: string;
  bestMonths: string[];
  season: string;
  image: string;
  why: string;
  sights: { name: string; note: string }[];
  access?: string;
};

export const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] as const;

/**
 * Altitude as a number, parsed from the authored display string ("3,800m").
 *
 * Stored as prose because that is how it is written in the guide and on the
 * website, and duplicating it as a second numeric field is how the two drift
 * apart. Parsing keeps one source of truth; if a string is ever malformed this
 * returns 0 and the trail simply sits at the bottom of the profile rather than
 * throwing.
 */
export function altitudeMeters(trail: Pick<Trail, "altitude">): number {
  return Number(trail.altitude.replace(/[^0-9]/g, "")) || 0;
}

/** Difficulty as a rank, for sorting. The strings are an ordered scale. */
const DIFFICULTY_RANK = ["Easy", "Easy–Moderate", "Moderate", "Hard"];
export function difficultyRank(trail: Pick<Trail, "difficulty">): number {
  const i = DIFFICULTY_RANK.indexOf(trail.difficulty);
  return i === -1 ? DIFFICULTY_RANK.length : i;
}

/** The month a trail guide should open on — this one. */
export function currentMonth(): string {
  return MONTHS[new Date().getMonth()];
}

export const TRAILS: Trail[] = [
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
