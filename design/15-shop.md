# 15 · The shop — council record

The catalogue page, `/shop`. Same method as the homepage councils: eight independent
lenses read the code and measured it, three adversarial judges killed what would not
survive contact, and what is left is below as one buildable plan.

**Read "Killed" before proposing anything.** It exists because two of the ideas in
this council were good and still should not ship.

Frame: `app/shop/page.tsx` · `components/sections/ShopContent.tsx` ·
`components/ProductCard.tsx` · `components/shop/FilterSidebar.tsx` ·
`lib/shop-filter.ts`. Catalogue at time of review: **10 products** — 6 equipment,
4 apparel; 3 collections holding 1 product each; 3 with a second image; 1 with none.

---

## The verdict

The shop is not badly designed. It is **well-built machinery pointed at a catalogue
that does not exist yet**, sitting on top of four defects that cost money.

`lib/shop-filter.ts` is the best-factored code on this page — pure functions, 29
tests, the URL as the single source of truth. The rail's facet counts are real
"what would I get" counts. The empty state diagnoses which filter emptied the shelf
and names it. That is real work and none of it should be undone.

What is wrong is that a five-facet rail, a three-tile collections plate and a
four-entry sort menu are all rendering against ten products — and three of the five
facets, all three tiles and one of the four sort entries **provably cannot partition
this catalogue.** Meanwhile the built page ships no products at all, the card can put
a sold-out size in a cart, filtering by size hides the shop's only ready-made tee,
and on a phone "Add to cart" is a 16px text link.

| Area | Now | Target |
|---|---|---|
| Filtering logic (`lib/shop-filter.ts`) | 8.5 | 9 — one predicate bug |
| Server rendering / first paint | **1** | 8 |
| Product card | 4.5 | 9 |
| Rail (as an instrument) | 7 | 8.5 |
| Rail (as a fit for 10 products) | **3** | 8 |
| Masthead + fold | **3.5** | 8.5 |
| Colour, depth, contrast | 4 | 9 |
| Type system | **2.5** | 8 |
| Accessibility | **2** | 8.5 |

---

## Ships first — no conflicts, no decisions needed

These four were reached independently by multiple lenses, survived all three judges,
and depend on nothing else in this document.

**A · `max-w-[1400px]` → `max-w-measure`.** `ShopContent.tsx:151, 177, 243, 397`.
The last four raw page-band widths in the repo — verified: 4 hits, 1 file, against
`max-w-measure` at 17 sites elsewhere. Law 04's named failure. It also stops the dark
CTA band printing 60px left of the footer directly beneath it. **Every measurement in
this document assumes 1280.**

**B · The card can put a sold-out size in a cart.** `ProductCard.tsx:58` takes
`variants[0]` unguarded; `:83` computes `soldOut` from the **product-level**
`inventory_quantity`. For `custom-hoodie` that is 99 while variant S is a separate row
at 24 — unrelated counters, so the guard *cannot ever* see a variant sell out. Same
class as the worst thing any council has found, still live in the component the shop,
the wishlist, `/collections/[slug]` and the PDP's related row all share.
**The fix already exists:** `lib/variants.ts:58` `firstAvailableVariant()`, written
for this bug, already used by `TheClimb.tsx:30` and `SeasonKit.tsx:49`. Three lines.
*Scope correction:* `021_stock_integrity.sql:17` has `CHECK (inventory_quantity >= 0)`
and `actions/orders.ts:206` catches `23514`, so the wrong garment cannot ship. It
fails as a hard error at the end of checkout. A lost order, not a wrong delivery.

**C · Filtering by size hides the shop's only ready-made tee.** **— WITHDRAWN.
The finding does not survive; see the third correction in the build log.** What
shipped instead is the facet gate. The original claim, for the record:
`lib/shop-filter.ts:191–194` — `sizesOf()` returns `[]` for a product with no
variants and `matches()` then excludes it. Verified: `/shop?size=L` returns 3 cards;
`garhwal-ridgeline-tee` (25 in stock) is not one of them. Twenty lines above,
`inStock()` deliberately treats "no variants" as *not a stock signal* — "hiding it
would silently remove it from the shop". Same file, opposite policies. Add a test.

**D · The skip link points at nothing.** `app/layout.tsx:146` renders `href="#main"`
as the first tab stop of every page; `grep -c 'id="main"'` on the served shop = **0**.
There are 11 nav stops ahead of the catalogue and the one control built to skip them
takes focus and does nothing. One attribute, in two places (`ShopContent.tsx:146` and
the Suspense fallback).

---

## P1 — the page's four real defects

### 1 · The built page contains no shop

`.next/server/app/shop.html`, reproduced from a fresh build:

```
<template data-dgst="BAILOUT_TO_CLIENT_SIDE_RENDERING"></template>
<main class="pt-32 pb-24 px-6 md:px-10 bg-paper min-h-screen"></main>
```

Zero product names, zero prices, no `<h1>`. `revalidate = 60` prerenders the route;
`ShopContent` is `'use client'` and calls `useSearchParams()`; the Suspense boundary
wraps **the whole page**, so the fallback is what gets written into the shell. Hard
constraint 1, at 100%, by build configuration. **The dev server renders it correctly,
which is why this survived** — only the build artefact shows it.

Two fixes, and they are not alternatives:

- **1a — lift the masthead out of the client boundary.** `ShopContent.tsx:150–171`
  reads only `products`, which `app/shop/page.tsx` already has on the server. Move it
  above the `<Suspense>`. The page's words land in the HTML regardless of what the
  rail does. **Ships now.**
- **1b — make the route dynamic** so the grid lands too: read `searchParams` in the
  server component, drop `revalidate = 60`, move caching into the three data
  functions. Verified against the Next docs shipped in this repo
  (`use-search-params.md:82` and `:187` — the bailout is prerender-only, and a
  dynamically-rendered route gives `useSearchParams` real values during SSR).
  **Costs the CDN-cached document.** Held for a performance/commerce decision; nothing
  else here depends on it.

Also missing and worth adding either way: `app/shop/loading.tsx` (a still skeleton at
the real card dimensions — no pulse) and `app/shop/error.tsx`. The storefront has
neither; Trek Buddy has eleven.

### 2 · The catalogue starts below the fold, and what sits above it cannot sell

Grid top at 1440×900: **≈760px**. A visitor sees 140px of a 430px photograph — no
name, no price, no add-to-cart. At 390×844 it is 43px of 217.

The 275px above it is the collections plate: **3 collections, 1 product each, 7 of 10
products in none.** It is the largest, highest-contrast, most photographic object on
the page, the eye reaches it before any product, and every tile leads to a
one-product grid. It is also *filters dressed as merchandise* — byte-for-byte the
same treatment as `CollectionsRow` on the homepage, where the identical object is a
`<Link>` that navigates. A visitor arriving from the homepage has been trained by that
object to expect the opposite behaviour.

**Gate the plate on the same usefulness predicate as the rail's Collection facet.**
On today's data it does not render, and the grid top moves **760 → ≈485**. One
predicate, no restructuring, no screenshot needed.

`WEB-POLISH.md:333` claims the shallow plate fixed this. It did not — the plate got
shorter and the masthead never moved. **Correct that line.**

### 3 · The product card publishes its price as a caption, then hides it

`ProductCard.tsx:191` and `:202` are byte-identical: `font-body text-xs sm:text-sm
font-medium text-forest`. The price, the "Add to cart" and the description are the
same size; the price is 0.70× the product name. Both are wedged into a 24px
`md:overflow-hidden` window, so **hovering a card — the gesture that means "I am
interested" — removes its price from the screen**, and the global focus ring (2px,
3px offset) is clipped on all four sides of a 24px control in a 24px window.

Below `md` the window is inert, so "Add to cart" is a **16px-tall text link with no
padding**, sitting directly on a non-tappable 16px price row.

**Delete the window.** Price and action share one permanently-visible row:

```
name   .shop-h3      19 / 1.25    line-clamp-2
desc   .shop-meta    13 / 1.45    line-clamp-2 min-h-[2lh]   ← pins the grid row
price  17px / 600 / tabular-nums / text-forest
action min-h-[44px] md:min-h-[36px], bordered, its own target
```

Hierarchy becomes 19 → 17 → 13 → 11; the price moves to 0.89× the name. Caption grows
**+26px**, bought back several times over by gating the plate.

Same edit, same file: wishlist `h-7` → `h-11` and persistent when saved (today a
desktop shopper cannot see what they have saved without hovering each card);
`ring-forest/40` → `ring-forest` (**2.12:1 → 9.48:1**); `aria-label`s that name the
product (twenty pairwise-identical accessible names today); `aria-hidden` +
`tabIndex={-1}` on the image link, which kills both the duplicate-link problem and the
live empty-link failure on `trekking-poles-buy`; `animate-pulse` deleted; the ±4°
spring tilt deleted; and `--shadow-card` removed from the heart and the tags so it
means one thing — **a product photograph, ten uses, one meaning** — instead of
appearing 25 times across five object scales from a 28px icon to a 700px rail.

Then the confirmation. `ShopToaster` is mounted, themed, and **never called from this
page**; its own docstring says it exists because "the customer spending four thousand
rupees was told nothing at all when their cart changed". `TheClimb.tsx:46–58` already
ships the pattern — `toast.success()` naming the size, plus `trackEvent('add_to_cart')`.
Four lines. The shop grid is currently the only commerce surface on the site that
emits **no analytics at all**.

### 4 · The phone's filter sheet is not a dialog

`ShopContent.tsx:361–393`. No `role="dialog"`, no `aria-modal`, no accessible name,
nothing focused on open, no trap, no `inert` behind it, no focus return on close.
Press Filter and focus stays on a button now underneath the scrim; Tab walks the sort
control, the chips and all ten cards — **every one of them visually covered** — and on
close focus falls to `<body>`, so the next Tab restarts at the top of the document,
past 11 nav stops, via a skip link that does nothing (defect D).

It is the only unrecoverable state on the page, and it is the one the file's own
comment defends most: *"the device most people shop on should not get the weaker
instrument."* The rail moved into the sheet intact. The sheet was built without the
four things a sheet is.

Ships with it: an entrance (260ms translate on the panel, 200ms opacity on the scrim —
transform on content, opacity only on a curtain), `h-[100dvh]` to match
`NavBar.tsx:782`, and `env(safe-area-inset-bottom)` on the footer that holds the only
confirm control.

---

## P2 — the system defects

**5 · Contrast.** 70 pairs measured, 21 fail. `--light` (`#94917F`) carries **17
labels** on this page and reaches AA on nothing: **3.174:1** on `--surface`, **2.63:1**
on `--paper-warm`, at 10–11px. Among them the twelve facet counts — the number that
stops a shopper choosing an empty shelf — and both "Clear" controls.

`WEB-POLISH.md` §2.5 diagnosed this, prescribed `text-mid`, and records the item
**closed**. The rebuild shipped `text-light`. **Correct the doc in the same commit.**

Two changes, both ship, they are not alternatives:
- the six shop call sites → `text-mid` (**3.17 → 8.06:1**, **2.63 → 6.67:1**);
- the token itself → `#6C6A5D`, with the old value retired to a new `--faint` for
  decoration. Blast radius counted repo-wide: **42 affected sites in 24 files, of
  which 41 are text and exactly one is a dot** (`status-badge.tsx:25`). Trek Buddy
  already made this exact change and documented it at `globals.css:316–324`. Ships as
  its own commit — 18 of the beneficiaries are in the account area.

Also: disabled facets composite to **1.20–1.96:1** — the rail's own comment says
"greyed rather than hidden", and at 1.20:1 they are hidden. Give them a colour, not an
opacity. And the dark CTA band lacks `.on-dark`, so its focus ring draws forest on
forest-deep at **1.50:1** — the exact failure `globals.css:636` was written to prevent,
on the page its comment names.

**6 · The grid's breakpoints, and the photography.** Two cliffs — **−33% at 1024,
−35% at 1280** — and the largest cards on the site are at 1023px, the *narrowest*
desktop. Fix: a 200px rail with `gap-8`, and
`sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]`. Card width becomes
**163 / 332 / 344 / 307 / 307** against today's 163 / 332 / 308 / 283 / 323 — bigger
where it was worst, both named cliffs gone, and the residual 2→3 flip confined to
1024–1079 where no laptop sits.

With it: `sizes="(max-width: 640px) 50vw, 25vw"` → `(min-width: 640px) 340px, 47vw`.
`25vw` describes a four-column grid that has never existed and under-requests the
photograph by **1.79×** at 1023 — doubled on a 2× display. This is the one defect on
the page that costs money directly.

**7 · The rail, right-sized.** Keep every line of `lib/shop-filter.ts`. Keep the
multi-select, the counts, the same instrument on a phone. Change what it *renders*:
gate Size on values that return different sets, Availability on something actually
being out of stock, Collection on ≥2 collections holding ≥2. At 10 products that
leaves Category and Price — 8 controls, ~514px, no internal scroll. At 60 products all
five earn their guards and come back on their own. Rows 44px in the sheet,
`lg:min-h-[36px]` in the rail. Sticky offset reads `--nav-h` instead of guessing 96px
against a 56px nav. Panel: drop the border (it measures **1.06:1** — a smudge, not a
hairline), `--shadow-card` → `--shadow-panel`.

Also `FilterSidebar.tsx:273` — the Availability count is hand-rolled instead of using
`facetCount()`, so `/shop?category=drinkware` prints "0 results" and "In stock only
10" on the same screen.

**8 · Type.** 13 sizes, five of them inside a 4px band at semitone steps; 7 tracking
values for one role, six of them on `text-[10px]` alone; ~28 elements with no declared
leading; `tabular-nums` on exactly one element while ten prices ripple down a grid.
Nine `font-mono` sites are costume — including a six-word sentence, two button faces
and a 10px mono `<h2>` that is **half the size of every `<h3>` beneath it**.

Ship the subset now: kill the 9px step, fold 10/12 → 11, two trackings, `tabular-nums`
on every price and count, and de-mono the nine costume sites. The full nine-class
`.shop-*` system — the right answer, and what Trek Buddy already has — is a type-system
commit, not a page review, and it reaches `empty-state.tsx` on ten other routes.

`app/layout.tsx:141` also has no `font-body` on `<body>` and `--font-sans` is
undefined, so anything without an explicit family class inherits the OS UI font.
Verified. Fix it at the theme, not the call site.

**9 · Spacing.** 16 distinct steps over 98 decisions; 6px doing five unrelated jobs;
every value above 40px used **exactly once**, so no large number ever becomes a step.
Page gutter, rail-to-grid gutter and grid row gap are all 40px — three nested levels of
hierarchy at one distance. Collapse to ten steps; retune the five moments so the
eyebrow→h1 and h1→lede gaps stop being identical (`SectionHeader` already sets 8 and
12); grow the dark band from 64/80 to 96/128, where every other dark anchor on the
site sits.

**10 · Motion.** One of nine explicit durations is inside Law 06's bands; two of
sixteen transitions name an easing. `animate-pulse` on the low-stock dot is an
infinite opacity loop — **the third time this council has had to delete this pattern**.
Nothing on the page is gated on `prefers-reduced-motion`, and `motion/react`'s
`useSpring` does not consult it without a `MotionConfig` the web app does not have.
Filtering has no pending state at all: between the click and the commit, a checkbox
does not tick.

**11 · Rhythm.** The shop imports `SectionHeader` **zero** times while ten homepage
sections rotate the three species, and its masthead is a stamp's eyebrow at a
statement's scale — **three values off** the statement's own class string. Route it
through the component, add an `as` prop, and declare `masthead` as the fourth species:
it already exists and is used; it is only undeclared. Resolve the hardcoded-margin
problem with one documented `!mb-6`. **Do not reach for `PageHeader.tsx`** — it uses a
raw `max-w-4xl` and animates opacity on the eyebrow, the `<h1>` and the subtitle,
live on seven pages. That needs its own line in `00-cross-cutting.md`.

---

## Built — 2026-08-30

Everything below shipped in one pass. `npx tsc --noEmit` clean · `npm test` **125
pass / 0 fail** (five new, four of them pinning the two `lib/shop-filter.ts`
bugs) · `npm run build` succeeds · `eslint` clean on every touched file.

**The four no-decision items.** `max-w-[1400px]` → `max-w-measure` at all four
bands. `ProductCard` now takes its variant from `firstAvailableVariant()` and its
sold-out state from `isSoldOut()` — the functions in `lib/variants.ts` written for
this bug and already used by two other components. `<main id="main">`, so the
skip link resolves. The size predicate is **unchanged** — see the third
correction below.

**The catalogue is in the HTML.** The masthead moved to `app/shop/page.tsx`
above the Suspense boundary. Verified in the artefact, not inferred — before:
`"The DEWDROPZ Collection."` × 0, `<h1>` × 0. After: the h1, the lede, the
eyebrow, the price range and a real `<title>Shop · DEWDROPZ</title>`. The grid is
still inside the boundary; that is hold 7.

**The fold.** The collections plate is gated on whether the collection dimension
can partition the catalogue. On the current data it does not render — three
collections holding one product each — and the first product photograph moves
from ≈760px to ≈485px at 1440×900. Measured on the render: at 1440 a shopper now
sees all of the first row, its names, its prices and its buy controls. The tile
rewrite (links not buttons, tagline restored, a bare `--dawn-soft` figure, on
`--paper-deep`) is in the code and takes effect the day the gate opens.

**The rail.** 200px, `--shadow-panel`, no border. Size, Availability and
Collection are gated on the same predicate; on this catalogue the rail renders
**Category and Price only** — eight controls where there were sixteen. Rows are
44px in the sheet and 34px in the rail.

**The card.** The 24px clip window is gone. Price at 17px semibold with tabular
figures, the action a bordered 44px target beside it, name 17/19px, description
`line-clamp-2` with a reserved height so a grid row's prices sit on one baseline.
The tilt, the `animate-pulse` dot and four of the six `--shadow-card` uses are
deleted; the low-stock badge is `--dawn-soft` on `--ink` (14.35:1). It now fires
`toast.success()` naming the size and `trackEvent('add_to_cart')` — the grid was
the only commerce surface on the site emitting nothing.

**The sheet** is a `role="dialog"` with `aria-modal`, a label, focus on open, a
Tab trap, `inert` on everything behind it, focus returned to the trigger on
close, `h-[100dvh]`, a safe-area inset, and a 260ms translate entrance. Crossing
1024px with it open no longer strands `overflow: hidden` on the body.

**Contrast.** `--light` raised `#94917F` → `#6C6A5D` (5.44 / 5.00 / 4.50:1 on
surface / paper / paper-warm) with the old value retired to `--faint` for
decoration, and the one non-text user of it — the neutral status dot — moved
across. The six shop call sites went to `text-mid` on top of that. Focus rings
`ring-forest/40` → `ring-forest` (2.12 → 9.48:1). The CTA band gained `.on-dark`,
so its ring is 5.44:1 instead of 1.50:1. Disabled facets carry a filled checkbox
and legible type instead of a 1.20:1 fade.

**Also:** an intrinsic grid (`minmax(240px,1fr)`) that removes both breakpoint
cliffs; `sizes` rewritten for the grid that exists; a pending dim on the results
column via `useTransition`; an `aria-live` count; a sort menu with arrow keys,
`aria-haspopup`, `aria-controls` and focus returned on select; `SectionHeader`
gained an `as` prop and the declared `masthead` species; a still `loading.tsx`
skeleton and an `error.tsx`; an empty-catalogue branch and a one-filter branch on
the empty state; the empty state's title is now a heading; `--font-sans` defined,
so the site stops inheriting the OS UI font.

`sortProducts` gained the `featured` branch it never had, so "Featured" and
"Newest" are no longer byte-identical. It is a stable sort and **nothing moves
until someone sets the flag** — which is hold 3.

### Three corrections to this council's own build

- **A hardcoded margin, exactly as warned.** The masthead shipped with
  `mb-10 md:mb-12` on the species and `className="mb-0"` at the call site. The
  override lost — `className` is concatenated as a raw string and Tailwind emits
  media-query rules last, so `md:mb-12` won above 768px and put 96px of dead
  ground under the figures row. Caught on the first screenshot. The species now
  carries no bottom margin at all; the band's padding owns that space.
- **The council was wrong about the size predicate, and I built its fix before
  testing it.** The finding — that `matches()` and `inStock()` apply opposite
  policies to the same silence — is rhetorically neat and does not hold. They ask
  different questions. `inStock` asks whether a thing can be bought, and a
  product with no variant rows can be. `size=L` asks whether it comes in L, and a
  product with no variant rows does not. The relaxed version shipped, and
  `?size=L` returned **all ten products** — a four-person tent and a sleeping bag
  included, because six of ten products here are equipment with no sizes. A size
  facet that returns tents is worse than the defect it was fixing. Reverted to
  strict, with the reasoning written into the predicate and pinned by a test that
  now asserts the opposite of what it did an hour earlier.

  The observation underneath it is real and is now hold 8: the Garhwal Ridgeline
  Tee is apparel with 25 in stock and **no size variants**, so a size filter
  correctly excludes a tee that certainly comes in L. That is fixed in admin, not
  in a predicate. What protects a shopper today is the facet gate — Size does not
  render unless its values actually split the catalogue.

- **The mobile layout is UNVERIFIED.** Headless Chrome at `--window-size=390`
  does not give a 390px viewport on this machine — macOS enforces a minimum
  window width, so the page lays out at ~520px and the screenshot is cropped,
  which looks exactly like horizontal overflow. Confirmed by rendering the
  homepage as a control: it clipped identically. Desktop renders are sound (at
  1440 the content edge landed at exactly 1280 + a 40px gutter). **Every phone
  claim in this document is computed from classes, not seen.** The sheet, the
  44px targets and the two-up grid need the real devtools browser before anyone
  says they work.

---

## Client review — 2026-08-31 · six reversals, all built

The client saw the built page and sent six notes back. Four of them overturn
council decisions. **They stand.** Recorded here in full, because the reasoning
that produced the rejected versions was good reasoning and a later session will
otherwise reproduce it.

**1 · "The sidebar is not showing the collection information."** The council gated
Collection, Size and Availability on whether their values could partition the
catalogue; on ten products that removed Collection entirely. The logic was right
and the outcome was wrong — collections are how this brand organises its range,
and a rail that drops the dimension the shop merchandises by is not a cleaner
rail, it is a rail missing its most interesting column. **The gate is gone. Every
facet with values renders.** If a dimension is weak, that is information about the
catalogue and the shopper may see it.

**2 · "You have reduced the collection showcase — I would like them."** The plate
was gated off on the same predicate. It is back, unconditionally, and larger:
its own band, tiles as `<Link>`s, taglines restored, `--dawn-soft` figures. It
costs ≈400px of first screen and the client has bought it knowingly. **Do not
re-gate it.** The fold argument in P1·2 above is now historical.

**3 · "Sidebar dynamicism needs to be better."** Read as: it should not vanish
things, and it should feel alive. Facets no longer disappear (1), and the
disclosure now animates the content rather than only the chevron — a `1fr/0fr`
grid-row transition, because the chevron was turning over 200ms while the list it
pointed at unmounted in a single frame.

**4 · "It is very thin and a very bad looking thing."** 200px → **280px**, and the
Collection rows now carry the collection: a 40px photograph, the name, the
tagline, the count. That is the one facet on this page with art behind it and it
was being spent on a 15px tick box, which is most of why the column read as
scaffolding. The rail also takes the dawn hairline the masthead and the empty
state use, so a white panel on cream stops reading as a blank rectangle.

**5 · "The horizontal bar is sticky. That is not looking good."** Un-stuck. The
sticky results bar was solving something real — filtering collapses the grid, the
page shortens, and the count and sort scroll away — but a translucent blurred
strip riding over the catalogue is the one gesture that makes a quiet page feel
like app chrome. The collapse is carried by the live region and the chip row,
both attached to the thing that actually changed.

**6 · "Overall background colour is too much creamy."** The palette is settled, so
this was read as an execution problem, and it was an **area** problem: the
catalogue band is the tallest surface on the page by a wide margin and it sat on
`--paper-warm` `#F1E9D7`, the *second* rung — so the largest thing anyone saw was
the beige one. The ladder now runs:

```
masthead    --paper       #F8F5ED   ΔL* 9.4
collections --paper-deep  #E7D9BE   ΔL* 9.4
catalogue   --paper       #F8F5ED   ΔL* 78
CTA         --forest-deep #16290F
```

Every adjacent pair is a real step, the golden-hour rung is spent on the one band
carrying photography — which is what it is for — and the acres of cream become
one deliberate stripe. When there is no plate the catalogue falls back to
`--paper-warm`, because otherwise it would sit on the same ground as the masthead
and break Law 01.

> **The lesson worth keeping.** Five of these six were places where the council
> optimised a measurable quantity — controls on screen, pixels above the fold —
> and lost something the measurement could not see. The gate was defensible on
> every number it was built from and it still made the shop worse. Numbers decide
> between options; they do not decide what the page is for.

---

## Client review — 2026-08-31 (second pass) · the rail's scrolling

Three complaints about the rail, one of which had a cause that is not in the
rail's CSS at all.

**The bug nobody could have found by reading the stylesheet.**
`providers/LenisProvider.tsx` constructs Lenis with no `prevent` option. Lenis
calls `preventDefault()` on wheel events and drives `window.scrollTo` itself —
so a nested `overflow-y-auto` element **never scrolls natively**, and
`overscroll-contain`, which only governs native scroll chaining, was inert. That
is why scrolling the sidebar scrolled the product grid. No amount of CSS on the
rail would have fixed it; the escape hatch is the `data-lenis-prevent` attribute,
which Lenis 1.3.25 checks for in its wheel handler.

**The fix is to not have a second scroll region.** The rail had
`max-h-[calc(100dvh…)]` with its own `overflow-y-auto`, which is what produced
all three complaints: taller than the screen, so the last facets were unreachable
while reading the grid; reachable only by moving the pointer over the rail and
driving a second scroller; and that scroller was hijacked by Lenis.

So the rail no longer scrolls. No max-height, no overflow. Its sticky `top` is
measured instead: when the rail fits, `top` is the nav height plus a gap and it
pins like any sticky column; when it is taller than the viewport, `top` goes
negative, so the rail rides up with the page until its **last** facet sits at the
bottom of the screen and pins there. Scrolling back up releases it and walks back
to the top of the rail, because that is what `position: sticky` does. A
`ResizeObserver` recomputes it when sections open and close.

Size and Availability now open closed — not to hide them, but because the rail's
height is the constraint now that it has no scrollbar of its own. Each costs 44px
closed instead of 80 and 78, and a closed section still prints its active count.

**Measured over CDP, not eyeballed** — a screenshot cannot answer "is the last
facet reachable while reading the grid":

| viewport | rail | computed `top` | rail bottom | inner scrollers | last facet visible at scrollY 1400 |
|---|---|---|---|---|---|
| 1000px | 796px | `72px` | 868 | **none** | yes |
| 800px | 796px | `-12px` | 784 | **none** | yes |
| 650px | 796px | `-162px` | 634 | **none** | yes |

At 800px, scrolled 1400px into the catalogue, all five section headers sit inside
the viewport (Collection 41, Category 279, Price 530, Size 694, Availability 739).
At 650 the rail is 146px taller than the space it has, so its top is off-screen —
that is the only thing that can be true, and it comes back on scroll-up.

`data-lenis-prevent` is still applied to the phone sheet's scroll area, which
genuinely must scroll. Touch is unaffected (Lenis leaves touch native by
default), so that attribute is for the trackpad case: a narrow window on a laptop.

> **Standing note for anyone adding a scrollable region to this site.** Lenis owns
> the wheel globally. Any `overflow-y-auto` you add needs `data-lenis-prevent`, or
> it will silently scroll the page instead of itself — and it will look like a CSS
> bug, because everything about the CSS will be correct.

---

## Client review — 2026-08-31 (third pass) · more columns

"Make it wider to fit more products. More columns."

**A fifth declared measure, not a raw width.** Design Law 04's own justification
already contains this case: *"A four-up product grid and a paragraph cannot share
a width, which is why this is four names and not one number."* The shop is the
grid that sentence was describing, and the number was never declared — which is
why the file had carried `max-w-[1400px]` at four call sites. So
`--measure-catalogue: 1536px` is now a token beside `--measure`, with the
reasoning in `globals.css`. After a 280px rail and its gutter, 1280 leaves 888px
of grid, which is three columns and cannot be four at any card size a garment
photograph survives. 1536 leaves 1048px, which is four.

The masthead, the collections band and the grid take it. **The dark CTA band
stays on `--measure`**, because it sits directly on the footer and a 128px step
between two adjacent dark bands' content edges is precisely the misalignment Law
04 exists to prevent. The one width change on the page happens where the ground
changes too, so it reads as a change of register.

The card minimum went 240 → 220px so four-up starts at a laptop width rather
than a desktop one.

**And a defect the measurements found.** At 1024 the page showed **two** columns
while 900 showed three — widening the window LOST a column, cards jumping 257 →
304 while the shopper saw fewer of them. Cause: the rail appeared at `lg` and
took 312px of a 944px band. At that width you can have a 280px rail or three
columns and not both; it is arithmetic. **The rail now appears at `xl` (1280).**
Below it the sheet carries the same rail, which is this file's own principle —
the smaller screen gets the same instrument, not a weaker one.

Measured over CDP with real device metrics at every width, after a rebuild:

| viewport | columns | card | rail | band |
|---|---|---|---|---|
| 1920 / 1680 / 1600 | **4** | 268px | 280 | 1536 |
| 1512 | **4** | 262px | 280 | 1512 |
| 1440 | **4** | 244px | 280 | 1440 |
| 1366 | **4** | 226px | 280 | 1366 |
| 1300 | 3 | 287px | 280 | 1300 |
| 1280 | 3 | 280px | 280 | 1280 |
| 1180 | 4 | 257px | — | 1180 |
| 1024 | 3 | 299px | — | 1024 |
| 900 | 3 | 257px | — | 900 |
| 768 | 2 | 332px | — | 768 |
| 430 / 390 / 375 | 2 | 183 / 163 / 156px | — | — |

`document.scrollWidth > clientWidth` was **false at every width**, 375 included —
so the horizontal overflow the earlier screenshots appeared to show was, as
suspected, the screenshot harness and not the page. That caveat is withdrawn.

One residual dip remains at exactly 1280, where the rail arrives and the grid
goes 4 → 3 while cards grow 257 → 280. It cannot be removed while a 280px rail
appears at that width, it is only visible while resizing, and both sides of it
are good pages.

### Method note

Headless Chrome's `--window-size` does not give a real narrow viewport on macOS —
it enforces a minimum window width and crops, which is what made an earlier pass
report a mobile overflow that does not exist. Driving CDP instead
(`--remote-debugging-port`, then `Emulation.setDeviceMetricsOverride` from Node,
which has a global `WebSocket` and needs nothing installed) gives true numbers at
any width and can read computed grid tracks and scroll positions, which a
screenshot cannot. The probes are in the session scratchpad. Re-run any row that
returns nulls — the first measurement after a metrics override flakes
occasionally, and it did twice here.

---

## Killed — do not re-propose

| Idea | Why |
|---|---|
| An editorial cell inside the product grid | No rule forbids it, and the craft was good. It spends a product slot on a first screen that currently shows no complete product, breaks the grid's contract (every other cell goes somewhere), and makes the dark band's argument 600px before the band makes it. The client's pattern on designer-authored non-merchandise objects is consistent and negative. |
| Deleting the "Made yours" eyebrow to make the band a statement | It is the page's **only** `--dawn` — `text-dawn` × 1, `bg-dawn*` × 0 in the served HTML — while two lenses filed the absence of warmth as a defect. Rename it; do not delete it. |
| Size chips revealed inside the hover window | Reuses and enlarges the exact window three lenses are deleting, and the window is inert below `md` — so the chips would not exist on the device most people shop on. The chips ship; they ship **permanent**. |
| Colour swatches on the card, and a colour facet | The three hexes are the *customiser's* palette, not stock colourways. Different thing. |
| Hiding the Size facet when its counts are equal | A heuristic that flickers as the catalogue grows. **And gating facets at all was overturned by the client on 2026-08-31 — see the client review.** |
| A search box | Ten products. The real navigation defect is three nav links that land on an empty shelf. |
| Deleting the rail, or `lib/shop-filter.ts` | The best-factored code on the page. Keep all of it — and, since 2026-08-31, render all of it. |
| A portrait collections plate | `aspect-[16/10]` was chosen deliberately to stop the plate eating a screen. Still correct — the plate is back and bigger, but not taller. |
| Adopting `PageHeader.tsx` | Would import a live breach of hard constraint 2 onto an eighth page. |

**And one correction to this council's own reasoning.** The card's tilt is deleted —
but *not* because the client rejected a pointer-reactive headline. That rejection is
eight words about letterforms in a poster; reading it as a species-wide ban is
over-extension, and a council that governs by inferred precedent will eventually
delete something the client liked and tell them they asked for it. The tilt goes on
grounds that need no precedent: it does not respect reduced motion, and the card's own
comment argues the distortion case in full and then stops at 4° instead of 0.

---

## Open questions for the client

1. **The masthead's words.** The h1 is "The DEWDROPZ Collection." — a noun phrase that
   names the company, on a page whose sibling in the nav is called Collections. Every
   other display heading on the site is a sentence with a claim. Rewriting it to name
   the goods was rejected **for the hero**, and the record explicitly said "if the
   frame is to name the goods, it must be somewhere other than this sentence." This may
   be that somewhere — but any line must match the catalogue on ship day, and the
   drafted one names drinkware, of which the shop stocks zero.
2. **"Fast dispatch across India"** is set in the figures typeface, in a row with two
   real figures, and is character-for-character the footer of the same page. Keep,
   qualify with a real number, or drop?
3. **Which products lead the shop.** "Featured" is the identity function over
   `created_at desc`, and `?sort=newest` returns a byte-identical list — so the menu
   offers four choices of which three are distinct. The code fix is three lines; you
   pick the four or five products.
4. **Three nav links land on an empty shelf** (drinkware, mugs, tumblers) and
   Equipment — 6 of 10 products, ₹2,200 to ₹16,000 — has no nav entry at all.
5. **How a multi-variant card sells:** size chips on the card, or "Choose a size"
   through to the PDP? The stock bug is fixed either way.
6. **Facets that cannot partition** — hide until useful? This changes what you see in
   your own store.
7. **Route `/shop` dynamic** to get the grid into the HTML, at the cost of the
   CDN-cached document?
8. **The Garhwal Ridgeline Tee has no size variants** — 25 units on the product
   row, no S/M/L behind it. It is the shop's only ready-made garment, and any
   size filter will correctly exclude it until it has them. Add its variants in
   admin, or confirm it really is one-size.

---

## Corrections to the record

- `WEB-POLISH.md` §2.5 — counts were specified as `text-mid`, shipped as `text-light`
  (3.17:1), and the item is recorded closed.
- `WEB-POLISH.md` §2 / Appendix E — the shallow plate did not fix the fold; the
  masthead was never touched. Appendix E also implies a colour dimension shipped. It
  did not.
- `WEB-POLISH.md` Appendix C says 29 shop-filter tests; `ShopContent.tsx:33` says 37.
  It is 29.
- Design Law 03 says the `opsz` axis is "never driven". `font-optical-sizing` defaults
  to `auto`, so it already is — driven by font size. Overriding it above 48px is an
  art-direction choice, not the bug-fix the law frames it as. (Axis range verified by
  parsing the shipped WOFF2: opsz 9–144.)
- `globals.css:74` says the storefront never references the Trek Buddy placeholder
  tokens. `ShopContent.tsx:303` and `:330` reference `--sage-soft`. The comment is
  now false.
