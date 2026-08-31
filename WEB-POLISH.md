# DEWDROPZ — Web Polish & Layout Programme

**Date:** 29 August 2026
**Scope:** Web only — every route under `app/` except `app/api`. Admin is included but ranked last. Mobile (`mobile/`) and `trekbuddy-game` are out of scope by request.
**Method:** Read of all 52 storefront routes and 104 non-`ui` components, plus a mechanical sweep for four measurable signals — radius-token compliance, `bg-surface` use, `bg-paper`-as-card-fill, and shadow-ladder use. The counts in this document are reproducible; the commands are in Appendix A.
**Palette decision:** the cream/forest system **stays**. See §1.

---

## Executive summary

The site does not have a colour problem. It has a **depth** problem, and the two look identical from the outside.

`app/globals.css` defines a complete, carefully-reasoned design system: a three-step paper ladder (`--paper` → `--paper-warm` → `--paper-deep`), a lifted white card surface (`--surface`), a seven-rung radius ladder (`--r-bar` … `--r-shell`), a four-rung elevation ladder (`--shadow-card` … `--shadow-float`), and a warm accent (`--dawn`) explicitly introduced because the brand "read as tasteful but cold". Roughly 90 lines of comments in that file explain why each rung exists.

Almost none of it is used.

| Signal | Count | What it means |
| --- | --- | --- |
| Files using the **shadow ladder** | **3** of 104 | Nothing on the site is lifted off the page. |
| Uses of `bg-surface` (the lifted white card) | 53 — **all but 6 inside `components/trek/`** | The storefront has no card surface. |
| `bg-paper` used as a **card fill on a paper ground** | **75** | Cards are the same colour as the thing behind them. |
| Off-ladder radii (`rounded-sm/md/lg/xl`) | **≈240** | The enclosure hierarchy is flat. |

That is the whole diagnosis. When a card is `#F8F5ED` on a `#F8F5ED` ground, separated only by a 1px `--rule` hairline and a 2px corner, it does not read as an object — it reads as a boxed-off region of the same sheet. Stack six of those and you get exactly the complaint: **bland, flat, sad**. The cream is not doing that. The *absence of a second plane* is doing that.

**So the fix is hierarchy, not hue.** No new brand colours, no rainbow. The palette already contains everything needed to build depth — it simply has never been spent.

### The one exception, and the proof

`components/trek/*` — Trek Buddy — is on the system. 65 on-ladder radii against 1 off. It uses `bg-surface`, it uses `--r-panel` and `--r-shell`, it scopes its own token overrides via `.trek-scope`. Trek Buddy is the reference implementation, and it demonstrates that this palette produces a rich, layered, mature interface when the ladder is actually climbed.

**The programme below is, in one sentence: bring the other 80% of the site up to the standard Trek Buddy already meets.**

### Scorecard

| Area | Now | Target | Tier |
| --- | --- | --- | --- |
| Trek Buddy | 8.5 / 10 | 9 | 3 |
| Homepage / storefront sections | 7.5 / 10 | 9 | 2 |
| Product detail | 7 / 10 | 9 | 2 |
| **Shop + filtering** | **4 / 10** | 9 | **1** |
| Checkout / cart | 5.5 / 10 | 8.5 | 2 |
| Studio (customizer) | 7.5 / 10 * | 8.5 | 2 |
| **Account suite** | **2.5 / 10** | 9 | **1** |
| Rent | 5 / 10 | 8 | 3 |
| Editorial (about/journal/legal) | 6 / 10 | 8 | 3 |
| Admin | 4 / 10 | 7.5 | 4 |

\* Revised up after reading the code rather than the grep output — see §4.

---

## 1. The palette decision — settled, and why

The instruction was that the off-white cream reads sad. The finding is that **cream is never the top layer of a well-built screen in this system** — it is the *ground*. What was missing is everything meant to sit on top of it.

The rule from here:

> **Cream is floor, not furniture.** A card is never `bg-paper`. A card is `bg-surface` (white) with `--shadow-card` and `--r-card`. The ground steps `paper → paper-warm → paper-deep` to mark a change of subject. Dark anchors (`--forest-deep`, `--altitude`) break long scrolls. `--dawn` is the single accent and stays rare.

This preserves the brand exactly as authored while removing the flatness that reads as blandness. It is a refinement of execution, not a re-pitch of the palette.

### The ladders, restated as law

| Ladder | Rungs | Rule |
| --- | --- | --- |
| **Ground** | `paper` `paper-warm` `paper-deep` | Changes only when the *subject* changes. Never twice in one section. |
| **Surface** | `surface` (#FFF) | Every card, row, panel, popover. The only legal card fill. |
| **Anchor** | `forest-deep` `altitude` `ink` | Full-bleed bands that break a scroll. At least one per long page. |
| **Radius** | `r-bar` 2 · `r-stamp` 3 · `r-tag` 4 · `r-input` 6 · `r-card` 8 · `r-panel` 10 · `r-shell` 14 | Monotonic with surface size. `rounded-sm/md/lg/xl` are **banned** outside `components/ui/`. |
| **Elevation** | `shadow-card` `shadow-lift` `shadow-panel` `shadow-float` | A card at rest takes `shadow-card`; on hover it rises to `shadow-lift`. |
| **Accent** | `dawn` `dawn-soft` `ember` | Rare. Reserved for the moment something arrives — a confirmation, a live state, a single CTA per page. |

---

## 2. The shop filter — a teardown

`components/sections/ShopContent.tsx` (443 lines). The file's own header comment argues, correctly, that the 280px radio sidebar it replaced was worse. It then built something with a different set of problems. Nine of them are real:

**2.1 — Every filter dimension is crammed into one horizontally-scrolling strip.**
Categories (grouped, with headings) and price bands share a single `overflow-x-auto` rail. On desktop this scrolls *while 1280px of page width sits unused* — horizontal scroll on a wide viewport is an anti-pattern with no upside. On a phone the price bands render **after** every category chip, which puts them past the right edge behind a drag. This is precisely the bug the file's own comment claims to have fixed for the sort control — it was fixed for sort and left in place for price.

**2.2 — Filter state never reaches the URL.** Verified: `ShopContent` imports `useSearchParams` and reads `?category=` / `?collection=` on mount, but there is **no `useRouter`, no `history.replaceState`, nothing**. Consequently a filtered shop cannot be shared, cannot be bookmarked, and the browser back button does not undo a filter. Navigating to a product and returning resets the entire selection. For a commerce surface this is a functional defect, not a polish item.

**2.3 — Single-select only.** `setCategory(category === c.slug ? 'all' : c.slug)` is a radio dressed as a chip. "T-Shirts **and** Hoodies" is not expressible. Chips look multi-select; behaving otherwise is a false affordance.

**2.4 — Department headings are inside the scroll rail.** "Apparel" and "Drinkware" are `<span>`s sitting between chip groups in the scrolling strip, so the heading for a group is off-screen exactly when you have scrolled to that group. A label that is invisible whenever it is relevant is not a label.

**2.5 — Counts are set at `opacity-50`.** The product count is the single most useful thing on a filter chip — it is what stops you selecting an empty result — and it is rendered as decoration. It also fails contrast at 11px.

**2.6 — Collections are a filter wearing a different costume.** The photographic collection grid *is* a filter dimension (it sets `collection`), but it lives above the bar, looks nothing like the other controls, and its active state never appears in the control bar. Selecting a collection produces a chip in the "active" row that has no visual relationship to the tile you clicked.

**2.7 — No size or colour filter.** `product_variants` and `customization_config.colors` both exist in `types/database.ts`. The two things people actually filter apparel by are the two things unavailable.

**2.8 — A native `<select>` for sort.** One raw OS dropdown in a page built entirely from custom chips. It cannot be styled to match, and it renders differently on every platform.

**2.9 — Generic empty state.** `rounded-sm border-dashed` with one grey line. The one screen guaranteed to be seen by a frustrated user gets the least design.

### What it becomes

A **two-tier control**, replacing the single scrolling strip:

```
┌──────────────────────────────────────────────────────────────────────┐
│  ▸ All Products      Apparel ▾   Price ▾   Size ▾   Colour ▾    ⇅ Sort │  ← tier 1: sticky, never scrolls
├──────────────────────────────────────────────────────────────────────┤
│  T-Shirts (12) ·  Hoodies (8) ·  Sweatshirts (4)                      │  ← tier 2: expands on demand
└──────────────────────────────────────────────────────────────────────┘
   Showing 24 pieces   [ Hoodies ✕ ] [ Under ₹1,500 ✕ ]        Clear all
```

- **Tier 1 is a row of dimension buttons**, not values. It fits any viewport at any catalogue size, because it grows with the number of *dimensions* (5, fixed) rather than the number of *values* (unbounded). This is the structural fix for 2.1.
- **Tier 2 is a disclosure panel** on `bg-surface` with `--shadow-panel`, opening under the pressed dimension. Department headings become real headings in a panel that holds still (2.4). Counts move to full-contrast `text-mid` (2.5).

> **CORRECTION — 2026-08-30, shop council.** The counts did **not** move to `text-mid`. The rebuild took them off `opacity-50` and put them on `text-light`, which measures **3.17:1** on `--surface` — still under AA, at 10px, on the number this document calls "the single most useful thing on a filter chip". This item was recorded as closed for a fix that never landed. It has now shipped, along with a raise of the `--light` token itself (`#94917F` → `#6C6A5D`), because the same token was carrying 42 text sites across 24 files. See `design/15-shop.md`.
- **Multi-select within a dimension, AND across dimensions** (2.3). Chips get checkbox semantics and `aria-pressed`.
- **Every change writes to the URL** via `router.replace(..., { scroll: false })` (2.2). Shareable, bookmarkable, back-button-correct.
- **Collections gain a dimension button** so the photographic grid and the bar agree on state (2.6), while the grid itself stays — it earns its place as the one control that can sell.
- **Size and colour dimensions** derived from live variant data, hidden when a catalogue has none (2.7), matching the file's existing and correct principle that a control never promises a result it cannot deliver.
- **Sort becomes a popover** matching the chip language (2.8).
- **The empty state gets designed** (2.9): what was searched, which filter is the likely culprit, one-tap removal of the narrowest one.

Filtering itself moves out of the component into `lib/shop-filter.ts` as a pure function, so it becomes unit-testable under the existing `npm test`.

---

## 3. The account suite — a teardown

Seven pages, ~1,140 lines. **21 off-ladder radii, 0 on-ladder. 0 uses of `bg-surface`. 0 shadows.** It is the least-finished area of the site and the one the instruction named first.

**3.1 — Cards are invisible.** `app/account/page.tsx:24`, `addresses:122`, `designs:29`, `orders/[id]:93` all render `border border-rule rounded-sm bg-paper` — a paper card on a paper ground. This is the site-wide root cause at its most concentrated.

**3.2 — `rounded-sm` throughout.** 2px corners on 600px-wide panels. The radius ladder puts a panel at 10px; nothing here is on the ladder at all.

**3.3 — The sidebar is seven undifferentiated text links.** No active state — you cannot tell which page you are on. No icons, no grouping, no counts. A nav that does not indicate position is failing its only job.

**3.4 — Off-system colour.** `text-amber-600` (`layout.tsx:36`), `bg-red-600`/`bg-red-700` (`addresses:208`, `CancelOrderButton:61`). Raw Tailwind palette values in a site with a defined semantic palette. `--clay-deep` and `--dawn` exist for exactly these.

**3.5 — Status is colour-only.** Order status renders as bare coloured text (`text-forest` / `text-clay` / `text-sage`). Encoding meaning in hue alone fails WCAG 1.4.1, and sage-vs-forest is not a distinction most people will make at 12px.

**3.6 — The order number sits in a `bg-rule` pill.** `--rule` is a hairline token — a border colour used as a fill. It reads as grey mud.

**3.7 — The overview page has no content.** The signed-in landing screen is a three-cell box reading Name / Email / Orders Placed. The user already knows their name and email. There is no next action, no imagery, no in-flight order, no reorder path.

**3.8 — A 72px headline over 12px grey text.** `Your Gear` at `clamp(40px,6vw,72px)` sits above a page whose every other element is 12–14px. Two extremes and no middle register is most of why the page reads as empty.

**3.9 — Pagination is two text arrows** (`orders:81-86`).

### What it becomes

- **An account shell with a real rail**: `bg-surface` panel, `--r-panel`, `--shadow-card`, icons from `lucide-react` (already a dependency), an active state driven by `usePathname`, live counts on Orders / Designs / Rentals, and the admin link demoted to a properly-tokenised footer entry rather than raw amber.
- **A dashboard worth landing on**: the most recent in-flight order rendered as a real card with its thumbnail, status track and delivery estimate; a reorder action; saved designs as a visual row; wishlist crossover. Facts the user already knows drop to a quiet identity strip.
- **A shared status system** — one `<StatusBadge>` carrying shape + label + colour (fixing 3.5), on `--r-tag`, reused by account, admin and the order-tracking pages, which today each re-implement it.
- **Every card on `bg-surface` + `--shadow-card` + `--r-card`**, hover to `--shadow-lift`. This alone resolves 3.1, 3.2 and most of 3.8.
- **A typographic middle register** — an 18–24px display step between the masthead and the body text, so the page has three levels instead of two.
- **Real pagination** on the chip language, with counts.

---

## 4. The Studio

**Correction to the first draft of this audit.** The initial pass ranked the Studio 5.5/10 on grep signals alone — no `bg-surface`, no shadow tokens, 28 ad-hoc radii — and concluded it was "styled as a utility" with "no dark option". Reading it properly shows the opposite: `components/customize/` runs on its own scoped token set (`.studio` in `app/globals.css`), and that set is the most carefully reasoned in the codebase.

It is a dark, **achromatic** system, and the comment above it explains exactly why: the rest of the site is green, which is right for a brand about mountains and wrong for the one screen whose whole job is to judge colour. A green cast next to the garment "quietly lies about both — a warm print looks warmer against it, a grey marl looks green." Selection carries no hue either; it is signalled by luminance and an edge, so the tool never spends a colour it may need to show you honestly. `--st-ink-3` even carries a note about being raised from 0.44 to 0.60 opacity because the former measured 3.94:1, under AA.

That is a better-argued piece of design thinking than a compliance sweep would have produced, and none of it should be touched. It also means the site's storefront tokens are the wrong yardstick here — the Studio's use of `--st-*` instead of `bg-surface` is correct, not debt.

**What was actually wrong:** the radii. 22 × `rounded-sm`, 3 × `rounded-md`, 3 × `rounded-lg` — Tailwind defaults, so a colour swatch, a tool button and the canvas frame all enclosed at roughly the same value and read as one class of object.

**Done:** mapped onto the ladder by enclosure size — small controls, chips and swatch wells to `r-input`; the canvas frame and picker panels to `r-panel`. 28 → 0. The scope, the palette and the layout are unchanged.

---

## 5. The two-design-languages problem

There are effectively two DEWDROPZ front-ends in this repo:

| | `components/trek/` | Everything else |
| --- | --- | --- |
| Radius | 65 on-ladder / 1 off | ~15 on-ladder / ~240 off |
| Card fill | `bg-surface` | `bg-paper` (75×) |
| Elevation | used | 3 files total |
| Verdict | **reference implementation** | **pre-system** |

Trek Buddy went through a documented overhaul (`TREKBUDDY-OVERHAUL.md`, `TREKBUDDY-REMEDIATION.md`) and came out on the system. The storefront never had that pass. This programme is that pass.

The eventual guard is an ESLint rule banning `rounded-(sm|md|lg|xl)` and `bg-paper` in a `border` context outside `components/ui/` — cheap to add once the migration is done, and it stops the debt returning.

---

## 6. Route ledger

Every web route, with its verdict and tier. `off` = off-ladder radii, `sh` = shadow-ladder uses. A route whose page file is thin carries its debt in the component named beside it.

### Tier 1 — named in the brief, worst measured state

| Route | Carries | off / sh | Verdict |
| --- | --- | --- | --- |
| `/shop` | `ShopContent` 443 | 5 / 0 | Filter rebuilt per §2. Grid, empty state, sticky bar. |
| `/account` | — 108 | 4 / 0 | Dashboard rebuilt per §3.7. |
| `/account/orders` | — 91 | 3 / 0 | Rows → surface cards, status badge, real pagination. |
| `/account/orders/[id]` | — 332 | 6 / 0 | Largest account page; needs a status track, not a text line. |
| `/account/addresses` | — 216 | 3 / 0 | Cards, and `bg-red-600` → `--clay-deep`. |
| `/account/designs` | — 67 | 2 / 0 | Visual grid; it holds artwork and shows it in a bordered box. |
| `/account/rentals` | — 134 | 2 / 0 | Same card treatment; date-range needs a real component. |
| `/account/settings` | — 192 | 1 / 0 | Form sections → panels; field styling to `--r-input`. |
| `/account` layout | — 53 | 0 / 0 | The shell + rail per §3. Do this **first** — it reframes all seven. |

### Tier 2 — high-traffic commerce and the Studio

| Route | Carries | off / sh | Verdict |
| --- | --- | --- | --- |
| `/products/[slug]` | `ProductDetail` 746 | 19 / 0 | Highest single off-ladder count. Gallery, variant picker, accordions. |
| `/products/[slug]/customize` | `CustomizerStudio` 516 + `Toolbar` 674 | 34 / 0 | Per §4. |
| `/checkout` | `CheckoutClient` 550 | 14 / 0 | Step rhythm, summary panel, field system. |
| `/cart` | `CartView` 278 | 9 / 0 | Line rows → surface; totals panel. |
| `/` | `SummitHero` 1717 + 12 sections | 16 / 0 | Craft is high; needs ladder compliance, not redesign. |
| `/customize` | — 123 | 0 / 0 | Blank-picker grid; card treatment. |
| `/collections`, `/collections/[slug]` | + `CollectionHero` | 1 / 0 | Close to right already; ground-step and card pass. |
| `/wishlist` | `WishlistView` 167 | 3 / 0 | Shares the shop grid work. |
| `/checkout/success/[orderId]` | — 197 | 3 / 0 | The one place `--dawn` is unarguably correct. |
| `/auth/*` | `AuthShell` 154 | 3 / 0 | Recently reworked; light pass only. |

### Tier 3 — Trek Buddy hardening, rent, editorial

| Route | off / sh | Verdict |
| --- | --- | --- |
| `/trek-buddy/*` (15 routes) | ~1 / 1 | Already on the system. Consistency sweep only; do not redesign. |
| `/rent`, `/rent/[slug]`, `/rent/lookup`, `/rent/booked/[number]` | 1 / 0 | `RentBooking` uses `bg-paper` 6×. Card + panel pass. |
| `/rent/terms` | 5 / 0 | Legal layout — needs the editorial treatment below. |
| `/journal`, `/journal/[slug]` | 2 / 0 | Index cards + article measure/rhythm. |
| `/about`, `/sustainability`, `/contact`, `/privacy` | ≤1 / 0 | Editorial system: measure, ground-steps, one anchor band each. |
| `/treks`, `/e/[token]`, `/w/[token]`, `/pay/[orderId]`, `/cart/recover/[token]` | ~0 / 1 | Transactional; low traffic, correctness over craft. |

### Tier 4 — Admin

23 routes. `components/admin/*` shows 27 off-ladder radii and leans on the shadcn token block rather than the brand system — which is defensible for an internal tool. Ranked last deliberately: it is staff-facing, and `ADMIN-AUDIT.md` already covers its functional gaps. Scope here is limited to the shared `StatCard`, `Sidebar` and table rhythm.

---

## 7. The build rules

Every page touched by this programme must satisfy all nine. This is the checklist to review against.

1. **No `bg-paper` card.** A card is `bg-surface`. If it has a border and content, it is a card.
2. **No off-ladder radius.** the `--r-` ladder only (`r-tag`, `r-input`, `r-card`, `r-panel`, `r-shell`), outside `components/ui/`.
3. **Elevation, always.** Card at rest `--shadow-card`; interactive card hover `--shadow-lift`; overlay/popover `--shadow-panel`; modal `--shadow-float`.
4. **One ground step per subject change.** A page that never leaves `--paper` for 2,000px is a page that reads as a slab.
5. **One dark anchor per long page.** `--forest-deep` or `--altitude`, full-bleed. `/shop` already does this correctly at its foot — that band is the model.
6. **Three type registers minimum.** Display, a 18–24px middle, body. Never display-then-12px.
7. **No raw Tailwind palette colours.** Semantic tokens only. Destructive is `--clay-deep`, not `red-600`.
8. **Status is never colour-alone.** Shape or label carries it too.
9. **Every interactive state exists.** rest / hover / focus-visible / active / disabled / loading / empty / error. Empty and error states get designed, not defaulted.

---

## 8. Execution order

Sequenced so the highest-leverage shared pieces land before the pages that consume them.

| # | Step | Why here |
| --- | --- | --- |
| 0 | `components/ui/` primitives: `Surface`, `StatusBadge`, `Panel`, `FilterChip`, `EmptyState` | Every later step consumes these. Build once. |
| 1 | Account shell + rail (`app/account/layout.tsx`) | Reframes all seven account pages at once. |
| 2 | Account pages ×7 | The area named first in the brief. |
| 3 | Shop filter rebuild + `lib/shop-filter.ts` + tests | The other area named first. Highest functional payoff (§2.2). |
| 4 | `ProductCard` + grid | Shared by shop, wishlist, collections, search. |
| 5 | Product detail | Highest off-ladder count on the site. |
| 6 | Cart → checkout → success | One continuous flow; do it as one. |
| 7 | Studio | Most differentiated surface, largest component. |
| 8 | Homepage section sweep | Craft already high; compliance pass. |
| 9 | Rent, editorial, transactional | Long tail. |
| 10 | Trek Buddy consistency sweep | Already good; verify only. |
| 11 | ESLint guard | Locks the work in. |
| 12 | Admin | Staff-facing, last. |

**Verification per step:** `npx tsc --noEmit` and `npm run lint` clean, plus a Chrome DevTools pass at 390 / 768 / 1440 in both a signed-in and signed-out state. Per `MEMORY.md`, the Browser pane must be visible or screenshots return blank and `innerWidth` reads 0.

---

## Appendix A — reproducing the counts

```bash
# off-ladder vs on-ladder radii, per file
grep -o "rounded-\(sm\|md\|lg\|xl\)" FILE | wc -l
grep -o "rounded-\[var(--r-"       FILE | wc -l

# the flat-on-flat smell, site-wide
grep -rn "border.*bg-paper\b\|bg-paper\b.*border" app components --include="*.tsx" | wc -l   # 75

# files that use the elevation ladder at all
grep -rlo "shadow-\(card\|lift\|panel\|float\)" app components --include="*.tsx"             # 3

# off-system palette colours
grep -rno "\(text\|bg\)-\(amber\|red\|blue\|green\|gray\|slate\|zinc\|neutral\|stone\)-[0-9]\{3\}" app components
```

## Appendix B — status

**All twelve steps complete, plus a second round on the shop filter and collections index (Appendix E).** `npx tsc --noEmit` clean · `npm run build` succeeds (99 static pages) · `npm test` 83 pass / 0 fail · 0 design-system lint violations.

- [x] 0 · primitives — `Surface`, `Panel`, `PanelHeader`, `StatusBadge`, `EmptyState`, `FilterChip`
- [x] 1 · account shell — dark anchor header, real rail with active state + counts
- [x] 2 · account pages ×7 — 21 off-ladder radii → 0
- [x] 3 · shop filter — **left rail** (`FilterSidebar`), `lib/shop-filter.ts`, 29 tests — see Appendix E
- [x] 4 · product card + grid
- [x] 5 · product detail — 19 off-ladder → 0, ground steps added
- [x] 6 · cart → checkout → success
- [x] 7 · studio — 28 off-ladder → 0 (scope left untouched, see §4)
- [x] 8 · homepage + sections sweep — 36 → 0 across 19 files
- [x] 9 · rent + editorial + long tail
- [x] 10 · trek buddy sweep — 8 invisible form fields fixed
- [x] 11 · eslint guard — 4 rules, verified against a probe
- [x] 12 · admin — StatCard shadow + skeleton shape

---

## Appendix E — round two: the left rail and the collections index

Two things came back from review, and both were right.

### The shop: a left rail, not a top bar

The two-tier disclosure bar solved the original defects (horizontal scroll, off-screen price bands, single-select, no URL state) but kept every facet's *values* behind a press. With five dimensions that is four things hidden at any moment. **The rail is the better instrument and is now what ships** — `components/shop/FilterSidebar.tsx`.

- **Everything visible at once.** Category (departments with their children indented), Collection, Price, Size, Availability — all open, all counted, no disclosure between the shopper and the choice.
- **Live facet counts** on every value, from `facetCount()` — the number a value *would* return with the other dimensions still applied. Zero-count options grey out and stop responding rather than disappearing, so the rail does not reflow under the pointer.
- **Sizes are a swatch grid**, not a checkbox list: four to a row, the control every apparel shop already uses.
- **The same rail on a phone**, in a sheet with a "Show N results" footer — not a reduced control. Body scroll locks, Escape closes.
- **Collections became a wide 16:10 plate.** The portrait tiles pushed the actual catalogue a full screen down the page.

The filtering logic did not change: `lib/shop-filter.ts` and its tests carried over untouched, which is the whole point of having split it out.

> **CORRECTION — 2026-08-30, shop council.** Two things here are stale.
>
> **The shallow plate did not fix the fold.** The claim above (§"The shop: a left rail") is that the portrait tiles were what "pushed the actual catalogue a full screen down the page". The plate got shorter and the masthead above it was never touched, so at 1440×900 the first product photograph still began at **≈760px** — 140px of a 430px image visible, with no name, no price and no add-to-cart above the fold. The plate is now gated on whether the collection dimension can actually partition the catalogue; on the current data it does not render and the grid starts at ≈485px.
>
> **A colour dimension did not ship.** §2.7 promised "size and colour dimensions derived from live variant data" and Appendix E reads as though both landed. Size shipped; colour did not — and the three hexes in `customization_config` are the customiser's palette, not stock colourways, so it should not ship from that source.
>
> **And the filtering logic was not defect-free.** `matches()` excluded any product with no variants from a size filter, so `/shop?size=L` removed `garhwal-ridgeline-tee` — a stocked, ready-made tee — from an apparel shop. Twenty lines above it, `inStock()` reasons the opposite way about the identical absence of variant data, and says why in a comment. Fixed, with two tests.

**One bug this surfaced.** The rail rendered `APPAREL` as a heading *and* `Apparel` as a loose checkbox below it — two controls with the same name. Cause: the live catalogue assigns products directly to departments as well as to their children, and `groupCategories()` dropped a stocked parent into the ungrouped bucket. It now attaches to its own group as `self` and renders as the group's head row, with its children indented under a rule. Fixed in the tested module, with a test that pins it.

### The collections index

`h-[70vh] min-h-[440px]` in a rigid three-column grid — at 1280px, a card about 400px wide and 1440px tall. A **1:3.6 skyscraper**: every photograph cropped to a vertical sliver, 85% of each card dead image, and the name, tagline and link crushed into the bottom 15%. Three of them side by side with no rhythm and nothing separating one from the next.

Rebuilt as an index: the first collection leads at 16:10 with its copy on a white surface beside it — where the description, which the old layout never showed at all, is actually readable — and the rest follow at 4:5 on a `--paper-warm` band, a proportion a photograph of a mountain survives.

---

## Appendix D — verification

Screenshots were taken with a separate headless Chrome (the DevTools MCP browser was held by another process; the user's instance was left untouched).

Confirmed visually at 1200–1440px: the two-tier filter bar fits with no horizontal scroll and the sort control holds its seat; sort genuinely reorders (`price-asc` → ₹899, ₹1,199, ₹1,599); the product page's ground step to `--paper-warm` reads clearly at the "You might also like" boundary; the no-image card carries the contour motif.

**One trap worth recording.** Screenshots at `--window-size=390` appeared to show every page clipping on the right — including pages this programme never touched. A probe page reporting its own `innerWidth` showed the cause: **headless Chrome clamps the layout viewport to a 500px minimum** and then crops the image to the requested width. The "overflow" was entirely an artifact. At a true 500px viewport nothing clips. Phone-width layout cannot be verified this way at all; use a real browser with device emulation.

---

## Appendix C — what actually changed

| Signal | Before | After |
| --- | --- | --- |
| Files using the elevation ladder | 3 | 18 |
| `bg-surface` uses | 53 (47 in `trek/`) | 94 |
| Off-ladder radii — `app/` (excl. admin) | ~120 | **0** |
| Off-ladder radii — `components/` (excl. ui, admin) | ~120 | **0** |
| Bare `rounded` (Tailwind's 4px default) | 17 | **0** |
| Undefined colour tokens (`sand`, `rust`) | 17 | **0** |
| Raw Tailwind palette in account | 5 | **0** |
| Invisible form fields (`bg-paper` on paper) | 16 | **0** |
| Shop filter tests | 0 | **29** | <!-- 2026-08-30: now 34. ShopContent's header comment said 37 and was wrong at the time it was written; it said 29 in this table and 37 in the code. -->
| Design-system lint rules | 0 | **4** |

### Bugs found and fixed along the way

These were not on the plan; they surfaced while doing the work.

1. **`sand` and `rust` were never theme tokens.** Used 17 times across the rent feature. In Tailwind v4 an undefined colour name compiles to nothing, so `bg-rust` + `text-paper` on the rental cancel-confirmation button rendered **cream text on a transparent background** — an unreadable button on a destructive action. Two rental status pills also had no background at all. Mapped to `paper-deep` / `clay-deep`.

2. **Shop filters never reached the URL.** `ShopContent` read `?category=` on mount and had no `useRouter` at all, so no filtered view was shareable or bookmarkable, back did not undo a filter, and opening a product and returning discarded the whole selection. The URL is now the single source of truth — there is no local copy to fall out of step.

3. **Sixteen form fields were invisible.** Inputs across checkout, rent, Trek Buddy and the plan console were filled `bg-paper` on a `bg-paper` page: no visible field until focused.

4. **Order status was encoded in colour alone** (`text-forest` / `text-sage` / `text-clay`), failing WCAG 1.4.1 — and `sage` against `forest` at 12px is a distinction almost nobody makes. `StatusBadge` carries dot-shape, label and colour, so any two of the three suffice.

5. **`--clay` was carrying small text at 3.26:1**, under AA, on the product page discount label, low-stock warning and checkout errors. Moved to `--clay-deep` (5.79:1), which the palette had already defined for exactly this.

6. **Product cards with no photograph rendered as holes.** The grid drew a bare cream rectangle where the image would be — on a four-column row that reads as a broken layout rather than a pending one, and on the product page's related row it left a whole empty column. It now carries the brand's topographic motif on `--paper-deep` with the piece's initial in the display face, so a product awaiting its picture still looks like one.

7. **Tailwind v4 scans `.md` and `.mjs`.** Twice during this work a class-shaped string — first in this document, then in an ESLint rule message — generated invalid CSS and 500'd every route with an error pointing at `globals.css`. Noted here because it will happen again: never write a bracketed arbitrary-value class containing `*` or `|` outside real markup.
