import type { RentalItem, RentalCategory } from "./data";

// ── Finding gear in the locker, on a phone ───────────────────────────────────
//
// WHY THIS IS A SECOND COPY, DELIBERATELY
//
// `lib/rental-filter.ts` on the web is the same arithmetic, and this is a port
// rather than an import for a reason worth writing down: `mobile/tsconfig.json`
// carries a `@dewdropz/web/*` alias pointing at the web root, it is used by
// nothing, and Metro has no matching `watchFolders` or `extraNodeModules`. An
// import through it would TYPECHECK CLEANLY AND FAIL AT RUNTIME, on a device,
// after a store build. That is a worse outcome than duplication.
//
// The drift a port normally invites is closed by `lib/rental-filter.test.ts`,
// which imports BOTH implementations and asserts they agree on identical
// fixtures — the same technique `lib/calendarGrid.test.ts` uses to hold the two
// copies of the calendar arithmetic together.
//
// WHAT IS DELIBERATELY NOT PORTED: the URL round-trip. On the web the query
// string is the single source of truth because a filtered locker has to be
// shareable and the back button has to work. A phone screen has neither
// problem, and porting `rentalFiltersToParams` would be carrying a mechanism
// for its own sake.

export type RentalSortKey = "featured" | "rate-asc" | "rate-desc" | "lightest" | "name";

export const RENTAL_SORTS: { key: RentalSortKey; label: string }[] = [
  { key: "featured", label: "Recommended" },
  { key: "rate-asc", label: "Rate: low to high" },
  { key: "rate-desc", label: "Rate: high to low" },
  { key: "lightest", label: "Lightest first" },
  { key: "name", label: "A–Z" },
];

/** What the screen knows about the shelf, keyed by item id. Produced by
 *  `rental_items_availability`; never computed here. */
export type AvailabilityMap = Record<string, { free: number; total: number }>;

export type RentalFilters = {
  q: string;
  categories: string[];
  fulfilment: string[];
  bands: string[];
  capacities: string[];
  availableOnly: boolean;
  from: string;
  to: string;
  sort: RentalSortKey;
};

export const EMPTY_RENTAL_FILTERS: RentalFilters = {
  q: "", categories: [], fulfilment: [], bands: [], capacities: [],
  availableOnly: false, from: "", to: "", sort: "featured",
};

// ── Rate bands ──────────────────────────────────────────────────────────────

export type RateBand = { key: string; label: string; min: number; max: number | null };

/** Derived from the catalogue rather than hardcoded, so they stay meaningful
 *  when ₹120/day poles and an ₹850/day bundle are both on the shelf. Returns
 *  nothing rather than three bands that all say the same thing — a control must
 *  never promise a distinction it cannot make. */
export function rateBands(items: RentalItem[]): RateBand[] {
  if (items.length < 4) return [];
  const rates = items.map((i) => i.daily_rate).sort((a, b) => a - b);
  const lo = rates[Math.floor(rates.length / 3)];
  const hi = rates[Math.floor((rates.length * 2) / 3)];
  const r = (paise: number) => Math.round(paise / 100);
  if (r(lo) === r(hi)) return [];
  const inr = (paise: number) => `₹${r(paise).toLocaleString("en-IN")}`;
  return [
    { key: "low", label: `Under ${inr(lo)}/day`, min: 0, max: lo },
    { key: "mid", label: `${inr(lo)} – ${inr(hi)}/day`, min: lo, max: hi },
    { key: "high", label: `Over ${inr(hi)}/day`, min: hi, max: null },
  ];
}

export function rateBandMatches(band: RateBand, rate: number): boolean {
  if (band.max === null) return rate > band.min;
  if (band.min === 0) return rate < band.max;
  return rate >= band.min && rate <= band.max;
}

// ── Capacity ────────────────────────────────────────────────────────────────

export const CAPACITY_BUCKETS: { key: string; label: string; test: (c: number) => boolean }[] = [
  { key: "1", label: "Solo", test: (c) => c === 1 },
  { key: "2", label: "Two of you", test: (c) => c === 2 },
  { key: "3+", label: "A group", test: (c) => c >= 3 },
];

/** Only the buckets something actually falls into. Gear with no meaningful
 *  capacity — poles, spikes — is not "capacity 0"; the question does not apply,
 *  so it is absent from the facet AND unaffected by it. */
export function capacityBuckets(items: RentalItem[]) {
  return CAPACITY_BUCKETS.filter((b) =>
    items.some((i) => typeof i.capacity === "number" && i.capacity !== null && b.test(i.capacity)),
  );
}

// ── Search ──────────────────────────────────────────────────────────────────

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function searchHaystack(item: RentalItem): string {
  return normalise(
    [item.name, item.summary ?? "", item.description ?? "", item.category?.name ?? "",
     ...Object.values(item.specs ?? {}).map(String)].join(" "),
  );
}

/** Every token must appear, in any order and anywhere — so "tent season" finds
 *  the four-season tent, and adding a word always narrows. Substring rather
 *  than word-boundary, because "spike" should find "microspikes". */
export function matchesSearch(item: RentalItem, q: string): boolean {
  const tokens = normalise(q).split(" ").filter(Boolean);
  if (!tokens.length) return true;
  const hay = searchHaystack(item);
  return tokens.every((t) => hay.includes(t));
}

// ── The predicate ───────────────────────────────────────────────────────────

export type RentalFilterCtx = { bands: RateBand[]; availability?: AvailabilityMap };

function matches(
  item: RentalItem,
  f: RentalFilters,
  ctx: RentalFilterCtx,
  except: (keyof RentalFilters)[] = [],
): boolean {
  const on = (d: keyof RentalFilters) => !except.includes(d);

  if (on("q") && !matchesSearch(item, f.q)) return false;

  if (on("categories") && f.categories.length) {
    if (!item.category?.slug || !f.categories.includes(item.category.slug)) return false;
  }

  // OR within the dimension: choosing both "Collect" and "Post it" means
  // "either is fine", not "must offer both".
  if (on("fulfilment") && f.fulfilment.length) {
    const offers = f.fulfilment.some(
      (v) => (v === "pickup" && item.allows_pickup) || (v === "ship" && item.allows_shipping),
    );
    if (!offers) return false;
  }

  if (on("bands") && f.bands.length) {
    const chosen = ctx.bands.filter((b) => f.bands.includes(b.key));
    if (chosen.length && !chosen.some((b) => rateBandMatches(b, item.daily_rate))) return false;
  }

  // See `capacityBuckets`: gear where capacity does not apply is never excluded
  // by a capacity choice. Somebody outfitting a trip for two still needs poles.
  if (on("capacities") && f.capacities.length && item.capacity != null) {
    const chosen = CAPACITY_BUCKETS.filter((b) => f.capacities.includes(b.key));
    if (chosen.length && !chosen.some((b) => b.test(item.capacity as number))) return false;
  }

  // Inert without a date range, and that is correct rather than a missing
  // guard: "only what's free" has no meaning until there is a "when", and
  // silently hiding the whole locker would be the worst reading of it.
  if (on("availableOnly") && f.availableOnly && f.from && f.to && ctx.availability) {
    if ((ctx.availability[item.id]?.free ?? 0) < 1) return false;
  }

  return true;
}

export function sortRentalItems(
  items: RentalItem[],
  sort: RentalSortKey,
  availability?: AvailabilityMap,
): RentalItem[] {
  const out = [...items];
  // Array.prototype.sort is stable (spec, ES2019), so each keeps the
  // catalogue's own order underneath as the tiebreak.
  if (sort === "rate-asc") out.sort((a, b) => a.daily_rate - b.daily_rate);
  if (sort === "rate-desc") out.sort((a, b) => b.daily_rate - a.daily_rate);
  if (sort === "name") out.sort((a, b) => a.name.localeCompare(b.name));
  // Unweighed gear sorts LAST. `?? 0` would put everything the shop has not yet
  // weighed at the head of a list headed "Lightest", which is a confident
  // answer to a question nobody has measured.
  if (sort === "lightest")
    out.sort((a, b) => (a.weight_grams ?? Infinity) - (b.weight_grams ?? Infinity));
  // With dates chosen, gear with nothing free sinks but does not vanish — a
  // card that cannot be booked still says when it comes back.
  if (sort === "featured" && availability)
    out.sort((a, b) =>
      Number((availability[b.id]?.free ?? 1) > 0) - Number((availability[a.id]?.free ?? 1) > 0));
  return out;
}

export function applyRentalFilters(
  items: RentalItem[],
  f: RentalFilters,
  ctx: RentalFilterCtx,
): RentalItem[] {
  return sortRentalItems(items.filter((i) => matches(i, f, ctx)), f.sort, ctx.availability);
}

/** How many items a value WOULD return, with every other dimension still
 *  applied but this one relaxed — "if I tap this, what do I get". */
export function rentalFacetCount(
  items: RentalItem[],
  f: RentalFilters,
  ctx: RentalFilterCtx,
  dimension: keyof RentalFilters,
  predicate: (i: RentalItem) => boolean,
): number {
  return items.filter((i) => predicate(i) && matches(i, f, ctx, [dimension])).length;
}

// ── Shelves ─────────────────────────────────────────────────────────────────

export type RentalShelf = { category: RentalCategory | null; items: RentalItem[] };

/** Grouped for the browse view, in the shelves' own order, with anything
 *  uncategorised last. An unfiled item still renders — losing a bookable tent
 *  because nobody has filed it would be worse than an untidy heading. */
export function shelve(items: RentalItem[], categories: RentalCategory[]): RentalShelf[] {
  const ordered = [...categories].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
  const shelves: RentalShelf[] = ordered
    .map((c) => ({ category: c, items: items.filter((i) => i.category?.slug === c.slug) }))
    .filter((s) => s.items.length > 0);
  const loose = items.filter((i) => !i.category?.slug || !ordered.some((c) => c.slug === i.category?.slug));
  if (loose.length) shelves.push({ category: null, items: loose });
  return shelves;
}

/** Dates are not counted: they are the errand, not a filter on it, and showing
 *  "2 filters" for having said when you are going reads as something to clear. */
export function countActiveRental(f: RentalFilters): number {
  return (
    (f.q.trim() ? 1 : 0) + f.categories.length + f.fulfilment.length +
    f.bands.length + f.capacities.length + (f.availableOnly ? 1 : 0)
  );
}

export function toggle(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}
