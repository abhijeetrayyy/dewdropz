# The climb — Action Plan

*Section 9 of the homepage. Written against `components/sections/TheClimb.tsx` (187 lines), `app/page.tsx`, `app/globals.css`, `lib/trail.ts`, `lib/constants.ts`, `lib/variants.ts`, `actions/settings.ts`, `app/admin/homepage/HomepageEngine.tsx`, `supabase/migrations/025|026|027` on branch `mobile-remediation`. Every line number and every contrast figure below was measured against the working tree, not recalled. Where a value could not be fixed exactly, it is in §6, not hidden behind an adjective.*

---

## 1. The verdict

This section is named after a climb and does not contain one. Its entire compositional idea — the dashed rail, the node dots, the left/right alternation — is gated behind `sm:` and `md:`, so the phone that most of this traffic arrives on gets three stacked 4:3 tiles with a number floating over them and no route at all, for roughly 2,000px of scroll. Above 640px, where the idea does exist, two organising systems fight: the rail anchors reading to the left gutter while the alternation throws every other row's copy to the far right, so at 1440 a flipped row's words start ~570px from the node that is supposed to be labelling them, and the node itself sits 3.5px off the 1px rule it is meant to pierce. Three other facts finish the diagnosis. **The day arc runs backwards for 1,500px:** the stop is `17:50 · 3,500M` and the band renders on `--paper #F8F5ED`, which `globals.css:32` calls "midday — the brightest ground", so the page goes dusk-blue at 17:00 → *full midday* at 17:50 → afternoon at 18:30, measured 1.109:1 brighter than both its neighbours. **The commercial payload ships invisible:** `motion.li`'s `initial={{opacity:0,y:28}}` is serialised by Motion into the SSR style attribute, so every product name, price and buy button leaves the server at `opacity:0`, with no `MotionConfig`/`useReducedMotion` anywhere in the web app to switch it off — three hard constraints broken by one prop. **And the price on the row is not the price the button charges:** `:108` prints `formatPrice(p.price)` while `:34` commits `priceFor(p, variant)`, which in a cash-on-delivery market is a courier at a door with a parcel nobody will pay for.

The fix is one idea: **make it an actual route.** A single dashed line that starts under the trailhead, runs down the left gutter through a numbered well at every stop, and terminates on an open ring at the catalogue door — at 390px exactly as much as at 1440. Put the band on golden-hour paper so 17:50 looks like 17:50, kill the alternation that fights the line, make the photograph a real object held by a shadow instead of the only thing on the page held by nothing, delete the motion that takes the words away, and spend the header's 26 words on what the cloth actually *is* rather than on a fourth lecture about made-to-order. Everything below is that idea, itemised.

---

## 2. What stays — do not touch

| | Why it is right |
|---|---|
| **`stopEyebrow(stop)` and `lib/trail.ts` as the single source of the stop.** | One format everywhere is what that file exists to enforce. Item 1 changes the *species* of the opener and prints `stop.time` and `stop.alt` separately — this is a deliberate departure and it is recorded in §5 so the next session does not "fix" it back. `TRAIL_STOPS.climb` itself is untouched; `TrailSpine` reads `data-trail-*` from `app/page.tsx:129–131`, not from this eyebrow. |
| **The slug-join and the silent drop of unmatched slugs.** `:149–151` | Correct posture: a product deleted out from under a station must not 500 the homepage. Item 8 keeps the join verbatim and only adds a fallback beneath it. |
| **`firstAvailableVariant` / `isSoldOut` / `priceFor`.** `lib/variants.ts:57–72` | Deterministic across renders, stock-aware, and already imported here. The current comment at `:25–28` describes the *old* broken behaviour; the code is right. Item 6 makes the row *print* what these functions return; it does not change them. |
| **`trackEvent('add_to_cart', …)` and the sonner toast with a "View cart" action.** `:45–57` | This was the first homepage add-to-cart the funnel had ever seen. Keep both. Item 6 only removes the size from the toast description once the button label carries it. |
| **The empty-data posture at the component boundary.** `:147`, `:164` | The instinct to degrade rather than crash is right. Item 8 replaces *what* it degrades to; the discipline stays. |
| **`data-cursor="magnetic"` on the buy control.** `:113`, read by `CustomCursor.tsx:81–95` | Correct hook. It currently falls back to the `'8px'` default at `:95` because a `border-b` element has no computed radius; item 6 gives it a real box to read. |
| **Copy lives in `store_settings.home_config.climb`, edited at `/admin/homepage`.** `HomepageEngine.tsx:355–427` | The client can change the words without a deploy. Every copy change below therefore ships as *code default + column default + one-row backfill*, never as a code default alone. |

---

## 3. The action plan

Table and specs share the same numbering. **Items 1, 2 and 3 alone change what this band looks like on a phone and on a laptop.**

| # | Action | What | Why | Effort | Priority |
|---|---|---|---|---|---|
| 1 | update | One continuous trail, at every width; the alternation goes | The section's whole idea is `sm:`/`md:`-gated, and where it exists the zigzag fights it | 4h | **P1** |
| 2 | update | Golden-hour ground, one measure | 17:50 renders on the brightest ground on the page; 1152 between two 1280s | 45m | **P1** |
| 3 | update | The photograph becomes a held object | The only enclosed thing on the page with no border, no shadow, no species — arriving out of a near-black green that is in no token | 1.5h | **P1** |
| 4 | remove | The per-station entry animation | Every station ships `opacity:0` in the server HTML, and reduced motion does not stop it | 20m | **P1** |
| 5 | update | The words: opener species, headline, intro, station lines | Fourth made-to-order lecture on this page, in trade jargon, set in a synthesised oblique inside quotation marks nobody said | 2h + migration | **P1** |
| 6 | update | The row prints the price it charges; the buy becomes a target | Shown price ≠ charged price; the buy control is a 2.08:1 hairline ~17px tall | 1.5h | **P1** |
| 7 | remove | The scrim badge on the image | 3.87:1 over a white studio backdrop, and the third printing of the same digits within 200px | 10m | **P1** |
| 8 | update | The section never apologises | A fresh database renders "check back soon" under a heading promising goods, with the HUD advertising the stop | 2h | P2 |
| 9 | add | A fact strip in mono under each line | Mono currently carries words and the figures are set in Archivo — Law 3, inverted | 1.5h | P2 |
| 10 | update | Focus rings, list semantics, keys, timer cleanup | Three tab stops per row with no ring; preflight strips list semantics; duplicate keys; a timer that fires after unmount | 45m | P2 |
| 11 | remove | Dead comments and a wrong admin path | Comments cite an export that does not exist and an editor at the wrong URL | 15m | P3 |

---

### The specs

**1 — One continuous trail, at every width.**

The section becomes: a trailhead (header), then one `relative` wrapper carrying a single dashed rail, the intro, the stations and a terminus ring.

*1a — the opener changes species.* Replace `:156–162` entirely. Law 5's third species is *a rule across the measure with the heading inline*; three consecutive sections (SeasonKit `:100–111`, this one, BrandPulse `:73–80`) currently open with species 1, mono eyebrow over a display heading.

```
<div className="flex flex-wrap items-baseline gap-x-5 gap-y-3 lg:flex-nowrap">
  <span className="shrink-0 self-center font-mono text-[11px] tracking-[0.16em] tabular-nums text-forest">{stop.time}</span>
  <h2 className="min-w-0 font-display font-light text-[clamp(28px,4vw,46px)] leading-[1.05] text-text">{config.headline}</h2>
  <span aria-hidden className="hidden h-px min-w-12 flex-1 self-center bg-rule-warm lg:block" />
  <span className="hidden shrink-0 self-center font-mono text-[11px] tracking-[0.16em] tabular-nums text-mid lg:block">{stop.alt}</span>
</div>
```

`min-w-0` on the `h2` and `min-w-12` (48px) on the rule stop an over-long admin headline collapsing the rule to zero; below `lg` the whole row wraps and the rule and altitude are hidden, so a 390px phone gets `17:50` above the heading rather than a crushed inline row. `--rule-warm #D2C4A4` measures **1.24:1** on `--paper-deep` — decorative, `aria-hidden`, correct. `stop.alt` in `--mid` is **5.79:1** on paper-deep; never `--light`, which is **2.32:1** there and fails. `3,500M` appears in this section for the first time; it is a coordinate and it is in mono, which is Law 3 exactly.

*1b — one rail, one wrapper.* After the header, open `<div className="relative mt-8 lg:mt-10">` and make it the *only* place the rail exists. Its first child:

```
<span aria-hidden className="pointer-events-none absolute left-[13px] top-0 bottom-[13px] w-0 -translate-x-[0.5px] border-l border-dashed border-forest/40" />
```

The `-translate-x-[0.5px]` is not decoration: the border's 1px box would otherwise occupy x 13→14 with its centre at 13.5, while every node centre is at exactly 13.0. Translating the zero-width element back half a pixel puts the rule at 12.5→13.5, centre **13.0**, on the node centre at every breakpoint. `border-forest/25` composites to `#B7B596` on paper-deep and measures **1.50:1** — gone; `/40` composites to `#9A9F7E` at **2.00:1**, which is the floor a 1px dashed structural line can be read at. No `sm:` gate: the rail exists at 320px.

*1c — the geometry that makes it work at every width.* The intro, the `ol` and the terminus all take the same gutter: `pl-9 lg:pl-12` (36px / 48px). Every marker is `absolute -left-9 lg:-left-12 top-0 h-[26px] w-[26px]`. With `pl-9` and `-left-9` the marker's left edge lands on the wrapper's own left edge (x=0) and its centre at **x=13**; with `pl-12` and `-left-12` it lands at x=0 and centre **x=13** again. One `left-[13px]` rail, no fractional offsets, no per-breakpoint fudge, no `ring-*` punching a hole. This replaces `:70–72`'s `-left-[29px] md:-left-[45px]` node, which was ~3.5px off the rule with a 4px ring making the miss read wider.

*1d — the number moves into the well.* Delete the node-dot wrapper `:70–72` (its `items-center gap-2` is inert — one child). Each `li` gets:

```
<span aria-hidden className="absolute -left-9 top-0 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-paper-deep font-mono text-[11px] leading-none tabular-nums text-forest lg:-left-12">
  {stationNo}
</span>
```

`--forest` on `--paper-deep` measures **7.42:1**. `bg-paper-deep` matches the ground exactly, which is why item 2 ships a **flat** band and not a gradient — a flat-filled well on a graded ground mismatches at one end (see §5).

*1e — the terminus.* The trail must end on something, or it is a stripe. The tail becomes the wrapper's last child at a fixed 26px height so the rail's `bottom-[13px]` lands on the ring's centre:

```
<div className="relative mt-14 h-[26px] pl-9 lg:pl-12">
  <span aria-hidden className="absolute -left-9 top-0 h-[26px] w-[26px] rounded-full border border-forest/40 bg-paper-deep lg:-left-12" />
  <Link href="/shop" className="-my-[9px] inline-flex min-h-[44px] items-center font-body text-xs uppercase tracking-[0.12em] text-forest transition-colors duration-300 hover:text-text">…</Link>
</div>
```

`-my-[9px]` with `min-h-[44px]` gives the link a 44px hit box while the row stays exactly 26px tall, so the ring geometry is not disturbed. (Item 5 makes this two doors.)

*1f — the alternation dies.* Delete `const flip` (`:22`) and all three uses: `md:order-2` (`:74`), `md:order-1 md:text-right` (`:89`), `md:justify-end` (`:107`). The rail anchors reading to the left gutter; a zigzag that throws alternate rows' copy ~570px away from their own numbered node is a second organising system fighting the first. DOM order becomes **copy, then image**, so no `order-*` utility exists anywhere and the reading order is name → line → facts → photograph.

*1g — the row.*

```
<li className="relative grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-14 lg:items-start">
```

`<ol className="relative mt-12 lg:mt-16 space-y-12 lg:space-y-24 pl-9 lg:pl-12" role="list">`. `items-start`, not `items-center`: today a 526px column centres ~200px of copy inside a 394px image, so the marker floats against blank paper.

**Measured heights.** At **390px**: content 342 − 36 gutter = 306px image, 4:3 → 230px; row ≈ 230 + 20 + ~205 copy = 455px; three rows + two 48px gaps = 1,461; + header ~206 + terminus 82 + `py-24` 192 = **≈1,941px**, against today's ≈2,004px — marginally shorter, and now the scroll buys a route instead of three tiles. At **1440px**: content 1280, row 1232, image fixed 420 square, copy 756; three rows + two 96px gaps = 1,452; + header ~230 + terminus 82 + `py-32` 256 = **≈2,020px**, against today's ≈1,977px. Flat, within 2%.

The copy column at 1440 is 756px with its paragraph capped at 46ch (item 5) — about 360px of the row is air. That air is deliberate and it is framed on both sides: the rail on the left, the tile's edge on the right. It is not the 144px-per-side dead margin item 2 deletes.

**2 — Golden-hour ground, and one measure.**

`:154` → `className="bg-paper-deep px-6 md:px-10 py-24 md:py-32"`. `--paper-deep #E7D9BE` is commented in `globals.css:34` as "golden hour"; the stop is 17:50. Today the page runs 16:20 warm → 17:00 `--altitude` dusk-blue → **17:50 full midday** → 18:30 warm, so the light gets *brighter* as the day ends, measured 1.109:1 brighter than both neighbours. Law 1 holds in both directions after the change: `--altitude #142536` above is a full-bleed dark band; below, `BrandPulse` is `--forest-deep #16290F` (always renders), and `Community`, when reviews exist, is `--paper-warm` — one full step of the ladder. Live today, with no approved reviews, the descent reads dusk → golden hour → night, which is the arc the palette was rebuilt to tell.

`:155` → `className="relative mx-auto max-w-7xl"`. 1152 → **1280**, level with `SeasonKit.tsx:97`, `HomeTrails.tsx:75` and `Community.tsx:60`. Content stops narrowing 128px on entry and widening 128px on exit — Law 4.

Contrasts on the new ground, all measured: `--text` **13.16:1**; `--mid` **5.79:1**; `--forest` **7.42:1**; `--paper` on `--forest` (the filled button, item 6) **9.48:1**; `--rule-warm` **1.24:1** (decorative); `--rule #DDD7C6` drops to **1.20:1** and must not be used here — `--rule-warm` exists at `globals.css:69` for exactly this; `--light #94917F` is **2.32:1** and is banned in this band.

**3 — The photograph becomes a held object.**

`:74` → `className="relative aspect-[4/3] lg:aspect-square overflow-hidden rounded-[var(--r-card)] bg-paper-deep shadow-[var(--shadow-card)]"`. Radius + shadow, no border, is the card species from Law 2; today the tile is the only enclosed object in the section held by nothing at all. `--shadow-card` is `0 12px 32px -16px rgba(12,16,13,0.35)` (`globals.css:102`).

Square at `lg` rather than 4:3 keeps 33% more vertical frame on a garment shot at the same width — a 4:3 cover-crop on a portrait product photograph keeps the middle band of the torso and discards collar and hem, which for a section about chest prints is the worst possible crop. `SeasonKit.tsx:158` already uses `aspect-[3/4]`, so portrait-safe photography is the working assumption; going further to 4:5 needs an audit of the live `products.images` and is **Q3**.

Placeholder: add beside the import, replacing `BLUR_DATA_URL` at `:81` — an 8×8 flat `--paper-deep`:

```
// --paper-deep #E7D9BE, written out because a data URI is outside Tailwind's token reach.
const CLIMB_BLUR = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiNFN0Q5QkUiLz48L3N2Zz4='
```

`BLUR_DATA_URL` (`lib/constants.ts:24–25`) is a flat `#1a2e17` — a near-black green that is not `--forest-deep`, not `--ink`, not any token, measuring **12.01:1** against the tile it covers. It paints a dark rectangle N times into the section and then resolves to a mostly-light garment. Leave `BLUR_DATA_URL` alone for other callers; this is a local constant.

`:79` `sizes` → `"(max-width: 1023px) calc(100vw - 84px), 420px"`. Exact: below `lg` the image is viewport − 48 (`px-6`) − 36 (`pl-9`); at `lg` and above the column is a fixed 420px. Today the browser is told `50vw` and needs ~548px, over-declaring by ~1.75x at 1920.

`:76` guard the empty `src` — `p.images?.[0] ?? ''` hands `next/image` an empty string for any product without a photo:

```
{p.images?.[0]
  ? <Image src={p.images[0]} alt={p.name} fill sizes={…} placeholder="blur" blurDataURL={CLIMB_BLUR} priority={index === 0} className="object-cover transition-transform duration-200 ease-[var(--ease-out)] hover:scale-[1.03]" />
  : <span aria-hidden className="absolute inset-0 grid place-items-center font-mono text-[28px] tabular-nums text-mid">{stationNo}</span>}
```

`duration-700` → `duration-200`: Law 6 puts micro-motion at 140–260ms, and `hover:scale-105` at 700ms is the section's only interactive feedback arriving a third of a second late. `1.03` rather than `1.05` because a square tile shows the crop loss at the edges more than a 4:3 one does.

**The tile becomes the link, and the `h3` stops being one.** Wrap the tile in `<Link href={`/products/${p.slug}`} className="… focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">` with `alt={p.name}` carrying the accessible name, and change `:99–103` so the `h3` is plain text. Two things fix at once: the largest object in the row (420×420 at `lg`) stops being dead, and the section's *strongest* object stops routing the visitor off the page while its weakest one takes the money. Do **not** use `aria-hidden` + `tabIndex={-1}` on a `Link` — that is an ARIA violation, and it is why the "make everything clickable" proposal was killed (§5).

**4 — Delete the per-station entry animation.**

Delete `import { motion } from 'motion/react'` (`:7`); `motion.li` → `li` (`:63`, `:126`); delete `initial`, `whileInView`, `viewport`, `transition` (`:64–67`), keeping the `className`. This one deletion removes: the SSR `opacity:0` on every product name, price and buy button (hard constraints 1 and 2); the missing reduced-motion guard, since there is no `MotionConfig`/`useReducedMotion` anywhere in the web app — the only repo-wide hits are `mobile/app/(tabs)/index.tsx:13,105` — and Motion's default is `reducedMotion: "never"`; and N independent viewport animations where Law 6 allows one choreographed moment per page, which the hero's Turn already spends.

Ship nothing in its place. If the client wants the rail to draw, the only legal form is transform-only keyframes in `globals.css` behind `@media (prefers-reduced-motion: no-preference)` — the pattern already at `globals.css:412`, `:469`, `:568` — with the rail's **default rendered state `scaleY(1)`** so a dead observer leaves the line drawn. That is **Q1**, and Law 6 argues against it.

**5 — The words.**

Three strings live in three places each and all three must move together: `actions/settings.ts:24–29` (`DEFAULT_HOME_CONFIG.climb`), the `store_settings.home_config` column default, and the live row. Migration **027** changed the default and never backfilled, which is exactly why a fresh environment renders the empty panel today — so ship `supabase/migrations/103_climb_copy.sql` with **both** an `ALTER COLUMN … SET DEFAULT` and a one-row `UPDATE store_settings SET home_config = jsonb_set(…)`. A code-only change reaches nobody live.

Headline (replaces "Every blank, made to order."):

> **Start with the weight.**

Intro (replaces the 20-word warehouse sentence):

> **They are cut and printed in Dehradun once ordered. What separates them is the cloth: how heavy it sits on you, and how a print lands on it.**

The current header argues made-to-order for the **fourth** time on this page — `TRAIL_STOPS.trust.label` is literally "Made to order" (`lib/trail.ts:76`), `DesignYourOwn.tsx:106–107` says "Made to order — COD available across India", `actions/settings.ts:19–20` gives SeasonKit "ships in 8-10 days" — and it does it in trade vocabulary: "blank" means an undecorated garment to a printer and nothing to a retail first-timer, and it is wrong for what the rows show, which are named, printed, priced products. The replacement names the decision the list actually asks for and hands the differentiator to the station lines. Neither string contains a count, because the station list is admin-editable and can outgrow any number written into a headline.

Station lines — `font-display italic` and the curly quotes both go. Fraunces is declared with `axes:['opsz']` and no `style` (`app/layout.tsx:49–54`), so this italic is a browser-synthesised oblique, and the quotation marks attribute a spec sheet to a speaker nobody can name. `:104–106` →

```
<p className="mt-3 max-w-[46ch] font-body text-[15px] leading-[1.6] text-mid">{station.line}</p>
```

Archivo explains (Law 3), capped at 46ch at every width — today it releases to `max-w-none` at `md` and runs ~71ch of synthesised oblique, right-aligned on every odd row. New lines, one physical fact plus one reason to want it, no line repeating another's fact:

- `custom-hoodie` — **380 GSM French terry — heavy enough to be the only layer you pack.**
- `custom-sweatshirt` — **Boxy through the body, so a full-chest print sits flat instead of wrapping.**
- `custom-print-tee` — **180 GSM combed cotton. The one that carries an idea the same week you have it.**

Eyebrow: the number now lives in the well (item 1d), so `:95–98` collapses to a label that renders only when it says something the number does not — and it crosses into Archivo, because "Base camp" is a word:

```
{station.label?.trim() && station.label.trim() !== stationNo && (
  <div className="font-body text-[10px] font-medium uppercase tracking-[0.18em] text-forest">{station.label}</div>
)}
```

Terminus, two named doors instead of one, matching the two-door pattern `DesignYourOwn.tsx:68,78` already uses — and **no counts**, because `products.length` is 3 and "See all 3 pieces" advertises how little there is to buy:

> **Put your own design on one →** → `/customize`, in `text-forest`
> **The full catalogue →** → `/shop`, in `text-mid`

**6 — The row prints the price it charges, and the buy becomes a target.**

`:108` → `formatPrice(priceFor(p, variant))`, `priceFor` already imported at `:11`. Today the row prints `p.price` while `:34` commits `p.price + variant.price_adjustment`; an XL surcharge is the normal case on apparel, and the correction currently arrives inside a toast that auto-dismisses. Keep `font-body … tabular-nums`, bumped to `text-[15px]`: prices are set in Archivo at `ProductCard.tsx:194`, `ShowcaseRails.tsx:52` and `SeasonKit.tsx:175`, and changing it in one section alone would be the inconsistency. Whether the storefront's prices should be mono at all is **Q2**.

Action row `:107` → `className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3"`. Button `:109–117`:

```
className="inline-flex min-h-[44px] items-center rounded-[var(--r-input)] bg-forest px-6 font-body text-[11px] font-medium uppercase tracking-[0.14em] text-paper transition-colors duration-200 hover:bg-forest-mid disabled:bg-rule-warm disabled:text-mid focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
```

Label `:116` → `soldOut ? 'Sold out' : added ? 'Added ✓' : variant ? \`Add · ${variant.name}\` : 'Add to cart'`. Naming the size makes the deterministic pick *visible* — the button then tells the truth about what the click will do — and the toast description at `:55` drops the size it now duplicates: `` `${p.name} — ${formatPrice(price)}` ``.

Today's control is 10px Archivo over `border-b border-forest/40`, which measures **2.08:1** on paper and computes to roughly 15–17px tall, against WCAG 2.5.8's 24×24 minimum and a 44px practical minimum on a phone. `--paper` on `--forest` is **9.48:1**. `--r-input` 6px is on the radius ladder; `rounded-full`, which `empty-state.tsx:64` uses for the storefront's primary pill, is not — see **Q2**. A real 44px box also gives `data-cursor="magnetic"` a radius to read instead of `CustomCursor.tsx:95`'s 8px fallback.

The secondary link changes *species* rather than shade, so the two are not typographic twins separated only by colour: `className="font-body text-[13px] text-mid underline decoration-rule-warm underline-offset-4 transition-colors duration-200 hover:text-text hover:decoration-forest"`, text **"Sizes and details →"**. Wrap it to `min-h-[44px] -my-[9px] inline-flex items-center` for the target.

**7 — Delete the scrim badge.** `:84–86` goes entirely. `--paper` on `bg-ink/55` at 10px composites to `#797C7A` over a white studio backdrop and measures **3.87:1** against the 4.5:1 that size requires; `backdrop-blur-sm` softens what is behind, it does not raise luminance contrast; and it is pinned `top-3 left-3`, the whitest corner of an on-white apparel shot. It is also the third printing of the same digits within 200px — `addStation` (`HomepageEngine.tsx:231–236`) seeds `label` to the zero-padded index, which is the only reason the de-dupe at `:97` exists. With it gone the section's enclosure inventory is two clean species: the tile held by radius + shadow, the markers held by radius.

**8 — The section never apologises.**

Export a resolver, exactly as `ShopByCategory.tsx:32` exports `pickEssentials` and `CollectionsRow.tsx:23` exports `pickCollections`, both called from `app/page.tsx:65` for this precise reason:

```
export function pickClimbStations(config: HomeConfig['climb'], products: ProductWithCollection[]): Station[]
```

Body: the current join (`:149–151`), de-duplicated by slug; then `if (matched.length === 0) return products.slice(0, 3).map(p => ({ product_slug: p.slug, label: '', line: p.short_description ?? '', product: p }))`. `short_description` (`types/database.ts:263`) and `images` are already loaded — `PRODUCT_LIST_EMBEDS` is `select('*', …)` (`actions/products.ts:26`) — so the fallback costs no query. A curated station always wins.

Delete `:164–167`, the dashed panel and its "New pieces are on the way — check back soon." copy, and the `stations.length === 0` ternary with it. In `app/page.tsx`, beside the existing `essentials` call: `const climbStations = climb.enabled ? pickClimbStations(climb, products) : []`, and gate the wrapper at `:129–131`:

```
{climbStations.length > 0 && (
  <div data-trail-time={…} data-trail-alt={…} data-trail-label={…}><TheClimb config={climb} stations={climbStations} stop={TRAIL_STOPS.climb} /></div>
)}
```

`TheClimb` then takes `stations` as a prop and drops its own `if (!config.enabled) return null`, so the page and the HUD become structurally incapable of disagreeing. This is live today on any post-027 database: `027_home_config_sections.sql:66` set `"stations": []` and never backfilled, so a fresh environment renders a dashed apology under a heading promising goods while `TrailSpine` announces "17:50 · The climb" over it — the exact failure `app/page.tsx:96–103` and `:139–147` already guard against for their neighbours. Item 5's backfill migration fixes the seeded case; this fixes the class.

**9 — A fact strip in mono.**

Under the station line, rendered only when it has something to say:

```
<ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] tracking-[0.08em] tabular-nums text-mid">
```

Two entries, each conditional: the weight, from `p.highlights?.find(h => /\d/.test(h))` (`types/database.ts:271`) — gated on containing a digit, so a highlight that is prose is skipped rather than set in mono — and `{n} colourways` from `p.customization_config?.colors?.filter(c => c.available).length`. Both fields are already in memory. `--mid` at **5.79:1** clears 4.5:1 at 10px on paper-deep. If neither resolves, render no `<ul>` at all.

This is the Law 3 repair: today mono carries "Station", carries "· The climb", and carries whatever arbitrary text an admin typed into the badge, while the price — the one pure figure in the row — is set in Archivo and `3,500M` never appears. After items 1, 5, 7 and 9, every mono string in this section is a figure or a figure with its unit. **Do not** add "Ships 8–10 days" to the strip: that promise already appears in `TrustBand` and in SeasonKit's default line, and printing it per station makes it the fifth and sixth appearance on one page.

**10 — Rings, semantics, keys, timers.** (a) `role="list"` on the `<ol>` — Tailwind preflight strips `list-style`, which drops list semantics in VoiceOver, and that now matters because the visible number has become an `aria-hidden` decoration. (b) `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest` on all three interactive elements per row; there are three tab stops per row today and none of them shows a ring. (c) `key={station.product_slug}` (`:171`) → `key={`${station.product_slug}-${i}`}` — `HomepageEngine` imposes no uniqueness on the product `<Select>`, so the same product twice yields duplicate React keys; item 8's de-dupe makes this belt and braces. (d) Replace the bare `setTimeout` at `:59` with `useEffect(() => { if (!added) return; const t = setTimeout(() => setAdded(false), 1600); return () => clearTimeout(t) }, [added])` — today `setAdded(false)` can fire on an unmounted row.

**11 — Dead comments.** `:130–134` cites `lib/constants.ts` `CLIMB_STATIONS`, which `grep` does not find — only `BLUR_DATA_URL` matches in that file — and points the admin at `/admin/settings`; the editor is `/admin/homepage` (`app/admin/homepage/HomepageEngine.tsx`). `:25–28` describes `variants[0]` behaviour that `:29` already replaced with `firstAvailableVariant(p)`. `:142–144` narrates a stop conflict that no longer exists. Delete all three. Adjacent and worth logging while here, though out of scope for this section: `normalizeHomeConfig` (`actions/settings.ts:42–52`) never returns `trails`, so `app/page.tsx:59` always takes `DEFAULT_HOME_TRAILS` regardless of what an admin saved; and `lib/trail.ts:25` says the rail is `hidden lg:flex` when `TrailSpine.tsx:81` makes it `hidden xl:flex`.

---

## 4. Removals, argued

**The per-station entry animation (item 4).** `motion.li`'s `initial` is serialised into the SSR style attribute. That means the server HTML for this section — three product names, three prices, three buy buttons — ships at `opacity:0`. JavaScript off, a dropped chunk, a background tab that never fires the viewport observer, and the band is a blank column under a heading. There is no `MotionConfig` anywhere in the web app, so `prefers-reduced-motion: reduce` does not stop it either. Three hard constraints, one prop, one deletion.

**The left/right alternation (item 1f).** It is a `md:`-only device that exists to relieve monotony, and it does it by breaking the one structure the section is named after. At 1440 a flipped row's copy starts ~570px from its own numbered node, so the node stops labelling anything, and `md:text-right` sets a 71ch ragged-left paragraph at 768px, which is the hardest text in the section to read. Variation now comes from the photographs, which is where it belongs.

**The scrim badge (item 7).** 3.87:1 over the white backdrop that a print-to-order shop's product photography is most likely to have, in the corner most likely to be white, at 10px. It is also the only `ink/55` scrim object in a band with no other scrims — one enclosure species used exactly once — and it prints digits the eyebrow and the well already carry.

**The dashed empty-state panel (item 8).** A store with three buyable products and a working `/shop` currently tells its visitors "New pieces are on the way — check back soon." in a 56px-padded dashed box, because a migration changed a column default and did not backfill. The correct posture for this brand is not an apology; it is to show the newest three and say nothing about it. And when there is genuinely nothing, the band and its trail chapter disappear together.

**The `h3`'s link (item 3).** In the page's last selling band the strongest typographic object — up to 36px Fraunces — was the control that navigated *away*, while the weakest — 10px over a 2.08:1 hairline — was the one that took the money. The PDP link moves to the photograph, which is where a visitor's thumb was going anyway.

**`font-display italic` and the curly quotes (item 5).** The italic is a browser-synthesised shear of a serif — `app/layout.tsx:45–48` documents this as a known hazard of the way Fraunces is declared — and the quotation marks attribute "380 GSM French terry" to a speaker who does not exist. It reads as a testimonial and is not one.

**The `--dawn` accent, deliberately not added.** This section has no warm accent and that is now correct rather than accidental: `globals.css:53` reserves `--dawn` for "where the narrative says the light arrives, and nowhere else." 17:50 is not first light. The warmth this band was missing arrives as ground (item 2), not as an accent.

---

## 5. Killed in judging — on the record

- **The row becomes a full product grid** — radio size chips with strike-through disabled states, filled buttons and compare-at prices is the default Shopify theme in a band whose job is narrative; roughly +130px per row and three saturated fills; and it proposed `aria-hidden` on a `Link` with `tabIndex={-1}`, which is an ARIA violation. Item 3 takes the one salvageable part (the tile becomes the link, legally).
- **A vertical `paper-warm → paper-deep` gradient down the band** — the concept was right and the execution has two seams: the node wells and the terminus ring are flat fills against a ground that changes down the section, so they mismatch at one end, and the image tile's own fill stops matching too. Item 2 ships the flat `paper-deep` the gradient's own author named as the fallback, and all the contrast figures were already measured at that value. Revisit only with a per-marker fill strategy.
- **A `--forest → --ember → --dawn` gradient rule with the last node lit** — genuinely beautiful, and it was specified `hidden sm:block`, so the entire premise is invisible on the device most of this traffic arrives on. It also spends `--dawn` on last light against a token documented as first light. Not this section's call to make alone. Recorded as revivable *after* item 1 puts the rail on phones — it would then be a one-line change to the rail element.
- **`aspect-[4/5]` at `md`+** — the right instinct, resting on an unverified bet: if the live `products.images` are landscape, `object-cover` at 4:5 crops the sides and the fix inverts. Item 3 ships `aspect-square`, which is strictly better than today's 4:3 for portrait *and* landscape sources, and 4:5 is **Q3**.
- **The rail draws itself on scroll (600ms `scaleY`)** — correctly specified (transform-only, keyframes behind `prefers-reduced-motion: no-preference`, default state `scaleY(1)`), but Law 6 allows one choreographed moment per page and the hero's Turn already spends it. **Q1**.
- **Excluding `season_kit.product_slugs` from the station list** — does not survive contact with this catalogue. There are exactly three products (migration `026_remove_seed_data.sql:8–12` hard-deleted everything not `is_customizable`) and `025_home_config.sql:39` seeds the same three slugs into both sections. Excluding them empties the list, the newest-3 fallback then runs *without* the exclusion, and hands back the products just excluded. The de-dupe half survives as item 8; the exclusion does not.
- **A `ships_in` config field with an admin input and its own migration** — "Ships 8–10 days" already appears twice on this page; a third and fourth printing does not need a schema change to deliver it.
- **"See all {products.length} pieces →"** — renders "See all 3 pieces" against the live catalogue and advertises how little there is to buy. Item 5's tail names two doors and counts nothing.
- **"Three blanks. Put anything you like on them."** — the best sentence in the council and it hardcodes a count into a string an admin can edit and a catalogue can outgrow. Its second half's spirit survives in item 5's headline.
- **"Add one here, or open it to choose a size."** — describes the interface rather than the goods, in what would be the second most-read string in the band.
- **Splitting the grid at `1024` with `[0.85fr_1.15fr]`** — the diagnosis (Law 4, `items-center`) is right and both halves are in items 1 and 2, but its arithmetic subtracted the section padding twice and produced a `sizes` value ~4% *under* the real column, the opposite of the over-fetch it set out to fix. Item 3's fixed 420px column makes `sizes` exact instead of approximate.
- **Prices in Space Mono in this section only** — Law 3 argues for it and three shipped call sites argue against it; changing one section alone is guaranteed inconsistency. **Q2**, storefront-wide.

---

## 6. Open questions for the client

1. **Does the trail draw?** Item 4 deletes all motion from this band. The rail could draw itself once, 600ms, transform-only, default state drawn. Law 6 says the page gets one choreographed moment and the hero has it. Show them the still band first; ask after.
2. **The primary button, storefront-wide.** `empty-state.tsx:64` uses `rounded-full`, which is not on the radius ladder the brief calls "the only legal values". Item 6 ships `--r-input` 6px here. One call for the whole storefront, not for this section. Same question, same visit: are prices Archivo `tabular-nums` (three shipped call sites) or Space Mono (Law 3)?
3. **The photography.** Item 3 ships `aspect-square`. If the live `products.images` for the three custom SKUs are shot portrait with room at top and bottom, `aspect-[4/5]` is better and costs ~+150px per row at `lg`; if any are landscape, square is the ceiling. This needs eyes on the real files, not a guess.
4. **`Community`'s ground.** With this band on `--paper-deep` (17:50), `Community` at 18:30 on `--paper-warm` steps the light back *up* one rung. It is legal under Law 1 and it is narratively backwards. Today it renders null with no approved reviews, so the live sequence is dusk → golden hour → night and reads correctly. Send `Community` to `--paper-deep` when section 10 is worked, or accept the step.
5. **The station label field.** After item 7 and item 5, an admin label only appears when it says something the number does not — and `addStation` seeds it to the number, so in practice it never appears. Is the field worth keeping in `/admin/homepage` at all, or should it be dropped and the well left to number itself?
6. **The headline.** "Start with the weight." names the decision the list asks for and repeats nothing else on the page. Does it read as too spare next to "Every blank, made to order."? The intro sentence carries the argument either way.
7. **Scope.** Item 8 edits `app/page.tsx` and item 5 ships a migration touching `store_settings`. Approved?

**What could not be specified exactly:** the copy column at 1440 carries ~360px of air to the left of the image tile — the numbers are right and whether it reads as composed or as unfinished is a judgement to make in a browser at 1280, 1440 and 1920; and the `hover:scale-[1.03]` value on a square tile is a starting point that needs an eye on real photography, where `1.05` visibly loses the hem.

---

## 7. How we will know it worked

**Widths, every time.** 320, 360, 390, 640, 768, 1023, 1024, 1280, 1440, 2560. At every one of them: **the dashed rail is present**, every station's number well is centred on it, and the rule visibly terminates on the open ring — this is the pass/fail on item 1, and 320 and 390 are the ones that fail today. No horizontal body scroll. The header's rule never collapses to zero, and below `lg` the row wraps to `17:50` above the heading rather than crushing inline.

**The geometry, measured not eyeballed.** In DevTools, at 390 and at 1440: the rail's rendered `left` and every marker's centre `x` must both be **13.0px** from the rail wrapper's left edge. Section height: **≈1,941px at 390** (today ≈2,004) and **≈2,020px at 1440** (today ≈1,977) — if either is more than 10% off, the spacing numbers in item 1g drifted.

**Degraded states, every time.** (a) **JavaScript off** — all three product names, all three prices and all three buy buttons are fully visible in the served HTML; `curl` the page and grep for `opacity:0` in the station markup, which must return nothing. This is the pass/fail on item 4. (b) **`prefers-reduced-motion: reduce`** — a complete, still, legible band; nothing fades, nothing rises. (c) **Slow 3G / images blocked** — each tile shows flat `--paper-deep` and the fallback station numeral, never a dark green rectangle. (d) **A product with `images: []`** — no empty `src` warning in the console.

**Empty and hostile data.** (e) `home_config.climb.stations = []` on a database with products — the band shows the newest three and the trail HUD still says "17:50 · The climb". (f) `stations = []` **and** `products = []` — the band and its `data-trail-*` wrapper both vanish, and `TrailSpine` shows no climb chapter. (g) `climb.enabled` unchecked — same. (h) The same product listed twice in `/admin/homepage` — it appears once, and there is no duplicate-key warning in the console. (i) A station whose `product_slug` no longer resolves — it is dropped and the rest render.

**Colour and contrast, sampled from the live render on `--paper-deep`.** Body `--mid` ≥ **5.79:1**; `--forest` on ground ≥ **7.42:1**; `--paper` on the filled button ≥ **9.48:1**; the fact strip at 10px ≥ 4.5:1. The rail composites to `#9A9F7E`, **2.00:1** — confirm it is visible at 1px at 390px on a real phone, not only on a desktop panel. Confirm `--light` appears nowhere in the band (2.32:1). Confirm `--rule` appears nowhere (1.20:1) and only `--rule-warm` is used.

**Interaction and keyboard.** Tab through one station: the tile link, the buy button and "Sizes and details" each show a 2px ring. Every one of the three has a hit box ≥ 44px on a 390px viewport. Press the buy button: the label reads `Add · M` before the click and `Added ✓` after, the toast names the product and the same figure the row printed, and the cart's line total equals that figure. **Set a non-zero `price_adjustment` on a variant and repeat** — row, button, toast and cart must all agree; that is the pass/fail on item 6. VoiceOver: the `ol` announces "list, 3 items" and each product name is heard once as a heading and once as a link, never twice as plain text.

**Rhythm.** Scroll `SeasonKit` → `TheClimb` → `BrandPulse` in one pass and confirm three different opening species, and that the ground gets *darker* at every step.

**Housekeeping.** Two notes from experience so nobody loses an afternoon: a mobile check needs a **full relaunch** — a stale bundle looks identical to "my change didn't work" — and the **browser pane must be visible**, or screenshots come back blank and `innerWidth` reads 0, which makes a correct responsive layout look broken.
