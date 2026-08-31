# 08 · The Season Kit — Action Plan

*Section 8 of the homepage. Written against `components/sections/SeasonKit.tsx` (208 lines), `app/page.tsx`, `app/globals.css`, `lib/trail.ts`, `lib/variants.ts`, `lib/constants.ts`, `actions/settings.ts`, `actions/checkout.ts`, `app/admin/homepage/HomepageEngine.tsx`, and migrations `025`, `026`, `027`, `039`, `094`, on branch `mobile-remediation`. Every line number and every contrast ratio below was verified against the working tree — the ratios by WCAG relative-luminance arithmetic over the composited pixel, not estimated. Where I could not specify a value exactly, it is in §6, not hidden behind an adjective.*

---

## 1. The verdict

This is the page's only bundle, and it is the one section that never argues one. Four facts carry the diagnosis. **The band is not a place.** `--altitude` `#142536` and `--forest-deep` `#16290F` measure L=0.01738 and L=0.01791 — a contrast ratio of **1.008:1** between the page's two dark grounds. HomeTrails at 15:30 and SeasonKit at 17:00 are separated by TrustBand's ~100px cream ribbon, so the eye reads one long dark run with a stripe in it rather than two hours of a day, and the section contains **no warm pixel at all** — `--dawn` last appears on this page as TrustBand's 3px hairline directly above and then never again through the kit, the climb, basecamp and the footer. **The kit is not an object.** Nothing encloses it: `--shadow-card` is `rgba(12,16,13,0.35)`, which renders as nothing on a ground already at that value, so every object here falls back to a hairline at three different alphas, and the tile grounds (`bg-ink/40` = `#111d26`) are *darker* than the section — four garments punched as holes in a slab, under a floating sum. **The numbers are not true.** Line 183 prints `products.length` while line 185 sums `availablePicks`, so one sold-out piece renders "The full kit — 4 pieces" over a three-piece price; the tiles print base `p.price` while the total uses `priceFor`; the label doing the lying measures **4.04:1**, under AA; and the section's one real figure is set in Fraunces while Space Mono carries a two-word English phrase. **And the button sells something the shop refuses to sell anywhere else.** Migration `026` hard-deleted every product that was not `is_customizable`, so all three kit slugs are customizable blanks, and `ProductDetail.tsx:518` gives a customizable product **no add-to-cart at all** — only "Customize This Shirt →". This button is the only route on the entire storefront to buy an unprinted blank, and the line it writes carries `custom_design_id NULL`, which is precisely what the print-queue index at `039_production.sql:24` excludes.

The fix is not more section. It is to make this band **the last light of the day falling on one lit plate — a single object holding four garments, one number in the measuring face taking the warm light, and a button whose promise the shop can actually keep.** Give the band an hour so it stops matching the band above it, give the kit an enclosure that exists on a dark ground (lightness, because shadow cannot), make every figure agree with the figure beside it, and settle — with the client — whether an unprinted blank is a thing this shop sells. Everything below is that idea, itemised.

---

## 2. What stays — do not touch

| | Why it is right |
|---|---|
| **`max-w-7xl`.** `SeasonKit.tsx:97`. | **Correction to the recon and to three of the proposals.** This is not a Law 4 defect. The page runs *two* measures with a rule behind them: `max-w-7xl` is the **showcase** measure (CollectionsRow `:55`, ShopByCategory `:70`, DesignYourOwn `:42`, HomeTrails `:75`, Community `:60`, SeasonKit) and `max-w-6xl` is the **band** measure (TrustBand `:30`, TheClimb `:155`, TrekBuddyBand `:102`, NewsletterBar `:65`). SeasonKit is a showcase. Narrowing it to 6xl would align it with its two neighbours and break it from its five siblings, and it would cost the product photography 128px at 1440. The real Law 4 defect is `BrandPulse` at `max-w-5xl`, and that is BrandPulse's council. |
| **`lib/variants.ts` and everything computed from it.** `firstAvailableVariant` (`:57-60`), `isSoldOut` (`:63-66`), `priceFor` (`:69-71`), and `kitPicks`/`availablePicks`/`kitTotal` at `SeasonKit.tsx:48-51`. | Deterministic across renders (`sort_order`, then a size ladder, then name), correct about the "no variants means untracked, not sold out" case, and the total is already priced off what the button would actually add. The items below *surface* this data; they do not re-derive it. |
| **The toast names every size.** `:77-90`. | Its own comment records why: three garments went into a cart with no statement of what size any of them was, and the buyer found out when the courier arrived. Item 6 moves that statement *earlier*; it does not remove it from the toast. |
| **The two-column idea — a window on the left, the kit on the right.** | Correct composition for a bundle: an argument beside the goods. Item 8 changes only *when* it splits and *how wide* each side runs. |
| **The mono index badge.** `:170-172`, `01`…`04`. | The only string in the section that is Space Mono carrying an actual figure. Law 3 is satisfied here and nowhere else in the band. |
| **Copy is server-rendered and the section has no entrance choreography.** | Hard constraints 1, 2, 3 and 5 are all satisfied today. Item 1 adds a still gradient and item 4 deletes the one animation that breaks constraint 4; nothing below introduces motion, so the section stays identical under `prefers-reduced-motion: reduce`. |
| **The admin owns the block.** `HomeConfig['season_kit']` (`types/database.ts:658-666`), edited at `app/admin/homepage/HomepageEngine.tsx:271-352`. | The section's whole existence is "an admin can change what this sells without a code change". Every copy change below ships as a **default an admin overwrites**, never as a hardcoded string — the council record already shows the client reverting a rewritten sentence the same day (`HOMEPAGE-COUNCIL.md`, 2026-08-30, item 4). |
| **`data-cursor="magnetic"` / `data-cursor-text="Add"`.** `:191-192`. | `CustomCursor.tsx:81-95` matches the bubble to the element's computed radius and is gated on `(hover:hover) and (pointer:fine)`; the button is `disabled` in the sold-out state and disabled controls dispatch no pointer events, so the stale "Add" label never appears. Verified, not assumed. |

---

## 3. The action plan

Table and specs share the same numbering. Items **1, 2 and 3 alone change what this band looks like on a phone and on a laptop** — a lit hour, one object instead of four stickers, and a price that is finally the loudest thing in the section.

| # | Action | What | Why | Effort | Priority |
|---|---|---|---|---|---|
| 1 | add | **Last light** — one warm radial entering below the bottom-left corner | The page's two dark grounds measure 1.008:1 apart; this band has zero warm pixels and no reason to be a different hour | 45m + one panel check | **P1** |
| 2 | update | **The kit becomes one lit plate** — a `paper/[0.06]` panel, tiles that sit *on* it, a blue-hour placeholder | Shadow is invisible on `#142536`; today the tiles are darker than the ground, so the kit is four holes, not an object | 1.5h | **P1** |
| 3 | update | **One face for the figures, and the truth beside them** — mono total in `--dawn`, `availablePicks.length`, contrast fixes | The one number the section exists to state is set in the display face; the label above it fails AA at 4.04:1 and describes a different kit | 1h | **P1** |
| 4 | update | **The band opens with a ruled manifest**, carries its stop, and the pulsing dot goes | Species 1 twice running with TheClimb; the repo's only `animate-ping`, infinite, untouched by either reduced-motion block | 1.5h | **P1** |
| 5 | update | **The button only promises what the shop can keep** | One click books three unprinted blanks that no other page will sell and the print queue excludes by definition | 2h–1d | **P1**† |
| 6 | update | **Sold-out and size, on the tile, before the click** | `unavailable` is computed on every render and consumed only inside the toast, *after* the money moves | 1.5h | **P1** |
| 7 | update | **Three guards: partial config, empty kit, phantom stop** | A hand-written partial `season_kit` row 500s the whole homepage on `.map` | 45m | **P1** |
| 8 | update | **Refit the frame** — dark-band rhythm, split at `xl`, one measure per role | At 1024 the product photography renders at 112px; at 768 a 448px measure sits in a 688px column | 2h | P2 |
| 9 | update | **A track that survives its data**, capped in admin, with a correct `sizes` | `sm:grid-cols-4` leaves a hole at N=3 and orphans a tile at N=5; `sizes` under-requests by a third across 640–1023 | 2h | P2 |
| 10 | update | **The words** — one migration that fixes the row, the default and the TS default together | `027` changed only the column DEFAULT, so the live row and `actions/settings.ts:20` carry different copy | 1h | P2 |
| 11 | update | **A list, four headings, one touch target** | Every tile currently announces its own name twice; the primary action is ~45px and full-width only by undeclared `stretch` | 1h | P2 |
| 12 | remove | **The collection card becomes a link** | A 64px crop is not a photograph, inside a border measuring 1.56:1 | 30m | P3 |
| 13 | add | **A kit price that is less than the sum** | `kitTotal` is a plain sum, so there is no stated reason to take four rather than one | 3h | P3 |
| 14 | remove | **Stale comments and dead guards** | Three files point admins at `/admin/settings`, which contains no `home_config` | 30m | P3 |

† P1 **pending client decision** — see §6, Q1. Item 5 has two branches; items 1–4 and 6–14 are correct under either.

---

### The specs

**1 — Last light.**
`SeasonKit.tsx:96`: `className="on-dark bg-altitude px-6 md:px-10 py-20 md:py-24"` gains `relative overflow-hidden`. As the **first child**, before the grid:

```jsx
{/* Last light on the band. rgba(227,155,63) is --dawn #E39B3F and
    rgba(194,102,42) is --ember #C2662A, written out because a gradient
    stop cannot take a bare CSS variable in this repo. */}
<div
  aria-hidden
  className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_75%_at_10%_112%,rgba(227,155,63,0.13)_0%,rgba(194,102,42,0.07)_34%,transparent_68%)]"
/>
```

The container at `:97` gains `relative` so it sits above it.

The origin is **below the band's bottom-left corner** on purpose: light entering from under the ridge and dying before it reaches the photographs. Measured consequences, all computed against `#142536`:

- Peak alpha *inside* the band is at the bottom-left corner, ≈ **0.10** (the 0.13 core is off-canvas at y=112%). That ground composites to `#293137`; `--sage` on it measures **4.65:1**, `--paper` 11.9:1.
- At the eyebrow (top-left, x≈4% / y≈12%) the normalised radius is 1.33 — **past the 68% stop, alpha exactly 0.** The two sage strings in this section are never lit.
- At the photographs at `xl` (x ≥ 85%, y ≈ 90%) the radius is 0.805 — **also past the stop, alpha 0.** No garment photograph is tinted.
- Binding rule for everything downstream: **no `--sage` text may sit where alpha exceeds 0.12** (sage falls to 4.50:1 at 0.12 and 3.84:1 at 0.20). The 10%/112% origin satisfies this because both sage strings are above the 34% stop.

*The law tension, declared rather than buried.* The palette says `--dawn` is "the ONE warm accent, used where the light arrives and nowhere else". `kit` is `17:00 · 3,600M` on a descent — this is light *leaving*. The defence is that it is the same light, and that this page already sets `--dawn` and `--dawn-soft` on a dark ground after noon two sections above at `HomeTrails.tsx:79` (15:30) and `:101`. It is still a judgement call: **Q2**.

Only one warm system in this band. Item 3 puts the total in `--dawn` — that is the same note landing on an object, not a second note. Nothing else in this section gets a warm colour.

**2 — The kit becomes one lit plate.**
Wrap the grid *and* the footer row (`:154-201`, the whole `<>` fragment body) in one panel:

```jsx
<div className="rounded-[var(--r-panel)] bg-paper/[0.06] p-4 md:p-5">
```

Measured: `paper/6%` over `#142536` composites to **`#223141`**, a **1.175:1** lift. That is small, and it is the *point* — on a ground this dark, shadow does not exist (`--shadow-card` is `rgba(12,16,13,0.35)`, `globals.css:102`) and a hairline at 15% is 1.56:1, so enclosure has to come from **lightness**. The repo already names this species: `.trek-card-onink` at `globals.css:1015-1018` is `rgba(248,245,237,0.04)` with `box-shadow: none`. We use 0.06 rather than 0.04 because item 1 raises the ground beneath it; over the glow's hottest in-band point the plate composites to `#393f42`. **No border and no shadow** — Law 2 stays honest and the plate *is* the enclosure.

Inside it:
- Tile ground `:158`: `bg-ink/40` → `bg-paper/[0.04]`. Today `ink/40` composites to `#111d26`, which is **darker than the section**, so an image-less tile is a hole punched in the band. `paper/4%` on the plate is a surface.
- Tile radius `:158`: `--r-card` 8px → `--r-input` 6px. The token's own comment names "photo tiles" (`globals.css:94`), and an 8px child inside a 10px panel with 16–20px of inset reads as a mistake.
- Footer divider `:180`: `border-paper/10` → `border-paper/18` (1.72:1 on the plate; it now sits on a lighter ground and 10% has disappeared).
- Footer spacing `:180`: `mt-6 … pt-5` → `mt-5 … pt-5`.

**Blur placeholder — a real, visible defect.** `BLUR_DATA_URL` (`lib/constants.ts:24-25`) decodes to an 8×8 SVG filled **`#1a2e17`, forest green**, and it is currently painted under four photographs on a blue-slate ground: every slow connection sees a green flash in a blue-hour band. Add beside it:

```ts
/** The blue-hour ground. BLUR_DATA_URL is #1a2e17 forest green and flashes
 *  green-black under any image on --altitude #142536. */
export const BLUR_DATA_URL_ALTITUDE =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiMxNDI1MzYiLz48L3N2Zz4='
```

and use it at `SeasonKit.tsx:166` and `:126`.

**3 — One face for the figures, and the truth beside them.**
Law 3 is currently exactly inverted: Space Mono carries `config.eyebrow` (live value "Now shipping" — a phrase), while the tile price is Archivo and the kit total is Fraunces. One label spec everywhere in this band: **`text-[11px] tracking-[0.14em] uppercase`** — the value `DesignYourOwn.tsx:67` and `HomeTrails.tsx:101` already use. Then one rule for the face: **mono carries figures, Archivo carries words, no exceptions.**

| Line | From | To | Measured |
|---|---|---|---|
| `:185` total | `font-display text-2xl text-paper mt-0.5 tabular-nums` | `mt-1 font-mono text-[clamp(22px,2.2vw,28px)] leading-none tracking-[-0.01em] tabular-nums text-dawn` | `--dawn` on `--altitude` **6.70:1**; on the plate **5.70:1**; on the plate over the glow **4.60:1** — AA at all three, and it is the section's one warm object |
| `:175` tile price | `font-body text-[11px] text-paper/50` | `font-mono text-[11px] tabular-nums text-paper/70`, value `formatPrice(priceFor(product, variant))` | 4.63:1 → **7.71:1**, and it is now the number the button commits rather than the base price |
| `:182` label | `font-body text-[9px] tracking-[0.18em] text-paper/45` | `font-body text-[11px] tracking-[0.14em] text-paper/70` | 4.04:1 (**AA FAIL** at 9px) → **7.71:1** |
| `:183` count | `products.length` | `availablePicks.length` | The count and the price finally describe the same kit |
| `:170` index | `text-[9px] text-paper/80` | `text-[10px] text-paper/85` | stays mono — this is the one figure already in the right face; **10.69:1** |
| `:174` name | `font-body text-xs` (12px) | `font-body text-[13px] leading-snug` | matches `TrustBand.tsx:33`'s value spec, 20px above on the page |
| `:193` button face | `text-[10px] tracking-[0.16em]` | `text-[11px] tracking-[0.14em]` | one label spec |
| `:132`, `:139` | 9px/`0.15em` and 10px/`0.1em` | `text-[11px] tracking-[0.14em]` | six near-identical micro-labels at four trackings become one voice |

Space Mono is wider than Fraunces: `₹12,497` at 28px sets ≈190px. **The clamp floor of 22px is the default, not the contingency** — at 1024–1279 the plate runs full width and the footer is `flex-row`, so the total and the button never share a 484px column under item 8's frame; verify anyway at 1024 and 1120.

**4 — The band opens with a ruled manifest, and the pulse stops.**
Two problems, one move. SeasonKit opens *species 1* (mono eyebrow over a light Fraunces heading) and `TheClimb.tsx:157-160` directly below opens species 1 again, with headings differing only by `4.8vw` against `5vw` — the most literal Law 5 violation on the page. And SeasonKit is the **only** homepage product section not passed a `stop`: it prints admin free text in the figures-only face, twenty pixels from a HUD reading "17:00 · The kit". `lib/trail.ts:1-36` exists to end exactly that drift.

- Props (`:22-30`) gain `stop: TrailStop`, imported from `@/lib/trail`. `app/page.tsx:127` passes `stop={TRAIL_STOPS.kit}` — the wrapper at `:126` already holds those exact values.
- Container: `<div className="relative max-w-7xl mx-auto">`, then the rule, then `<div className="mt-12 md:mt-16 grid …">`.
- Replace `:100-106` (the ping pair **and** the eyebrow) with:

```jsx
<div className="flex items-baseline gap-4 border-b border-paper/22 pb-4">
  <span className="font-mono text-[11px] tracking-[0.14em] tabular-nums text-sage">{stop.time}</span>
  <span className="truncate font-body text-[11px] uppercase tracking-[0.14em] text-paper/70">{stop.label}</span>
  <span aria-hidden className="h-px flex-1 -translate-y-[3px] bg-paper/22" />
  <span className="font-mono text-[11px] tracking-[0.14em] tabular-nums text-paper/70">{stop.alt}</span>
</div>
```

Measured: `--sage` **5.48:1**, `paper/70` **7.71:1**, and the rule at `paper/22` composites to `#47535e` for **1.98:1** — a line the eye tracks, deliberately two full steps below the 4.5:1 a word would need. A rule drawn edge to edge with a time at one end and an altitude at the other is species 3, it is a manifest at blue hour, and it belongs to an outdoor shop rather than to a template.

`config.eyebrow` stops being rendered. **Do not delete the JSONB key or the type field** — leave both, and delete only the Eyebrow `<Input>` at `HomepageEngine.tsx:292-300` so nobody writes a string nothing shows.

**The ping.** `:102`'s `animate-ping` is Tailwind's built-in `ping 1s cubic-bezier(0,0,0.2,1) **infinite**`. It is the **only** `animate-ping` in `components/`, `app/` and `lib/` (grepped), and `app/globals.css` has exactly two `prefers-reduced-motion: reduce` blocks — `:714-720` (`.trail-marquee`) and `:1100-1105` (`.tb-pulse`, `.tb-rise`, `.trek-liftable`) — neither of which names it, with no global kill switch anywhere. A visitor who asked for stillness gets a dot throbbing forever about a sentence that never changes. That is hard constraint 4, live in the code, and the client has rejected ambient motion twice (`HOMEPAGE-COUNCIL.md:135-136`). Both spans go; the `flex items-center gap-3` wrapper goes with them.

**The tile zoom, while we are here.** `:167` `duration-700` → `duration-200`. The laws set micro-motion at 140–260ms; 700ms on a product photograph reads as a slideshow, not a response. `ease-[var(--ease-out)]` is unchanged. The section's motion is then: one 200ms scale, three 300ms colour transitions, nothing else, nothing ambient.

**5 — The button only promises what the shop can keep.** *(Gated on Q1.)*

The chain, verified end to end: migration `026_remove_seed_data.sql:36-38` hard-deletes every product where `is_customizable = false`, and its own header records that exactly 3 of 16 rows survived — the three slugs seeded into `season_kit.product_slugs` at `025:38`. `ProductDetail.tsx:518-528` gives an `is_customizable` product **no add-to-cart control at all**, only `Customize This Shirt →`. `SeasonKit.addKit` (`:53-93`) adds them to the cart with `customDesignId` undefined; `actions/checkout.ts:32` takes the custom branch only `if (line.customDesignId && line.productId)`, so the line lands with `custom_design_id = NULL`; and `039_production.sql:22-24` defines the print queue as `WHERE custom_design_id IS NOT NULL AND printed_at IS NULL`. **This button is the only route on the storefront to buy an unprinted blank, and what it books never enters the print queue.**

That is not a design call. Either an unprinted blank is a product this shop sells — in which case `ProductDetail` is the page that is wrong — or it is not, in which case this button is. Ask (**Q1**). Both branches are specified so neither is a fresh round:

*Branch A — the shop does sell blanks (recommended default, smaller change).* The button stays and the section states what it is. `:183`'s label carries the noun: `The kit — {n} blanks, unprinted` (an admin-overwritable default, item 10). Fulfilment needs a queue that can see these lines; that is a back-office change outside this council, and it must be **confirmed before shipping**, not assumed.

*Branch B — it does not.* Then the button, the total, `addKit`, `useCart`, the toast and the `trackEvent` call all go **together** — a price in a footer with no control that transacts it is worse than what is there now. The plate becomes a lookbook: four blanks, each tile linking into the studio, and the footer carries one line in the site's own secondary-link species (`TheClimb.tsx:163`, `HomeTrails.tsx:101`): `Design any of them →` to `/customize`. The section stops being a bundle and becomes the studio's shop window, which is at least a thing it can honestly be.

*Under either branch, ship now:* the tile `href` at `:157` becomes `` `/products/${p.slug}/customize` `` when `p.is_customizable` and `` `/products/${p.slug}` `` otherwise. Today all four tiles land on a page whose only control is "Customize This Shirt →" — one hop the section can spend on the visitor's behalf.

**6 — Sold-out and size, on the tile, before the click.**
`unavailable` is derived at `:50` on every render and consumed **only** inside the toast description at `:87`. Nothing in the grid marks a sold-out tile: it is fully lit, fully priced and fully linked, and the buyer learns it was dropped from a toast reading "— 1 sold out and skipped", *after* committing. On a cash-on-delivery apparel store a wrong size or a silent substitution is a courier arriving with a parcel nobody pays for.

Map the grid over `kitPicks` (`:156`), not `products`, so every tile has its `variant`. Then, per tile:

- **In stock.** Price line as item 3 specifies, and beneath it a third line: `<div className="mt-0.5 font-body text-[10px] uppercase tracking-[0.08em] text-paper/60">Size {variant.name}</div>` — **6.04:1**, rendered only when `variant` is non-null. One word and a letter under each tile, not a run-on "M · M · L · M" under the button, which reads as debug output.
- **Sold out** (`isSoldOut(product)`). Image wrapper gains `opacity-60 saturate-[0.4]` — *not* `grayscale`, which on a low-saturation studio shot reads as a failed image load. The price line is replaced by `<div className="mt-0.5 font-body text-[11px] text-clay">Sold out</div>` (`--clay` `#B8826B` on `--altitude` = **4.78:1**). The mono index badge prints `—`. No size line.
- Beside the button, `<span className="sr-only" aria-live="polite">{added ? `${availablePicks.length} pieces added to your cart` : ''}</span>` — today the confirmation exists only as a visual label swap and a sonner toast.

`variant.name` is admin free text; `lib/variants.ts` normalises the *order* of the size ladder, not the label. A badly named variant prints badly, and that is a data problem, not a layout one.

**7 — Three guards.**

*(a) A live 500.* `actions/settings.ts:44-51`'s `normalizeHomeConfig` does `season_kit: raw.season_kit ?? DEFAULT_HOME_CONFIG.season_kit` — **whole-key only**. A row carrying a *partial* `season_kit` (hand-edited JSONB, or written by an older admin build) passes `product_slugs === undefined` straight into `.map` at `SeasonKit.tsx:37` and takes the entire homepage down. Fix per key:

```ts
season_kit: { ...DEFAULT_HOME_CONFIG.season_kit, ...(raw.season_kit ?? {}) },
climb:      { ...DEFAULT_HOME_CONFIG.climb,      ...(raw.climb ?? {}) },
```

`climb.stations` has the identical exposure at `TheClimb.tsx:149`. A spread can only *add* missing keys and never overwrite present ones, so this is safe for every existing row.

*Named while in this function, out of scope, and it should not be lost:* `normalizeHomeConfig` never copies `trails`, though `HomeConfig` declares `trails?: HomeTrail[]` (`types/database.ts:684`). Every read therefore drops it, `app/page.tsx:59`'s `?? DEFAULT_HOME_TRAILS` fires unconditionally, and an admin's edited trails **never render**. That is HomeTrails' council; file it.

*(b) The undesigned empty state.* Delete `:149-152`. The dashed panel's sentence — "New pieces are on the way — check back soon." — is **verbatim** the string at `TheClimb.tsx:166`, forty lines apart on the same page, and it paints a full dark band with an eyebrow, a headline and a box announcing that nothing is here, with no button, no total and no link out. Replace with `if (products.length === 0) return null` beside the existing guard at `:34`, the same shape `DesignYourOwn.tsx:25` already uses.

*(c) The phantom stop.* Export `pickKitProducts(config, allProducts)` from `SeasonKit`, call it in `app/page.tsx` beside `pickEssentials`/`pickCollections` (`:65-70`), and wrap `:126-128` as `{season_kit.enabled && kit.length > 0 && ( … )}` — exactly the pattern already at `:96-99` (ShopByCategory) and `:139-143` (Community), both of which carry comments explaining why. Note honestly: `TrailSpine` is the only consumer of `data-trail-*`, and `design/01-hero.md` item 7 has it down as a P1 removal pending the client (`HOMEPAGE-COUNCIL.md:147`). The guard is right either way, it costs nothing, and the hero plan explicitly keeps the wrappers.

**8 — Refit the frame.**

- `:96` `py-20 md:py-24` → `py-24 md:py-32`. Every other **dark** band on this page is taller: HomeTrails `py-24 md:py-32` (`:75`), TrekBuddyBand `py-24 md:py-32` (`:102`), BrandPulse `py-28 md:py-36` (`:60`). The one band that needs air to read as a chamber currently gets the least.
- `:97` keeps `max-w-7xl` (§2). The split changes: `lg:grid-cols-[0.9fr_1.1fr] gap-12 lg:gap-16 items-center` → `xl:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] gap-10 md:gap-12 xl:gap-16 **items-start**`.

  **Delaying the split to `xl` is the whole point.** Measured tile widths (grid gap 12px, plate inset from item 2):

  | Viewport | Today | After |
  |---|---|---|
  | 390 | 149px | **149px** |
  | 768 | 163px | **153px** |
  | 1024 | **112px** | **217px** |
  | 1280 | 147px | **165px** |
  | 1440 | 158px | **185px** |

  At 1024 the current `0.9fr/1.1fr` gives the section's only product photography **112px** — thumbnail territory — because the outer grid splits at `lg` while the inner grid is already 4-up. Single-column through 1279 gives it 217px. `items-start` replaces `items-center` because the plate is now taller than the copy and centring floats a heading against nothing.

- **One measure per role.** Delete `max-w-md` at `:111` — a px cap on an Archivo paragraph is a box, not a measure: it lands at ~64ch at 14px and ~56ch at 16px, so the line length changes when only the type size changed. At `xl` the left column is a fixed **400px** and *is* the measure. Below `xl`, run the opening as a masthead — the pattern already built at `HomeTrails.tsx:77`:

```jsx
<div className="md:flex md:items-end md:justify-between md:gap-10 xl:block">
  <h2 className="font-display font-light text-[clamp(30px,4.2vw,46px)] leading-[1.05] text-paper md:max-w-[20ch] xl:max-w-none">
    {config.headline}
  </h2>
  <p className="mt-4 font-body text-sm leading-relaxed text-paper/70 md:mt-0 md:max-w-[38ch] md:text-base xl:mt-4 xl:max-w-none">
    {config.line}
  </p>
</div>
```

  This closes the 240px void at 768–1023 without depending on the collection link, which is `null` in every seed. The heading clamp drops from `clamp(32px,4.8vw,54px)` to `clamp(30px,4.2vw,46px)`: it fits the 400px `xl` column in two lines at the seeded string, and it stops being a 0.2vw variant of `TheClimb.tsx:158`. Body copy lifts `text-paper/65` → `text-paper/70` (6.80:1 → 7.71:1) for margin over the glow.

**9 — A track that survives its data.**
`config.product_slugs` has **no cap and no ordering control** (`HomepageEngine.tsx:334-347` is a flat checkbox list of every active product; order is array insertion). Three configured slugs leave a permanent hole in a `sm:grid-cols-4` track, five orphan a tile on a second row, and fifty would commit fifty lines to a cart in one un-confirmable click. Fix it in the layout **and** in the admin, in the same commit:

- `SeasonKit.tsx`: `const kit = kitPicks.slice(0, 4)` and render `kit`.
- Track `:155`: `grid grid-cols-2 gap-3 sm:flex sm:gap-3`, each item `sm:flex-1 sm:basis-0 sm:min-w-0 sm:max-w-[240px]`. `flex-1 basis-0` divides evenly for any N; the 240px cap stops N=1 rendering one 3:4 tile ~900px tall.
- `HomepageEngine.tsx:341`: each `Checkbox` gains `disabled={!config.season_kit.product_slugs.includes(p.slug) && config.season_kit.product_slugs.length >= 4}`, and the `Label` prints `{config.season_kit.product_slugs.length} of 4 chosen`. **The slice and the cap must ship together** or an existing five-product config silently loses a tile with no warning anywhere.
- `sizes` `:164`: `"(max-width: 640px) 50vw, 15vw"` → `"(max-width: 639px) 45vw, (max-width: 1279px) 24vw, (max-width: 1599px) 15vw, 200px"`. Against item 8's measured widths every request now covers what is displayed: 390 → 176 for 149; 768 → 184 for 153; 1024 → 246 for 217; 1280 → 192 for 165; 1440 → 216 for 185; 2560 → 200 for 185 (today's string requests 384 there, and 115 for a 163px tile at 768).
- Delete the dead optional chaining at `:159` and `:163` — `images` is non-nullable `string[]` (`types/database.ts:270`).

**10 — The words.**
One migration, because the live row and the code disagree and `027` is why: it changed only the column DEFAULT, never the existing row (`027:14-38` touches `featured_category_slugs`/`stats`/`showcase`). So the DB most likely still carries `025:36`'s long sentence while `actions/settings.ts:20` carries a short one. **Set all three: the row (`UPDATE`), the column DEFAULT, and `DEFAULT_HOME_CONFIG`.**

- `line` → **"Three heavyweight blanks, cut and printed in Dehradun. Pick a colour, add your artwork — it ships in 8–10 days."** (en dash in the range; the current copy uses a hyphen). Names the goods and the town, which is what this brand sells on. **If Q1 resolves to Branch A, this sentence is wrong for the button and must be re-written around the blank instead.**
- `:183` label → `The full kit — {availablePicks.length} piece{s}` (Branch A: `blanks, unprinted`).
- `:198` confirmed state → `Kit added to cart ✓` → **`In your cart`**. The tick is a second glyph doing a job the words already do, and a screen reader announces it as "check mark".
- The `:151` empty-state string is deleted by item 7, which also removes the duplicate of `TheClimb.tsx:166`.

Every one of these is a **default an admin overwrites**, not a hardcoded string. The council record shows the client putting the hero's sentence back the same day it was rewritten.

**11 — A list, four headings, one touch target.**
- Wrap `:155-178` in `<ul>` with each `Link` in an `<li>`; the product name div at `:174` becomes `<h3>` with its classes. Four products currently appear in neither the list tree nor the heading tree; the section has exactly one heading.
- `alt={p.name}` at `:162` → `alt=""`. The link already prints the name, so every tile announces **"Aspen Hoodie 01 Aspen Hoodie ₹2,499"**. This is safe only while the caption stays inside the same link — if the tile ever loses its name, the alt comes back.
- Button `:193`: add `min-h-[46px] w-full sm:w-auto`. It computes to ~45px (`py-4` + a 10px line box) with no `min-h`, against the repo's own precedent at `CartView.tsx:50` (`min-h-[46px]`), and it is full-width on phones only by the `flex-col` wrapper's undeclared default `align-items: stretch` — one day someone adds `items-start` and the primary action silently shrinks to 180px.

**12 — The collection card becomes a link.** See §4.

**13 — A kit price that is less than the sum.**
`kitTotal` is a plain sum, so the button buys convenience and never claims it — the section asserts a kit and never argues one. The engine already expresses this without new schema: `lib/promotions.ts:26-33` accepts `conditions: { productSlugs, minQuantity }` with `action_type: 'percentage'`, and `resolvePromotions` (`:69`) is pure. Add `getLivePromotions()` (`lib/promotions.server.ts:51`) to the existing `Promise.all` in `app/page.tsx:42-55`; build kit lines as `{ productSlug, collectionSlug: null, unitPrice: priceFor(p, firstAvailableVariant(p)), quantity: 1 }`; pass `kitOffer={applied[0] ?? null}`. Render directly beneath the total:

```jsx
<div className="mt-1 font-mono text-[11px] tabular-nums text-paper/70">{kitOffer.label} — save {formatPrice(kitOffer.amount)}</div>
```

`paper/70` **7.71:1**, in Archivo-free mono because it is a figure — and deliberately **not** `--dawn`: item 1 and item 3 are the band's one warm note and a third bid would spend it. Scoped to the kit's own lines, a stacked cart can save *more* than the homepage quoted, never less. Do not attach a `minSubtotal` condition to this promotion or the preview over-promises. Null prop → nothing renders → the section is exactly item 3's layout. **This is invisible until an admin creates a promotion row**, which is why it is P3.

**14 — Stale comments and dead guards.**
`SeasonKit.tsx:19-21` says the block is "editable from `/admin/settings`". It is `/admin/homepage`; `app/admin/settings/page.tsx` contains no `home_config`. The same stale path is at `025_home_config.sql:1` and `092_client_brief_23aug.sql:101` — fix all three. Rewrite `:40-47`: the first comment promises the total matches what the button buys, which item 3 finally makes true of the *count* as well; the second describes a "4-up product grid" world that item 9 actually enforces. Delete the dead `?.` (item 9). `key={p.slug}` at `:157` survives duplicate slugs only because the admin checkbox UI prevents them — the `slice`+cap in item 9 does not change that, and it is fine; note it, do not fix it.

---

## 4. Removals, argued

**The pulsing dot (item 4).** `animate-ping` is the repo's only one, it is `1s … infinite`, and `app/globals.css` has no reduced-motion rule that touches it. It runs at full speed for a visitor who explicitly asked for stillness — hard constraint 4, live in code. It is also a *liveness* idiom decorating a static admin string: "Now shipping" has been true and unchanging since migration 025. The flex wrapper collapses cleanly and nothing else moves.

**`config.eyebrow` from the render (item 4).** This is the only homepage product section printing admin free text where every sibling prints `stopEyebrow(stop)`, and it prints it in Space Mono — a two-word English phrase in the figures-only face — two hundred pixels from a HUD saying "17:00 · The kit". `lib/trail.ts:1-36` was written to end exactly this drift and simply never named this section. The admin loses a free-text eyebrow on one section and keeps the headline and the body copy; the trade is that they can no longer print a sentence that contradicts the page's own clock. **The JSONB key and the type field stay** — only the input and the render go, so nothing needs migrating and the decision is reversible in one line.

**The empty state (item 7).** Four lines of copy and a dashed panel that paint a full dark band announcing "Now shipping" over a box saying nothing is. Its sentence is a verbatim duplicate of `TheClimb.tsx:166` on the same page. It has no button, no total and no link out, so it is a dead end on the darkest ground on the site. `return null` is the honest answer; the page then runs TrustBand → TheClimb, which is a legitimate sequence.

**The collection card (item 12).** Delete `:113-144` in full — the `Link`, its `border border-paper/15 rounded-[var(--r-input)] p-4 max-w-md`, the 64×64 `Image`, the "From the collection" kicker, the tagline and "Explore →". Three separate faults in one object: a 64px crop of a landscape is mush at any density and is the section's only editorial image, arguing nothing; `border-paper/15` composites to `#364451` for **1.56:1**, an edge nobody has ever seen; and it is enclosed as a *card* (radius + border at `--r-input` 6px, a token reserved for inputs and photo tiles) while being built as a *row*. Replace with the site's own secondary-link species, matching `TheClimb.tsx:163` and `HomeTrails.tsx:101-107`:

```jsx
{collection && (
  <Link href={`/collections/${collection.slug}`}
        className="group mt-8 inline-flex items-center gap-2 font-body text-[11px] uppercase tracking-[0.14em] text-sage transition-colors duration-300 hover:text-paper">
    See {collection.name}{' '}
    <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
  </Link>
)}
```

Keep the `collections` prop and the lookup at `:36`. An admin who *did* configure a collection loses a thumbnail and a tagline — which is why the collection's own name stays in the link text rather than becoming generic copy. Note that `collection_slug` is `null` in every seed and `getCollections()` filters `is_active` (`actions/products.ts:157`), so on the live site this block renders for nobody today.

**The 700ms tile zoom, retimed not removed (item 4).** Nearly three times the 140–260ms micro-motion band. The hover response stays; only its duration changes.

**The `?.` on `images` (item 9).** Optional chaining on a non-nullable `string[]`. Dead guard, and it hides the real case: a product with an *empty* images array still renders an empty tile carrying only a number badge — which item 2's `bg-paper/[0.04]` at least turns into a surface rather than a hole.

---

## 5. Killed in judging — on the record

- **"The button stops selling blanks it cannot print"** — killed on incoherence. It kept the total (a real figure, in a footer, at 24px) and removed the only control that transacts it, replacing it with a link to `/customize?start=library` that preselects nothing: a price for four garments over a button that opens an empty studio reads as broken, not considered. Its premise was also unverified — every product in this catalogue is a customizable blank, so "production cannot fill these orders" is a business fact nobody has established. **Item 5 keeps the diagnosis, hands the business question to the client as Q1, specifies both branches coherently (Branch B removes the price *with* the button), and takes the one salvageable line: deep-link each tile into the studio.**
- **Narrowing the section to `max-w-6xl`** (proposals 1 and 8's frame half) — rejected in §2. `max-w-7xl` is the page's showcase measure, used by five other sections; matching the two neighbours would break the five siblings and cost the photography 128px at 1440.
- **A second warm element** — three separate proposals each nominated the section's single warm pixel: the glow (6), the total (7), the collection link (9), the sold-out note (10), the saving line (19). The band gets **one** warm system: the glow at the floor and the total sitting in it. Everything else in this section is sage, paper-alpha or clay.
- **"Sizes M · M · L · M" under the button** (proposal 14) — a row of repeated single letters under a primary action reads as debug output. Item 6 keeps the honesty and moves it onto each tile, where "Size M" is a spec line.
- **`grayscale-[0.55]` on sold-out tiles** (proposal 8) — on a low-saturation studio shot, grayscale plus 60% opacity reads as a failed image load, which is the specific way this idea goes cheap. Item 6 uses `saturate-[0.4] opacity-60` plus a replaced price line instead.
- **Repurposing `config.eyebrow` as the kit's NAME** (proposal 13) — changes what an existing admin's stored string *means* without migrating it: the live row says "Now shipping", which would render as the kit's name in the footer. A wrong label is worse than a stale one. It also sends the eyebrow slot opposite to items 3 and 4.
- **A `paper/[0.05]` plate with nothing else** (proposal 0) — item 2 with the interesting parts removed: no sold-out treatment, no placeholder fix, no tile radius correction. A 1.14:1 overlay on its own is at the edge of visible and the client will scroll past it.
- **Deleting `BLUR_DATA_URL` entirely from this section** (proposal 3) — the plate's own fill is *not* a placeholder; it is behind the image, not in it, and a blur placeholder is what stops a hard pop-in on a slow connection. Item 2 replaces the colour instead of removing the mechanism.
- **A conditional column count (`sm:grid-cols-3` / `sm:grid-cols-2`)** (proposal 22) — blunter than `flex-1 basis-0`, which divides evenly for any N with no ternary. Item 9 takes proposal 22's admin cap, which is the part that matters, and proposal 3's track.
- **Spending an item on the ping deletion alone** (proposal 15) — unarguable, necessary and completely invisible. Folded into item 4, which the client can see.

---

## 6. Open questions for the client

1. **Does this shop sell an unprinted blank?** This is the one question that changes what the section *is*. Today the kit button is the only control on the storefront that adds a customizable blank straight to a cart; `ProductDetail` refuses to, and what the button books lands outside the print queue. Branch A keeps the button and needs a fulfilment path for un-designed lines confirmed with whoever prints. Branch B turns the plate into a lookbook that opens the studio. **Item 5 cannot ship until this is answered.**
2. **`--dawn` at 17:00.** The law reserves the warm accent for "where the light arrives". This is a descent, and the argument is that last light is the same light — HomeTrails already sets `--dawn` on a dark ground at 15:30. Is a warm glow at the bottom of the blue-hour band right, or does the whole back half of the page stay cold on purpose?
3. **Is a kit a discount or a convenience?** Item 13 can make the kit genuinely cheaper than its parts using machinery that already exists, but it needs a promotion row and a number from the client. Without one, "the full kit" costs exactly the sum of four things and the only argument for taking four is one click.
4. **The eyebrow input.** Item 4 stops rendering `config.eyebrow` and removes its admin field, so this section's opening line becomes the trail stop like every other section's. Acceptable, or is the free-text eyebrow load-bearing for a campaign?
5. **The body copy.** The proposed sentence names the goods and Dehradun. The hero's equivalent rewrite was reverted the same day. Is this one different because it is a product block rather than the brand statement, or does the client keep their own line here too?
6. **Scope.** Items 7(a), 9 and 14 touch `actions/settings.ts`, `app/admin/homepage/HomepageEngine.tsx`, `lib/constants.ts` and two old migration comments — outside section 8. Approved?
7. **`TrailSpine`.** Item 7(c) guards the trail wrapper, which matters only while `TrailSpine` is mounted. `01-hero.md` item 7 has it down as a P1 removal and the council records the client rejecting it twice. Same answer as the hero, whatever it is.

**What I could not specify exactly:** the glow's falloff (`100% / 75%` at `10% 112%`, stops `0.13 / 0.07 / transparent`) is measured for contrast but not for *banding* — a wide, low-alpha radial over a near-black ground is exactly where 8-bit banding shows, and it needs eyes on a real panel, not a screenshot; the plate at `paper/[0.06]` is a 1.175:1 lift, which is deliberate and which I cannot promise reads on an uncalibrated laptop at low brightness; and `opacity-60 saturate-[0.4]` on a sold-out tile needs to be seen against the actual catalogue photographs before it ships, because the failure mode is "looks like a broken image" and no number predicts it.

---

## 7. How we will know it worked

**Widths, every time.** 320, 390, 640, **767 and 768**, **1023 and 1024**, **1279 and 1280**, 1440, 2560. At every one: the page body never scrolls horizontally; the plate never touches the section's `px-6`/`md:px-10` edge; the footer's total and button never collide; the manifest rule's four spans stay on one line with `stop.label` truncating rather than wrapping. Confirm the measured tile widths — 149 / 153 / 217 / 165 / 185 at 390 / 768 / 1024 / 1280 / 1440 — and that **1024 is no longer 112px**.

**Degraded and empty states, every time.**
(a) `product_slugs: []` → the section and its trail wrapper both **absent**; the page runs TrustBand → TheClimb with no dark band and no HUD stop.
(b) `enabled: false` → same.
(c) A hand-written partial `season_kit` row missing `product_slugs` → the homepage **renders**, not 500s. Test this one directly against a JSONB row, not through the admin UI, which cannot produce it.
(d) N = 1, 2, 3, 4 and 5 configured → the track fills evenly at 1–4 with no hole and no orphan; at 5 the admin checkbox for the fifth is **disabled** and reads "4 of 4 chosen".
(e) One of four sold out → the tile is desaturated, says "Sold out", its badge reads `—`, the label reads "3 pieces", and the total is a three-piece figure. All four numbers on the tiles sum to the number below them.
(f) All four sold out → button `disabled`, label "Sold out", no cursor bubble.
(g) A product with an empty `images` array → a lit surface with a badge, not a hole.
(h) `collection_slug` pointing at a deactivated collection → the link is simply absent, and the left column still ends on a sentence rather than mid-air.
(i) **JavaScript off** — the full band, the rule, the heading, the copy, every tile, every price and the total are all present and legible; only the button is inert.
(j) **`prefers-reduced-motion: reduce`** — the band is pixel-identical to the motion build at rest. Nothing pulses. This is the pass/fail on item 4.

**Measurements, before and after.**
- Warm-pixel share of the band on a 1440×900 render (R > G + 12): **0.00% today → 4–8%** after item 1, concentrated below y=70% and left of x=45%.
- Contrast, sampled from the live render on the composited pixel, not the token: `:182` label **4.04 → ≥ 7.5:1**; `:175` tile price **4.63 → ≥ 7.5:1**; the total in `--dawn` **≥ 4.5:1** at its worst point (over the plate over the glow — measured 4.60, so this has almost no margin and must be checked, not assumed); `--sage` on the rule **≥ 5.4:1**; nothing in the band below **4.5:1** at any size.
- The glow's alpha at the two sage strings must be **0** (both are above the 34% stop) and must never exceed **0.12** anywhere sage or 11px type sits.
- `--altitude` against `--forest-deep` is still 1.008:1 — item 1 does not change the token, it changes the *band*. Confirm by scrolling HomeTrails → TrustBand → SeasonKit as one motion and checking that three distinct grounds are visible, not two.
- Network panel at 768 and 1024: the tile request is **≥** the rendered width (today 115px is requested for a 163px tile at 768). No green flash under any tile on a throttled first load.

**Interaction and assistive passes.** Tab the whole section: rule → heading → copy → collection link → four tiles → button, ring visible at every stop (`on-dark :focus-visible` is `--sage`, **5.48:1** here; if `01-hero.md` item 8 lands it becomes `--sage-lit` at **8.79:1**). VoiceOver: each tile announces its name **once**, not twice; the four products appear as a list of four items and in the heading tree; pressing the button announces the added count through the `aria-live` region. Hover a tile and confirm the zoom settles inside 200ms.

**Housekeeping.** Two notes from experience so nobody loses an afternoon: **a mobile check needs a full relaunch** — a stale bundle looks identical to "my change didn't work" — and **the browser pane must be visible** or screenshots come back blank and `innerWidth` reads 0, which makes a correct responsive layout look broken.
