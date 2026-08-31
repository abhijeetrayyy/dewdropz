# The custom studio — Action Plan

*Section 4 of the homepage. Written against `components/sections/DesignYourOwn.tsx` (114 lines), `components/customize/DesignYourOwnConfigurator.tsx` (254 lines), `components/ui/ContourLines.tsx`, `app/globals.css`, `app/page.tsx`, `app/customize/page.tsx`, `app/products/[slug]/customize/page.tsx`, `components/customize/CustomizerStudio.tsx`, `lib/trail.ts`, `lib/constants.ts`, `actions/customRange.ts`, `types/database.ts` on branch `mobile-remediation`. Every line number and every contrast ratio below was computed against the working tree. Where I could not specify a value exactly, it is in §6, not hidden behind an adjective.*

---

## 1. The verdict

This is the only section on the homepage that is an **instrument** rather than a picture, and it is built as though it were a picture. Four facts carry the diagnosis. **It says everything twice and shows nothing once.** The top half — eyebrow, heading, lede, the two-door `<dl>`, the warm glow, the contour motif — is a near-verbatim second rendering of `/customize`'s own header (`app/customize/page.tsx:55–96`), so a visitor who takes a door lands on the same sentence; three of its four links go to the same page in the same state, and one of them, `?start=blank`, has never changed a byte because the destination only ever tests `start === 'library'` (`app/customize/page.tsx:33`). Meanwhile the section that sells printing contains **no printed pixel** — two un-printed blanks, and a badge reading "Your canvas" asserting what the picture does not show. **Its two background layers do not render.** The glow composites to `#F1E6D3`, which is **1.02:1 against `--paper-warm`** — the ground of the section directly above it — so the section spends its entire warm layer arriving at its neighbour's paper, and half the ellipse is then painted underneath an opaque panel; the contours read at 1.24:1. A file comment claims the band is "layered rather than flat". It renders flat. **The controls fail the people using them.** The dark panel carries `bg-[#0F1410]` but not `.on-dark`, so every one of its tabs, swatches, chips, toggles and CTAs takes the default `outline: 2px solid var(--forest)` — **1.80:1** on that ground — and a keyboard visitor configuring a garment sees nothing move; its instruction set ("01 — PICK YOUR COLOUR") is the least readable text in the section at 3.61:1; a sold-out size can be the pre-selected one and rides all the way into a paid order; and between 768 and 1023px the panel grid has not split yet, so a **879 × 1099px** garment photograph sits above every control on an iPad.

The fix is not more layers. It is to make the section **do the one thing it uniquely can — show the visitor, on the garment, exactly where their artwork will go and how big it can be — on a bench that is visibly a bench, on ground that separates, with the two doors moved from the top of the section (where the visitor has chosen nothing) to the bottom of the panel (where they have chosen everything).** The print rectangle is already in the data, in inches, per colourway, per side; the studio already draws it and already names it. Pull that one screen forward, put a real rake of `--dawn` across a `--forest-deep` bench so the light the comment promises actually arrives, drop the band onto `--paper-deep` so a ladder step does the job a 1.32:1 hairline is failing to do, and spend the reclaimed words on the two facts nobody can learn here today: that one is a whole order, and that the number on the panel already has the printing in it. Everything below is that idea, itemised.

---

## 2. What stays — do not touch

| | Why it is right |
|---|---|
| **The dark panel as a species.** `Configurator.tsx:19` — shadow + radius, no border. | LAW 2, correct. A dark work surface on warm paper is the single strongest compositional idea in this section, and the contrast people actually notice. Items below change its **colour, its light and its contract**; the species is untouched. |
| **`key={product.id}` on `ProductPanel`.** `Configurator.tsx:65`. | This is what actually resets colour and size when the garment changes — an honest remount instead of an effect reaching back to clear stale state. Item 8 removes the *other* key (`key={previewImage}`, `:98`); do not confuse them. |
| **The step ladder as a metaphor.** 01 colour → 02 size → 03 artwork, each a hairline row. | ROW species, correct enclosure, and it is the reason item 1's numbered opening rhymes into something instead of being a decoration. Item 11 removes Step 03's *bullets*, never the step. |
| **The colourway disabled state.** `Configurator.tsx:172–176` — the rotated hairline bar on unavailable swatches. | Not-orderable conveyed by something other than colour, on a control that *is* a colour. Exactly right. Item 6 gives the size chips the same discipline. |
| **`aria-pressed` on the tabs, the swatches and the front/back toggle.** `:32`, `:160`, `:119`. | Correct. Item 6 adds the one that is missing (`:191`), it does not re-litigate the three that are there. |
| **The `<dl>` copy's *argument*.** `DesignYourOwn.tsx:58–64`'s comment: the page sold "upload your design" exclusively, which told everybody without a design the shop was not for them. | The diagnosis is right and it stays right. Item 4 moves where the two doors are offered; it does not remove the idea that there are two. |
| **Rendering off the real catalogue, not a hardcoded three.** `DesignYourOwn.tsx:24`. | Turning a fourth blank on in admin surfaces it here with no code change. Item 12 tightens the *predicate*, never the principle. |
| **`ContourLines` at `opacity-[0.13]`.** | Measured on the new ground: `#CEC6A9` on `--paper-deep` = **1.23:1**, against 1.24:1 on `--paper` today. It reads identically after item 1. Leave the opacity alone — the proposal to lower it to 0.11 was based on a guess, and the guess was wrong. |
| **The section has no entry motion and no ambient motion.** | Constraint 4 and LAW 6. The page's one choreographed moment is the hero. Nothing below adds a reveal, a draw-on, or a scroll-linked anything — item 9 only brings the existing hover transitions into the 140–260ms band. |

---

## 3. The action plan

Table and specs share the same numbering. Items **1, 2 and 3 alone change what this section looks like and what it can tell you**, on a phone and on a laptop.

| # | Action | What | Why | Effort | Priority |
|---|---|---|---|---|---|
| 1 | update | Ground steps to `--paper-deep`, the section opens on a numbered rule, one measure | LAW 1 breaks outright in a reachable state; four consecutive sections open in the same species; the measure narrows 128px at the seam below | 1.5h | **P1** |
| 2 | update | The bench goes `--forest-deep` with one rake of `--dawn`, joins `.on-dark`, and its small print clears AA | Focus ring is 1.80:1 on the section with the most controls on the page; three 10px strings are under 4.5:1; four one-off hexes | 3h | **P1** |
| 3 | ✅ add | The print area, drawn on the garment, with its real size in inches | The section that sells printing shows nothing printed and states no dimension; every number is already in `customization_config` | 3h + stills | **P1** |
| 4 | update | The two doors move from the header into the panel, as a CTA pair | Three links, two identical destinations, one dead parameter — offered at the moment the visitor has chosen nothing, withheld at the moment they have | 2.5h | **P1** |
| 5 | update | Half the words, each carrying a fact | Nobody can learn here that one is a whole order or that the price includes the printing | 45m | **P1** |
| 6 | ✅ update | Stock truth, from the swatch to the bag | A sold-out size can be the pre-selected one and survives into a paid order | 2h | **P1** |
| 7 | update | The tablet frame — split at `md`, cap the stage below it | At 1023px the stage computes to 879 × 1099px with every control below it | 1h | P2 |
| 8 | update | The stage stops flashing black on every colour change | `key={previewImage}` replays a `#1a2e17` placeholder on a light plate, on the most-used control in the section | 45m | P2 |
| 9 | update | Controls a thumb can hit; one motion speed | 32px swatches, 34px chips, 22px toggle buttons; two transition speeds for one interaction, neither in band | 1.5h | P2 |
| 10 | update | Mono measures. Archivo stops being a nine-step ramp | LAW 3 is exactly inverted — mono labels, Archivo carries every figure | 1.5h | P2 |
| 11 | remove | Step 03's three bullets | An advert wearing a step's number, restating the doors 400px above it | 30m | P2 |
| 12 | update | An honest gate, a guarded chapter, a projected prop | A blank with no orderable colourway renders a Customize button into a dead studio; the trail wrapper is unguarded; the whole catalogue is serialised into a client component | 1.5h | P2 |
| 13 | update | The comments stop describing a different page | The file says 14:30 and names two hexes from `/customize` as its neighbours | 15m | P3 |

---

### The specs

**1 — Ground, opening species, and one measure.**

*1a — the ground.* `DesignYourOwn.tsx:34`: `bg-paper` → `bg-paper-deep` (`#E7D9BE`), and **delete `border-t border-rule`**. A ground step separates; a 1.32:1 hairline does not. This gives one ladder step below `--paper-warm` when `ShopByCategory` renders, and **two steps** below `--paper` in the reachable state where `pickEssentials` is empty and `app/page.tsx:98` drops that whole wrapper — the state in which LAW 1 currently fails outright with no image between the two bands. Text on the new ground, all measured: `--text` **13.15:1**, `--mid` **5.79:1**, `--forest` **7.41:1**. Nothing else needs a colour change. The trio's rule at `:99` goes `border-forest/15` → `border-rule-warm` (`--rule-warm #D2C4A4`, `globals.css:69`, which exists for exactly this ground; forest at 15% over warm paper composites to a cool grey).

*1b — the opening species.* Three neighbours in a row — `CollectionsRow.tsx:58`, `ShopByCategory.tsx:73`, and this file at `:50` — open with a mono eyebrow over a Fraunces heading, and `TrekBuddyBand.tsx:110` makes it four. Take the species the run is missing. With the header link and the `<dl>` gone (item 4), `DesignYourOwn.tsx:43–95` collapses to a plain block:

```
<div className="flex items-baseline gap-4">
  <span className="font-mono text-[13px] tabular-nums text-forest">04</span>
  <span aria-hidden className="h-px flex-1 bg-rule-warm" />
  <span className="font-mono text-[13px] uppercase tracking-[0.2em] text-forest">{stopEyebrow(stop)}</span>
</div>
<h2 className="mt-6 max-w-3xl font-display text-[clamp(30px,5vw,54px)] leading-[1.03] text-balance text-text">
```

The 13px eyebrow stays 13px: the comment at `:45–49` records the client asking for that size by hand, so it is an instruction, not a defect. The `04` is a within-section figure that rhymes forward into the panel's own `01 / 02 / 03` — it is **not** a page-wide chapter index (see §4). Clamp floor `32` → `30`: at 390px the column is 342px and "Go on — make it yours." at 32px Fraunces computes to ~338px, i.e. **4px from wrapping**, so its silhouette currently flips between the fallback face and Fraunces on a cold cache; at 30px it is ~317px with 25px of slack, and at 320px (272px column) `text-balance` breaks it as "Go on —" / "make it yours." instead of orphaning "yours." Keep `text-balance` **on**.

*1c — the glow, corrected and moved.* `DesignYourOwn.tsx:36–39`. The literal `rgba(215,169,106,0.20)` is not a token and composites over `--paper` to `#F1E6D3` — **1.02:1 against `--paper-warm #F1E9D7`**, the ground of the band directly above. Replace with `--dawn #E39B3F` at 13%, written out because it is inside an arbitrary-value gradient outside Tailwind's token reach — **add a comment naming the token**:

```
className="pointer-events-none absolute -right-[120px] -top-[140px] h-[520px] w-[720px] rounded-full
           bg-[radial-gradient(circle,rgba(227,155,63,0.13)_0%,transparent_70%)]"
```

Two changes beyond the colour. The size becomes **absolute px, not `h-[70%] w-[70%]`** — a percentage of section height means the glow's physical size changes with how many colourways a blank has. And the position moves up and out of the panel: today the ellipse centres at ~70% width / ~35% height, which lands *under* the opaque panel, so roughly half of it is painted and then covered. On the new ground the peak composites to **`#E6D1AE`** — 16 steps of blue below `#E7D9BE`, a warm delta you can see, where today's peak lands within 4 steps of the neighbour's paper.

*1d — one measure.* `:42` `max-w-7xl` (1280) → `max-w-6xl` (1152), matching `TrekBuddyBand.tsx:102` directly below. Crossing that seam currently narrows the page by 128px for no reason a visitor can name (LAW 4). Delete `max-w-2xl` from `:44` and `max-w-xl` from `:54`; with the doors gone the block sets against `max-w-3xl` (768px) for the heading and `max-w-xl` stays only on the lede — one width per role.

**2 — The bench is green-black, the light is real, and it joins the dark contract.** Four parts, in this order.

*2a — the contract.* `Configurator.tsx:19` — add **`on-dark`** to the class list. `globals.css:620–628` sets `:focus-visible { outline: 2px solid var(--forest) }` and `.on-dark :focus-visible { outline-color: var(--sage) }`; `TrekBuddyBand.tsx:73` carries `on-dark` for precisely this reason and this panel does not. Measured: `--forest #27481F` on `#0F1410` = **1.80:1** against a 3:1 non-text requirement; `--sage #7BA46F` on `--forest-deep #16290F` = **5.43:1**. This is the single highest-value line in the plan and it is one word. Also delete the second copy of the literal at `:163`: `ring-offset-[#0F1410]` → `ring-offset-forest-deep`.

*2b — the colour.* `bg-[#0F1410]` → **`bg-forest-deep`** (`#16290F`, `globals.css:39`, whose own comment says it exists "for layering dark-on-dark without going to ink"). `shadow-[0_30px_80px_-40px_rgba(12,16,13,0.7)]` → `shadow-[var(--shadow-float)]`. **State the honest number:** `#0F1410` measures **1.03:1** against `--ink #0C100D`, the full-bleed ground of `TrekBuddyBand` about 200px below, so the page today shows a dark slab, a strip of cream, then a dark band of the same value — the panel rehearses Trek Buddy's arrival and spends it. `--forest-deep` improves that to **1.24:1**, which is a real but modest separation. What actually stops the rehearsal is the **hue** — a green-black bench next to a neutral near-black band — and 2c. Do not claim the value gap does the work.

*2c — the rake.* Make `:19` `relative overflow-hidden`, insert as first child, and wrap the existing tab row + `<ProductPanel>` in a `<div className="relative">` so they sit above it:

```
<div aria-hidden className="pointer-events-none absolute inset-0
     bg-[radial-gradient(90%_70%_at_14%_-6%,rgba(227,155,63,0.14)_0%,transparent_62%)]" />
```

`rgba(227,155,63,…)` is `--dawn` written out — comment it. This is the light the file's own comment has been promising since it was written ("as if the light is coming across the bench") and never delivering, and it is the section's second and last legitimate use of the page's one warm accent. Measured: at its peak the ground composites to `#333916`; the small print specified in 2d holds **5.3:1** there against 6.8:1 on the unlit ground, so the rake costs about 1.5 points of ratio and nothing falls under AA. **0.14 is the ceiling** — at 390px the panel is 310px wide and the gradient covers proportionally more of it, and a large low-alpha radial on a near-black ground is exactly where 8-bit banding shows. Check it on a cheap panel. If the client rules `--dawn` out at 08:30, the pre-agreed retreat is the identical gradient in `rgba(168,205,152,0.10)` (`--sage-lit`), which still lights the bench without touching the accent (§6, Q2).

*2d — the small print clears AA.* All measured on `--forest-deep`. `Configurator.tsx:248` Step label `text-paper/40` (**3.61:1**) → `text-paper/65` (**6.81:1**) — this is the section's instruction set and today it is its least readable text. `:236` caption `text-[10px] text-paper/35` (**3.06:1**) → `text-[11px] text-paper/65` (**6.81:1**). `:51` idle tab index `text-paper/35` → `text-paper/60` (**5.98:1**). `:142` short description `text-paper/50` → `text-paper/60`. `:200` out-of-stock chip `text-paper/20` (**1.80:1** — a strikethrough nobody can see) → `text-paper/50` (**4.61:1**), keeping `line-through`. **Hold `:251` (the Step *value*) at `text-paper/70`** (**7.64:1**) — raising every alpha at once flattens the label against its value; let the 1px size difference and the 5-point ratio gap carry the hierarchy.

Two more one-off literals go while you are here: `:94` stage `bg-[#D9D9D7]` (a neutral grey in a palette with no neutral grey — every other ground on this page is warm) is handled in item 8, and `:120` `rounded-[2px]` → `rounded-[var(--r-bar)]`, which is the same number written as the token it was approximating.

**3 — The print area, drawn on the garment.** The section's one genuinely new idea, and every number for it is already in the database.

`CustomizationZone` (`types/database.ts:229–237`) carries `x`, `y`, `widthPx`, `heightPx` in a canonical space plus `widthIn`, `heightIn`. `CANONICAL_WIDTH` is **800** (`CanvasStage.tsx:11`). The stage box is `aspect-[4/5]`, so the canonical height that box already assumes is **1000**, and the mockups are 1080 × 1350 (the house 4:5 convention, `mobile/components/customize/CustomizeStage.tsx`) — which means `object-cover` on a 4:5 image in a 4:5 box is a no-op crop and the percentages land exactly. Inside the `aspect-[4/5]` div at `Configurator.tsx:95–108`, after the `<Image>`, guarded on `shownZone` (`:81`):

```
{shownZone && (
  <span aria-hidden className="pointer-events-none absolute rounded-[var(--r-bar)] border border-dashed border-dawn/70"
        style={{ left:   `${(shownZone.x / 800) * 100}%`,
                 top:    `${(shownZone.y / 1000) * 100}%`,
                 width:  `${(shownZone.widthPx / 800) * 100}%`,
                 height: `${(shownZone.heightPx / 1000) * 100}%` }} />
)}
```

1px dash, no fill, no animation — it moves when the image moves and it never draws itself on. Then **replace the "Your canvas" badge** at `:130–132`, which is unconditional and therefore lies whenever every colourway is unavailable, with the readout — and move it to `bottom-3` so it sits under the rectangle instead of competing with the front/back toggle at `top-3`:

```
{shownZone && (
  <span className="absolute right-3 bottom-3 flex items-baseline gap-2 rounded-[var(--r-input)] bg-ink/70
                   px-2.5 py-1.5 text-paper backdrop-blur-sm">
    <span className="font-body text-[10px] uppercase tracking-[0.18em] text-paper/80">Print area</span>
    <span className="font-mono text-[11px] tabular-nums">{shownZone.widthIn} × {shownZone.heightIn} in</span>
  </span>
)}
```

Nothing here is invented. `CustomizerStudio.tsx:353–356` already renders that exact string under `RailLabel n="04" label="Print area"`, and its canvas already draws the dashed edge with the caption "Anything past the dashed edge is trimmed off the print". This pulls the shop's own craft vocabulary forward by one screen. It is also the section's only legitimate use of `--dawn` on a surface — 08:30, light arriving, on the one plane that matters — and it is the first printed-looking thing this section has ever shown.

**Guard, do not assume:** a future mockup that is not 4:5 will both crop under `object-cover` and misplace the rectangle. It cannot be more wrong than the crop already is, but if non-4:5 mockups become real the overlay must move to `object-contain` and read the intrinsic ratio. §6, Q4.

**4 — The two doors move to where the decision is made.**

Delete `DesignYourOwn.tsx:65–86` (the `<dl>`) and `:88–94` (the `Open the studio ↗` link). The header keeps eyebrow-rule, h2, lede, and `:43`'s `md:flex-row md:items-end md:justify-between` collapses to a plain block, which is what item 1's numbered opening needs. In `ProductPanel`, replace the single `<Link>` at `Configurator.tsx:229–235` with a pair:

```
const lib = new URLSearchParams(params); lib.set('start', 'library')
const libraryHref = `/products/${product.slug}/customize?${lib}`
```

```
<div className="mt-8 grid gap-2 sm:grid-cols-[1.3fr_1fr]">
  <Link href={libraryHref}  className={btn + ' bg-sage text-ink hover:bg-sage-lit'}>Start from a design →</Link>
  <Link href={studioHref}   className={btn + ' border border-paper/25 text-paper hover:border-paper/60'}>Bring your own →</Link>
</div>
```

with `btn = 'group flex min-h-[52px] items-center justify-center gap-2.5 rounded-[var(--r-input)] px-6 font-body text-[11px] uppercase tracking-[0.14em] transition-colors duration-200 ease-[var(--ease-out)]'`.

`?start=library` on the product studio route is already fully honoured — `app/products/[slug]/customize/page.tsx:42` → `openLibrary` → the studio's toolbar. The library is the **primary** (sage) because the person with no artwork of their own is the larger group and is the exact person this section's own comment (`:58–64`) says the page was quietly excluding; the sage must stay unmistakably primary so the pair does not read as a decision the visitor is not ready to make. Both routes now land in the studio **on that garment, with colour and size attached, with no interstitial page** — where all three deleted links first went to `/customize` and made the visitor pick a blank a second time.

Under the pair, the way out for people who do not want to design anything at all — today there is none, and the studio refuses to continue until the canvas has objects on it (`CustomizerStudio.tsx:171–176`):

```
<Link href={`/products/${product.slug}`}
      className="mt-3 block text-center font-body text-[11px] text-paper/70 underline-offset-4 hover:text-paper hover:underline">
  Buy it plain — {formatPrice(price)}
</Link>
```

**7.64:1.** The `/customize` index loses its homepage entry; the nav still links it, and item 12's overflow note gives it back if the catalogue ever grows past the strip.

**Consequence to watch:** with the bullets gone (item 11) and `mt-auto pt-7` replaced by `mt-8`, the options column ends short of the stage at `lg`. Measured on a blank with a two-line `short_description` at a 1280 viewport: column content ≈ **447px** against a **595px** stage, so the column settles ~148px above the stage's bottom edge. That is a column that has ended, not a stretched one with a hole in it — but it is the one thing in this plan that needs eyes at 1440 before it merges (§6, Q5).

**5 — Half the words, each carrying a fact.** Exact strings. **The h2 at `:52` is not touched** — the client hand-reverted the hero sentence the day it shipped (`HOMEPAGE-COUNCIL.md:138`), and everything this rewrite would have fixed is fixed by deleting the duplicate header instead.

- **Lede**, `:55` — "Build every detail before it goes to print." → **"Our artwork or yours, printed on one garment. The price on the panel already includes the printing."**
  The price claim is **verified in code, not asserted**: `Configurator.tsx:83` and `CustomizerStudio.tsx:76` both compute `product.price + (variant?.price_adjustment ?? 0)`, `:239` puts that number in the cart unchanged by artwork, and no print surcharge exists anywhere in the repo. This is the strongest commercial fact the section owns and it has never been said.
- **Trio**, `:100–103` — replace all three rows:
  `['Printed in Dehradun', 'The same room the samples get made in.']`
  `['A run of exactly one', 'Nobody else walks up wearing yours.']`
  `['Ships in 8–10 days', 'Longer than stock, because nothing exists until you order it.']`
  Row 3 turns the slowest fact in the section into the proof of the promise. "COD available across India" is deleted: `TRUST_POINTS` already says "Cash on delivery, India-wide" (`lib/constants.ts:134`) lower on the same page. Row 2 drops "jacket", a garment noun admin can turn off. Set the figure in mono per LAW 3 by splitting the title — `Ships in <span className="font-mono">8–10</span> days` — the same construction `TrustBand` already uses.
- **Price micro-label**, under `Configurator.tsx:139`: `<span className="mt-1 block text-right font-mono text-[10px] uppercase tracking-[0.18em] text-sage">printing included</span>`. `--sage` on `--forest-deep` = **5.43:1**.
- **CTA caption**, `:236–238` — "Opens the studio with this blank, colour and size already loaded." → **"Your blank, colour and size come with you."** at `text-[11px] text-paper/65` (**6.81:1**, from 3.06:1).
- **Step 03 value**, `:213` — `"next, in the studio"` → `"in the studio, next"`. It is the only line in the panel that reads as a fragment rather than a phrase.

**What is deliberately NOT claimed:** "no setup fee", "no plate charge", and "no minimum" were all proposed and all cut. They are business facts the code cannot confirm; they are also the two strongest lines that could be false. They go to the client as Q1, not into the page.

**6 — Stock truth, from the swatch to the bag.** A correctness bug, not a polish item. `Configurator.tsx:77` is `useState(variants[0]?.id)` with a `?? variants[0]` fallback at `:78`, and the chip ternary at `:196–202` tests the **selected** branch before the **oos** branch — so a sold-out size renders in sage as chosen *while* being `disabled`, unclickable and unchangeable, is included in the price shown, and is written into `studioHref` at `:87`. The studio accepts it verbatim (`CustomizerStudio.tsx:71`), its only pre-flight check is `variants.length > 0 && !variantId` (`:177`) which passes because `variantId` is set, and `actions/orders.ts:51–65` reads inventory only to compose a low-stock notification. Nothing between this chip and a paid order stops it.

- `:77` → `useState(variants.find((v) => (v.inventory_quantity ?? 0) > 0)?.id)`
- `:78` → `const variant = variants.find((v) => v.id === variantId)` — **delete the `?? variants[0]` fallback**
- `:196–202` — test `oos` **before** the selected branch
- `:191` — add `aria-pressed={variant?.id === v.id}`; the size chips are the only one of the panel's four toggle groups without it, so today the selected size is conveyed by `border-sage bg-sage/15` alone, and that variant id is what gets handed to the studio
- `:87` → `if (variant && (variant.inventory_quantity ?? 0) > 0) params.set('variant', variant.id)`
- `:186` Step 02 value → `variant?.name ?? 'Sold out'`
- when `variants.length > 0 && !variant`: render the CTA pair with `aria-disabled="true" tabIndex={-1} pointer-events-none opacity-50` and swap the caption to **"Every size is sold out — try another blank above."**
- wrap each control group in `role="group"` with an `aria-label` matching its Step label

The same in-stock default must land at `CustomizerStudio.tsx:71` or the studio re-selects `variants[0]` on arrival and undoes the whole item — that file is outside this section, see §6, Q6.

**Honest consequence:** a blank with no stocked sizes now shows a visibly disabled CTA instead of a working-looking one. That is correct, and it exposes bad inventory data the section used to hide.

**7 — The tablet frame.** `Configurator.tsx:91` → `mt-5 sm:mt-6 grid grid-cols-1 md:grid-cols-[0.9fr_1fr] lg:grid-cols-[0.82fr_1fr] gap-5 md:gap-6 lg:gap-8`. The grid only splits at `lg` today, so at a 1023px viewport the stage computes to **879 × 1099px** — a single blank product mockup taller than the viewport, with every control below it (1023 − 80 `px-10` = 943; − 64 `p-8` = 879; × 5/4 = 1099). iPad portrait at 820 gives 676 × 845. After the `md` split: at 768 the stage is **284px** and the options column **316px**, which holds six size chips at `min-w-[52px]` across two rows with `flex-shrink-0` already protecting the price from a long product name.

Below `md`, cap the stage — `:94` gains `mx-auto w-full max-w-[380px] md:max-w-none` — so the single-column stage tops out at **380 × 475** instead of 544 × 680 at `sm`. A 390px phone is unaffected (310px, under the cap).

And correct the `sizes` lie at `:102` while you are in there. The declared `(max-width: 1024px) 100vw, 52vw` asks for 665px at a 1280 viewport into a slot that, after item 1's `max-w-6xl`, computes to **476px** (1152 − 64 panel padding − 32 gap = 1056; × 0.82/1.82). Replace with:

```
sizes="(max-width: 767px) 380px, (max-width: 1023px) 40vw, (max-width: 1279px) 38vw, 476px"
```

Checked at each breakpoint: 767 → slot 380, asks 380. 1023 → slot 405, asks 409. 1024 → slot 382, asks 389. 1279 → slot 476, asks 486. Every clause over-requests slightly and none under-requests, which is the only direction that is safe.

**8 — The stage stops flashing black.** This is the single most-repeated visual event in the section and it is a black flash on a light plate. `key={previewImage}` at `:98` forces a full remount on every `src` change, so `placeholder="blur"` replays `BLUR_DATA_URL` — an 8×8 solid `#1a2e17` (`lib/constants.ts:24–25`) — which measures **10.27:1** against the `#D9D9D7` stage it paints on. Every swatch click and every front/back flip blanks the garment to a near-black square and fades it back.

- `:98` — **delete `key={previewImage}`**. The `src` change alone re-renders; the key only forces the remount. This is safe because colour state is reset by the `key={product.id}` remount at `:65`, which is what actually guards garment switching.
- `:94` — `bg-[#D9D9D7]` → **`bg-paper-warm`** (`#F1E9D7`). Not `paper-deep`: a mockup with a soft edge or a transparent cutout will show a warm halo on the deeper plate, and `paper-warm` is one step safer while still being a warm ground in a palette that contains no neutral grey.
- `:104` — `blurDataURL={BLUR_DATA_URL}` → `blurDataURL={BLUR_DATA_URL_PAPER}`, added beside `lib/constants.ts:24` as the identical 8×8 SVG with `fill="#F1E9D7"`. That constant is a shared file outside this section — one added export, no existing use changed (§6, Q6).
- `:41–47` — add `placeholder="blur" blurDataURL={BLUR_DATA_URL_PAPER}` to the tab thumbnail. It is the only `<Image>` on the homepage without a placeholder (`ShopByCategory:104`, `CollectionsRow`, `TrekBuddyBand:79` all have one).

**9 — Controls a thumb can hit, at one speed.**

*Touch targets.* Do **not** grow the swatches to 44px — that drops a 390px phone column from 7 swatches per row to 5 and makes a colour picker look like a button grid. Grow the **hit area** instead, leaving the visual dot at 32px. `Configurator.tsx:161`, on the already-`relative` button, add `before:absolute before:-inset-[6px] before:content-['']` → a **44 × 44px** target around a 32px circle, and change the row gap at `:148` from `gap-2.5` (10px) to `gap-3` (12px) so adjacent hit areas abut exactly at a 44px pitch instead of overlapping by 2px. Density is unchanged: (310 + 12) / 44 = **7 per row at 390px**, the same as today.

Size chips `:196` — `min-w-[46px] px-3 py-2 text-xs` (34px tall) → `inline-flex items-center justify-center min-h-[44px] min-w-[52px] px-3.5 text-[11px]`. Front/back toggle `:120` — `px-2.5 py-1 text-[9px]` (22px) → `inline-flex items-center min-h-[40px] px-3 text-[10px]`. **40, not 44, and say so:** the toggle is an overlay plate on a photograph, and at 44 the plate becomes 52px tall on a 388px stage and starts to own the garment. This is the one residual target miss in the section (§6, Q3).

*Motion.* Every `duration-300` in both files → `duration-200 ease-[var(--ease-out)]` (`globals.css:107`). The two bare `transition-colors` at `:51` and `:54` currently fall back to Tailwind's 150ms default while the border they sit inside runs at 300ms — the tab strip runs at two speeds for one interaction, and neither is in the 140–260ms band. Give them the same `duration-200 ease-[var(--ease-out)]`. Nothing gains an entry animation, a delay, or a loop.

**10 — Mono measures. Archivo stops being a nine-step ramp.** LAW 3 is exactly inverted here: `font-mono` appears **once** in 368 lines, on the eyebrow — a string that is mostly words — while every real figure is Archivo.

*Figures to mono.* `:51–53` tab index → `font-mono text-[10px] tracking-[0.18em]` (add `leading-none`; see the risk below). `:249` step number → `<span className="font-mono text-sage">{n}</span>`, leaving the label in Archivo. `:139` price `font-body text-lg … tabular-nums` → `font-mono text-[17px] tracking-[-0.01em] text-sage` — drop `tabular-nums`, redundant on a monospaced face, and 17px mono sets to roughly the optical size of 18px Archivo. This is consistency, not invention: the studio this panel hands off to already sets the identical price in mono at `CustomizerStudio.tsx:401`, and `tabular-nums` at `:139` was already an admission the face was wrong for the job. `--sage` on `--forest-deep` = **5.43:1** at 17px, clear of AA.

*Two label rungs, not five.* Archivo currently runs **{9, 10, 11, 12, 13, 14, 15, 18}** at five uppercase trackings (0.06 / 0.14 / 0.15 / 0.16 / 0.2em), which is why a link and an inert label are indistinguishable except by an underline.
- **Rung A — section level, `text-[11px] uppercase tracking-[0.14em]`:** trio titles (`DesignYourOwn.tsx:106`, already correct), both CTA faces (item 4, from 0.16em), size chips (`:196`, from `text-xs`/0.06em).
- **Rung B — panel micro-label, `text-[10px] uppercase tracking-[0.18em]`:** Step label (`:248`, from 0.2em), front/back toggle (`:120`, from 9px/0.15em), print-area label (item 3).
- **9px and 12px leave the section entirely.** Net: Archivo lands on **{10, 11, 13, 15}** plus the two display sizes, at two uppercase trackings.

**Real typographic hazard, name it:** Space Mono at 10px uppercase with 0.18em tracking sets optically smaller and noticeably wider than Archivo at the same nominal size, and Space Mono ships weight 400 only. The Step row is `items-baseline` so it will not shift, but the tab's two-line index/name stack at 390px, where tabs are full-width, is where it will look thin — `leading-none` on the index line is likely needed. **Eyeball it at 390 before committing.**

**11 — Step 03's three bullets.** Delete the `<ul>` and its three-string array at `Configurator.tsx:214–225`, keeping only `<Step n="03" label="Add your artwork" value="in the studio, next" />` inside the existing wrapper. The three lines restate the two doors sitting 400px above them, and the facts they carry do not vanish — "a photo, a logo, or something you drew" and "front, back, or both" are what the CTA pair's two faces now mean, at the moment the visitor is committing rather than reading. Change `:228`'s `mt-auto pt-7` to `mt-8` in the same edit so the reclaimed ~120px does not become a hole above the button (see item 4's measurement). Below 1024 the panel simply gets ~120px shorter, which is a straight win on a phone.

**12 — An honest gate, a guarded chapter, a projected prop.**

*The gate lies.* `DesignYourOwn.tsx:24` tests `colors.length > 0`, but the configurator's own selection filter (`:72`) and the studio (`CustomizerStudio.tsx:50`) both require `available && (front || back)`. A blank with five "coming soon" colourways passes the gate: every swatch renders disabled, `color` is `undefined`, the alt text reads "in default colour", the stage silently falls back to `product.images[0]` (a catalogue photo, not a mockup), and the CTA opens a studio where `sides` is `[]` and there is no print zone at all. Align the predicate:

```
p.is_customizable && (p.customization_config?.colors ?? []).some((c) => c.available && (c.front || c.back))
```

*Hoist and guard.* Move that filter into `app/page.tsx` as `const blanks = …` and wrap the trail div at `:105–107` in `{blanks.length > 0 && ( … )}`, exactly as `:98` and `:145` already do for `ShopByCategory` and `Community` — both with comments saying why. `TrailSpine` builds its chapter HUD from these `data-trail-*` attributes, so today, with nothing customizable, the page advertises an "08:30 · Custom Studio" stop with nothing behind it.

*Project the prop.* `:97` currently hands whole `ProductWithCollection` records into a client component — description, story blocks, every variant, and every zone's pixel and inch geometry for every colourway. Map to `Pick<ProductWithCollection, 'id'|'slug'|'name'|'price'|'short_description'|'images'|'customization_config'|'variants'>` and narrow the Configurator's prop type to match; `app/products/[slug]/customize/page.tsx:31–33` already builds exactly this shape for exactly this job.

*One more conditional.* Wrap the tab strip (`Configurator.tsx:23–61`) in `{products.length > 1 && ( … )}` — at one blank it is a lone "01" chip that explains nothing.

**Explicitly not doing:** the `is_featured` sort and the cap-at-five. With three customizable blanks the cap is invisible, and `is_featured` is a product-level flag shared with other surfaces, so sorting on it here quietly couples this section to a tick that means something else elsewhere. That is a governance decision for the shop, not a design one (§6, Q7).

**13 — The comments stop describing a different page.** `DesignYourOwn.tsx:28` says "**14:30** on the page's clock — strong afternoon light"; `lib/trail.ts:72` puts this stop at **08:30**. The clock was re-cut for the 23 August scroll order and this comment was not. `:29–30` says "the surrounding sections run #F6F0E2 → #F4EBD7"; those two hexes belong to `app/customize/page.tsx:40` — the real neighbours are `#F1E9D7` above and `#0C100D` below. Rewrite both to describe **08:30, first working light, `--paper-deep` between `--paper-warm` and `--ink`**, and state out loud that `--paper-deep` is annotated "golden hour" in `globals.css:34` while this stop is 08:30 — the ladder is a law and the clock is a comment, and the ladder wins here. Say it in the file so a later session does not "fix" it back. Also correct `:45–49`, which claims the eyebrow reads "CUSTOM STUDIO" when `stopEyebrow()` renders `08:30 · CUSTOM STUDIO`.

---

## 4. Removals, argued

**The `<dl>` of two doors, from the header (item 4).** Not the idea — the placement. The two doors are offered at the exact moment the visitor has chosen no garment, no colour and no size, and withheld at the moment they have chosen all three. Both of them, plus the header link, lead to `/customize`, a slower duplicate of the panel sitting directly beneath them, where the visitor picks a blank a second time. Moved into the panel they become one tap into the studio on that garment with state attached — and the door that was missing, the library, becomes the *primary* button rather than the first of two inert `<dt>`s.

**The `Open the studio ↗` link (item 4).** A fourth name for a destination door 2 already reached, and the fifth element in the section wearing the byte-identical `text-[11px] uppercase tracking-[0.14em] text-forest` — which is why two links and three inert labels are today indistinguishable except by an underline. Its removal is also what lets `:43`'s `md:flex-row md:justify-between` collapse, which item 1's numbered opening needs.

**`?start=blank` (item 4).** A parameter that is read and never tested. `app/customize/page.tsx:32–33` reads `start` and branches only on `'library'`, so this URL has produced byte-identical output to the bare route since the day it was written.

**"Your canvas" (item 3).** A badge asserting what the picture does not show, rendered unconditionally so that it also asserts it when every colourway is unavailable and there is no canvas at all. It is replaced by a readout of the same rectangle in real inches, guarded on the data.

**Step 03's three bullets (item 11).** An advert wearing a step's number. "Drop in a photo, a logo, or something you drew" is the same sentence as door 2, 400px up the same section — and after item 4 it is the same sentence as the button immediately below it. "Two controls you can use, then the button" is the disciplined ending for a workbench.

**"COD available across India" (item 5).** `TRUST_POINTS` at `lib/constants.ts:134` already says "Cash on delivery, India-wide" lower on the same page, with a whole band built to say it.

**`key={previewImage}` (item 8).** One prop that turns every swatch click into a full remount and a black flash. It duplicates a guard that `key={product.id}` already provides correctly one level up.

**Four one-off hexes (item 2).** `#0F1410` (twice, the second as `ring-offset`), `#D9D9D7`, `rgba(215,169,106,…)`. Each was approximating a token that already exists; two of them were also breaking a law while they did it.

---

## 5. Killed in judging — on the record

- **Put a person in the frame at the bottom edge** — FATAL. Every `DAY_ARC` image is stock Unsplash trekking scenery (`lib/constants.ts:54–67`); there is no photograph of a printed DEWDROPZ garment in this repo. A full-bleed strip captioned as "someone in Dehradun wearing the thing that was printed for them", running an anonymous stock trekker, is the cheap dishonest move this brand cannot afford — and borrowing `theRidge` pre-spends Trek Buddy's own 11:00 hour, breaking the two-palette separation. If the client supplies a real shot this becomes a different proposal.
- **Delete both background layers** — the glow diagnosis is right, but the prescription is deletion and the contours at 0.13 are the brand's topographic device, not filler. Measured after item 1 they read at 1.23:1, identical to today. A proposal whose stated premise is "nothing changes on screen" is also the last thing to put in front of a client who has rejected three things for not looking good. The comment correction is lifted out of it as item 13.
- **Rebuild the header around the `<dl>` on the panel's own grid track** — the one-track idea is genuinely the strongest structural reading here, but it hard-conflicts with item 4, which deletes the `<dl>` it rebuilds around, and both cannot land. Item 4 is the better half: moving the doors into the panel removes a whole page from the purchase path, which the client can feel, while a shared grid track is something only a designer sees. Its measure-unification half survives as item 1d.
- **Grow the colour swatches to 44 × 44px** — correct diagnosis, wrong execution. It drops a 390px column from 7 swatches per row to 5 and turns a colour picker into a button grid. Item 9 takes the 44px target with a `before:` pseudo-element and keeps the 32px dot.
- **`bg-paper-deep` for the product stage** — riskier than `paper-warm` for the same win: any mockup with a soft edge or transparency shows a warm halo, and the proposal itself ended by asking a human to check three blanks. Item 8 takes `paper-warm`.
- **Delete `placeholder`/`blurDataURL` from the stage** — same correct diagnosis as item 8, wrong fix. A bare plate during load is worse than a correctly-coloured placeholder, and it changes LCP appearance on slow connections. Item 8 recolours it instead.
- **Delete the reassurance trio and fold it into a two-clause lede** — the trio is the only warmth this section has on paper, and "Printed in Dehradun — the same room the samples get made in" is its most human sentence. A client who rejects things for looking wrong reads three deleted cells as content taken away. Item 5 rewrites the trio and keeps it; the "printing included" line and the caption fix are lifted out of that proposal into items 5 and 2d.
- **Rewriting the h2 to "Bring a drawing. Leave with a hoodie."** — the warmest line proposed anywhere in this council, and still killed: it rewrites the one string this client hand-reverted a rewrite of on the day it shipped, and it hardcodes a garment noun admin can turn off. Everything it was fixing — the verbatim duplication with `/customize`'s h1 — is fixed by deleting the duplicate header instead.
- **A four-tile strip of real library artwork under "Browse the library"** — right instinct, wrong craft. 56px tiles with `p-1.5` leave a ~44px mark, admin-uploaded artwork is exactly the content most likely to be a detailed line drawing that turns to mush or a white-on-white PNG that vanishes, and four grey blobs would make the section look cheaper, not richer. It also dies with the header `<dl>` in item 4. Revivable at 64–72px tiles inside the panel, as evidence rather than decoration.
- **A "N already printed on this blank" sibling-prints strip** — `getSiblingPrints` (`actions/customRange.ts:81`) is real but returns nothing until an admin ticks `is_custom_range` and sets `custom_blank_id`, so today the work renders as literally nothing; it adds one query per blank to the homepage's critical path; and it puts a third and fourth call to action into a panel item 4 is already giving a pair. Its better half — "Buy it plain — ₹X" — ships inside item 4.
- **`is_featured` curation and a cap of five on the tab strip** — see item 12. A governance smell rather than a design decision, and invisible at three blanks.
- **"No minimum, no setup fee, no plate charge"** — the two strongest copy lines in the council, and the two the code cannot confirm. They go to the client as Q1, not into the page.

---

## 6. Open questions for the client

1. **The two facts we cannot verify.** Is one garment genuinely a whole order, with no setup fee and no plate charge? These are the strongest lines available to this section and the only ones the codebase cannot confirm. If yes, row 2 of the trio becomes `['A run of exactly one', 'No minimum, no setup fee, no plate charge.']` and it is the best sentence on the page. If unsure, it ships as written in item 5.
2. **`--dawn` at 08:30.** Item 2c puts one rake of the page's single warm accent across the workbench, and item 3 puts it on the dashed print rectangle. That is two uses of the "used where the light arrives and nowhere else" colour inside one section. Indicator, or a second brand colour? The pre-agreed retreat for 2c is `rgba(168,205,152,0.10)` (`--sage-lit`); item 3's rectangle should keep `--dawn` either way, because it is the one surface in the section that is genuinely about arriving light.
3. **The front/back toggle at 40px.** Item 9 gets every control in the section to 44px except this one, which stops at 40 because at 44 the plate becomes 52px tall on a 388px stage and begins to own the garment. Accept 40 on an overlay, or move the toggle off the photograph and into a hairline row beneath it?
4. **Non-4:5 mockups.** Item 3's rectangle assumes the house 4:5 convention that `aspect-[4/5]` and `object-cover` already encode. Is every mockup 1080 × 1350, and will it stay that way? If not, the overlay needs `object-contain` and an intrinsic-ratio read, which is a different and larger item.
5. **The options column ending short.** After items 4 and 11 the column settles ~148px above the stage's bottom edge at `lg` on a blank with a two-line short description. Does that read as a column that has ended, or as a hole? This is the one judgement in the plan that must be made in a browser at 1440.
6. **Scope.** Three items touch files outside this section: item 6 needs the in-stock default at `CustomizerStudio.tsx:71` or the studio re-selects `variants[0]` on arrival; item 8 adds one export to `lib/constants.ts`; item 12 hoists the blanks filter into `app/page.tsx` and guards the trail wrapper. Approved? Separately: `app/customize/page.tsx:39` renders the same h2 without its full stop — a one-character drift fix, in or out?
7. **The tab strip's order.** It is `created_at DESC`, so the lead garment — the one every visitor sees first — is whichever blank was inserted last. Every neighbouring section has an admin field for this (`featured_collection_slugs`, `featured_category_slugs`, `season_kit`, `climb`); this one has none. Does the shop want to choose the lead blank, and if so, a dedicated field or a reuse of `is_featured`?
8. **`04` on the opening rule.** The brief names "a numbered rule across the measure with the heading inline" as one of the three legal opening species, and the `04` rhymes forward into the panel's own `01 / 02 / 03`. But this client rejected a chapter-index rail twice. Confirm that one number on one section reads as a section mark and not as counting restarted.

**What I could not specify exactly:** the rake's 0.14 alpha in item 2c is a ceiling, not a measurement — it needs eyes on a cheap 8-bit panel at 390px before merge; the `-right-[120px] -top-[140px] h-[520px] w-[720px]` glow placement in item 1c is a starting geometry that needs checking at 1440 and 2560, where the section is wider than the ellipse; and the Space Mono tab index at 10px/0.18em in item 10 may need `leading-none` and may still look thin in a full-width phone tab — that is a browser judgement at 390, not a calculation.

---

## 7. How we will know it worked

**Widths, every time.** 320, 360, 390, **767 and 768** (the panel split), 820, **1023 and 1024** (the second split), 1152, 1440, 2560. At every one of them: the page body never scrolls horizontally; the heading is never orphaned onto a lone "yours."; and **at 768 and above, the garment and at least one control group are on screen together** — the pass/fail on item 7, which today fails at every width from 768 to 1023.

**Degraded and empty states, every time.**
- **No customizable blanks at all** — section absent, and the `08:30 · Custom Studio` chapter absent with it (item 12). Check the HUD, not just the band.
- **A blank whose colourways are all `available: false`** — must not reach the page at all after item 12. Before the fix it renders a Customize button into a studio with no print zone.
- **`ShopByCategory` empty** (`pickEssentials` returns nothing) — `CollectionsRow` on `--paper` must land on this section on `--paper-deep`: **two ladder steps, no hairline required**. This is the state where LAW 1 fails outright today.
- **A blank with one colourway and no back** — the front/back toggle is absent, the print rectangle still draws, the readout still reads.
- **A blank where every size is out of stock** — no size pre-selected, no `variant` in the URL, CTA pair visibly disabled, caption reads "Every size is sold out".
- **One blank in the catalogue** — the tab strip does not render (item 12).
- **JavaScript off** — the eyebrow, heading, lede, the first garment's stage image, the price and the trio are all in the server HTML and legible. The panel's controls are inert, which is correct; nothing is invisible or faded out.
- **`prefers-reduced-motion: reduce`** — identical page. Nothing in this section animates on entry, before or after, so this is a confirmation, not a fix.

**Measurements, before and after.**
| | Today | Target |
|---|---|---|
| Focus ring inside the panel | **1.80:1** | **5.43:1** (`--sage` on `--forest-deep`) |
| Step label, 10px | **3.61:1** | **6.81:1** (`paper/65`) |
| CTA caption | **3.06:1** @10px | **6.81:1** @11px |
| Idle tab index | **3.06:1** | **5.98:1** (`paper/60`) |
| Out-of-stock size chip | **1.80:1** | **4.61:1** (`paper/50`) |
| Glow peak vs. the band above it | **1.02:1** against `--paper-warm` | a 16-step blue delta on its own ground |
| Panel vs. `TrekBuddyBand`'s ink | **1.03:1** | **1.24:1** plus a hue change — report both, claim neither alone |
| Stage `sizes` at a 1280 viewport | asks **665px** for a **476px** slot | asks 486px |
| Stage at a 1023 viewport | **879 × 1099px**, controls below the fold | **405 × 506px**, controls beside it |
| Smallest touch target | **22px** (front/back), 32px (swatch), 34px (chip) | 40px, **44px**, **44px** |
| Transition durations | 150ms **and** 300ms | 200ms, `--ease-out`, everywhere |
| Archivo sizes in the section | **8** at 5 uppercase trackings | **4** at 2 |
| `font-mono` uses | **1**, on a string of words | every figure; no sentence |

**The print rectangle, specifically.** On each of the three flagged blanks, in each available colourway, on both sides: the dashed box sits **on the garment**, not off its edge; flipping front→back moves it; the inches in the readout match `CustomizerStudio.tsx:354` for the same blank, colour and side, character for character. Switch colours ten times in a row and watch the stage — **no black flash** (item 8), no layout shift, no rectangle left behind from the previous side.

**Interaction passes.** Tab from the section's first control to its last with a **visible ring at every stop** — tabs, every enabled swatch, every enabled chip, both toggle buttons, both CTAs, and "Buy it plain". Then with a screen reader: confirm the selected size is announced as pressed (it is not today), and that a disabled swatch reads "…, coming soon". Then pick a sold-out size — you should not be able to, and it should never be the one already chosen. Then follow "Start from a design" and confirm the studio opens **with the library panel open, on that garment, in that colour, in that size** — one page load, not two.

**Housekeeping.** Two notes from experience so nobody loses an afternoon: **a mobile check needs a full relaunch** — a stale bundle looks identical to "my change didn't work" — and **the browser pane must be visible** or screenshots come back blank and `innerWidth` reads 0, which makes a correct responsive layout look broken.
