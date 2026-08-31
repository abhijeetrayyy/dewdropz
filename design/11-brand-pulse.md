# Brand pulse — Action Plan

*Section 11 of the homepage. Written against `components/sections/BrandPulse.tsx` (142 lines), `components/sections/StatsBand.tsx`, `app/page.tsx`, `app/globals.css`, `lib/constants.ts`, `lib/trail.ts`, `app/admin/homepage/HomepageEngine.tsx`, `app/about/page.tsx` on branch `mobile-remediation`. Every line number and every contrast figure below was recomputed against the working tree. Where I could not specify a value exactly, it is in §6, not hidden behind an adjective.*

---

## 1. The verdict

This is the page's one brand statement, and almost nothing in it is actually on the screen. **The words are not in the HTML.** `motion.h2` and `motion.p` serialise `initial={{opacity:0}}` into the server markup, so with JavaScript off, stalled, or throttled in a background tab, section 11 is a photograph, an orphaned `19:30 · BASECAMP`, and a 12px "Read Our Story" link — the statement itself is gone. That is hard constraints 1 and 2 broken verbatim, in the one band whose entire job is words. **The picture is not on the screen either.** I decoded the source and measured its own luminance in fifths: `.186 / .371 / .044 / .039 / .012` — it is bright only in its top two fifths. The scrim runs the other way (`from-ink/50 via-ink/70 to-ink`, effective alpha `.54 → .94`), so it applies its lightest hand where the photograph is brightest and spends the rest of its opacity killing pixels that were already black; `opacity-45` then mixes what survives with `bg-forest-deep`, turning a hot orange dusk horizon (`#cbac97`) into a khaki (`#2f3025`). The band pays for a full-bleed photograph and renders a flat near-black rectangle, 771px tall on a phone. **And the numbers are not on the screen at all** — `stats` defaults to `[]` in both settings paths and the admin card actively talks the owner out of filling it, so the `'use client'` boundary, GSAP, ScrollTrigger and a ref array ship on every homepage load to render nothing; on the rare occasion they do render, the server HTML says `0+`.

The fix is not a redesign. It is to **let this band be the thing it already is: one photograph that arrives, one statement that is simply there, and one sentence that finally names what DEWDROPZ sells.** Turn the scrim right way up so the last light of the day is actually in the frame, take the words out of the animation's custody, cut a 65-word centred paragraph to 36 and spend the words it frees on a noun, and give the band a second way out that leads into the shop instead of only out of it. Everything below is that idea, itemised.

---

## 2. What stays — do not touch

| | Why it is right |
|---|---|
| **The photograph.** `STATS_BG_IMAGE`, `lib/constants.ts:36` — `photo-1761566333643-bf7d2c94f0ed`. | I opened it. It is a dusk volcanic caldera: a hot orange horizon on the left, a cloud sea across the middle, and a valley of town lights already lit along the bottom edge. It reads as **19:30**, which is exactly the hour the eyebrow claims. The recon note that this band is "lit by a sunrise" is wrong, and the obvious swap is a trap — see §5. Every item below improves this frame; none replaces it. |
| **The section is unconditional.** Headline, paragraph and CTA always render; only `stats.length > 0` gates (`:105`). | The page has several sections that vanish with their data. This one is the brand statement and must never be one of them. Item 5 and item 8 keep it that way at every arity, including zero. |
| **The one paragraph, and its cadence.** "We started with a feeling… the quiet after heartbreak… the solitude of an empty trail… a sky larger than yourself." | Client copy from the 23 August mark-up. Item 3 is a **trim of their own sentence** — 33 of the words that ship are theirs, in their order — not a rewrite. Present it as a diff. |
| **`font-display` on the paragraph**, not `font-body` (`:95`). | The comment at `:84–89` records why: at this length, centred and alone under a serif headline, Archivo read as a caption. That judgement is correct and item 3 keeps it. |
| **The stop comes from `lib/trail.ts`.** `stopEyebrow(TRAIL_STOPS.basecamp)`, one format everywhere. | Single source of truth for the day arc. Items 9A and 9B change *where* and *how much* of the stop prints; neither invents a second format nor hardcodes a time. |
| **The `.on-dark` class on the section** (`:60`). | It buys the correct focus ring on a dark ground (`globals.css:625–628`). Item 10 adds a second focusable element into this section and depends on it. |
| **The founder pull-quote stays struck.** Comment at `:126–131`. | The mark-up removed it and it still lives on `/about`, where a named quote belongs. Nothing below restores it. |

---

## 3. The action plan

Table and specs share the same numbering. Items **1, 2 and 3 alone change what a visitor sees**, on a phone and on a laptop.

| # | Action | What | Why | Effort | Priority |
|---|---|---|---|---|---|
| 1 | update | Turn the scrim right way up, and land it on `--forest-deep` | The scrim is inverted against the photograph's own luminance; the band renders a khaki slab over a picture with an orange horizon and town lights in it | 2h + measurement | **P1** |
| 2 | update | `--sage-lit` carries the display type; every hairline becomes visible | The sage half of the headline measures 3.56:1 at the hot pixel; the CTA's underline measures 2.03:1; the stat labels 4.10:1 | 30m | **P1** |
| 3 | update | The statement, halved — and the first noun on the page that says what is sold | 65 words centred at ~90ch, and no section above this one names a garment or a flask | 45m + client sign-off | **P1** |
| 4 | remove | Both entry animations; the words ship in the server HTML | `motion` serialises `opacity:0` into SSR — the brand statement is invisible with JS off, stalled, or backgrounded | 30m | **P1** |
| 5 | update | The true figures ship in the HTML, in Space Mono, reduced-motion guarded | The page currently publishes `0+` as a public claim, and the counter runs under `prefers-reduced-motion: reduce` | 1.5h | **P1** |
| 6 | update | The phone gets the light; the alt tells the truth | At 390px `object-cover` shows the volcano's dark flank; the alt describes a Himalayan sunrise that is not in the picture | 30m | **P1** |
| 7 | update | Ask Unsplash for the right file; give it its own placeholder | 1,429,961 bytes vs 179,295 for the same frame; the pre-paint state is a flat off-palette green slab | 30m | **P1** |
| 8 | update | One shell, one silhouette, and a numbers row that survives any count | Three measures stacked (768 / 1024 / 672), and `md:grid-cols-4` holes at 3 stats and orphans at 5 | 2h | P2 |
| 9 | update | Open on the altitude, not a fourth identical eyebrow | Four consecutive sections open with the same species; `stop.alt` reaches no phone on the site today | 1h + stills | P2† |
| 10 | update | Close on a way to buy, not only a way to read | Section 11 of 12 spends its one exit sending people out of the funnel, four taps from a product | 45m | P2 |
| 11 | remove | Both hairlines at the dark seam | `border-paper/10` measures 1.27:1 on ink and 1.33:1 on forest-deep — rules pretending to do a job | 15m | P2 |
| 12 | update | One number band, one component, and a cap in the admin | `StatsBand` is character-identical and live on `/about`; the admin has no cap, no label limit, and a blank-able React key | 3h | P3 |
| 13 | remove | Dead code: `BrandStatement.tsx`, `STATS`, the never-truncated ref array | An orphan component, and the four invented figures this file's own comment says were deleted on principle | 30m | P3 |
| 14 | update | Reconcile the destination — `/about` currently refutes this paragraph | One click, two mutually exclusive origin stories | 1h | P3† |

† **pending client confirmation** — see §6, Q1 (item 9) and Q5 (item 14).

---

### The specs

**1 — Turn the scrim right way up.**
Two edits in the component, one utility in the stylesheet.

`BrandPulse.tsx:68` — `className="object-cover opacity-45"` → `className="object-cover"`. The 45% is what mixes the one warm event in the frame with a green: the photograph's own colour in the copy zone is `#cbac97` (relL .448, p95 pixel `#ebccad`), and after the green mix plus the ink scrim the ground reads `#2f3025`, a khaki. If the picture needs darkening, darken it with `--ink`, which is neutral. Keep `bg-forest-deep` on `:60` — it is the ground *behind* the image and it is what paints before the lazy image lands.

`BrandPulse.tsx:70` — `className="absolute inset-0 bg-gradient-to-b from-ink/50 via-ink/70 to-ink pointer-events-none"` → `className="absolute inset-0 night-scrim pointer-events-none"`.

In `app/globals.css`, inside `@layer base`, beside the light rules (the `hero-in` block at `:393–416`):

```css
/* The scrim over the 19:30 photograph. Written as literal rgb, not var(),
   and NOT as a Tailwind arbitrary value: this repo's memory records that a
   bare CSS variable inside a Tailwind arbitrary value (`bg-[--ink]/88`)
   compiles to nothing in v4. Same precedent as the hero poster, 01-hero §3a.
     rgb(12 16 13)  = --ink         #0C100D
     rgb(22 41 15)  = --forest-deep #16290F
   The stops follow the photograph's own luminance, measured in fifths
   top-to-bottom: .186 / .371 / .044 / .039 / .012. It is bright only in its
   top two fifths, so the scrim is HEAVIEST at 0% and clears at 30% where the
   horizon glow lives. It ends on forest-deep so the band's last pixel row is
   the ground NewsletterBar opens with. */
.night-scrim {
  background: linear-gradient(to bottom,
    rgb(12 16 13 / 0.88) 0%,
    rgb(12 16 13 / 0.74) 30%,
    rgb(12 16 13 / 0.84) 58%,
    rgb(22 41 15 / 0.92) 100%);
}
/* Identical, except the foot. StatsBand on /about hands off to FounderNote,
   which is bg-paper — there is nothing to dissolve into, so it ends on ink. */
.night-scrim-ink {
  background: linear-gradient(to bottom,
    rgb(12 16 13 / 0.88) 0%,
    rgb(12 16 13 / 0.74) 30%,
    rgb(12 16 13 / 0.84) 58%,
    rgb(12 16 13 / 0.92) 100%);
}
```

Apply `.night-scrim-ink` and the `opacity-45` removal to `StatsBand.tsx:57` and `:56` as well, until item 12 makes that one file.

Measured resulting grounds down the centre column at 1440: eyebrow **#242523**, headline **#38342d** rising to **#464137** over the glow, paragraph **#2f2a21**, stats **#151b18**, CTA **#142112**, foot **#162710**. Surviving photo signal by band: **12% / 26% / 16% / 8%** — the glow is 1.6x today's, and it is mixed with neutral ink rather than with green. The last row measures **1.02:1** against NewsletterBar's `--forest-deep`: the photograph runs to the seam and dissolves into it, which is Law 1's full-bleed exemption used properly instead of claimed.

**This item and item 2 ship together.** Opening the scrim costs text contrast: `--sage` at the hot pixel drops to **3.56:1**, which is why item 2 is not optional. The stop percentages are tuned to *this* photograph; swapping the image later means re-measuring. Verify on a real render, not a headless screenshot, at 1440 and at 390.

**2 — `--sage-lit` carries the display type; every hairline becomes visible.**
All figures below are computed against item 1's measured grounds.

- `BrandPulse.tsx:82` — `italic text-sage` → `italic text-sage-lit`. On the headline's mean ground `#38342d`: **4.35 → 6.98:1**. At the p95 hot pixel `#464137`: **3.56 → 5.72:1**. `globals.css:41–48` defines `--sage-lit` for exactly this — "large type on dark grounds only" — and records the precedent: `--sage` at display size measured 4.75:1 against a 12.8:1 cream half, so the line was "one word carrying two different weights". `:82` repeats that defect verbatim.
- `BrandPulse.tsx:118` — `text-paper/50` → `text-paper/70`. On the stats ground `#151b18`: **4.87 → 8.38:1**. Today's 4.10:1 mid-band is a fail, and because the image is `fill`/`object-cover` with no fixed aspect, *which* part of the cloud sits behind a given label is decided by the browser window — contrast that is a function of crop is not contrast you have.
- `BrandPulse.tsx:135` — `text-sage border-b border-sage/40` → `text-sage-lit border-b border-sage-lit/50`. The face goes **5.88 → 9.44:1** on `#142112`; the underline goes **2.03 → 3.38:1**, clearing the 3:1 non-text threshold. Keep `hover:text-paper transition-colors duration-300` exactly as it is.
- `BrandPulse.tsx:73` — **leave the eyebrow on `--sage`.** It measures **5.41:1** on the new `#242523` ground, and `--sage` is correctly the UI green doing UI work at 10px. This is the one place the two lenses disagreed; the 3.08:1 figure was measured against the *old* `ink/50` top stop, which item 1 replaces with 0.88.
- **Out of remit, flag it:** `NewsletterBar.tsx:73` makes the identical `italic text-sage` choice on flat `--forest-deep` (5.44:1). It should take `--sage-lit` in the same pass or the two dark bands read as two different systems. Do not land it silently — see §6, Q6.

**3 — The statement, halved — and the first noun on the page that says what is sold.**
Three parts. **3a ships now; 3b needs client sign-off; 3c is the client's call.**

*3a — the headline is two beats at every width.* `BrandPulse.tsx:81–82`, replace the `<br className="hidden sm:block" />` construction with two block spans:

```jsx
<span className="block">For those still searching.</span>
<span className="block italic text-sage-lit">More than a destination.</span>
```

Today the `<br>` is `hidden` below 640px, so on every phone the two beats run together as one wrapped sentence and on desktop they are two lines. That is not a responsive decision, it is an unintended silhouette. Two `block` spans make it two beats everywhere. Copy is untouched; `text-sage-lit` is item 2.

*3b — the paragraph, trimmed, with a noun in it.* `BrandPulse.tsx:97–101`, replace the body with, verbatim:

> We started with a feeling, not a product — the quiet after heartbreak, the solitude of an empty trail, a sky larger than yourself. The shirts and the flasks came after, printed to order in Dehradun.

**36 words / 198 characters**, against today's **65 words / 386 characters**. Classes at `:95` become `mx-auto mt-8 max-w-[540px] font-display text-[18px] leading-[1.7] text-paper/80 md:text-[20px] text-pretty` — 54ch at 20px, **3.7 lines** at desktop and **5.2 lines** at 390px, against today's ~90ch at 15px in a 672px well. `text-paper/80` measures **11.33:1** on the CTA ground and **9.16:1** mid-band.

Two things about this copy, and both matter for the pitch. First, **it is a diff, not a rewrite** — every word up to "yourself" is the client's own in their own order; the cuts are "the hope that follows a difficult season", "the wonder of standing beneath", "Somewhere between mountains, campfires, long walks, and unfamiliar paths, we rediscover who we are", and the closing "DEWDROPZ is an invitation to spend more time in those places", which is a sentence about a sentence. Second, **the noun is "the shirts and the flasks" and it is deliberately not "apparel and drinkware."** The council record's Rejected table has the client putting the hero's line back after it was changed to "Apparel and drinkware, made in Dehradun" — that exact phrase is struck. But the same entry reads: *"If the frame is to name the goods, it must be somewhere other than this sentence."* This is that somewhere, in the brand's own paragraph, in plainer words than the ones they rejected. Fallback if "flasks" reads wrong for the catalogue: **"the shirts and the bottles."** The noun has to stay either way.

"Printed to order in Dehradun" is a factual claim about fulfilment. The project brief states the business prints to order, so it is supportable — confirm it against real fulfilment before it goes public anyway (Q3).

*3c — the headline's second line.* Optional, and it is a copy change to client-approved words, so it goes to the client rather than into the build: "More than a destination." → **"This is what we send with you."** It hands the headline the same job the paragraph now does — turning an abstract second beat into the thing in the box. If the client says no, 3a and 3b stand alone and lose nothing structural. See Q2.

**4 — Both entry animations go; the words ship in the server HTML.**
`BrandPulse.tsx:74–83` and `:90–102` — convert `<motion.h2>` and `<motion.p>` to plain `<h2>` and `<p>` carrying the identical class strings, delete `initial` / `whileInView` / `viewport` / `transition`, and drop the `motion/react` import at `:7`. I verified the failure by rendering the exact props through `framer-motion@12.42.2` + `renderToStaticMarkup`: the server HTML is `<h2 class="…" style="opacity:0;transform:translateY(15px)">For those still searching.</h2>`. With JS off, a dropped chunk, or a throttled background tab, the brand statement does not exist.

**No CSS gesture replaces it, and that is deliberate.** The obvious substitute — a transform-only keyframe following `[data-hero-reveal]` at `globals.css:410–416` — would fire on *page load*, and this section is roughly 8,000px below the fold, so the animation completes long before anyone scrolls to it. It would ship motion that plays to nobody, which is the same defect 01-hero §3d was written about. The page's one choreographed moment belongs to the hero (Law 6), and this band's only surviving gesture is the counter in item 5. If the client wants an arrival here, the mechanism is specified in Q4, not built on spec.

`stats` no longer being the only reason for `'use client'`, note the boundary still cannot come off while item 5's counter exists — see item 13.

**5 — The true figures ship in the HTML, in Space Mono, reduced-motion guarded.**
`BrandPulse.tsx:115` — `0{stat.suffix}` → `{stat.plain ? String(stat.value) : stat.value.toLocaleString('en-IN')}{stat.suffix}`. Today the true value exists only inside the GSAP `onUpdate` at `:44–47`, so a visitor whose script never runs reads the shop's public figures as `0+` — a false claim, shipped in the markup, in the one component whose own comment (`:17–20`) says "a storefront should not publish invented numbers."

`BrandPulse.tsx:31`, first line of the effect: `if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return`. There is no `MotionConfig` anywhere in the repo (`grep MotionConfig|reducedMotion` over `*.tsx` returns nothing) and none of the five reduced-motion blocks in `globals.css` reaches GSAP. With item 5's SSR fix in place, an early return leaves the correct number on screen — which is why the two halves of this item are one item.

`BrandPulse.tsx:51–56`, cleanup: after killing the tweens, write the true string back to `el.textContent`, so a tween killed mid-count cannot leave a partial figure frozen on screen.

`BrandPulse.tsx:109` — `font-display font-light text-[clamp(32px,5vw,56px)] text-paper tabular-nums` → `font-mono text-[clamp(30px,3.6vw,44px)] text-paper tracking-[-0.02em]`. Three reasons, all rule-shaped: Law 3 gives figures to Space Mono, and today Space Mono carries a *place name* while the only unambiguous numbers on the page are set in a serif; `tabular-nums` on a monospace face is a no-op and `font-light` is a weight Space Mono does not have; and the figure currently clamps to **56px against a 52px headline**, so the largest type in the brand-statement band is an owner-entered number. 44px puts it back under the sentence it supports.

`BrandPulse.tsx:118` — add `max-w-[18ch] mx-auto text-pretty` alongside item 2's `text-paper/70`. At `md` exactly, four columns first appear and each is `(688−72)/4 = 154px`; a 33-character label at 12px sets to four lines there.

`BrandPulse.tsx:108` — `key={stat.label}` → ``key={`${i}-${stat.label}`}``. The admin permits a blank label (`HomepageEngine.tsx:748–752` has a placeholder and no `required`), so two blanks collide today.

**Hydration check, do not skip:** `toLocaleString('en-IN')` now runs on the server as well as the client. Node built with `small-icu` renders `100,000` where a browser renders `1,00,000`, which React will flag as a hydration mismatch. Verify with a five-figure value in a production build before merge.

**6 — The phone gets the light; the alt tells the truth.**
`BrandPulse.tsx:68` — add `object-[38%_center] md:object-center`. At 390×~1100 `object-cover` shows the centre **23.6%** of a ~3:2 frame; I measured that column's horizon band at relL **.323** today and **.489** at 38% — a 51% lift, because the orange horizon sits on the left of this frame. Be accurate about what the shift costs: the visible window moves to roughly 26–50% and the peak apex sits near 58%, so **the volcano's peak leaves the phone crop**. What you get instead is horizon, cloud sea and town lights, which is the better phone image — but do not claim the peak survives.

`BrandPulse.tsx:63` — replace the alt with:

> Dusk over a volcanic caldera — cloud filling the valley, the last orange of the day along the horizon, and a town&apos;s lights coming on below.

The current string ("Sunrise over a Himalayan summit, seen from above the clouds") is wrong on three counts: it is a caldera, not a summit; dusk, not sunrise; and Bali, not the Himalaya. Apply both changes to the identical lines in `StatsBand.tsx:50–51` until item 12 merges them.

**7 — Ask Unsplash for the right file; give it its own placeholder.**
`lib/constants.ts:36` — append the params the comment block three lines below already mandates:

```ts
export const STATS_BG_IMAGE =
  'https://images.unsplash.com/photo-1761566333643-bf7d2c94f0ed?w=2400&q=80&auto=format&fit=crop'
```

I measured both responses: bare URL `content-length: 1,429,961`; with params `179,295`. **8.0x**, fetched and decoded server-side at up to `w=3840`, for a picture that ends up at most ~26% visible. Every `DAY_ARC` entry at `lib/constants.ts:59–74` already carries these params and `:41–44` states why they are mandatory; `STATS_BG_IMAGE` is declared immediately above that block and is simply the one that was missed. It is the only full-bleed homepage image without them.

Beside it, a placeholder built from this photograph's own measured band means instead of the shared green:

```ts
// BLUR_DATA_URL is a flat #1a2e17 — a green that is not a palette token
// (grep app/globals.css: no such hex) — so this 1000px-tall dusk photograph
// currently flashes a green slab before it resolves. These four stops are the
// decoded source's own band means, top to bottom.
export const BASECAMP_BLUR =
  'data:image/svg+xml;base64,' /* 8x12: #6a687f → #cbac97 @30% → #2f3442 @55% → #17161e */
```

Point `BrandPulse.tsx:67` and the identical `StatsBand.tsx:55` at `BASECAMP_BLUR`. Leave the image lazy and without `priority` — it is the eleventh section and correctly not the LCP. Confirm `next/image` accepts the non-square 8×12 SVG placeholder before landing; it is scaled and blurred, so the aspect only affects the gradient's read.

**8 — One shell, one silhouette, and a numbers row that survives any count.**
*8a — the shell.* The section stacks three centred wells — 768 (`max-w-3xl`, `:72`), 1024 (`max-w-5xl`, `:106`), 672 (`max-w-2xl`, `:132`) — so the silhouette goes narrow → wide → narrow and the band bulges at the numbers and pinches at the exit. It is also narrower than both neighbours: `TheClimb.tsx:155` and `NewsletterBar.tsx:65` are both `max-w-6xl`. Wrap the whole body in one `relative max-w-6xl mx-auto` shell (**1152px**, the page's established measure — Law 4), delete all three `mx-auto` wells, and constrain by content instead: headline `max-w-[16ch] mx-auto`, paragraph `max-w-[540px] mx-auto` (item 3b), numbers row and closing row run the full 1152. Below 1024 the shell is viewport-bound and the `ch` caps do the work unchanged.

*8b — the padding.* `:60` — `py-28 md:py-36` → `py-24 md:py-32`, matching `TheClimb` and `Community`. Today this is the tallest section on the page (measured **~771px at 390px with `stats` empty**: 224px of padding plus ~547px of stacked centred copy) with the lowest content density on it. Item 3b removes 29 words; this removes a further 32px at each breakpoint.

*8c — the numbers row.* Replace the grid at `:106` with `relative mt-20 flex flex-wrap justify-center gap-x-14 gap-y-10 md:gap-x-20`. `grid-cols-2 md:grid-cols-4` leaves an empty fourth column at 3 stats (a row reading off-centre under a centred headline) and a ragged orphan at 5; `flex-wrap justify-center` centres any count. Each cell becomes `basis-[132px] md:basis-[190px] grow-0 text-center border-t border-paper/35 pt-5`, with `items-start` on the row so the hairlines stay flush when labels wrap to different depths. **`border-paper/35`, not `/12`** — I measured `paper/12` on the `#151b18` stats ground at **1.40:1** and `paper/25` at **2.19:1**; `paper/35` is **3.05:1**, the first value that is actually a rule. Law 2 wants a row held by a hairline, and an invisible hairline is decoration, not enclosure. If a five-figure grouped value like `1,00,000` wraps in Space Mono at 44px, widen the basis to `210px` rather than shrinking the type.

Also apply `border-paper/35` to the CTA foot rule at `:132` for the same reason — unless item 11 deletes it, which it does not (item 11 removes the two *section-edge* borders, not this one).

**9 — Open on the altitude, not a fourth identical eyebrow.** Two versions. **Show the client both; do not build either until Q1 is answered.**

`TheClimb.tsx:157`, `Community.tsx:63`, `BrandPulse.tsx:73` and `NewsletterBar.tsx:67` all open mono-eyebrow-over-display-heading, and `NewsletterBar:70–74` repeats this file's exact device — a display heading whose second line is `<span className="italic text-sage">`. Four consecutive sections, one species, is precisely the machine-made reading Law 5 exists to prevent. Law 5's other two species are both unused on this page.

*9A — the instrument rule (safer; gives the phone the altitude).* Replace `:73` with a full-measure rule row inside item 8's shell:

```jsx
<div className="flex items-center gap-5">
  <span className="font-mono text-[10px] tracking-[0.24em] text-sage uppercase shrink-0">{stopEyebrow(stop)}</span>
  <span className="h-px min-w-6 flex-1 bg-paper/35" aria-hidden="true" />
  <span className="font-mono text-[10px] tracking-[0.24em] text-paper/70 shrink-0">{stop.alt}</span>
</div>
```

then `mt-10` on the headline. `stop.alt` is `2,900M`, it is already passed in at `app/page.tsx:149`, and today it is consumed only by `TrailSpine`, which is `hidden xl:flex` (`TrailSpine.tsx:71`) — so on every phone the altitude exists in the data and nowhere on screen. An edge-to-edge instrument line over a centred statement is the composition, and it is the only opener of its kind on the page. Both mono strings carry a figure, so Law 3 holds. `bg-paper/35` for the rule, not `/15`, for the reason in item 8c. At 390px the rule compresses to ~90px between the two strings; `min-w-6` is the floor. Check the two mono strings do not baseline-shift against each other — `items-center` on differing cap heights can sit a pixel off.

*9B — the statement alone, and the stop at the foot (the ambitious one).* Delete the eyebrow at `:73`. Headline becomes `font-display font-light text-[clamp(40px,7vw,84px)] text-paper leading-[0.95] text-balance` in a `max-w-[900px] mx-auto` well, no `mt-4`. The foot at `:132` becomes a two-item row — `mt-16 border-t border-paper/35 pt-8 flex flex-col sm:flex-row items-center justify-between gap-5` — carrying, on the left, ``<p className="font-mono text-[10px] tracking-[0.24em] text-paper/70 uppercase">{`${stop.time} · ${stop.alt} · ${stop.label}`}</p>`` (renders `19:30 · 2,900M · BASECAMP`, **7.74:1** on the foot ground) and, on the right, item 10's links. This is Law 5's second species — a display statement alone at ~2x scale — which has not been used on this page, and 19:30 genuinely is the day's last reading, so printing the stop beside the way out is a justification rather than an exception.

**The client risk is the same for both, and it is not technical.** `HOMEPAGE-COUNCIL.md:137` records `TrailSpine` rejected twice — "Trail spine is shitty… remove it or use earlier one" — and a horizontal line printing a time and an altitude is close enough to that object to need showing, not describing. Present it as a **section rule**; never use the word spine. 9B additionally needs checking as a pair with `NewsletterBar`'s 48px heading 200px below it, not alone.

**10 — Close on a way to buy, not only a way to read.**
Today this band's single focusable element is `href="/about"`, and `/about` carries no product link at all — its only in-funnel `href` is one `/collections` text link two thirds down (`AboutStory.tsx:94`). Minimum path from the page's most emotionally credited moment to a product page: Read Our Story → scroll About → /collections → a collection → a product. Four taps and two full scrolls, in section 11 of 12.

Replace `:132–139`. The well becomes `relative mt-16 border-t border-paper/35 pt-10 flex flex-col sm:flex-row items-center justify-center gap-5 sm:gap-8` (dropping `max-w-2xl mx-auto` per item 8a). Primary:

```jsx
<Link href="/shop" className="inline-flex items-center gap-2 bg-sage text-ink font-body text-xs tracking-[0.12em] uppercase font-medium px-8 py-3.5 rounded-[var(--r-input)] hover:bg-paper hover:text-forest transition-colors duration-300">
  Shop the collection <span aria-hidden="true">→</span>
</Link>
```

Secondary keeps the existing element, re-worded to `Read our story` with the same `<span aria-hidden="true">→</span>` treatment. `/shop` exists (`app/shop/page.tsx`). `--ink` on `--sage` measures **6.74:1**. The button species and radius are the ones `NewsletterBar` already uses (`px-8 py-3.5`, `rounded-[var(--r-input)]`); **only the fill differs — sage here, paper there** — which is what stops two filled buttons 200px apart reading as a stutter. The `→` moves into an `aria-hidden` span so a screen reader stops announcing "right arrow" inside the accessible name; that is true of today's link too. The focus ring is already correct because the section carries `.on-dark` (`globals.css:625–628`).

If the client feels the pair is still doubled, this one drops to `border border-paper/30 text-paper` and `NewsletterBar` keeps the only filled button on the dark run — but the `/shop` route stays either way.

**11 — Delete both hairlines at the dark seam.**
Remove `border-t border-paper/10` from `BrandPulse.tsx:60` and from `NewsletterBar.tsx:51`. Measured: `paper/10` over ink is **1.27:1** and over forest-deep is **1.33:1** — invisible in both directions. BrandPulse's top edge needs no rule either; it meets `bg-paper` at a **13:1** value step. With item 1 in place the band's foot lands at `#162710` against NewsletterBar's `#16290F` (**1.02:1**), so the two dark bands become one deliberate night block and the photograph *is* the transition — Law 1's full-bleed exemption.

**This item ships with item 1 or not at all.** Without item 1, deleting these leaves 100%-opaque ink butting straight onto forest-deep with nothing between, which is worse than today. `NewsletterBar.tsx:51` is another section's file — flag it, do not land it silently (Q6).

**12 — One number band, one component, and a cap in the admin.**
`StatsBand.tsx:16–42` is character-identical to `BrandPulse.tsx:31–57` and `StatsBand.tsx:74–91` is character-identical to `BrandPulse.tsx:106–123`; both read the same `home_config.stats`, both sit over the same `STATS_BG_IMAGE` with the same alt string, and `StatsBand` is live at `app/about/page.tsx:33`. Editing the homepage's number band today means editing two files, or the two silently diverge — and items 5, 6 and 7 all touch both.

Extract the markup and the effect into `components/NumberBand.tsx` taking `{ stats }` and import it in both. Render it as an ordered list, not a definition list: a `<dl>` requires `<dt>` before `<dd>` in DOM order, and putting the figure first would break the semantics it invokes. Use `<ul>` with each `<li>` carrying `aria-label={`${figure} ${label}`}` — today a screen reader hears "0 plus" and "Trekkers geared up" as two unrelated `<div>`s.

Render `stats.slice(0, 4)`, and land the admin cap **in the same change** or an owner will wonder where their fifth number went: `HomepageEngine.tsx:768` — `disabled={config.stats.length >= 4}` on the Add button, with the label "Four is the maximum; the band is a row of four"; `:748–752` — `maxLength={26}` on the Label input with helper text "Short — it sits under a large figure, two lines at most"; `:758–761` — the bare "Plain" checkbox gets a description, because an owner typing a year currently gets `2,019` counting up from zero like a slot machine; `:729–731` — the CardDescription is factually wrong once this lands only if the band is removed from the homepage, which it is not, so leave the wording and add "Four at most."

`numberRefs.current` (`:29`, `:111–113`) is never truncated, so removing a stat in admin leaves a stale ref past the end of the array. Harmless today because the effect indexes by `i` over `stats`; truncate it in the extraction anyway.

**13 — Dead code.**
Delete `components/sections/BrandStatement.tsx` — zero importers repo-wide; its only mention is inside BrandPulse's own comment at `:12`. Delete `lib/constants.ts:69–74`, `export const STATS` — the four invented figures (`12000+ Trekkers geared up`, `40+ Trails mapped across the Himalaya`, `5200m Highest altitude tested`, `2019 Est. in Dehradun`) that `BrandPulse.tsx:18–20` says were removed because "a storefront should not publish invented numbers", still sitting in the constants file waiting to be re-imported by someone. Zero importers; confirm no dynamic import before landing. Fix the comment at `:12–16`, which names four components (`TrekManifesto`, `WhoGoes`, `MarqueeBand`, `BrandStory`) that no longer exist and one (`StatsBand`) that is live on `/about`.

`'use client'` stays. Item 5 keeps the counter and its reduced-motion guard needs `window.matchMedia`, so the boundary is load-bearing even after item 4 removes `motion/react`. Note honestly what item 4 does buy: one fewer client library on a section that renders below the fold.

**14 — Reconcile the destination.**
The paragraph says DEWDROPZ began with a feeling and not a product. `/about` opens with "Three trekking guides, one bad monsoon, and a decision to build it ourselves" (`AboutStory.tsx:58`), "gear that fell apart the moment the weather turned" (`:70`), and "we still test every prototype above 4,000 metres" (`:84`) — the supplier origin story that `BrandPulse.tsx:84–89` records as struck from *this* file for being untrue of a print-to-order shop. `app/about/page.tsx:17` and `:30` carry it into the metadata and the page header. One click, two mutually exclusive origins, and item 10 makes that click more likely rather than less.

This is a section-14 problem, not a section-11 one, and it is filed here because this band is the only thing on the homepage that links to it. Two options for the client (Q5): reconcile `/about`'s copy to the 23 August paragraph, or retarget this link. Do not quietly change the link to avoid the conversation.

---

## 4. Removals, argued

**Both entry animations (item 4).** `motion@12` serialises `initial` into the SSR `style` attribute. That is not a theoretical risk: the shipped HTML for this section's headline is `style="opacity:0;transform:translateY(15px)"`, and the paragraph is the same with a 0.15s delay. Every path that delays or drops hydration — JS off, a dropped chunk, a throttled background tab — takes away the page's only brand statement and leaves a photograph with a link on it. There is no version of this section where an entrance is worth that, and there is no version of the two hard constraints that permits it.

**`opacity-45` on the image (item 1).** Its job was to darken the photograph. It does not darken it; it *dilutes* it, with `bg-forest-deep`, a green the section then never actually shows. Measured, the horizon's own `#cbac97` becomes a `#2f3025` khaki. Darkening belongs to the scrim, where it is neutral and where its distribution can follow the picture.

**`border-t border-paper/10` at both seams (item 11).** 1.27:1 on ink, 1.33:1 on forest-deep. Two pieces of markup declaring a boundary that no visitor has ever seen, at a seam where — after item 1 — the photograph does the work properly. BrandPulse's own top border is equally pointless in the other direction: it sits on a boundary that already steps 13:1 from `bg-paper`.

**`grid-cols-2 md:grid-cols-4` (item 8c).** A fixed four-column grid fed by an uncapped admin array. Three stats leave a hole in column four and the row reads off-centre under a centred headline; five leave a ragged orphan; fifty build a thirteen-row wall. The gap also *shrinks* as the container widens (`gap-10` → `md:gap-6`), so the tightest column in the system appears at exactly the width where four columns first exist: 154px each, in which a 33-character label sets to four lines.

**`BrandStatement.tsx` and `lib/constants.ts:69–74` (item 13).** An orphan component with zero importers, and four invented public claims that this very file's comment says were deleted on principle, still exported and one import away from returning. The comment and the code disagree; the code loses.

**The `<br className="hidden sm:block" />` (item 3a).** The only breakpoint-conditional thing in the headline, and what it conditions is whether the client's two sentences are two sentences. Two `block` spans say the same thing at every width and cannot drift.

---

## 5. Killed in judging — on the record

- **Swap the photograph for `DAY_ARC.basecamp`** (proposed twice, once as "light the 19:30 band with 19:30"). **Fatal, verified by downloading it.** `lib/constants.ts:59` documents it as "19:30 — camp, headtorches, the day retold"; the actual file, `photo-1504280390367-361c6d9f38f4`, is a brightly sunlit orange tent interior shot from inside a sleeping bag, looking out at a green conifer forest in full daylight. No dusk, no headtorches, nobody in it. Swapping would put the page's brightest photograph in its darkest band, and drop a mass of saturated safety-orange nylon into a palette that reserves its one warm note for where the light arrives. **The JSDoc describing an image that is not there is the most useful thing found in this round — it is recorded here so the next session does not fall into it.** The narrative instinct is right and the current photograph already satisfies it.
- **A second, invisible hairline as "enclosure" for the stats** (`border-paper/12`) — the Law 2 argument was correct and the value was not; `paper/12` measures 1.40:1 on this ground. Item 8c keeps the argument and takes the hairline to `paper/35` (3.05:1). A rule nobody can see is decoration wearing a law's clothes.
- **Replace the number band with facts the page already knows** (collection count, product count, "2 days to dispatch, from Dehradun") — a real idea with a real degradation floor, killed for three reasons: it removes a feature the owner controls from the admin and calls it a cleanup; it ships a new public fulfilment promise pulled from a constant, duplicating a claim `TrustBand` already makes in section 7; and with three products in the catalogue the floor logic renders a hairline-boxed row containing one number. The safe half of it is item 5 — keep the band, put the true value in the HTML.
- **A cream `bg-paper` filled `/shop` button** — puts the exact `NewsletterBar` pill 200px above the `NewsletterBar` pill. Item 10 takes the sage fill instead, which is a decision rather than a contingency.
- **Delete `StatsBand` outright** and **extract the backdrop separately** — three proposals filed three overlapping extractions of the same two files (the row, the band, the backdrop). One refactor, not three new components: item 12, which also fixes the semantics and caps the admin.
- **A `<dl>` with `<dd>` before `<dt>`** — the accessibility fix breaking the semantics it invoked. Item 12 uses a list with an `aria-label` per item.
- **`--sage-lit` on the 10px eyebrow** — killed on measurement. After item 1 it sits at 5.41:1 on `#242523`, and `--sage` is correctly the UI green doing UI work at 10px. The 3.08:1 figure that motivated it was measured against the scrim item 1 replaces.
- **Deleting the entry animations and replacing them with a CSS keyframe** — right mechanism, wrong section. `[data-hero-reveal]` at `globals.css:410–416` fires on load, and this band is ~8,000px below the fold. See item 4 and Q4.

---

## 6. Open questions for the client

1. **The opener (item 9).** 9A is a hairline running the full measure with `19:30 · BASECAMP` on the left and `2,900M` on the right; 9B drops the eyebrow entirely, sets the statement alone at up to 84px, and prints `19:30 · 2,900M · BASECAMP` at the foot beside the way out. Show two stills. **Ask directly whether 9A reads as the trail spine they rejected twice** — it is a section rule, but they are the ones who decide that.
2. **The headline's second line (item 3c).** Keep "More than a destination." or take "This is what we send with you."? The first is theirs and abstract; the second names the thing in the box. 3a and 3b do not depend on the answer.
3. **The paragraph (item 3b).** Present it as a marked-up diff — 33 of the 36 words are theirs, in their order. Two things to confirm: does "the shirts and the flasks" read right for the catalogue, or is it "the shirts and the bottles"? And is "printed to order in Dehradun" a claim they are happy to make publicly?
4. **An arrival gesture (item 4).** With the motion components gone the band does not move on entry. If they want one back, the mechanism is specified and safe: an `IntersectionObserver` that sets a `data-` attribute, gating a transform-only keyframe with `animation-fill-mode: backwards` inside `@media (prefers-reduced-motion: no-preference)` — the same construction as `[data-alive-char]` at `globals.css:568`, where a missing signal costs the motion and never the words. It is deliberately not built on spec, because Law 6 gives the page one choreographed moment and the hero has it.
5. **`/about` (item 14).** The homepage paragraph says DEWDROPZ started with a feeling, not a product; `/about` says three trekking guides and a bad monsoon, and that prototypes are tested above 4,000 metres. Which one is true? Whichever it is, both pages should say it.
6. **Scope.** Items 2 and 11 both want to touch `NewsletterBar.tsx` — `italic text-sage` → `text-sage-lit` at `:73`, and deleting `border-t border-paper/10` at `:51`. That is section 12's file. Approved, or filed for section 12's own round?
7. **The numbers band at all.** `stats` has almost certainly never rendered in production: it defaults to `[]` in both settings paths and the admin card talks the owner out of filling it. Does the client actually intend to publish figures here? If not, items 5, 8c and 12 become dead-code maintenance rather than design, and the band should be reconsidered as a whole in a later round.

**What I could not specify exactly:** the four `night-scrim` stops (0.88 / 0.74 at 30% / 0.84 at 58% / 0.92) are computed from this photograph's band means and need eyes at 390, 768, 1440 and 2560 — too heavy at the top and the eyebrow floats on black, too light and the horizon reads as a flare; the `basis-[190px]` for a mono figure at 44px is a starting value that must be checked against a real five-digit `1,00,000`; and whether item 8b's `py-24 md:py-32` is enough of a height cut, or whether the band should go to `py-20 md:py-28` to match `NewsletterBar`, is a judgement to make in a browser with item 3b's shorter paragraph already in place.

---

## 7. How we will know it worked

**Widths, every time.** 320, 360, 390, 640 (the old `<br>` boundary), 768 (where four columns and the tightest gap first appear), 1024, 1440, 2560. At every one of them: the headline is exactly two beats, never one run-on sentence; nothing scrolls horizontally; the paragraph never exceeds ~54 characters per line; the band's silhouette widens or holds, never bulges then pinches.

**Degraded states, every time.**
- **JavaScript off** — the headline and the paragraph must be fully visible, at full opacity, with no transform. This is the pass/fail on item 4. Check the raw SSR HTML with `curl`, not the browser, so a working hydration cannot hide the defect.
- **`prefers-reduced-motion: reduce`** — the figures must show their true values immediately and never count. This is the pass/fail on item 5.
- **Throttled background tab** — open the homepage in a background tab, wait 30s, return, scroll to section 11. The statement must be there.
- **`stats` empty (the production default)** — the band renders headline, paragraph and both CTAs, with no hole where the numbers row was and no orphan hairline.
- **`stats` at 1, 3, 4 and 5 entries** — 3 centres instead of leaving a hole in column four; 5 centres its orphan; 5 is impossible to enter once item 12's admin cap lands.
- **A blank label, and two blank labels** — no duplicate-key warning in the console.
- **A five-figure non-plain value (e.g. 100000)** — renders `1,00,000` identically on server and client, no hydration warning, no wrap at 390px.
- **Slow 3G, cold cache** — the placeholder under the photograph is a dusk gradient, not a green slab.

**Measurements, before and after.**
- Band ground at six sample depths against the decoded photograph. Today: `#252b26 / #2b2c20 / #131914 / #101512 / #0d110e` — a 13.34→17.47 range against paper, which is no modelling at all. Target after item 1: `#242523 / #38342d / #464137 / #2f2a21 / #151b18 / #162710`.
- Surviving photo signal by band: today **20.7% / 17.1% / 2.7%**; target **12% / 26% / 16% / 8%** — the glow 1.6x today's.
- Contrast, sampled from the live render at 1440 and at 390, **at the p95 hot pixel and not the mean**: sage-lit headline ≥ **5.7:1** (from 3.56:1); stat labels ≥ **8.3:1** (from 4.10:1 mid-band); CTA face ≥ **9.4:1**, CTA underline ≥ **3.3:1** (from 2.03:1); eyebrow ≥ **5.4:1**; every hairline ≥ **3:1**.
- Phone crop luminance at the horizon band: **.323 → .489** at `object-[38%]`.
- Transferred bytes for `STATS_BG_IMAGE` in the network panel: **1,429,961 → 179,295**.
- Band height at 390px with `stats` empty: **~771px → target ≤ 600px** after items 3b and 8b.
- Seam contrast, BrandPulse's last pixel row against NewsletterBar's first: **1.24:1 → 1.02:1**, with no visible hairline between them.

**Interaction passes.** Tab into the section from `Community`/`TheClimb` above and confirm a visible sage ring on **both** links (item 10 adds the second); confirm the accessible names read "Shop the collection" and "Read our story" with no "right arrow"; scroll past the section and back and confirm the counter does not re-run or reset to zero; kill the tween mid-count with a fast scroll and confirm the true figure is left on screen, not a partial.

**Cross-page.** Load `/about` after every one of items 1, 5, 6, 7 and 12 — `StatsBand` shares this section's image, alt, scrim and counter, and four of those items touch shared code. Its scrim must end on ink (`.night-scrim-ink`), because it hands off to `FounderNote`'s `bg-paper` and has nothing to dissolve into.

**Housekeeping.** Two notes from experience, so nobody loses an afternoon: **a mobile check needs a full relaunch** — a stale bundle looks identical to "my change didn't work" — and **the browser pane must be visible**, or screenshots come back blank and `innerWidth` reads 0, which makes a correct responsive layout look broken. And when the `.night-scrim` utility lands, **verify it on a real render**: this repo has been burned by headless checks on exactly this kind of change.
