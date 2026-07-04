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

export const COLLECTIONS = [
  {
    id: 'mist-and-morning',
    name: 'Mist & Morning',
    tagline: 'Fog, dew, first light.',
    bestFor: '3-season forest treks',
    signature: 'Mist Tee',
    image: 'https://images.unsplash.com/photo-1758642882005-447873fd2d29',
    secondaryImage: 'https://images.unsplash.com/photo-1733744237781-6eed02c60b8a',
    gradient: 'linear-gradient(165deg, #4A5D52 0%, #9AAE9C 40%, #E8EAE4 100%)',
    description:
      'Built for the hours between 5 and 7 a.m., when the forest is still deciding whether to wake up. Lightweight, breathable layers cut for switchbacks through wet pine and low cloud.',
    narrative:
      'Every piece in Mist & Morning was tested on the same pre-dawn starts we guide on — the Roopkund approach, the Nag Tibba ridge, the wet pine switchbacks above Mussoorie. The brief was simple: nothing that traps moisture, nothing that takes more than a minute to dry, nothing that fights you when the fog rolls in at 5am and doesn\'t lift until 8.',
    conditions: [
      { label: 'Temperature Range', value: '8°C – 22°C' },
      { label: 'Terrain', value: 'Wet pine, switchbacks' },
      { label: 'Best Season', value: 'Spring & post-monsoon' },
      { label: 'Pairs Well With', value: 'Silent Altitude shells' },
    ],
  },
  {
    id: 'silent-altitude',
    name: 'Silent Altitude',
    tagline: 'Alpine stillness. Deep quiet.',
    bestFor: 'High-altitude alpine climbs',
    signature: 'Altitude Pack 40L',
    image: 'https://images.unsplash.com/photo-1769631417306-a1da09f42b20',
    secondaryImage: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b',
    gradient: 'linear-gradient(165deg, #0B1520 0%, #1E3347 40%, #5A7A96 100%)',
    description:
      'Above 4,000m the noise of the world finally drops away. This collection is engineered for that thin, quiet air — wind-sealed, insulated, built to survive a summit push and the long descent after.',
    narrative:
      'We field-test Silent Altitude above 4,500 metres, where wind is a constant and a torn seam is a real problem, not an inconvenience. Every welded seam, every insulation panel, every zip pull was chosen for what happens when your hands are too cold to be precise and the only thing that matters is whether the gear does its job without being asked twice.',
    conditions: [
      { label: 'Temperature Range', value: '-15°C – 5°C' },
      { label: 'Terrain', value: 'Alpine, scree, summit ridge' },
      { label: 'Best Season', value: 'Pre-monsoon & autumn' },
      { label: 'Pairs Well With', value: 'O Collection base layers' },
    ],
  },
  {
    id: 'o-collection',
    name: 'O Collection',
    tagline: 'Where the trail becomes a way of life.',
    bestFor: 'Desert ridges & long hauls',
    signature: 'Trail Cap',
    image: 'https://images.unsplash.com/photo-1766933366411-7a921aebe181',
    secondaryImage: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b',
    gradient: 'linear-gradient(165deg, #2E1F16 0%, #6B3F28 50%, #C8906A 100%)',
    description:
      'For the multi-day hauls across dry ridgelines, where the sun is the only companion that never leaves. Earth-toned, sun-hardened, and built to carry water, heat, and distance without complaint.',
    narrative:
      'O Collection came out of a five-day crossing where three of us ran out of good options for sun cover by day two. Everything here is built around heat management over distance — brims that hold shape after being packed flat for a week, fabric that breathes at 40°C, and a flask that still has cold water in it on day three.',
    conditions: [
      { label: 'Temperature Range', value: '18°C – 40°C' },
      { label: 'Terrain', value: 'Desert ridge, long hauls' },
      { label: 'Best Season', value: 'Winter & early spring' },
      { label: 'Pairs Well With', value: 'Mist & Morning base layers' },
    ],
  },
]

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

export const PRODUCTS = [
  {
    slug: 'mist-tee',
    name: 'Mist Tee',
    desc: 'Cotton trekking t-shirt',
    price: 1800,
    gradient: 'linear-gradient(135deg, #4A5D52, #9AAE9C)',
    image: 'https://images.unsplash.com/photo-1629185752193-0d25bb978c04',
    collectionId: 'mist-and-morning',
    materials: 'Merino-cotton blend, 180gsm',
    sizes: ['S', 'M', 'L', 'XL'],
    longDescription:
      'A lightweight base layer built for humid forest switchbacks. Merino keeps you warm when wet, cotton keeps it soft against the skin on 12-hour days.',
    care: 'Cold wash. Hang dry. Avoid fabric softener — it breaks down the merino fibres.',
  },
  {
    slug: 'dew-windbreaker',
    name: 'Dew Windbreaker',
    desc: 'Packable shell for damp mornings',
    price: 3200,
    gradient: 'linear-gradient(135deg, #6B8068, #C7D3C2)',
    image: 'https://images.unsplash.com/photo-1595174028948-42a4b1786664',
    collectionId: 'mist-and-morning',
    materials: 'Ripstop nylon, DWR coating',
    sizes: ['S', 'M', 'L', 'XL'],
    longDescription:
      'Packs down to fist size and cuts the chill off a foggy ridge without trapping heat. The shell we reach for first, every single time.',
    care: 'Machine wash cold, no bleach. Re-apply DWR spray every 15–20 washes.',
  },
  {
    slug: 'altitude-pack',
    name: 'Altitude Pack 40L',
    desc: 'Waterproof trail backpack',
    price: 2800,
    gradient: 'linear-gradient(135deg, #1E3347, #5A7A96)',
    image: 'https://images.unsplash.com/photo-1509762774605-f07235a08f1f',
    collectionId: 'silent-altitude',
    materials: 'Welded-seam TPU shell, 40L capacity',
    sizes: ['One Size'],
    longDescription:
      'Redesigned twice to survive monsoon and high-altitude wind alike. Welded seams, a dropped roll-top, and a frame that carries weight on your hips, not your shoulders.',
    care: 'Wipe down with a damp cloth. Do not machine wash. Air dry fully before storage.',
  },
  {
    slug: 'ridge-beanie',
    name: 'Ridge Beanie',
    desc: 'Merino wool summit beanie',
    price: 1100,
    gradient: 'linear-gradient(135deg, #2A3B4D, #7F97AC)',
    image: 'https://images.unsplash.com/photo-1648483092137-6e63796c8b06',
    collectionId: 'silent-altitude',
    materials: '100% merino wool',
    sizes: ['One Size'],
    longDescription:
      'Tested above 5,000 metres where the wind never really stops. Thin enough to fit under a hood, warm enough to sleep in.',
    care: 'Hand wash cold. Lay flat to dry.',
  },
  {
    slug: 'trail-cap',
    name: 'Trail Cap',
    desc: 'Merino wool cap',
    price: 1500,
    gradient: 'linear-gradient(135deg, #2E1F16, #7A4F35)',
    image: 'https://images.unsplash.com/photo-1780758841669-c961af1a5a7e',
    collectionId: 'o-collection',
    materials: 'Merino wool crown, cotton twill brim',
    sizes: ['One Size'],
    longDescription:
      'Sun-hardened for multi-day desert-ridge hauls. The brim is stiff enough to hold shape after being packed flat for a week straight.',
    care: 'Spot clean only. Reshape brim while damp.',
  },
  {
    slug: 'desert-scarf',
    name: 'Desert Scarf',
    desc: 'Dust-shield trail scarf',
    price: 900,
    gradient: 'linear-gradient(135deg, #7A4F35, #D9B08C)',
    image: 'https://images.unsplash.com/photo-1706206086774-0017933e52e2',
    collectionId: 'o-collection',
    materials: 'Brushed cotton-linen blend',
    sizes: ['One Size'],
    longDescription:
      'Doubles as dust shield, sun guard, and impromptu pillow. Long enough to wrap twice, breathable enough to forget you\'re wearing it.',
    care: 'Machine wash cold. Tumble dry low.',
  },
  {
    slug: 'summit-flask',
    name: 'Summit Flask',
    desc: 'Insulated steel bottle',
    price: 1200,
    gradient: 'linear-gradient(135deg, #27481F, #7BA46F)',
    image: 'https://images.unsplash.com/photo-1605539582747-ce302b9afca2',
    collectionId: 'o-collection',
    materials: '18/8 stainless steel, double-wall vacuum insulation',
    sizes: ['750ml'],
    longDescription:
      'Keeps water cold for 24 hours and tea hot for 12 — tested in the field, not just in a lab, across three-day desert-ridge crossings.',
    care: 'Hand wash. Do not microwave or freeze.',
  },
]

export const FOUNDER_QUOTE = {
  quote:
    "We didn't set out to build a brand. We set out to stop apologizing to our clients for gear that failed them halfway up a ridge. Everything else followed from that.",
  name: 'Rohan Thapliyal',
  role: 'Co-founder, Head Guide',
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

export const SITE = {
  email: 'hello@dewdropz.shop',
  phone: '+91 98765 43210',
  address: 'Rajpur Road, Dehradun, Uttarakhand 248009, India',
  instagram: 'https://instagram.com',
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

export const TESTIMONIALS = [
  {
    name: 'Ananya Krishnan',
    initials: 'AK',
    location: 'Bengaluru',
    trek: 'Kedarkantha, Dec 2025',
    quote:
      "The Altitude Pack survived a whiteout at 3,800m that ruined two other people's gear in our group. I stopped thinking about my pack entirely by day two, which is exactly the point.",
    gradient: 'linear-gradient(135deg, #1E3347, #7BA46F)',
  },
  {
    name: 'Vikram Nair',
    initials: 'VN',
    location: 'Pune',
    trek: 'Har Ki Dun, Oct 2025',
    quote:
      "I've bought three 'waterproof' shells from other brands that all soaked through by hour four. The Dew Windbreaker is the first one that actually held up through a full monsoon crossing.",
    gradient: 'linear-gradient(135deg, #4A5D52, #C8906A)',
  },
  {
    name: 'Ritika Sharma',
    initials: 'RS',
    location: 'Delhi',
    trek: 'Roopkund, May 2026',
    quote:
      'Small thing, but the Trail Cap brim held its shape after being crushed in my pack for six days straight. Sounds minor until you\'re the one person on the trek whose hat still looks like a hat.',
    gradient: 'linear-gradient(135deg, #2E1F16, #9AAE9C)',
  },
  {
    name: 'Devansh Rao',
    initials: 'DR',
    location: 'Hyderabad',
    trek: 'Valley of Flowers, Jul 2025',
    quote:
      "What got me was the reply when I emailed about a strap issue — an actual person who'd clearly worn the pack themselves wrote back with a fix in twenty minutes. Never happened with any bigger brand.",
    gradient: 'linear-gradient(135deg, #142536, #5A7A96)',
  },
]

export const COMMUNITY_PHOTOS = [
  { image: 'https://images.unsplash.com/photo-1633231610793-a5be285cb418', caption: 'Mount Ruapehu crater climb' },
  { image: 'https://images.unsplash.com/photo-1522506209496-4536d9020ec4', caption: 'Chandrashila Peak, dawn' },
  { image: 'https://images.unsplash.com/photo-1758272960205-96258d60ac1f', caption: 'Basecamp, night before summit' },
  { image: 'https://images.unsplash.com/photo-1689825422854-8e3083c2fb82', caption: 'Group push above tree line' },
  { image: 'https://images.unsplash.com/photo-1639938794001-bcc9e3770fd4', caption: 'Todd Crag, summit moment' },
  { image: 'https://images.unsplash.com/photo-1722410141874-5494d14deeca', caption: 'Andes crossing, day two' },
  { image: 'https://images.unsplash.com/photo-1733744237781-6eed02c60b8a', caption: 'Roopkund ridge, fog window' },
  { image: 'https://images.unsplash.com/photo-1587547131116-a0655a526190', caption: 'Trailhead, first light' },
]

export const TRAIL_MAP_POINTS = [
  { name: 'Har Ki Dun', x: 22, y: 28, altitude: '3,566m', difficulty: 'Moderate', story: 'The valley of gods — quiet enough to hear your own doubt leave.' },
  { name: 'Kedarkantha', x: 30, y: 42, altitude: '3,800m', difficulty: 'Moderate', story: 'A summit built for sunrise, and a reason to remember why you climbed.' },
  { name: 'Kuari Pass', x: 46, y: 22, altitude: '4,268m', difficulty: 'Moderate–Hard', story: 'The ridge Nehru walked for one view of Nanda Devi. Still worth the lungs it costs.' },
  { name: 'Roopkund', x: 55, y: 35, altitude: '5,029m', difficulty: 'Hard', story: 'A mystery lake and a trail that earns the story you\'ll tell for years.' },
  { name: 'Chandrashila', x: 40, y: 55, altitude: '3,690m', difficulty: 'Easy–Moderate', story: 'The easiest hard thing you\'ll do before breakfast.' },
  { name: 'Valley of Flowers', x: 62, y: 48, altitude: '3,658m', difficulty: 'Moderate', story: 'Blooms once a year. Forgives nothing twice.' },
  { name: 'Brahmatal', x: 35, y: 65, altitude: '3,734m', difficulty: 'Moderate', story: 'A frozen lake and the kind of cold that feels like clarity.' },
  { name: 'Nag Tibba', x: 15, y: 60, altitude: '3,022m', difficulty: 'Easy', story: 'The weekend trek that talks you into booking the harder one.' },
]

export const TREKS = [
  {
    slug: 'kedarkantha-winter',
    name: 'Kedarkantha Winter Trek',
    region: 'Uttarakhand Himalaya',
    image: 'https://images.unsplash.com/photo-1769631417306-a1da09f42b20',
    date: 'Jan 10–15, 2027',
    duration: '6 days',
    difficulty: 'Moderate',
    altitude: '3,800m',
    spotsLeft: 4,
    price: 12500,
  },
  {
    slug: 'har-ki-dun',
    name: 'Har Ki Dun Valley',
    region: 'Garhwal Himalaya',
    image: 'https://images.unsplash.com/photo-1689825422854-8e3083c2fb82',
    date: 'Oct 3–9, 2026',
    duration: '7 days',
    difficulty: 'Moderate',
    altitude: '3,566m',
    spotsLeft: 7,
    price: 14000,
  },
  {
    slug: 'roopkund-expedition',
    name: 'Roopkund Expedition',
    region: 'Chamoli, Uttarakhand',
    image: 'https://images.unsplash.com/photo-1733744237781-6eed02c60b8a',
    date: 'May 18–26, 2027',
    duration: '9 days',
    difficulty: 'Hard',
    altitude: '5,029m',
    spotsLeft: 2,
    price: 21000,
  },
  {
    slug: 'valley-of-flowers',
    name: 'Valley of Flowers',
    region: 'Chamoli, Uttarakhand',
    image: 'https://images.unsplash.com/photo-1722410141874-5494d14deeca',
    date: 'Jul 12–17, 2027',
    duration: '6 days',
    difficulty: 'Moderate',
    altitude: '3,658m',
    spotsLeft: 9,
    price: 13500,
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
