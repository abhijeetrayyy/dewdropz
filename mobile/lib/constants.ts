// ── All data from the DewDropz web app's lib/constants.ts ──
// Prices are in whole rupees on web; we store in paise for mobile.

// Mirrors the web app's default `store_settings` (actions/settings.ts) —
// hardcoded here the same way CartView.tsx hardcodes its own local copy,
// since mobile has no settings query yet. Centralized to one constant so
// Cart and Checkout can't drift from each other the way the two web files do.
export const FREE_SHIPPING_THRESHOLD_PAISE = 200000; // ₹2,000
export const FLAT_SHIPPING_RATE_PAISE = 15000; // ₹150

export const COLLECTIONS = [
  {
    id: "mist-and-morning",
    name: "Mist & Morning",
    tagline: "Fog, dew, first light.",
    bestFor: "3-season forest treks",
    signature: "Mist Tee",
    image: "https://images.unsplash.com/photo-1758642882005-447873fd2d29",
    gradient: "linear-gradient(165deg, #4A5D52 0%, #9AAE9C 40%, #E8EAE4 100%)",
    description:
      "Built for the hours between 5 and 7 a.m., when the forest is still deciding whether to wake up.",
    narrative:
      "Every piece in Mist & Morning was tested on the same pre-dawn starts we guide on — the Roopkund approach, the Nag Tibba ridge, the wet pine switchbacks above Mussoorie.",
    conditions: [
      { label: "Temperature Range", value: "8°C – 22°C" },
      { label: "Terrain", value: "Wet pine, switchbacks" },
      { label: "Best Season", value: "Spring & post-monsoon" },
    ],
  },
  {
    id: "silent-altitude",
    name: "Silent Altitude",
    tagline: "Alpine stillness. Deep quiet.",
    bestFor: "High-altitude alpine climbs",
    signature: "Altitude Pack 40L",
    image: "https://images.unsplash.com/photo-1769631417306-a1da09f42b20",
    gradient: "linear-gradient(165deg, #0B1520 0%, #1E3347 40%, #5A7A96 100%)",
    description:
      "Above 4,000m the noise of the world finally drops away. Engineered for thin, quiet air.",
    narrative:
      "We field-test Silent Altitude above 4,500 metres. Every welded seam, every insulation panel, every zip pull was chosen for what happens when your hands are too cold to be precise.",
    conditions: [
      { label: "Temperature Range", value: "-15°C – 5°C" },
      { label: "Terrain", value: "Alpine, scree, summit ridge" },
      { label: "Best Season", value: "Pre-monsoon & autumn" },
    ],
  },
  {
    id: "o-collection",
    name: "O Collection",
    tagline: "Where the trail becomes a way of life.",
    bestFor: "Desert ridges & long hauls",
    signature: "Trail Cap",
    image: "https://images.unsplash.com/photo-1766933366411-7a921aebe181",
    gradient: "linear-gradient(165deg, #2E1F16 0%, #6B3F28 50%, #C8906A 100%)",
    description:
      "For the multi-day hauls across dry ridgelines, where the sun is the only companion that never leaves.",
    narrative:
      "O Collection came out of a five-day crossing where three of us ran out of good options for sun cover by day two. Everything here is built around heat management over distance.",
    conditions: [
      { label: "Temperature Range", value: "18°C – 40°C" },
      { label: "Terrain", value: "Desert ridge, long hauls" },
      { label: "Best Season", value: "Winter & early spring" },
    ],
  },
];

export const PRODUCTS = [
  {
    id: "mist-tee",
    slug: "mist-tee",
    name: "Mist Tee",
    desc: "Cotton trekking t‑shirt",
    price: 180000, // paise
    compare_at_price: null,
    gradient: "linear-gradient(135deg, #4A5D52, #9AAE9C)",
    images: ["https://images.unsplash.com/photo-1629185752193-0d25bb978c04"],
    collectionId: "mist-and-morning",
    collectionName: "Mist & Morning",
    category: "layers",
    materials: "Merino-cotton blend, 180gsm",
    sizes: ["S", "M", "L", "XL"],
    short_description:
      "A lightweight base layer built for humid forest switchbacks. Merino keeps you warm when wet, cotton keeps it soft against the skin on 12-hour days.",
    longDescription:
      "A lightweight base layer built for humid forest switchbacks. Merino keeps you warm when wet, cotton keeps it soft against the skin on 12-hour days.",
    care: "Cold wash. Hang dry. Avoid fabric softener — it breaks down the merino fibres.",
    variants: [
      { id: "mist-tee-s", name: "S", price_adjustment: 0 },
      { id: "mist-tee-m", name: "M", price_adjustment: 0 },
      { id: "mist-tee-l", name: "L", price_adjustment: 0 },
      { id: "mist-tee-xl", name: "XL", price_adjustment: 20000 },
    ],
  },
  {
    id: "dew-windbreaker",
    slug: "dew-windbreaker",
    name: "Dew Windbreaker",
    desc: "Packable shell for damp mornings",
    price: 320000,
    compare_at_price: 380000,
    gradient: "linear-gradient(135deg, #6B8068, #C7D3C2)",
    images: ["https://images.unsplash.com/photo-1595174028948-42a4b1786664"],
    collectionId: "mist-and-morning",
    collectionName: "Mist & Morning",
    category: "layers",
    materials: "Ripstop nylon, DWR coating",
    sizes: ["S", "M", "L", "XL"],
    short_description:
      "Packs down to fist size and cuts the chill off a foggy ridge without trapping heat.",
    longDescription:
      "Packs down to fist size and cuts the chill off a foggy ridge without trapping heat. The shell we reach for first, every single time.",
    care: "Machine wash cold, no bleach. Re-apply DWR spray every 15–20 washes.",
    variants: [
      { id: "dw-s", name: "S", price_adjustment: 0 },
      { id: "dw-m", name: "M", price_adjustment: 0 },
      { id: "dw-l", name: "L", price_adjustment: 0 },
      { id: "dw-xl", name: "XL", price_adjustment: 50000 },
    ],
  },
  {
    id: "altitude-pack",
    slug: "altitude-pack",
    name: "Altitude Pack 40L",
    desc: "Waterproof trail backpack",
    price: 280000,
    compare_at_price: null,
    gradient: "linear-gradient(135deg, #1E3347, #5A7A96)",
    images: ["https://images.unsplash.com/photo-1509762774605-f07235a08f1f"],
    collectionId: "silent-altitude",
    collectionName: "Silent Altitude",
    category: "packs",
    materials: "Welded-seam TPU shell, 40L capacity",
    sizes: ["One Size"],
    short_description:
      "Redesigned twice to survive monsoon and high-altitude wind alike.",
    longDescription:
      "Redesigned twice to survive monsoon and high-altitude wind alike. Welded seams, a dropped roll-top, and a frame that carries weight on your hips, not your shoulders.",
    care: "Wipe down with a damp cloth. Do not machine wash. Air dry fully before storage.",
    variants: [
      { id: "ap-os", name: "One Size", price_adjustment: 0 },
    ],
  },
  {
    id: "ridge-beanie",
    slug: "ridge-beanie",
    name: "Ridge Beanie",
    desc: "Merino wool summit beanie",
    price: 110000,
    compare_at_price: null,
    gradient: "linear-gradient(135deg, #2A3B4D, #7F97AC)",
    images: ["https://images.unsplash.com/photo-1648483092137-6e63796c8b06"],
    collectionId: "silent-altitude",
    collectionName: "Silent Altitude",
    category: "headwear",
    materials: "100% merino wool",
    sizes: ["One Size"],
    short_description:
      "Tested above 5,000m where the wind never stops. Thin enough for a hood, warm enough to sleep in.",
    longDescription:
      "Tested above 5,000 metres where the wind never really stops. Thin enough to fit under a hood, warm enough to sleep in.",
    care: "Hand wash cold. Lay flat to dry.",
    variants: [
      { id: "rb-os", name: "One Size", price_adjustment: 0 },
    ],
  },
  {
    id: "trail-cap",
    slug: "trail-cap",
    name: "Trail Cap",
    desc: "Merino wool cap",
    price: 150000,
    compare_at_price: 180000,
    gradient: "linear-gradient(135deg, #2E1F16, #7A4F35)",
    images: ["https://images.unsplash.com/photo-1780758841669-c961af1a5a7e"],
    collectionId: "o-collection",
    collectionName: "O Collection",
    category: "headwear",
    materials: "Merino wool crown, cotton twill brim",
    sizes: ["One Size"],
    short_description:
      "Sun-hardened for multi-day desert-ridge hauls. The brim holds shape after being packed flat for a week.",
    longDescription:
      "Sun-hardened for multi-day desert-ridge hauls. The brim is stiff enough to hold shape after being packed flat for a week straight.",
    care: "Spot clean only. Reshape brim while damp.",
    variants: [
      { id: "tc-os", name: "One Size", price_adjustment: 0 },
    ],
  },
  {
    id: "desert-scarf",
    slug: "desert-scarf",
    name: "Desert Scarf",
    desc: "Dust‑shield trail scarf",
    price: 90000,
    compare_at_price: null,
    gradient: "linear-gradient(135deg, #7A4F35, #D9B08C)",
    images: ["https://images.unsplash.com/photo-1706206086774-0017933e52e2"],
    collectionId: "o-collection",
    collectionName: "O Collection",
    category: "headwear",
    materials: "Brushed cotton-linen blend",
    sizes: ["One Size"],
    short_description:
      "Doubles as dust shield, sun guard, and impromptu pillow. Long enough to wrap twice.",
    longDescription:
      "Doubles as dust shield, sun guard, and impromptu pillow. Long enough to wrap twice, breathable enough to forget you're wearing it.",
    care: "Machine wash cold. Tumble dry low.",
    variants: [
      { id: "ds-os", name: "One Size", price_adjustment: 0 },
    ],
  },
  {
    id: "summit-flask",
    slug: "summit-flask",
    name: "Summit Flask",
    desc: "Insulated steel bottle",
    price: 120000,
    compare_at_price: null,
    gradient: "linear-gradient(135deg, #27481F, #7BA46F)",
    images: ["https://images.unsplash.com/photo-1605539582747-ce302b9afca2"],
    collectionId: "o-collection",
    collectionName: "O Collection",
    category: "hydration",
    materials: "18/8 stainless steel, double-wall vacuum insulation",
    sizes: ["750ml"],
    short_description:
      "Keeps water cold for 24 hours and tea hot for 12 — tested across three-day desert crossings, not in a lab.",
    longDescription:
      "Keeps water cold for 24 hours and tea hot for 12 — tested in the field, not just in a lab, across three-day desert-ridge crossings.",
    care: "Hand wash. Do not microwave or freeze.",
    variants: [
      { id: "sf-750", name: "750ml", price_adjustment: 0 },
    ],
  },
];


export const TESTIMONIALS = [
  {
    quote: "The Altitude Pack survived a five-day crossing in sideways rain and didn't let a single drop through. I've never trusted a piece of gear more.",
    name: "Karan M.",
    trail: "Roopkund Ridge, 2025",
  },
  {
    quote: "Wore the Mist Tee through 18km of wet pine switchbacks above Mussoorie. It dried faster than my boots. That's not an exaggeration.",
    name: "Priya S.",
    trail: "Nag Tibba Trail, 2025",
  },
  {
    quote: "I packed the Trail Cap flat for a week in the Thar, pulled it out, and the brim held its shape perfectly. Desert gear that actually works.",
    name: "Rohan D.",
    trail: "Thar Crossing, 2026",
  },
  {
    quote: "The Summit Flask kept my tea hot for an entire summit push on Kedarkantha. At -8°C, that's not a nice-to-have — it's the difference between quitting and continuing.",
    name: "Ananya K.",
    trail: "Kedarkantha Winter, 2025",
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
  "7‑day easy returns",
  "Field‑tested at 5,200m",
];
