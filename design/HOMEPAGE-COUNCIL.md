# Homepage Council — the running record

One section at a time. A council of independent designers researches the frame,
an adversarial panel kills what would not survive contact, and what is left
becomes an action plan that gets built and tested. This file is the memory
between sessions: what was decided, what was rejected and why, and what is next.

**Read the "Rejected" section before proposing anything.** It exists because
this project has already spent two rounds re-proposing ideas the client had
turned down.

---

## How a council runs

| Phase | What happens |
|---|---|
| **Recon** | Agents read the actual code and write down what is really in the frame — every element, every current value. No opinions. |
| **Lenses** | Independent specialists critique and propose: layout, colour and light, typography, copy and content, interaction and motion, accessibility, commerce, brand narrative. |
| **Judge** | Adversarial panel scores every proposal on brand fit, execution risk, and whether the client would actually say yes. Anything breaking a hard constraint is killed. |
| **Synthesis** | One buildable action plan: add / remove / update, in priority order, each item specific enough to implement without inventing anything. |
| **Build & test** | Implemented, then verified — screenshots, degraded states, build, tests. Result recorded below. |

Each section gets its own file in this directory. This file is the index.

---

## The hard constraints, everywhere

These come from failures this codebase has already had. A proposal that breaks
one is dead on arrival.

1. **Copy lives in the server HTML.** The hero once shipped its words as
   `invisible` and waited on a script: 3.79s to the last call to action, and a
   permanently wordless page if one chunk failed to arrive.
2. **Never let a stalled animation take words away.** No animating opacity on
   content entry. A background tab stalls animations; a stalled transform leaves
   text legible, a stalled fade leaves a hole.
3. **Reduced motion gets a complete, still, legible page.**
4. **Nothing ambient.** Motion performs and resolves. Two attempts at permanent
   headline motion were rejected by the client.
5. **No reflow from type.** Variable-font axes change advance widths; animate
   transforms instead.
6. **The storefront and Trek Buddy keep separate palettes on purpose** — the
   shop sells, the board must be believed. Same standard of discipline, different
   tokens.

---

## Sections, in scroll order

| # | Section | Component | Council | Built |
|---|---|---|---|---|
| 1 | Hero | `components/sections/SummitHero.tsx` | **done** → `design/01-hero.md` | **P1 built** (7 of 8; see log) |
| 2 | Three collections | `components/sections/CollectionsRow.tsx` | **done** → `design/02-collections-row.md` | — |
| 3 | Choose your essentials | `components/sections/ShopByCategory.tsx` | **done** → `design/03-shop-by-category.md` | — |
| 4 | The custom studio | `components/sections/DesignYourOwn.tsx` | **done** → `design/04-design-your-own.md` | — |
| 5 | Trek Buddy | `components/sections/TrekBuddyBand.tsx` | **done** → `design/05-trek-buddy-band.md` | — |
| 6 | Trails | `components/sections/HomeTrails.tsx` | **done** → `design/06-home-trails.md` | — |
| 7 | Trust strip | `components/sections/TrustBand.tsx` | **done** → `design/07-trust-band.md` | — |
| 8 | Season kit | `components/sections/SeasonKit.tsx` | **done** → `design/08-season-kit.md` | — |
| 9 | The climb | `components/sections/TheClimb.tsx` | **done** → `design/09-the-climb.md` | — |
| 10 | Community | `components/sections/Community.tsx` | **done** → `design/10-community.md` | — |
| 11 | Brand pulse | `components/sections/BrandPulse.tsx` | **done** → `design/11-brand-pulse.md` | — |
| 12 | Newsletter | `components/sections/NewsletterBar.tsx` | **done** → `design/12-newsletter-bar.md` | — |
| — | Footer | `components/layout/FooterSection.tsx` | **done** → `design/13-footer.md` | — |
| — | Nav | `components/layout/NavBar.tsx` | **done** → `design/14-navbar.md` | — |

---

## Other pages

| Page | Council | Built |
|---|---|---|
| `/shop` | **done** → `design/15-shop.md` | **built 2026-08-30** (see its log) |
| The rental system | **done** → `design/16-rentals.md` | one security fix built; the rest is a plan |

The shop council follows the same method and carries its own Killed table and
its own open questions. It also corrects four stale claims in `WEB-POLISH.md`.

---

## Cross-cutting — found independently by several councils

These are not section defects. They are the same defect appearing in many
sections, and they should be fixed once, as a pass, rather than thirteen times.

**A · Content ships invisible.** Five elements are served with `opacity: 0` in
the homepage's HTML — including the brand statement headline and its entire
paragraph — waiting on `motion/react` to fade them in. Verified against the
running server, not inferred. Seventeen components repo-wide use the pattern.
This is precisely the failure the hero rewrote its own entrance in CSS to
escape: a background tab stalls the animation and the words never arrive, and
with no JavaScript they never arrive at all.

**B · Five container widths.** 896 / 1024 / 1152 / 1280 / 1400 across 42 call
sites, so moving between bands shifts the content edge by up to 248px for no
reason a visitor can name. Counted: `max-w-4xl` 4, `max-w-5xl` 4, `max-w-6xl`
15, `max-w-7xl` 15, `max-w-[1400px]` 4.

**C · Adjacent bands that measure ~1:1 against each other.** Sections 05→06 at
1.24:1, 07 sitting between two dark bands at 1.01:1, 08 at 1.008:1 against the
band above. The paper ladder exists and the light half of the page ignores it,
so runs of sections read as one slab.

**D · Every section opens the same way.** A mono eyebrow over a display heading,
four and five times running. Three species are defined; one is used.

**E · Text under AA, everywhere.** Every council measured rather than estimated
and found failures — 1.02:1 on a collections caption, 1.80:1 on the studio's
focus ring, five of seven text roles in Trails, five in the footer.

---

## Decision log

Newest first. Every entry says what changed and why, so a later session does not
undo it by accident.

### 2026-08-30 · Hero headline — "The Turn" — BUILT
The line arrives as one flat cream statement and then the same wave comes back
through it: letter by letter, ALIVE. leans out of roman, catches first light,
and settles into italic green. One glyph per letter, no second copy: Fraunces is
declared with no italic style, so italic is a synthesized oblique and an equal
CSS skew cancels it exactly. Origin measured at 89.2% (132px) / 89.7% (52px),
not guessed. Files: `components/AliveHeadline.tsx`, `app/globals.css`,
`components/sections/SummitHero.tsx`.

### 2026-08-30 · The intro signal is a guarantee — BUILT
`introDone` used to become true only because the preloader called it, so anything
waiting on it depended on a component existing. `IntroProvider` now announces it
itself after 1400ms if nothing else has, and publishes `data-intro-done` on the
root. The headline's choreography waits for it, so the gesture no longer plays
underneath the preloader's panel on a first visit. The preloader announces at
`hide()` — when the panel is gone — not when it starts fading.

---

### 2026-08-30 · 04 · The studio shows where the print goes — BUILT
The section is the shop's only real instrument and it showed nothing printed: a
photograph of a blank, a colour swatch and a button. Every number needed to draw
the print area was already in the database and none of it reached the screen.

`CustomizationZone` carries x / y / widthPx / heightPx in the canonical space
`CanvasStage` uses (width 800); the stage is `aspect-[4/5]` so the canonical
height it already assumes is 1000, and the mockups are 4:5, which makes
`object-cover` a no-op crop and lets the percentages land exactly. A dashed
`--dawn` hairline, no fill, no animation — it moves when the image moves and
never draws itself on.

The "Your canvas" badge is gone with it. It was unconditional, so it announced a
canvas even when there was no printable zone to have one, and it told a visitor
nothing they could act on. In its place, at the foot of the stage where it sits
under the rectangle instead of arguing with the front/back toggle: **Print area
12 × 16 in**, in Space Mono because they are figures, from the same values the
studio itself prints.

Verified on the served page: rectangle at left 36.26% / top 26.08%, 27.48% ×
29.25% — a chest placement — and the readout reading real data.

### 2026-08-30 · Section defects — FIXED

**04 · A sold-out size could ride into a paid order.** The worst thing any
council found, and it is verified in the code, not inferred.
`DesignYourOwnConfigurator` pre-selected `variants[0]` regardless of stock, kept
a `?? variants[0]` fallback, and — because the chip's class ternary tested the
SELECTED branch before the OUT-OF-STOCK one — drew a sold-out size in sage as
the chosen one *while* it was `disabled`, so a visitor could not click away from
it. Its id then went into the studio link, and nothing between that chip and a
paid order checks stock again. Fixed at every step: first in-stock variant is
the default, no fallback, `oos` outranks selected, `aria-pressed` added, the
variant is only carried into the studio when it is buyable, and a blank with
every size gone shows a disabled door reading "Every size is sold out — try
another blank above."

**14 · The nav's spotlight ring no longer pulses.** `animate-pulse` is an
infinite opacity loop and it ran for as long as a hero act held — ambient motion
in the one element that is on screen for the entire page. The ring still marks
the door the hero is pointing at, in `--dawn`; it says so by arriving rather
than by breathing.

**14 · CORRECTION — the "dead commerce links" finding is wrong.** The council
called `?category=mugs` "a 404-by-another-name". It is not: `mugs`, `tumblers`,
`bottles`, `t-shirts`, `hoodies`, `sweatshirts` and `caps` are all real slugs in
`supabase/migrations/050_launch_taxonomy.sql`. The links resolve. What is true is
that those categories may have no PRODUCTS yet — which is an empty result, not a
broken link, and a different decision. Nothing was removed. Recorded so nobody
acts on the original wording.

### 2026-08-30 · Cross-cutting pass D — BUILT
Three opening species in `components/SectionHeader.tsx`, rotated across ten
bands so no two adjacent sections open the same way. Filed independently by nine
of the thirteen councils. Took the season kit's ambient pulsing dot and both of
BrandPulse's entry animations with it. See `design/00-cross-cutting.md`.

### 2026-08-30 · Two data defects — FIXED
Both found by councils, both verified in the code before touching anything.

- **Every trail an admin added was silently discarded.**
  `normalizeHomeConfig` (actions/settings.ts) does not patch the settings row,
  it REBUILDS it from an explicit key list — and `trails` was not on the list,
  so it was dropped on every read. The homepage then fell back to
  `DEFAULT_HOME_TRAILS` forever: /admin/homepage wrote correctly, the storefront
  could never see it. Any future key added to `HomeConfig` fails the same way.
- **The shipping promise was a hardcoded string beside the live setting that
  governs it.** `TRUST_POINTS` said "Free over ₹2,000" while
  `free_shipping_threshold` is owner-editable and is what checkout actually
  charges against. They agreed by coincidence. `TrustBand` now reads the
  setting, with an honest zero branch ("Calculated at checkout") for when free
  shipping is switched off — a storefront may not print a price rule the
  checkout will not honour.

### 2026-08-30 · Cross-cutting passes B and C — BUILT
One measure (14 call sites across eleven bands) and the ground ladder (two Law 1
violations, one live and one latent). See `design/00-cross-cutting.md`.

### 2026-08-30 · Cross-cutting pass A — BUILT
Content that shipped invisible. Five elements were served with `opacity: 0` in
the homepage HTML — three `TheClimb` station rows (a product, a price and an
add-to-cart each) and both halves of the brand statement — waiting on
`motion/react`. With JavaScript unavailable they were not dimmed, they were
absent. Fixed by animating transform only, which is the rule `globals.css`
already records under THE HERO ENTRANCE. `Community`'s two `AnimatePresence`
blocks keep their crossfade (a real state transition) but take `initial={false}`
so the first review and first photograph mount finished rather than invisible.
`NewsletterBar` left alone — its faded element is a post-submit message that
never ships in the HTML. Verified against the running server: 5 → **0**, with
the rise intact. Plan: `design/00-cross-cutting.md`.

### 2026-08-30 · Hero P1 — BUILT
From `design/01-hero.md`. Seven items:

- **1 · Two lines, on purpose** — headline `clamp(52,10vw,132)` →
  `clamp(76,17vw,156)`, capped `max-w-[min(100%,5.6em)]`. **Correction to the
  plan:** its metrics were wrong. The line is ~4.74em, not 6.274em (measured off
  the render: 403px at 85px type). So it sets on ONE line at desktop and breaks
  to two below ~500px. The defect it was fixing — a break that flipped
  unpredictably at 1024px — is gone either way, because the cause was item 2.
- **2 · One weather instrument** — deleted both 176px side columns, the
  `WeatherRail` component, the duplicate inline picker, and "Change the
  weather". One control now, bottom-right, inside `copyRef` so it inherits the
  act's fade. Gated on `weather && mounted && !ambientMobile && !reduceMotion`
  and re-sampled with the breakpoint. Inactive labels 4.11:1 → 7.95:1.
- **3a · The poster has first light** — a `--dawn` ellipse at 74%/47%. It had no
  warm pixel, and it is the entire background on every phone and every
  reduced-motion visitor.
- **3b · A centred clearing** — the left-to-right scrim was buying a legible
  ground for a column that has been centred for weeks. `--sage-lit` over the
  range: 2.18:1 → 5.6:1.
- **4 · The sentence — REVERTED by the client, same day.** It was changed to
  "Apparel and drinkware, made in Dehradun. For everyday journeys." and the
  client put "Inspired by mountains. Made for everyday journeys." back.
  `text-balance` was kept. See Rejected.
- **5 · The preloader is animated in, never script-removed** — its resting state
  is absent, in CSS. It was server-rendered opaque over the whole page with a
  `useEffect` as the only thing that ever took it away.
- **6 · Deleted `hero-trek-scroll.mp4`** — 8.8 MB, referenced nowhere.

**Not built, and why:** 3c and 3d (moving `DawnGlow` and remapping the key light)
are inside the WebGL scene, which does not render in headless Chrome — they are
tuning-by-eye changes and I could not see them. Item 7 (`TrailSpine`) is the
client's call. P2/P3 untouched.

---

### 2026-08-31 · 12 · The dispatch told people they had subscribed when they had not — FIXED
The page's only conversion object, and its worst bug. `subscribeToNewsletter`
**returns** `{ error }` — it does not throw. The handler was:

    try { await subscribeToNewsletter(...); setSubmitted(true) } catch {}

so `await` resolved normally on every failure path and the success state ran
regardless. A rejected address, a rate limit, a database error: all answered
with "You're on the list." The `catch` only ever fired on a transport failure,
which was the one case already invisible.

It reads the result now, shows the reason in a `role="alert"` line (`--dawn`,
7.4:1 — this palette has no destructive token), keeps the form so the address
can be corrected, and reports `source: 'homepage'` rather than the inaccurate
`'footer'`.

**Verified by interaction in a real browser**, not by reading: `a@b` passes the
browser's `type="email"` check and fails the server's schema, and the band now
answers "That address did not look right — try again?" with the form intact.
The success path was NOT exercised — it would insert a junk row into a live
Supabase newsletter table.

The field is also visible now: boundary `paper/25` → `/40`, placeholder `/30`
(2.2:1) → `/55` (4.6:1), fine print `/40` → `/60`, focus ring `--sage` (6.0:1) →
`--sage-lit` (9.7:1).

### 2026-08-31 · 13 · The footer's shipping promise, from the setting — FIXED
The same figure was hardcoded in the footer's logistics strip as well as in
`TRUST_POINTS` — two places on all 27 pages the footer mounts, beside the live
`free_shipping_threshold` that checkout actually charges against. The footer is
a server component and already awaits its own data, so it reads the setting
directly and the whole line disappears when free shipping is switched off.

### 2026-08-31 · 03 · The pack manifest — BUILT
The section was a photographic card grid with no photographs: four
`aspect-[4/5]` tiles on `bg-ink/60` under a scrim, every one a flat grey
rectangle reading "Coming soon". 378px of void on a page about light.

It is a list now. Five hairline rows on the measure — stamp, name at display
scale, description, status — with the way out as the closing row (empty stamp
cell, so every name starts on the same x) replacing the two `Browse Everything`
links that used to sit above and below the grid.

- **The stamp carries first light.** `--dawn-soft` → `--paper-warm` at 160°,
  which with no photograph IS the cell. The stop is 06:40, the light is
  arriving, and the objects that have not arrived yet are the ones lit. Source
  order is `tile.image_url ?? newest listing's first frame`, so a real
  photograph wins the moment one exists — and costs no new query, because
  `products` was already a prop.
- **"In production", not "Coming soon"** — the same promise in the register of a
  shop that prints to order. `--mid` at 5.33:1; `--clay-deep` and `--ember` are
  the tempting warm tokens and both fail AA at 11px on this ground.
- **A row with nothing behind it is not a link.** `/shop?category=caps` returns
  an empty result AND hides the filter that emptied it, so the visitor cannot
  see what to undo — the dead end this component's own docstring says the stock
  rule exists to prevent. Those rows are `<div>`s.
- **One click target is not a band**, so while every row is unstocked the list
  is followed by a line pointing at the dispatch field further down this same
  page — a link to an existing form, not a second email capture on one scroll.
  It disappears the moment any row has stock.
- **One fold over the catalogue** replaces two O(n·m) passes that answered the
  same join twice.

**Item 3 of the plan was NOT taken.** It wanted `--paper-deep` here; Pass C has
since put `--paper-deep` on the section directly below, so taking it would
recreate the adjacency violation that pass just fixed. The band stays
`--paper-warm` and the ladder still steps.

**A bug found by looking, at 390px.** Below `md` the grid is two columns, so the
description became the third child — column 1 of a new implicit row, the 48px
stamp column — and `line-clamp-2` clipped "Top off your adventure." to "Top off
your…" in 48px. `md:contents` on a wrapper fixes it: below `md` the wrapper is
the second cell and the three stack inside it; from `md` its children are
promoted to grid items in their own columns. Description width 48px → 278px.

---

## The walkthrough — 2026-08-30, real browser

Every section walked at 1440, and the hero at a true 390 (device emulation; a
real Chrome window will not go below 500px on macOS, which is what defeated
every earlier attempt).

**Confirmed working, live:** the print area drawn on the hoodie with its
12 × 16 in readout; the ground ladder stepping on every seam; the species
rotation reading as three distinct openings; one measure across the bands; the
trust strip's shipping figure coming from the setting; no content arriving
invisible. On the phone: **no horizontal overflow** (scrollWidth 390 =
innerWidth), the headline at 76px breaking to two lines across the full 342px
column, and first light visible behind it.

**A regression I introduced, found and fixed during the walk.** The dispatch's
index rule sits inside a half-width grid column, and a long eyebrow on the same
line compressed the heading into a ribbon — "One email / a month. / Actually /
worth / opening." `min-w-[18ch]` on the index heading now forces the eyebrow to
wrap instead, and the dispatch's eyebrow stopped repeating the band's own name.

**Confirmed with my own eyes, still unfixed:** section 03 is four flat grey
voids reading COMING SOON. It is the ugliest thing on the page and the council
was right about it. The categories have no images and no products, so the tiles
render as empty gradient boxes.

**`TrailSpine` is visibly on the page** — the vertical rail at the left edge in
every desktop screenshot, printing a clock time and an altitude. Restored by the
revert. Still the client's call.

**Not a bug, worth knowing:** on a cold load 4 of the page's 26 images failed
and rendered as broken frames; on reload, 0 of 26. The URLs are all live and the
optimiser returns them fine when asked directly. It is a cold-cache symptom of
depending on 26 remote Unsplash images at first paint — a real risk for a first
visit, and a decision (self-host the imagery) rather than a fix.

---

## Rejected — do not re-propose

| Idea | Verdict | Why |
|---|---|---|
| Pointer-reactive headline (letters lift and lean toward the cursor) | client rejected | "I don't like the hover animation." |
| Permanent per-letter sway on independent periods | client rejected | "It is not looking good." Ambient motion reads as a screensaver. |
| `TrailSpine` rebuilt as a chapter index | client rejected twice | Two rebuilds both rejected: "Trail spine is shitty… remove it or use earlier one." Do not attempt a third. |
| Rewriting the hero sentence to name the goods ("Apparel and drinkware, made in Dehradun.") | client rejected | The council's finding stands — no noun in the hero says what is sold — but the client keeps the line as written. If the frame is to name the goods, it must be somewhere other than this sentence. |
| Loading Fraunces Italic | blocked | Breaks the headline's skew cancellation and back-slants ALIVE.; a second font file also re-sets a centred line mid-load. |

---

## Correction — 2026-08-30

**`TrailSpine` is back on the homepage, and it is the original.** The revert of
the handoff work restored `components/TrailSpine.tsx` and its mount at
`app/page.tsx:73`, so the element the client rejected twice is once again on the
page — in its *first* form: `aria-hidden`, `hidden xl:flex`,
`pointer-events-none`, `mix-blend-difference`, vertical type, printing a clock
time and an altitude. The hero council found it independently and filed it as a
P1 removal.

This is a decision for the client, not a bug to fix quietly: the revert was
asked for, and it restored this along with everything else. Recorded here so the
next session does not assume it was already dealt with.

---

## Open questions for the client

- **The preloader.** It costs the first visit about a second before the headline
  can begin, and it exists in front of a server-rendered page. Keep, shorten, or
  delete? Deleting also removes 182 lines and a provider.
