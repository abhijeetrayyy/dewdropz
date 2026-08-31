# Choose Your Essentials — Action Plan

*Section 3 of the homepage. Written against `components/sections/ShopByCategory.tsx` (145 lines, server component), `components/sections/CollectionsRow.tsx`, `components/sections/DesignYourOwn.tsx`, `app/page.tsx`, `app/globals.css`, `lib/trail.ts`, `actions/categories.ts`, `app/admin/homepage/HomepageEngine.tsx`, `app/admin/categories/CategoriesClient.tsx` on branch `mobile-remediation`. Every line number, token value and contrast figure below was verified against the working tree. Where I could not specify a value exactly, it is in §6, not hidden behind an adjective.*

---

## 1. The verdict

This section is a photograph gallery with no photographs and no way to ever get one. `categories.image_url` is written by no migration and `app/admin/categories/CategoriesClient.tsx` contains the string `image` **zero** times — its form has Parent, Name, Slug, Description and nothing else (`:174–186`) — while `HomepageEngine.tsx:489–492` tells the operator that "each tile's picture is the category's own image, set in Categories." So `tile.image_url` is falsy for all four tiles, the `<Image>`, `sizes`, `placeholder="blur"`, `blurDataURL` and the 700ms hover scale at `:98–107` have never once executed, and what actually ships is four flat `bg-ink/60`-over-`paper-warm` rectangles — measured composite **#68675E** — with an ink scrim gradient painted on top of nothing. Every label in the section is then legible or not depending on where it lands in a ramp that exists to protect a picture that isn't there: the 9px `--sage` count line measures **3.47:1** at 1440 and **3.21:1** at 390 against a 4.5:1 floor. All four of those rectangles read `Coming soon`, all four link to `/shop?category=…` with zero results behind them, and the shop then hides the very filter that emptied the shelf. Roughly 600px of prime scroll, four dead doors, and it is the **second** dark-card grid in 800px — `CollectionsRow` directly above uses the same recipe line for line, on a ground only **ΔL\* 4.0** away, under the same mono-eyebrow-over-Fraunces-heading opening that `DesignYourOwn` then uses a third time.

The fix is to stop pretending. The eyebrow says **06:40 · PACK CHECK** — so make the section a pack list: **five hairline-ruled rows read down the full measure, on a ground that is a real step deeper, each row carrying a small catalogue stamp, the name at 36px, the words that say what the thing is for, and the count as an actual figure in mono on the right.** No dark slabs, no scrim, no text burned into a photograph that cannot load, no 4-up grid that only composes at multiples of four. The picture well does not disappear — it becomes an 64×80 stamp that holds a real product photograph the instant one exists (the catalogue already carries `images: string[]`, and this component already has it in props), and until then holds a field of first light instead of a dead grey. LAW 2 says a row is held by a hairline; this is that sentence, built. Everything below is that idea, itemised.

---

## 2. What stays — do not touch

| | Why it is right |
|---|---|
| **`pickEssentials` is exported and called twice.** `ShopByCategory.tsx:32–45`, `app/page.tsx:65` and `:99–103`. | The section sits inside a `data-trail-*` wrapper that puts a chapter on the trail HUD. A page that guessed differently from the section would advertise a stop that is not on the page. One function, both callers. Item 7 changes what it returns; it does not change that contract. |
| **The stock rule, and the editorial override of it.** `:19–31`, `:37–44`. | The 23 August brief says "keep Caps, Coffee Mugs, Bottles, Tumblers (4 Items)" for a range still being photographed. An explicit admin pick is honoured as given. Proposal 19 wanted to overrule it and was killed (§5). |
| **`if (stocked.length === 0) return null`** (`:65`) and the `essentials.length > 0` gate at `app/page.tsx:99`. | Constraint: conditional sections must degrade to nothing gracefully. Both halves already do, together. |
| **The heading text, verbatim.** "Choose Your Essentials". | The client wrote it, and the council record shows this client reverting a copy rewrite the *same day* it shipped (`HOMEPAGE-COUNCIL.md:110–113`, the hero sentence). Every proposal that replaced it is in §5 or §6, never in §3. |
| **"Browse Everything →"**, the client's own string. | It survives — as one element instead of two (item 1). |
| **Whole-row link, not a link inside a row.** Today's tile is one `<Link>` wrapping everything (`:93`). | Correct target size, correct affordance. The manifest keeps it; item 9 only fixes what it announces. |
| **`{count === 0 ? 'Coming soon' : …}` as a rendered state**, not a hidden row. | The brief pins four tiles that have no stock. Hiding them would empty the section the brief asks for. The wording changes (item 4); the state stays. |
| **Zero JavaScript.** No `'use client'`, no effect, no hydration in this file. | Constraint 1. Every item below is server HTML and CSS. Nothing here needs a client component and nothing below adds one. |

---

## 3. The action plan

Table and specs share the same numbering. Items **1, 2 and 3 alone change what this section is** on a phone and on a laptop.

| # | Action | What | Why | Effort | Priority |
|---|---|---|---|---|---|
| 1 | update | The grid of four dark tiles becomes five hairline rows | The card species requires a photograph the data cannot supply; the grid only composes at multiples of 4; at 390px the CTA wraps under its own underline | 4h | **P1** |
| 2 | update | The picture well becomes a 64×80 stamp with a real source and a dawn field behind it | `image_url` has never rendered; every product already carries `images[]`; the empty state should read as first light, not as dead grey | 2h | **P1** |
| 3 | update | New ground, drawn edges, and a different opening species | `paper-warm` is ΔL\* 4.0 from its neighbours; this is the only band on the run with no `border-t`; three sections in a row open identically | 1.5h | **P1** |
| 4 | update | Honest status: mono figure, starting price, no link into an empty shop | The loudest string in the section is an apology printed four times over four dead doors | 1.5h | **P1** |
| 5 | remove | Both `Browse Everything →` links; the decorative CTA span inside each tile | Two copies of one link with different behaviour; a fake CTA inside a real link | 30m | **P1** (rides in 1) |
| 6 | update | One fold over `products` replaces two O(n·m) passes; `sizes` corrected; transform guarded | The `sizes` string is wrong at exactly 1024 and asks 480px for a ≤302px box; the 700ms scale has no reduced-motion guard | 45m | **P1** (rides in 2) |
| 7 | update | `pickEssentials` caps the render at 8 | Nothing bounds the count; 50 categories render ~5,000px of homepage | 20m | P2 |
| 8 | add | The category image field the admin has never had, and the admin sentence that lies about it | `HomepageEngine` sends the operator to a screen with no such field | 1.5h | P2 |
| 9 | update | One accessible name per row; description on the phone | The tile announces as one link made of four phrases; the description is `hidden` below 640px | 30m | P2 |
| 10 | update | Category mutations revalidate `/` | Renaming a slug silently deletes the section and its HUD chapter; this has already bitten the repo once | 30m | P3 |
| 11 | remove | Dead imports, dead comments, redundant optional chaining | `Image`/`BLUR_DATA_URL` become unreachable only if item 2 is skipped; two comments contradict the code | 20m | P3 |

---

### The specs

**1 — The pack manifest.**
Delete the grid block (`:89–133`) and both `Browse Everything →` links (`:81–86`, `:135–140`). In their place, one list:

```
<ul className="mt-10 border-b border-rule-warm">
```

Each essential is one `<li className="border-t border-rule-warm">` wrapping a single element — a `<Link href={`/shop?category=${tile.slug}`}>` when the row has stock, a `<div>` when it does not (item 4) — carrying:

```
group grid grid-cols-[48px_minmax(0,1fr)] gap-x-4 items-start
md:grid-cols-[64px_minmax(180px,0.85fr)_minmax(0,1.55fr)_150px] md:items-center md:gap-x-6
-mx-4 px-4 py-4 md:py-5 rounded-[var(--r-bar)]
transition-colors duration-200 ease-[var(--ease-out)] hover:bg-surface
```

Four cells: **stamp** (item 2) · **name** · **description** · **status** (item 4). Below `md` the last three stack inside column 2; from `md` they are three columns. The closing row is the same `<li>` with an **empty stamp cell**, so every name in the list starts on the same x, the name reading `Browse everything` in `text-forest`, and the status cell carrying only the arrow.

- Name: `font-display text-[clamp(24px,3vw,36px)] leading-[1.05] text-text transition-colors duration-200 group-hover:text-forest`
- Description: `font-body text-[13px] leading-relaxed text-mid line-clamp-2` — **no `hidden sm:block`**; it renders at 390px for the first time. `line-clamp-2` is the guard against a free-text admin field: `categories.description` has no length limit, and the four seeded strings ("Top off your adventure.", "Sip. Pause. Reset.", "Hydrate. Explore. Repeat.", "Hot or cold, always with you.") are all under 30 characters, so nothing clips today.
- Status cell: `justify-self-end text-right` (item 4).
- Arrow: its own `<span className="ml-3 inline-block text-forest transition-transform duration-200 ease-[var(--ease-out)] motion-safe:group-hover:translate-x-1">→</span>`.

**Track widths, resolved** (container `max-w-7xl`, section `px-6 md:px-10`): at **768px** the container is 688, fixed tracks 64 + 150 = 214, three 24px gaps = 72, leaving 402 — the name track floors at its 180px minimum and the description gets 222px (≈27ch at 13px). At **1024px**: name 233, description 425. At **1440px** (container capped 1280): name 352, description 642. The name never has less than 180px and "Coffee Mugs" sets at 132px at 24px type and 198px at 36px, so no seeded name wraps; a longer admin name wraps to two lines and the row grows, which is why the row is `items-start` below `md`.

**The `-mx-4 px-4` hover plate is safe at every width**: the section pads `px-6` (24px) below 768 and `px-10` (40px) above, both greater than the 16px bleed, so the plate never touches the viewport edge and the page body never scrolls horizontally. The plate is `--surface` `#FFFFFF`, **1.394:1** against the `--paper-deep` ground of item 3 — a plate you can see, and every text token gains contrast on it (`--mid` 5.33:1 → 7.43:1, `--forest` 7.41:1 → 10.33:1).

**Height, stated honestly.** At 1440 the band goes from ≈756px to ≈975px — **+219px**, and on a 390px phone from ≈824px to ≈962px, **+138px**. It trades height for legibility; it does not save space, and I will not claim it does. What it buys: 378px of grey rectangle becomes 4 rows of readable type, and the section stops needing a photograph to make sense.

**2 — The stamp, and first light behind it.**
The picture slot survives at catalogue scale, in the first cell of every row:

```
<div className="relative h-[60px] w-[48px] md:h-[80px] md:w-[64px] shrink-0 overflow-hidden
                rounded-[var(--r-input)]
                bg-[linear-gradient(160deg,var(--dawn-soft)_0%,var(--paper-warm)_72%)]">
```

`r-input` — not `r-stamp` — because the ladder's own comment reads *"inputs, photo tiles, date chips, hover plates"* for 6px and *"a caption burned into a photograph"* for 3px (`globals.css:92–95`). This is the photo tile, not the caption on it. Write `rounded-[var(--r-input)]` in full: this repo is Tailwind v4, where the bare `[--r-input]` form compiles to nothing, silently.

**Source order:** `tile.image_url ?? summary.image ?? null`, where `summary.image` is the newest listed product's first frame from that category (item 6). `images: string[]` is already on `ProductWithCollection` (`types/database.ts:270`) and `products` is already a prop of this component, so the photograph costs **no new query**. `getProducts` orders `created_at` descending (`actions/products.ts:34`), so "newest listing" is accurate. The moment anyone sets a real category image it wins, because it is first in the chain.

When a source exists:

```
<Image src={src} alt="" fill sizes="(min-width:768px) 64px, 48px"
  placeholder="blur" blurDataURL={BLUR_DATA_URL}
  className="object-cover transition-transform duration-[240ms] ease-[var(--ease-out)]
             motion-safe:group-hover:scale-[1.04] motion-reduce:transition-none" />
```

`alt=""` because the category name is the next cell and a screen reader should not hear it twice.

When no source exists — which is **all four tiles today** — the gradient is the whole cell: `--dawn-soft` `#F6DCA8` falling to `--paper-warm` `#F1E9D7` at 160°. This is the section's one warm move and the only place `--dawn`'s family appears in the band. It is legitimate here specifically: the stop is 06:40, the light is arriving, and the objects that have not arrived yet are the ones lit. **No text sits on it**, so there is no contrast obligation and no photograph can later break one. Deliberately *not* taken: a `--dawn` bar across each row, a warm wash across the whole band, and `--dawn` on the "In production" label — see §5. `DesignYourOwn` directly below already carries a warm radial glow and `ContourLines`; four 64×80 plates do not compete with a band-wide wash, but if the two bands read as one warm stretch in the render, this is the one to keep and 04's off-palette `rgba(215,169,106,0.20)` is the one to look at.

**3 — Ground, edges, and a different way in.**
`:69` becomes:

```
<section className="bg-paper-deep border-t border-rule-warm px-6 md:px-10 py-20 md:py-24">
```

Three fixes in one line. **Ground:** `--paper-deep` `#E7D9BE` measures **1.279:1 / ΔL\* 9.4** against the `--paper` above and below it, against today's `--paper-warm` at **1.109:1 / ΔL\* 4.0** — LAW 1's one step, in fact rather than in name. **Edge:** both neighbours carry `border-t` (`CollectionsRow.tsx:54`, `DesignYourOwn.tsx:34`) and this is the only band on the run rendering its seam by value alone. `--rule-warm` `#D2C4A4`, not `--rule` — globals declares it for exactly this case (*"rules that sit on paper-warm / paper-deep"*, `:69`), and `--rule` measures **1.031:1** on `paper-deep`, i.e. invisible, against `--rule-warm`'s **1.238:1**. **Padding:** `pt-20 pb-24 md:pt-24` has no `md:pb` override, so mobile is 80/96 and desktop 96/96 against symmetric neighbours; `py-20 md:py-24` matches `CollectionsRow` exactly.

The header (`:71–87`) becomes the third opening species — a rule across the measure with the heading inline — because `CollectionsRow`, this section and `DesignYourOwn` currently open identically (mono eyebrow, uppercase, `tracking-[0.2em]`, `text-forest`, over a Fraunces `clamp()` h2), differing only by a 3px eyebrow size. LAW 5 names three sections opening the same way as the specific cause of a page reading machine-made; this is that, exactly, in the middle of the run.

```
<div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 border-b border-rule-warm pb-5">
  <h2 id="essentials-heading" className="font-display text-[clamp(32px,4.4vw,46px)] leading-[1.05] text-text">
    Choose Your Essentials
  </h2>
  <div className="ml-auto hidden md:flex items-baseline gap-2 text-[10px] tracking-[0.2em] uppercase">
    <span className="font-mono tabular-nums text-forest">{stop.time}</span>
    <span className="text-mid">{stop.label}</span>
  </div>
</div>
```

Add `aria-labelledby="essentials-heading"` to the `<section>`.

Three details inside that. **The heading is the client's own string, unchanged.** **`leading-[1.05]`** fixes a real defect: the h2 sets no leading today and inherits preflight's 1.5, an 81px line box on 54px type — 27px of dead air — while the equivalent h2 one section down sets `leading-[1.03]`. **The clamp drops from `clamp(34px,5vw,54px)` to `clamp(32px,4.4vw,46px)`**, the same ceiling as `CollectionsRow`, so the run reads 46 / 46 / 54 — two sizes with a reason (the studio is the page's largest commercial ask) instead of three near-misses at 46 / 54 / 54. **The eyebrow splits**: `stopEyebrow()` returns one string and this file stops calling it, so mono carries `06:40` — a figure — and Archivo carries `Pack check`, two words. That is LAW 3 in both directions, which the file currently breaks in both directions inside forty lines. Drop the `stopEyebrow` import here only; `CollectionsRow` and `DesignYourOwn` still use it and the export stays. **No section numeral.** Numbering lives in the list, and a numeral plus a clock at the top of a section is one step from the chapter-index rail this client rejected twice (`HOMEPAGE-COUNCIL.md:137`).

The lede at `:77–79` moves below the rule and stops being a synthesized oblique:

```
<p className="mt-5 max-w-[46ch] font-body text-[15px] leading-relaxed text-mid">
  First light, and the pack is open. Everything here is printed to order in Dehradun.
</p>
```

`font-display italic` is a **browser-synthesised shear** — Fraunces loads with `axes:['opsz']` and no italic style (`app/layout.tsx:49–54`), and the council blocked loading the real face (`:139`). It is also neither voice: Fraunces speaks, Archivo explains, and this line explains. `--mid` on `--paper-deep` measures **5.33:1**. The council explicitly left this move open — the hero sentence may not name the goods, "but if the frame is to name the goods, it must be somewhere other than this sentence" (`:138`). This is somewhere other. The original line is one revert away and is in §6.

**4 — Honest status.**
The status cell, right-aligned, 150px from `md`:

*Stocked* — two lines, mono carrying only figures:

```
<div className="font-mono tabular-nums text-[11px] tracking-[0.06em] text-text">From {formatPrice(from)}</div>
<div className="mt-0.5 font-body text-[10px] tracking-[0.14em] uppercase text-mid">
  <span className="font-mono tabular-nums text-text">{count}</span> {count === 1 ? 'piece' : 'pieces'} <arrow/>
</div>
```

`formatPrice` is `lib/utils.ts:12` and takes **paise**, which is what `products.price` holds. "12 PIECES →" sets at ~85px and "From ₹1,299" at ~70px, both inside 150px.

*Unstocked* — one line, and **the row is not a link**:

```
<div className="font-body text-[11px] tracking-[0.14em] uppercase text-mid">In production</div>
```

`In production` rather than `Coming soon`: the same promise, in the register of a shop that prints to order. `--mid` **5.33:1**. Note for whoever builds this: `--clay-deep` is the tempting warm token here and it **fails** — its documented 5.79:1 is against `#FFFFFF`; on `--paper-deep` it measures **4.16:1**, under AA at 11px. `--ember` is worse at **2.88:1**. `--forest-mid` scrapes through at 4.56:1. Use `--mid`.

The row is a `<div>` because there is nothing behind the door: the only `INSERT INTO product_categories` in the repo (`050_launch_taxonomy.sql:63`) links t-shirts, hoodies and sweatshirts, and `092_client_brief_23aug.sql:105–108` says in its own comment that nothing is listed against caps, coffee-mugs, bottles or tumblers. `/shop?category=caps` returns nothing *and* hides the filter that emptied it, so the visitor cannot even see what they need to undo. That is the exact dead end this component's own docstring says the stock rule exists to prevent (`:19–23`).

Because today every row is unstocked, the band would otherwise ship with one click target. So, immediately under the list, gated on `stocked.every(t => count === 0)`:

```
<p className="mt-6 max-w-[54ch] font-body text-sm leading-relaxed text-mid">
  None of these are listed yet — <Link href="#dispatch-email"
  className="border-b border-forest/40 pb-0.5 text-forest transition-colors duration-200 hover:border-forest">join
  the dispatch</Link> and you&rsquo;ll hear the day they are.
</p>
```

`#dispatch-email` is a real target — `NewsletterBar.tsx:105`, the same page. This is a link to an existing field, **not a second form**: `NewsletterBar` is the last section of this page and two email captures on one scroll is one too many. The line disappears the moment any row has stock, and every row becomes a link again with a price and a count, with no further change.

**5 — Two removals that ride in item 1.** Argued in §4.

**6 — One fold, a correct `sizes`, and a guarded transform.**
`:43` filters `categories` by scanning `products`, then `:91` re-scans `products` per tile with the identical predicate — O(n·m), twice, for two answers that come off the same join. Replace both with one pass, built once above the return:

```
type Summary = { count: number; from: number; image: string | null }
const summary = new Map<string, Summary>()
for (const p of products) {
  for (const pc of p.categories ?? []) {
    const s = summary.get(pc.category_id)
    if (!s) summary.set(pc.category_id, { count: 1, from: p.price, image: p.images?.[0] ?? null })
    else { s.count++; s.from = Math.min(s.from, p.price); s.image ??= p.images?.[0] ?? null }
  }
}
```

`pickEssentials` keeps its own predicate — it is exported and `app/page.tsx` calls it before this component exists — but the render reads the map.

**`sizes`** at `:103` is wrong twice: `(max-width: 1024px) 50vw, 25vw` still matches at exactly 1024, where `lg:grid-cols-4` has *already* fired (Tailwind's `lg` is `min-width: 1024px`), and 25vw of a 1920 viewport asks for 480px when the container caps at 1280 and the tile is ≤302px. With item 2 the stamp is a fixed box and the string becomes exact: `sizes="(min-width:768px) 64px, 48px"`.

**The transform.** `group-hover:scale-105` at `:106` runs 700ms and is guarded by nothing — `globals.css` has exactly two `prefers-reduced-motion: reduce` blocks (`:714`, `:1100`) and neither covers it. Item 2's replacement is `motion-safe:group-hover:scale-[1.04]` at 240ms, inside LAW 6's 140–260ms micro-motion band. Nothing in this section is ambient, nothing loops, nothing animates on entry, and no opacity is animated on content — the page's one choreographed moment stays in the hero.

**7 — Cap the render at eight.**
`grid grid-cols-2 lg:grid-cols-4` has no slice and no minimum: the admin picker appends every ticked category in tick order with no bound (`HomepageEngine.tsx:104–107`), and the departments `apparel` and `drinkware` are tickable too. Fifty categories render thirteen rows of tiles in the middle of the homepage. The list of item 1 fixes the *ragged row* half of this for free — a list composes at 1, 3, 5 or 7 where a 4-up grid does not, so proposal 19's `length < 2` guard is no longer needed — but not the *fifty* half. Add `.slice(0, 8)` to **both branches inside `pickEssentials`**, not at the call site, so `app/page.tsx:65` and the component cannot disagree about whether the section exists. Then say so in the admin: `HomepageEngine.tsx:465–468` gains "The first eight are shown."

**8 — Give the category an image, and stop lying about it.**
`app/admin/categories/CategoriesClient.tsx:184–186` has Name, Slug and Description and nothing else, while `HomepageEngine.tsx:489–492` tells the operator the tile's picture is "the category's own image, set in Categories." One of those two has to change; both should. `actions/categories.ts:87` and `:137` already accept `image_url` on create and update, and `components/admin/ImageUploader.tsx` already exists and is wired to a `'use server'` upload boundary. Copy `CollectionsClient.tsx:194–204` verbatim into the category dialog:

```
<ImageUploader bucket="COLLECTIONS" multiple={false}
  value={form.image_url ? [form.image_url] : []}
  onChange={(urls) => setForm({ ...form, image_url: urls[0] ?? '' })} />
```

and add `image_url: ''` to `emptyForm`. **Bucket caveat, deliberately not hidden:** `STORAGE_BUCKETS` (`lib/supabase/storage.ts:4–14`) has no `CATEGORIES` entry, and `ensureBucketsExist()` at `:86` is **called by nothing in the repo** — buckets are created by hand in the Supabase dashboard. Reusing `COLLECTIONS` ships today with no ops step and a mis-named path; adding `CATEGORIES: 'categories'` is one line of code plus one manual bucket creation. That is Q5.

Then correct `HomepageEngine.tsx:489–492` to describe what the section actually renders: name, description, stamp and piece count, with the stamp falling back to the newest product in that category.

**9 — What a row announces, and what a phone reads.**
The `<span>` at `:122–128` is a decorative CTA inside a `<Link>`, so today a screen reader hears the whole caption as one link name — "Bottles Coming soon Hydrate. Explore. Repeat. Shop Bottles →". Item 5 deletes it. In its place, on the stocked row's `<Link>`: `aria-label={`${tile.name}, ${count} ${count === 1 ? 'piece' : 'pieces'}`}` — **name first**, so a voice-control user can still say the words they can see. Unstocked rows are `<div>`s and are not announced as links at all.

Two things this fixes for free. The description stops being `hidden sm:block` (`:118`), so a 390px visitor reads what the thing is for — the phone currently gets a name, a failing-contrast apology and a broken underline. And the focus ring becomes correct without touching it: the section has no `.on-dark`, so `:focus-visible` draws `2px solid var(--forest)` at 3px offset (`globals.css:620–624`) — today that light-ground ring lands on `paper-warm` outside a wholly dark object; on the item-3 ground it is **7.41:1** around a light row, which is what that rule is for.

**10 — A pinned slug is an unmanaged reference.**
`updateCategory` accepts a slug change and `deleteCategory` removes rows (`actions/categories.ts:131–176`); neither touches `home_config.featured_category_slugs` and both revalidate only `/admin/categories`. `pickEssentials` then drops the unknown slug silently — and if all four go, the section *and* its `data-trail-*` HUD chapter vanish with no message anywhere. This has already happened once: migration 092 renamed `mugs` to `coffee-mugs` and had to rewrite `home_config` in the same file to stop the tile disappearing (`092:74–79`, `:117–120`). Minimum fix: add `revalidatePath('/')` to `updateCategory` and `deleteCategory`, so the homepage reflects the change immediately rather than within `revalidate = 60`. Better fix, if the client wants it: `HomepageEngine`'s picker flags a pinned slug that no longer resolves. That is Q6.

**11 — Dead code and lying comments.**
With item 2, `Image` and `BLUR_DATA_URL` stay in use, so nothing is orphaned — but the `bg-ink/60` fill and the scrim `<div>` at `:109` go, and with them every contrast finding in the recon. Drop `p.categories?.` optional chaining in the fold: `types/database.ts:610` declares `categories: ProductCategory[]` non-null and `getProducts` always embeds it (`actions/products.ts:26–27`); one `?? []` at the loop boundary is the honest amount of paranoia. Fix the section comment at `:68` — it says "Early afternoon on the page's clock" over a stop that reads 06:40 since the trail was re-cut. Fix `CollectionsRow.tsx:48–53` while you are next door: its comment says it "takes `paper-deep` rather than `paper`" and that "The Climb sits directly above" — the class is `bg-paper` and what sits above is `SummitHero`. Both halves are false, and a false comment about ground is exactly what produces a ΔL\* 4.0 seam.

---

## 4. Removals, argued

**The dark card grid (item 1).** It is a photographic species with no photograph and no route to one — the `<Image>` branch at `:98` has never executed in production, so the `sizes`, `placeholder`, `blurDataURL` and hover scale beneath it are code nobody has ever seen run. What is left is `bg-ink/60` over paper-warm, measured `#68675E`, with a gradient painted over nothing, and every label's legibility set by where it happens to land in that ramp: the count line measures 3.47:1 at 1440 and 3.21:1 at 390. It is also the **second** such grid in 800px of scroll — `CollectionsRow.tsx:74–95` and `ShopByCategory.tsx:93–130` are the same object with a different aspect ratio and two different gradient stops. Deleting it removes a contrast failure, a duplicate species, a 4.4× area cliff at one pixel of viewport (459×574 at 1023px, 218×272 at 1024px), and a layout that only composes at multiples of four — in one move.

**The scrim (`:109`).** A gradient whose entire job is to protect text from a photograph. There is no photograph, and after item 1 there is no text on the image either. It is the reason a single token spans 3.54:1 to 5.99:1 inside one card.

**The second `Browse Everything →` (`:135–140`, item 5).** Two copies of one link with divergent treatment: the desktop copy has `hover:text-text transition-colors duration-300`, the `md:hidden` copy has neither. The header row that holds the first is `flex items-end justify-between` whose only other child is `hidden md:inline-block` — so that row has been decorative on every phone since it was written. One closing row, one treatment, one hover, at every width.

**The CTA span inside the tile (`:122–128`, item 5).** A decorative span styled as a control, inside a control. It is why the tile announces as four phrases, and at 390px "SHOP COFFEE MUGS →" measures ~133px into ~123px of caption width and **wraps under its own `border-b`**, so three of four rows break their underline in half and one does not. The row is the link; the arrow and the hover plate carry the affordance.

**`hidden sm:block` on the description (`:118`, item 9).** It deletes the only sentence in the section that says what a category is for, on every phone. It exists because the caption block had no room inside a 163×204 tile — 58% of which was caption. In a row there is 222–642px of room.

**The section numeral (declined, item 3).** The list is numbered by being a list; a numeral and a clock at the head of the section is the payload of `TrailSpine`, which this client rejected twice.

---

## 5. Killed in judging — on the record

- **"If the grid survives — the minimum that makes it correct"** — FATAL. After shipping it the band is still four dark empty slabs, and it deliberately deepens the scrim to `from-ink/90` over a photograph that cannot exist. Its own risks paragraph concedes "acceptable as an interim, not as the answer". Its two salvageable parts — the corrected `sizes` string and a `motion-safe` guard on the 700ms transform — are both carried by item 6, so nothing is lost.
- **Proposal 19, "Pinned first, stocked always, capped at eight"** — reverses a decision already made and documented at length in `pickEssentials`, and interleaves four empty rows with three garments this page already shows twice below (`SeasonKit`, `TheClimb`). The `.slice(0, 8)` half survives as item 7 and the tablet-column half is moot once the grid is gone.
- **A `--dawn` bar across each unstocked row (proposal 8)** — the palette reasoning was the most disciplined in the set, and its own mixed-state guard means it renders on *nothing* today, since all four rows are unstocked. Item 2 spends the same accent where it is actually visible: the empty picture well. Do not ship both.
- **A directional warm wash across the whole band (proposal 11)** — measured at 1.085:1 against the ground, which this client may simply not perceive, and it collides with `DesignYourOwn`'s existing warm radial one section down. Keep one warm move; item 2 is it.
- **Inverting the band to white cards (proposal 6)** — its ground argument is right and is taken as item 3; its card half is superseded. `--surface` is the only non-warm value in the palette and four white blocks on aged cream is how a considered page becomes a SaaS pricing table. `--surface` survives as the row's hover plate, where it lasts 200ms.
- **The caption plate under the photograph (proposal 18)** — the most defensible contrast argument in the set, and it makes section 03 look *more* like section 02, which is the rhythm failure it was meant to help. It solves legibility by deepening duplication.
- **A waitlist form under the grid (proposal 20)** — the plumbing checks out (`subscribeToNewsletter` at `actions/reviews.ts:129` takes a free-text source and is rate-limited 10/600s; a native `<form action={serverAction}>` posts with JS off). Killed on placement: `NewsletterBar` is the last section of this page. Item 4 links to that field instead of building a second one.
- **Rewriting the h2 to "What goes in the pack." or "Caps, bottles, mugs, tumblers."** — both are better lines than the one that ships. Both overwrite copy the client wrote, and the council records this client reverting exactly that, same day, in section 1. They are in §6 as a question, not in §3 as a change. The second also hardcodes four nouns against an admin checkbox list.
- **Setting the count as "12 PIECES" in mono (proposal 9)** — mono takes the figure, Archivo takes the word. Item 4 splits them.
- **Adding `{stop.alt}` to the eyebrow (proposal 12)** — a clock time plus an altitude in one line is the payload of the element the client rejected twice. The surviving half is item 3's mono/Archivo split.
- **A `hidden sm:inline-block` CTA and a hardcoded "Four things worth carrying" (proposal 10)** — half of its lede is the best line in the copy set and is taken into item 3; the other half is a literal count against an admin-editable pick, and the offered mitigation (interpolate a number word) is more machinery than the sentence is worth.

---

## 6. Open questions for the client

1. **The heading.** "Choose Your Essentials" ships unchanged. Two alternatives were written and are one line each: **"What goes in the pack."** and **"Caps, bottles, mugs, tumblers."** Show them beside the original as stills rather than swapping — but if either is wanted, say so before build, because the second one stops being true if the four ticked categories change.
2. **The lede.** Out: *"Trail Companions — From the cap on your head to the bottle in your pack."* In: *"First light, and the pack is open. Everything here is printed to order in Dehradun."* Does that read as sharpening, or as losing a line you liked? The revert is one string.
3. **The unstocked rows are not clickable.** Caps, Coffee Mugs, Bottles and Tumblers have no products, so tapping them today lands on an empty shop whose filter cannot be seen or removed. This plan makes them read "In production" and not respond, with one dispatch link under the list. The alternative — keep them as links into the empty result — is a dead end we would be shipping knowingly. Which?
4. **"Coming soon" → "In production".** Your wording, changed. Fine, or put it back?
5. **Where category photographs are stored.** Reuse the existing `collections` bucket (works today, no setup, mis-named path) or create a `categories` bucket in Supabase by hand (`ensureBucketsExist()` is not called by anything). One is a one-line change; the other needs someone in the dashboard.
6. **Pinned slugs.** Renaming a category slug in the admin silently removes its tile — and if all four go, the whole section and its trail chapter disappear with no warning. Worth a warning in the picker, or accept it?
7. **Scope.** Items 8 and 10 touch `app/admin/categories/CategoriesClient.tsx`, `app/admin/homepage/HomepageEngine.tsx` and `actions/categories.ts`, all outside section 3. Item 11 corrects a false comment in `CollectionsRow.tsx`. Approved?

**What I could not specify exactly:** the stamp at 64×80 is a catalogue plate, not a hero image — whether it reads as intentional or as a thumbnail is a judgement that needs the first real photograph in it, and the fallback if it reads small is 80×100 at a cost of 20px per row. The 160° dawn gradient's stop at 72% is a starting value and needs eyes at 390 and 1440 before it is called finished. And the `--surface` hover plate at 1.394:1 is deliberately quiet; if the rows do not feel tappable in the browser, the fix is the arrow and the name colour, not a louder plate.

---

## 7. How we will know it worked

**Widths, every time.** 320, 360, 390, 768, **1023 and 1024**, 1440, 2560. At every one: the page body never scrolls horizontally; the `-mx-4` hover plate never touches the viewport edge; every row's name starts on the same x, including the closing row with its empty stamp cell; and **nothing changes size by more than one step across 1023→1024** — that seam currently moves a tile from 459×574 to 218×272, a 4.4× area cliff, and after item 1 it should be invisible.

**Degraded states, every time.**
(a) **JavaScript off** — the section is unchanged in every particular. It has no client component before or after; if anything differs, something was built wrong.
(b) **`prefers-reduced-motion: reduce`** — complete, still, legible. The only motion in the band is three hover transitions (plate 200ms, arrow 200ms, stamp 240ms) and the stamp's transform is `motion-safe:` only. No entry animation, no opacity on content, nothing to stall.
(c) **Zero essentials** — `pickEssentials` returns empty, the section returns `null`, and `app/page.tsx:99` drops the `data-trail-*` wrapper. Confirm the trail HUD does **not** advertise 06:40 · Pack check.
(d) **One essential** — one row plus the closing row. A list composes here where a grid did not.
(e) **Nine ticked categories** — eight rows render, the ninth is dropped, and the admin card says so.
(f) **A category whose newest product has an empty `images` array** — falls through to the dawn field, no broken frame, no layout shift.
(g) **A 200-character description** — clamps to two lines, row does not grow past two.
(h) **A 25-character category name** at 1440 — wraps to two lines inside the 352px name track; the row grows and the stamp stays top-aligned.

**Measurements, before and after.**
- The count/status line: **3.47:1 at 1440 and 3.21:1 at 390 today** (`--sage` 9px on the composited gradient at the caption's top edge) → **5.33:1 at every width**, at 11px, on a flat ground that no photograph can move.
- The description: 3.81:1 at 390 today *and hidden anyway* → **5.33:1, visible**.
- The CTA underline: `border-sage/50` at **1.95:1**, failing SC 1.4.11 → deleted.
- The ground seam above and below: **1.109:1 / ΔL\* 4.0 → 1.279:1 / ΔL\* 9.4**.
- The section hairlines: `--rule` on this ground would be 1.031:1; `--rule-warm` is **1.238:1**.
- Focus ring on a row: `--forest` at **7.41:1** on `--paper-deep`, visible at every stop, no `.on-dark` needed.
- Section height: **≈756px → ≈975px at 1440** and **≈824px → ≈962px at 390**. Both are increases. Record them rather than discover them.
- Clickable targets in the band: **5 today, all of them dead ends** (four empty-shop links plus one of two duplicate browse links) → **2 that go somewhere real** on today's data (the closing row and the dispatch link), rising to 6 the moment a product is listed against any of the four.

**Interaction passes.** Tab through the whole band and confirm a visible ring on every stop and that the unstocked rows are **not** stops. Read the band with VoiceOver and confirm each stocked row announces as "Caps, 4 pieces, link" rather than a sentence. Hover a row and confirm the plate, the name colour and the arrow all move and all settle inside 240ms. At 390px, confirm no line in any row wraps under its own rule and that the description is present.

**Housekeeping.** Two from experience, so nobody loses an afternoon. **The browser pane must be visible** or screenshots come back blank and `innerWidth` reads 0, which makes a correct responsive layout look broken. And **this repo's Tailwind v4 scans non-gitignored `.md` files**: a bracketed arbitrary-value class containing a `*` or `|` anywhere — including in a document like this one — emits invalid CSS and 500s every route, with the error pointing at `globals.css`, a file nobody touched. Every class string above uses valid values for that reason. Write `rounded-[var(--r-input)]`, never the bare `[--r-input]` form, which compiles to nothing without a warning.
