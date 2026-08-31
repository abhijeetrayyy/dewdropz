# Collections Row — Action Plan

*Section 2 of the homepage. Written against `components/sections/CollectionsRow.tsx` (101 lines — the whole section), `components/sections/SummitHero.tsx`, `components/sections/ShopByCategory.tsx`, `components/sections/DesignYourOwn.tsx`, `app/page.tsx`, `app/globals.css`, `actions/products.ts`, `app/admin/homepage/HomepageEngine.tsx` on branch `mobile-remediation`. Every line number and every ratio below was checked against the working tree. Where I could not specify a value exactly, it is in §6, not hidden behind an adjective.*

---

## 1. The verdict

This section is the third printing of one card. The hero's act 2 racks the same three collections — resolved by the same `pickCollections` call at `app/page.tsx:68` — as portrait plates with an ink gradient, a Fraunces name and an italic tagline (`SummitHero.tsx:1336–1362`); this row reprints them ~600px later at `md:aspect-[3/4]` with the same `from-ink/9x via-ink/25` scrim, the same 700ms `scale-105` hover and the same italic `paper/60` tagline (`CollectionsRow.tsx:76–93`); `ShopByCategory` reprints them again 400px after that at `aspect-[4/5]` with the same scrim and a count line (`ShopByCategory.tsx:96–118`). Three consecutive bands of one component in three skins, opened by three mastheads a visitor cannot tell apart — 02, 03 and 04 all run the identical mono 10px/0.2em forest eyebrow over a Fraunces clamp `h2` with a right-floated `hidden md:inline-block` forest link, differing only in the clamp. Two further facts finish the diagnosis. **The section is named "05:50 · First light" and contains no warm pixel** — `--dawn` appears zero times in it, while a `border-t border-rule` draws a `#DDD7C6` chalk line at 11.97:1 straight across the foot of a full-bleed `#101E17` hero, at exactly the seam Law 1 exempts. And **the one per-card fact it carries is the word "Collection"**, set 9px Archivo in `--sage` over a translucent scrim, which measures **1.02:1 at 1024px** over a bright crop — a dead word, illegible, above a heading that hard-codes "Three" over a list `pickCollections` never caps and never de-duplicates.

The fix is not another film still. It is to **stop competing with the hero and become the page's index of ranges: a landscape photograph in a frame, at full brightness, with the caption set on cream underneath it where it needs no scrim and can carry real facts — how many pieces are in the range and what they start at — opened by the one section species this page has never used, and lit by the dawn the stop is named for.** The scrim goes, the photographs come back, the type moves onto paper, and the section takes the job the council explicitly moved off the hero sentence: naming what DEWDROPZ sells. Everything below is that idea, itemised.

---

## 2. What stays — do not touch

| | Why it is right |
|---|---|
| **The `stop` prop and `TRAIL_STOPS.collections`.** `lib/trail.ts:68`, passed from `app/page.tsx:93`. | The section used to print "11:00 · The Ridge" from a literal while the rail beside it read 05:50 — a 5h10 contradiction visible at once on a wide screen. Every item below keeps the eyebrow reading off `stop`, so the HUD and the section still cannot drift. `TrailSpine` is back on the homepage and is the original (`HOMEPAGE-COUNCIL.md`, correction of 2026-08-30). |
| **`pickCollections` stays exported and stays the single resolver.** `CollectionsRow.tsx:23–28`, called at `app/page.tsx:68` and `:93`. | Two copies of "empty means show all" is how the film advertises one set of ranges and the index under it another. Item 5 changes the function's body but never its role, and deliberately does **not** move the hero's own capping into it. |
| **`grid-cols-1 md:grid-cols-3`, `max-w-7xl` (1280), `px-6 md:px-10`, `py-20 md:py-24`.** | The measure matches `ShopByCategory`, `SeasonKit`, `HomeTrails` and `Community`. Law 4's defect is elsewhere on the page; this section is already on the majority width. Nothing below changes it. |
| **`rounded-[var(--r-card)]` = 8px, and no shadow on the plate.** `:76`, `globals.css:95`. | Legal on the ladder, and Law 2 is satisfied — nothing in this section carries a border *and* a shadow. Item 1 keeps 8px on the photograph and adds the hairline **only** under the caption row. |
| **Conditional render at `:45`.** `if (shown.length === 0) return null`. | Correct. Item 5 fixes only the wrapper that fails to disappear with it. |
| **`placeholder="blur"` with the shared `BLUR_DATA_URL`.** `lib/constants.ts:24–25`. | `#1a2e17` is a hair off `--forest-deep` `#16290F`, not the "near-black rectangle" one proposal claimed. A section-local base64 duplicate shadowing a shared constant buys nothing. See §5. |
| **No `priority` on these images.** | They sit below a `100svh` hero and are correctly not the LCP element. Do not add it. |

---

## 3. The action plan

Table and specs share the same numbering. **Items 1, 2 and 3 alone change what this band looks like on a phone and on a laptop**, and they are the three that stop it reading as the hero's leftovers.

| # | Action | What | Why | Effort | Priority |
|---|---|---|---|---|---|
| 1 | update | The plate becomes an index entry: landscape frame, caption on cream | Third printing of the hero's plate; the scrim veils the whole photograph; caption type measures 1.02:1 | 3h | **P1** |
| 2 | update | Species C masthead — a rule with the live count on it, a heading, and one sentence that names the goods | 02, 03 and 04 open identically; the section's entire prose is five words; nothing on the page says what is sold until section 8 | 1.5h | **P1** |
| 3 | update | First light actually arrives: a `--dawn` wash at the top edge; the chalk line moves off the hero seam | Zero warm pixels in a band called First light; `#DDD7C6` on `#101E17` = 11.97:1 at the one seam Law 1 exempts; `bg-paper` meets `bg-paper` below when 03 stands down | 45m | **P1** |
| 4 | update | The caption carries a figure: buyable piece count and a from-price | The only per-card fact today is the word "Collection"; the first price anywhere on the homepage is currently section 8 | 1.5h | **P1** |
| 5 | update | Three means three — cap, de-dupe, guard the trail wrapper | The heading states a count the code cannot guarantee; a duplicated slug renders a duplicate React key; the HUD announces a stop that returned `null` | 1h | **P1** |
| 6 | update | One crop, correct `sizes`, hover inside the micro-motion band | Three crops of one admin-framed image; `sizes` off by one against `md`; 700ms is outside Law 6's 140–260ms | 45m | P2 |
| 7 | update | No image → the admin's own `gradient`, not a black rectangle | `collections.gradient` is admin-editable and already consumed on `/shop`, but not here — so this surface alone falls to flat `bg-ink` | 30m | P2 |
| 8 | update | The admin panel stops naming a headline that does not exist | `HomepageEngine.tsx:436` calls this "the *Three conditions, three kits* row" — a string in no file | 20m | P2 |
| 9 | remove | Three stale comment blocks and one false guarantee | The file's own comments describe `paper-deep`, "11:00 · the ridge", `TheClimb` above, and a terrain flythrough — none of which is true of this build | 20m | P3 |
| 10 | update | Split the eyebrow so mono carries the figure and Archivo the words | Law 3: "05:50 · First light" is a time plus two words of prose, set entirely in Space Mono | 30m | P3† |
| 11 | update | *Contingency:* if the plates stay dark, retune the scrim to the stack it carries | Ends the veil at 66% instead of 100%, returns the sky, adds the missing `aria-hidden` | 45m | P3‡ |

† Diverges from `stopEyebrow()`'s one-format rule for five other sections — see §6, Q5.
‡ Build **only** if Q1 comes back "keep the plates dark". Items 1 and 4 delete the scrim outright.

---

### The specs

**1 — The plate becomes an index entry.**
Replace the card block at `:73–95`. The photograph keeps its frame and gets its brightness back; the caption moves onto the section's own ground, where Law 2 holds it with a hairline and no shadow.

```tsx
<article key={c.id} className="flex flex-col">
  <Link href={`/collections/${c.slug}`} className="group block">
    <div className="relative aspect-[3/2] overflow-hidden rounded-[var(--r-card)] bg-forest-deep">
      {/* image or gradient fallback — item 7 */}
    </div>
    <div className="mt-4 border-t border-rule pt-4">
      {/* figures line — item 4 */}
      <h3 className="mt-2 font-display text-[clamp(20px,1.7vw,26px)] leading-[1.1] text-text">{c.name}</h3>
      {c.tagline && (
        <p className="mt-1.5 line-clamp-2 font-display text-[15px] italic leading-snug text-mid">{c.tagline}</p>
      )}
      <span className="mt-3 inline-block border-b border-forest/40 pb-0.5 font-body text-[11px] uppercase tracking-[0.1em] text-forest transition-colors duration-200 group-hover:border-forest">
        See the range →
      </span>
    </div>
  </Link>
</article>
```

**Deleted outright:** the scrim div (`:89`), the absolute caption wrapper (`:90`) and the 9px `Collection` label (`:91`). The `<Link>` wraps image **and** caption so the card is still one tab stop and one hit target.

Grid at `:71` becomes `grid grid-cols-1 gap-y-10 md:grid-cols-3 md:gap-x-6 md:gap-y-0 md:items-start`. `gap-y-10` (40px) on the phone, not `gap-4`: with the caption now on cream, 16px lets card 1's tagline fuse with card 2's photograph. `items-start` lets the captions run ragged while the three images stay baseline-aligned, which is correct for an index.

Measured at the 1280 cap, gap 24: each column is **410.67px**, so the image is **410.67 × 273.8**. Caption block: 1px rule + 16 pad + ~13 figures + 8 + 27 (h3 at 24.5px, leading 1.1) + 6 + ~40 (two clamped tagline lines at 15px/1.375) + 12 + ~14 CTA = **≈137px**, plus `mt-4` = 16. Card total **≈427px** against today's 308. At 390px: 342 × 228 image, card ≈ 365px, three stacked with two 40px gaps = **≈1,175px** of scroll, against today's ~830. That is the honest cost of moving the type onto paper and giving each range four facts instead of three words.

`alt` goes from `{c.name}` to `alt=""` — the `<h3>` two lines below names it, and the hero's identical plate already does this at `SummitHero.tsx:1350`.

Contrast, all measured on `--paper` `#F8F5ED`: `--text` **16.82:1**, `--mid` **7.26:1**, `--forest` **9.48:1**. Every one of them clears AA at every size in the block, which the current caption does not do at any size at any breakpoint.

Tagline as `font-display italic` and not `font-body italic`: italic is Fraunces's job on this site — `ShopByCategory.tsx:78` and `app/collections/page.tsx:135` both set collection taglines that way. It renders as a synthesised oblique (`app/layout.tsx` declares no italic style), which is fine here; the skew-cancellation constraint belongs to `AliveHeadline` alone.

**2 — Species C: a rule across the measure, with the count on it.**
Replace the masthead at `:56–69`. This is the third of the three sanctioned opening species and the page currently uses none of it, while 02, 03 and 04 all run species A.

```tsx
<div className="mb-10 md:mb-12">
  <div className="flex items-center gap-4">
    <span className="whitespace-nowrap font-mono text-[13px] uppercase tracking-[0.2em] text-forest">
      {stopEyebrow(stop)}
    </span>
    <span aria-hidden className="h-px flex-1 bg-dawn/35" />
    <span className="font-mono text-[13px] tabular-nums text-mid">{shown.length}</span>
    <span className="font-body text-[10px] uppercase tracking-[0.16em] text-mid">
      {shown.length === 1 ? 'range' : 'ranges'}
    </span>
  </div>

  <div className="mt-6 grid gap-x-10 gap-y-5 md:grid-cols-[minmax(0,1fr)_minmax(0,44ch)] md:items-end">
    <h2 className="text-balance font-display text-[clamp(30px,4.4vw,46px)] leading-[1.05] text-text">
      The mood changes. The make does not.
    </h2>
    <div>
      <p className="font-body text-[15px] leading-relaxed text-mid">
        Heavyweight tees, hoodies, caps and bottles — cut oversized and printed one at a time in Dehradun.
      </p>
      <Link
        href="/collections"
        className="mt-4 inline-flex items-center gap-2 border-b border-forest/40 pb-1 font-body text-xs uppercase tracking-[0.1em] text-forest transition-colors duration-300 hover:border-forest hover:text-text"
      >
        All collections <span aria-hidden>→</span>
      </Link>
    </div>
  </div>
</div>
```

Four things happen at once here. **The species changes**, so the section no longer opens the way `ShopByCategory` opens 400px below it. **The count becomes data-true** — `{shown.length}` replaces the literal "Three", mono carries the figure and Archivo carries the unit, per Law 3. **The goods get named** — nouns taken from the real taxonomy (`supabase/migrations/050_launch_taxonomy.sql:46–51`: T-Shirts, Hoodies, Caps, Tumblers & Bottles) and the brand's own sanctioned sentence (`app/layout.tsx:104`), in Archivo roman so it does not re-run `ShopByCategory`'s display-italic sub-line one section later. **The phone gets a door**: below 768px the two-column grid collapses and the link sits under the sub-line at every width, which removes the `hidden md:inline-block` hole where a 390px visitor had no in-flow route to `/collections` at all.

The eyebrow goes 10px → **13px**, following the client's own note on this exact element at `DesignYourOwn.tsx:49` ("make the font a bit bigger"). `--forest` on `--paper` is **9.48:1**; over the item-3 wash at its 0.13 peak it is **8.55:1**. The `ranges` unit is `--mid` (**7.26:1**), *not* `--light` — `--light` `#94917F` on `--paper` measures **2.91:1** and fails AA at any size.

`leading-[1.05]` on the `h2` is not decoration: an arbitrary `text-[clamp(...)]` carries no paired leading and there is no storefront `h2` rule in `globals.css`, so a wrapped heading currently sets 30px type on 45px of leading. At 390px this heading is 36 characters against a 342px column — it wraps, every time.

**The heading is the one line in this plan that needs a yes.** "Three collections. One philosophy." traces to the client's own 23 August brief (`app/page.tsx:89` still calls this section "Three Collection Philosophy"). The exact revert, if they want it back, is `{shown.length === 3 ? 'Three collections. One philosophy.' : 'Our collections. One philosophy.'}` — and the sub-line, the rule and the live count are independent of which heading wins. See §6, Q2.

**3 — First light actually arrives.**
`:54` becomes `className="relative overflow-hidden bg-paper border-b border-rule px-6 md:px-10 py-20 md:py-24"`. Add `relative` to the `max-w-7xl mx-auto` wrapper at `:55`. First child inside the section, before the measure:

```tsx
<div
  aria-hidden
  /* rgba(227,155,63,…) is --dawn #E39B3F, written out because gradient stops
     are outside Tailwind's colour reach — same technique as SummitHero.tsx:1004. */
  className="pointer-events-none absolute inset-x-0 top-0 h-[40%] bg-[linear-gradient(180deg,rgba(227,155,63,0.13)_0%,rgba(227,155,63,0.04)_46%,transparent_100%)]"
/>
```

Two separate corrections, and the second is the one nobody would catch from a screenshot. **The hairline moves from top to bottom.** `--rule` `#DDD7C6` against the hero's `#101E17` measures **11.97:1** — a chalk line drawn full-width at precisely the seam Law 1 exempts, because a `100svh` full-bleed dark hero already separates the bands. Against `--paper` the same token measures **1.32:1**, a hairline as intended. It earns a place at the *bottom* because `ShopByCategory` is conditional (`app/page.tsx:99`) and when it stands down, this `bg-paper` meets `DesignYourOwn`'s `bg-paper` (`DesignYourOwn.tsx:34`) at **1.00:1**.

**The wash must stay top-anchored and must terminate.** `--dawn` at 0.13 over `--paper` resolves to **`#F5E9D6`**, which is `--paper-warm` `#F1E9D7` to within a rounding error. A glow that reached the bottom edge would literally become the next band's ground and collapse the Law 1 step into `ShopByCategory`. At `h-[40%]` the lower 60% of the band is untouched `#F8F5ED`, and the wash covers the masthead and the top of the photographs — which is the composition: the light comes over the ridge behind the hero and lands on the index. Text over it: `--forest` 9.48 → **8.55:1**, `--text` 16.82 → **15.17:1**.

0.13 is the **ceiling**, not a starting guess — above ~0.15 dawn over cream stops reading as light and starts reading as a stain. It must be judged from a screenshot at 1440 and at 390, not from the hex.

**4 — The caption carries a figure.**
`app/page.tsx:93` passes the already-fetched products array — in scope, already handed to three other sections — as a new prop. Zero new queries.

```tsx
<CollectionsRow collections={collections} products={products} featuredSlugs={featured_collection_slugs} stop={TRAIL_STOPS.collections} />
```

In the component, per card:

```tsx
const items = products.filter((p) => p.collection_id === c.id)
const from  = items.length ? Math.min(...items.map((p) => p.price)) : null
```

```tsx
{items.length === 0 ? (
  <p className="font-body text-[10px] uppercase tracking-[0.16em] text-mid">Coming soon</p>
) : (
  <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 font-body text-[10px] uppercase tracking-[0.16em] text-mid">
    <span className="font-mono text-[11px] tabular-nums tracking-[0.08em]">{items.length}</span>
    {items.length === 1 ? 'piece' : 'pieces'}
    <span aria-hidden className="h-px w-3 self-center bg-rule" />
    from
    <span className="font-mono text-[11px] tabular-nums tracking-[0.08em]">{formatPrice(from!)}</span>
  </p>
)}
```

`formatPrice` already exists (`lib/utils.ts:12`) and takes **paise**; `Product.price` is paise (`types/database.ts:262`). Import it.

Derive the count from the `products` prop, **not** from `c.products.length` on the `getCollections` embed: that embed counts inactive products too and says so at `actions/products.ts:151–155`, whereas `getProducts()` filters `is_active = true` (`actions/products.ts:35`). This surface therefore advertises only what is buyable — which `/collections` currently does not, and which is the right way round for the front door.

The figures line answers the two questions a visitor actually has before a tap, and the `Coming soon` branch discloses the dead end at `app/collections/[slug]/page.tsx:65` ("More pieces from this collection are on the way.") *before* the tap instead of after it. The layout is the pattern `app/collections/page.tsx:127–130` already uses — label, hairline segment, figure — so the site's two collection surfaces stop disagreeing.

**On the adjacency risk, deliberately taken:** `ShopByCategory.tsx:99–101` also prints `{count} pieces` in a caption. It does so at 9px `--sage` over a photograph, inside a portrait scrimmed tile. Ours is 10/11px `--mid` on cream, under a hairline, below a landscape frame, with a price. Same fact, different species — which is the point of the whole section. Do not let it drift back toward theirs.

**5 — Three means three.**
Four changes, all invisible on a healthy store and all of them things the section can currently get wrong.

(a) De-duplicate in `pickCollections` (`:23–28`), before the return: `.filter((c, i, a) => a.findIndex((x) => x.id === c.id) === i)`. A slug listed twice in `featured_collection_slugs` renders the same card twice under the same `key={c.id}`. The checkbox UI cannot produce that state today; nothing in the function or the type prevents it.

(b) Cap **in the component, not in the exported function**: `const shown = pickCollections(collections, featuredSlugs).slice(0, 3)`. This matches the hero's `MAX_RANGES = 3` (`SummitHero.tsx:109`) without reaching into the hero's own filtering, which additionally drops any collection with a null `image_url` (`:391`). Moving the cap into `pickCollections` would silently change act 2, whose council is closed and built.

(c) Guard the trail wrapper. `app/page.tsx:92` is unguarded while `:99` and `:143` both guard theirs, so a store with zero active collections has `CollectionsRow` return `null` at `:45` while `TrailSpine` goes on announcing "05:50 · First light" over nothing. Wrap it: `{featuredCollections.length > 0 && ( … )}`.

(d) Widths for 1 and 2 collections. Three columns with one card leaves a 411px plate in a 1280 measure with 869px of blank paper beside it. Fixed with literal class strings so Tailwind's scanner sees them:

```tsx
const cols = shown.length === 1 ? 'md:grid-cols-1 md:max-w-[411px]'
           : shown.length === 2 ? 'md:grid-cols-2 md:max-w-[846px]'
           : 'md:grid-cols-3'
```

846 = 411 + 24 + 411. Never build these class names by interpolation — this repo has already been burned by Tailwind v4's scanner (`MEMORY.md`, twice).

**6 — One crop, correct `sizes`, hover inside the band.**
`aspect-[4/3] md:aspect-[3/4] lg:aspect-[4/3]` → **`aspect-[3/2]`**, one crop at every width. Today `object-cover` re-centre-crops the same admin-framed image three different ways, and the portrait window exists only for the 256px band between 768 and 1023 — which is exactly the width where the hero's rack of portraits is still in visual memory. If 3/2 reads as a strip under a full-height hero at 1440, the single-token escalation is **`aspect-[4/3]`** (410.67 × 308, exactly today's plate height); do not reintroduce a per-breakpoint flip.

`sizes` (`:83`) → `"(min-width: 1280px) 411px, (min-width: 768px) calc(33.33vw - 43px), calc(100vw - 48px)"`. The current `(max-width: 768px) 100vw` is one pixel off Tailwind's `md` (`min-width: 768px`), so at exactly 768 the grid is three-up while the browser is told to fetch a full-viewport image.

Hover (`:86`): `duration-700` → **`duration-200`**, `group-hover:scale-105` → `group-hover:scale-[1.03]`, keeping `ease-[var(--ease-out)]`. Law 6 puts micro-motion at 140–260ms; 700ms is nearly three times the ceiling and it is the same 700ms the hero's plate and `ShopByCategory`'s tile both run, so the three bands currently also *move* identically.

*Optional, out of section — see §6, Q4:* act 2 asks `sizes="(min-width:1024px) 320px, 45vw"` (`SummitHero.tsx:1348`) while this row will ask 411px, so `next/image` picks a 384-wide rendition for one and a 640-wide for the other and desktop downloads every collection photograph twice. Aligning act 2's desktop hint to `411px` makes them share one rendition. One line, in a file outside this section.

**7 — The missing image falls back to the admin's own gradient.**
Inside the frame, replace the bare `{c.image_url && (<Image … />)}` with a real else-branch:

```tsx
{c.image_url ? (
  <Image … />
) : (
  <span aria-hidden className="absolute inset-0" style={{ background: c.gradient ?? undefined }} />
)}
```

over the frame's `bg-forest-deep` base. `collections.gradient` is admin-editable at `app/admin/collections/CollectionsClient.tsx:206` and **is** consumed on the storefront — `ShopContent.tsx:220` uses exactly this fallback for the shop's collection tiles. This row is the surface that ignores it, so a shop owner who has set a colour still gets a black rectangle on the front door. Ink → `--forest-deep` for the base at the same time: a flat `#0C100D` block on cream is the harshest thing this band can render.

**8 — The admin panel describes the section it controls.**
`app/admin/homepage/HomepageEngine.tsx:435–438`: `Which collections lead the "Three conditions, three kits" row.` names a headline that exists in no file in this repo. Replace with:

> Which collections lead the collections row on the homepage, in the order you tick them. Only the first three appear. Leave all unchecked to show the first three active collections in their sort order.

Then append one clause to the existing note at `:456–459`: *A collection with no image falls back to its Gradient (CSS) field.* No behaviour change — `toggleFeaturedCollection` (`:95–100`) already appends on check and filters on uncheck, which *is* ticking order; the copy simply has to stop implying a picker that does not exist. **The "only the first three appear" sentence ships with item 5(b) or not at all.** If the client takes the heading rewrite in item 2, quote the new headline here instead of the generic phrasing.

**9 — Three stale comment blocks, and a guarantee that is false.**
Delete `:7–10` (the terrain flythrough that sells "the two mountain collections in-world" — the section above is `SummitHero`, whose act 2 is itself a rack of collection plates). Delete `:48–53` in full: it claims this band is "Midday… 11:00 · the ridge", that it "takes `paper-deep` rather than `paper`", and that "The Climb sits directly above on the same ground". All three are false — the eyebrow renders 05:50, the class is `bg-paper`, and `TheClimb` moved to `app/page.tsx:129–131` in the 23 August re-cut. Correct the doc comment at `:15–22`, which promises the film and the index "cannot advertise different ranges": both call `pickCollections`, but the hero then applies two filters this row does not (`SummitHero.tsx:391` — `filter(c => c.image_url).slice(0, MAX_RANGES)`), so a collection with a null `image_url` appears here and not there. State the divergence instead of denying it.

**10 — Mono carries the figure; Archivo carries the words.**
`stopEyebrow(stop)` renders "05:50 · First light" — a legal time plus two words of prose — entirely in Space Mono, which Law 3 forbids. Locally, without touching `lib/trail.ts`:

```tsx
<span className="whitespace-nowrap font-mono text-[13px] tabular-nums tracking-[0.14em] text-forest">{stop.time}</span>
<span className="whitespace-nowrap font-body text-[11px] uppercase tracking-[0.18em] text-forest">{stop.label}</span>
```

Values still come from the `stop` prop, so nothing can drift from the HUD. The cost is real and is why this is P3: five other sections still print the joined string, so this one would render its stop in a different shape from theirs. It is either a site-wide change or none — Q5.

**11 — Contingency only: the scrim tuned to the stack it carries.**
Build **only** if the client rejects the light index (Q1). Replace `:89` with `bg-gradient-to-t from-ink/95 via-ink/72 via-[26%] to-transparent to-[66%]` and add `aria-hidden="true"` — the hero's equivalent scrims at `SummitHero.tsx:1291` and `:1359` both carry it; this one walks a screen reader through a decorative div. Raise the tagline from `text-paper/60` to `text-paper/70`. Ending the gradient at **66%** rather than 100% is the point: today `to-transparent` only reaches zero alpha at the card's top edge, so every pixel of every collection photograph on the brightest band of the page is dimmed by up to a quarter — including the sky, which is the part of a range photograph that carries the light. Measured on a 3/2 plate under a blown-out sky: name `--paper` **7.26:1** (16.57:1 on a dark frame), tagline at `/70` **6.13:1**, against today's 5.15:1 and 4.05:1. The 9px `--sage` label is deleted in this branch too — it does not survive at any gradient.

---

## 4. Removals, argued

**The scrim (`:89`), in items 1 and 4.** It was built to hold 24px of type and is spread across the whole frame: `via-ink/25 to-transparent` reaches zero alpha only at the card's top edge, so every photograph in this band is dimmed by up to 25% throughout — three muted plates on a cream ground, with the imagery doing none of the arguing. It also fails at the one job it has. The caption stack is a fixed ~116px at every breakpoint while the card is 308px tall at 1440 and 224px at 1024, so the type occupies 38% of the plate at 1440 and **52%** at 1024 and sits in the thin half of a gradient that reaches 25% ink at the 50% mark. Once the caption is on cream, no scrim is needed at all, and the photograph is returned at full value.

**The 9px `Collection` micro-label (`:91`).** Three defects in one 20-character div. It is a dead word — the eyebrow, the `h2`, the link and the destination URL all already say it. It is the smallest type in the section, 9px Archivo at 0.2em. And it is unreadable: `--sage` `#7BA46F` over the composited scrim at that height measures **1.02:1 at 1024px**, 1.18:1 at 390px, 1.48:1 at 1280 over a bright crop — missing AA by a factor of three, on admin-uploaded mountain photography, where a bright top of frame is the normal case rather than the edge case. Item 4 puts the one fact a visitor actually wants in that slot instead.

**`border-t border-rule` (`:54`), in item 3.** An enclosure species used as a divider, at the one seam the laws exempt. `#DDD7C6` on `#101E17` is **11.97:1** — a chalk line drawn across the full page width under a full-bleed dark hero. It does not disappear; it moves to the bottom edge, where it does real work the moment `ShopByCategory` stands down.

**`alt={c.name}` (`:81`), in item 1.** The `<h3>` two lines below prints the same string, so a screen reader announces every collection name twice per card. The hero's identical plate already gets this right with `alt=""` (`SummitHero.tsx:1350`).

**`hidden md:inline-block` on the link (`:65`), in item 2.** Below 768px this section — which, because act 2 is gated `!staticHero` (`SummitHero.tsx:930`, `:1276`), is the **only** collections surface a phone or a reduced-motion visitor ever sees on this page — offered no route to `/collections` at all. `ShopByCategory` directly beneath it ships an explicit `md:hidden` link for exactly this reason (`:137–142`); this section just dropped its exit.

**The three-crop ladder (`:76`), in item 6.** `4/3 → 3/4 → 4/3` re-centre-crops one admin-framed photograph three ways, and the portrait window exists only across a 256px band — which is the width where the hero's rack of portraits is freshest. One crop, one object.

**The stale comments (`:7–10`, `:48–53`), in item 9.** A file whose comments describe a different ground, a different hour and a different neighbour is how a section gets rebuilt wrong by the next person to open it. This one has already outlived two re-cuts.

---

## 5. Killed in judging — on the record

- **Nine 44px product squares across the bottom of the three cards ("one tap to a garment")** — a marketplace widget on a Dehradun outdoor brand's front door, fatal on look alone at any level of execution. It also passed `src={p.images?.[0] ?? ''}` to `next/image` (an empty `src` is an error path), added nine tab stops in one row, and nested links inside a stretched overlay.
- **A section number "02" inline on the rule** — the masthead already carries a number (`05:50`); adding a second gives one line two numbering systems, one of which claims a page order nobody can see. It is also an orphan unless 03 and 04 adopt the other two species, and it is close enough to the chapter-index family that this client rejected **twice** (`HOMEPAGE-COUNCIL.md:137`) to be a poor thing to put in front of them. Item 2 takes the rule species without it.
- **Deepening the scrim (`ink/0.86` held to the 50% mark)** — makes half of every photograph effectively black across the three heaviest images on the light half of the page. It also contradicts item 11, which reaches better ratios by *ending* the veil at 66% instead of thickening it, and it buys legibility for a caption that items 1 and 4 move onto cream where it needs none.
- **A section-local gradient `BLUR_DATA_URL`** — the shared constant is already `#1a2e17` (`lib/constants.ts:24–25`), a hair off `--forest-deep`, not the near-black flash the proposal described. A duplicated base64 literal shadowing a shared constant buys nothing measurable.
- **A `rounded-full` mobile pill for the `/collections` link** — not on the radius ladder (`--r-bar` 2 through `--r-shell` 14 are stated as the only legal values), and it would give the same job two species within 500px of `ShopByCategory.tsx:137–142`, which sets it as a plain centred text link.
- **`--sage-lit` at 11px for the count** — the token is defined in `globals.css:41–46` as *large type on dark grounds only*. Using it at 11px is a token used against its own definition.
- **`--light` for the masthead unit and the count line** — `#94917F` on `--paper` measures **2.91:1**. It cannot carry text at 10px. Both slots take `--mid` (7.26:1).
- **Moving the cap into the exported `pickCollections`, and deleting the hero's `MAX_RANGES`** — deliberately changes act 2's behaviour from inside section 2's plan, in a file whose council is closed and built. Item 5(b) caps in the component and gets the same protection with none of the reach.
- **`style={{ maxWidth: shown.length * 420 }}` with `auto-fit` for the 1- and 2-collection cases** — contrived, as its own proposal conceded. Item 5(d) does it with three literal class strings.
- **Claiming `collections.gradient` has no storefront consumer** — false. `ShopContent.tsx:220` renders it. The *finding* survives (this row ignores it, item 7), the framing does not.

---

## 6. Open questions for the client

1. **The plate: dark poster, or index entry?** This is the one that decides items 1, 4 and 11. Show two stills at 1440 and two at 390. The argument for the index: the dark scrimmed plate is already spent twice on this page above and below this band, and the photographs come back to full brightness. The cost: ~1,175px of phone scroll against today's ~830, and a look some will read as quieter.
2. **The heading.** "Three collections. One philosophy." came from the 23 August brief. "The mood changes. The make does not." says the philosophy the current line only promises. Is replacing it sharpening the brief, or overwriting it? The rule, the live count and the sub-line ship either way; the revert is one ternary, spelled out in item 2.
3. **The sub-line names the goods.** The council record says the hero sentence keeps its wording and that "if the frame is to name the goods, it must be somewhere other than this sentence" (`HOMEPAGE-COUNCIL.md:138`). This section is the somewhere. Confirm that "printed one at a time in Dehradun" as a supporting line here reads as taking that note, not as reopening it.
4. **Scope.** Item 8 edits `app/admin/homepage/HomepageEngine.tsx`; item 5(c) edits `app/page.tsx`; the optional half of item 6 edits one `sizes` string in `SummitHero.tsx`. Approved?
5. **The eyebrow format, site-wide.** Item 10 is right by Law 3 and wrong by consistency: five other sections print `stopEyebrow()`'s joined string. Split it everywhere, or nowhere. Which?
6. **Two warm washes on one page.** `DesignYourOwn.tsx:38` already runs a warm radial two sections below — and it is `rgba(215,169,106,0.20)`, which is **not** `--dawn` `#E39B3F`. Should that one be re-pointed at the token, dropped, or left as a second warm colour? "The ONE warm accent" is currently one accent and one near-miss.
7. **"First light" twice in one frame.** The eyebrow reads FIRST LIGHT and Mist & Morning's own tagline is "Fog, dew, first light." — they will sit a few hundred pixels apart. The tagline is catalogue copy the client owns. Change the tagline, or accept the echo?
8. **A four-collection store.** Item 5(b) caps at three, so a fourth ticked collection silently does not appear on the homepage (the admin copy in item 8 says so). Is three the rule, or should the row grow to a 2×2 at four?

**What I could not specify exactly:** the wash alpha — 0.13 is the measured ceiling before dawn over cream resolves past `--paper-warm`, but whether 0.13, 0.10 or 0.08 reads as *light* rather than *tint* is a screenshot decision at 1440 and 390, not a hex decision. The crop — 3/2 (273.8px of picture at the 1280 cap) versus 4/3 (308px, today's height); 3/2 is the differentiating choice and may read thin under a `100svh` hero. And whether the three **live** `image_url`s survive a landscape crop: they are admin-framed and unreviewable from here, so if a portrait-composed photograph loses its subject at 3/2 that is an admin re-crop, not a CSS fix.

---

## 7. How we will know it worked

**Widths, every time.** 320, 360, 390, 767, **768** (the `sizes` boundary), 1023, 1024, 1280 (the measure cap and `TrailSpine`'s `xl`), 1440, 2560. At every one: the page body never scrolls horizontally; the `h2` never sets on 1.5 leading; the masthead rule never collapses to zero width or pushes the count off the measure; the `/collections` link is visible and tappable at **every** width, including 320.

**Degraded and empty states, every time.**
- **0 active collections** — section returns `null` **and** the trail wrapper is gone, so `TrailSpine` does not announce "05:50 · First light" over nothing. This is the pass/fail on item 5(c).
- **1 collection** — one 411px card, left-aligned, in a 411px-capped grid; no 869px of blank paper. **2 collections** — 846px cap. **4 ticked** — exactly three render, and the admin panel says so.
- **A slug listed twice in `featured_collection_slugs`** (set it by hand in `store_settings.home_config`) — one card, no React duplicate-key warning in the console.
- **`image_url` null** — the admin's `gradient` fills the frame; with `gradient` also null, `--forest-deep`, never flat `--ink`.
- **`tagline` null** — the caption loses ~46px cleanly and the CTA moves up; the three cards are still baseline-aligned at the image because of `md:items-start`.
- **A collection with zero active products** — reads **Coming soon**, not "0 pieces"; the dead end at `app/collections/[slug]/page.tsx:65` is disclosed before the tap.
- **`ShopByCategory` stands down** (empty `essentials`) — this band's bottom hairline is the only thing between two `bg-paper` sections, and it is visible.
- **JavaScript off** — every collection name, tagline, count, price and link is in the server HTML and readable. Nothing in this section may depend on hydration.
- **`prefers-reduced-motion: reduce`** — a complete, still, legible band. The only motion here is a hover transform; nothing to stall, nothing to fade in.

**Measurements, before and after.**
- Caption contrast on the worst-case bright crop: today **1.02:1** (9px sage label at 1024), 3.23:1 (24px name at md). After: `--text` **16.82:1**, `--mid` **7.26:1**, `--forest` **9.48:1**, all on `--paper` — nothing under **7:1** anywhere in the block.
- Masthead: eyebrow `--forest` on the wash **≥ 8.5:1**; the unit and count on `--mid` **7.26:1** (verify `--light` appears nowhere — it is 2.91:1).
- Warm-pixel share of the band, sampled at 1440 across the top 40% (R > G + 12): **0% today → non-zero**, and the sampled colour at the very top must not exceed `--paper-warm` `#F1E9D7` in warmth, or the Law 1 step into `ShopByCategory` is gone.
- Bottom-edge seam: `--rule` on `--paper` **1.32:1** (was `--rule` on `#101E17` at 11.97:1 at the top).
- Network panel at 1440: count the renditions fetched per collection photograph. Two today (384 for act 2, 640 for the row); one if Q4 is approved.
- Hover duration: **200ms**, measured in DevTools, not read from the class.

**Interaction and reader passes.** Tab through the section: exactly one stop per card plus one for the masthead link, ring visible at every stop on cream. Run a screen reader across one card and confirm the collection name is announced **once**, not twice. Confirm no decorative div — wash, hairline segment, gradient fallback, arrow — is reachable or announced.

**Side-by-side, the actual test.** Screenshot the hero's act 2 (scrub to it at 1440), this row, and `ShopByCategory`, and put the three next to each other. If a stranger cannot say in one sentence what makes the middle one a different kind of object from the two either side of it, item 1 has not landed.

**Housekeeping.** Two notes from experience so nobody loses an afternoon: **a mobile check needs a full relaunch** — a stale bundle looks identical to "my change didn't work" — and **the browser pane must be visible**, or screenshots come back blank and `innerWidth` reads 0, which makes a correct responsive layout look broken. And never build a Tailwind class by string interpolation in this repo; item 5(d)'s three variants are literals for that reason.
