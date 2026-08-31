# The navigation — Action Plan

*Section 14 of the homepage. Written against `components/layout/NavBar.tsx` (853 lines), `components/Logo.tsx`, `components/ui/dropdown-menu.tsx`, `providers/CartProvider.tsx`, `providers/WishlistProvider.tsx`, `actions/products.ts`, `app/page.tsx`, `app/globals.css` on branch `mobile-remediation`. Every line number and every migration citation below was verified against the working tree. Contrast figures are computed with the WCAG 2.x relative-luminance formula, compositing the stated alpha over the stated ground; where my number disagrees with the recon's I have used mine and said so. Where I could not specify a value exactly, it is in §6, not hidden behind an adjective.*

---

## 1. The verdict

This bar is the only element on the site that never joined the site. Everything else on the homepage belongs to a measure, a ground, a palette and the six laws; the navigation belongs to none of them. **It has no measure** — `px-6 md:px-10` full-bleed with no `max-w` (`:349`) while every section below it is that same gutter *plus* `max-w-7xl mx-auto`, so above a 1360px viewport the wordmark walks away from the page: 40px adrift at 1440, 76px at 1512, 280px at 1920. **It has no ground** — `bg-ink/95` composites to rgb(24,27,24), which I measured against every band the fixed bar crosses: **1.10:1** against `--ink`, **1.10:1** against `#101E17`, **1.11:1** against `--forest-deep`, **1.11:1** against `--altitude`. On five of the eleven bands the bar is literally invisible, held together by a `border-paper/10` hairline that measures **1.27:1** against its own fill; on the six paper bands the same slab measures **16:1**, a black guillotine cut across a cream page. It is the one element that refuses the day-arc the whole palette is built around. **And below 1024px it is not a bar at all — it is the site's entire navigation, and it fades in.** Six `motion.li` rows animate `opacity: 0 → 1` on a 50ms stagger reaching 0.29s (`:790-792`) while `document.body.style.overflow` is locked to `hidden` (`:329-332`), with no `motion-reduce` guard anywhere in the sheet: a stalled animation leaves a phone with a scroll-locked page under an invisible full-screen ink overlay and no door off it. That is hard constraint 2, broken verbatim, on the one surface where it costs the most. Underneath all of that, the copy is false — `Mugs → /shop?category=mugs` points at a slug migration 092 renamed to `coffee-mugs`, and a whole Drinkware group advertises a department the shop's own filter rail hides for having no stock.

The fix is to make the bar a **member of the page instead of a lid on it**: give it the page's measure, give it a ground that answers the band underneath it, spend the system's one warm token on the one moment in the header that has earned it — something is in the bag — and make the menu the **bar itself deepening onto the page's own grid**, on a sage rule that reads on ink and against paper alike, instead of a 660px box floating in the air. Then, below 1024px, stop fading the navigation in, put the mountain's own night values under it, and put the cart at the top of the sheet instead of 1,034 pixels down. Everything below is that idea, itemised.

---

## 2. What stays — do not touch

| | Why it is right |
|---|---|
| **The three-column grid** (`:349`, comment `:345-348`). | It replaced a `justify-between` flex that collided with the wordmark at exactly 1024px. Item 2 moves it inside a measure; the grid itself is the fix and survives unchanged. |
| **The 140ms close timer and the `pt-3` bridge** (`:171-176`, `:464-467`). | The single most common way a hover menu feels broken — a dead zone between label and panel — already solved, in state rather than `:hover` so keyboard and Escape drive the same thing a mouse does. |
| **Panels anchored to the `<nav>`, not to the trigger** (comment `:374-380`). | Anchoring a 660px panel to SHOP put its left edge 37px off-window at 1024. Item 2 keeps the anchor and widens the surface to the measure. |
| **Type-only menus. No thumbnails.** (post-mortem `:31-50`). | Twenty lines recording remote 640/1080px images oversampled into a 54×42 box, three aspect ratios cropping three ways, a panel that re-laid itself out under the pointer. Do not put pictures back. |
| **The collections fetch runs on mount in `requestIdleCallback`, not on hover** (`:158-165`, `:178-191`). | Text-only means both shapes are identical, so a slow reply cannot shift anything. |
| **The scroll contract** (`:270-327`): `SOLID_AFTER 80`, `HIDE_AFTER 260`, `FLIP 48` on **accumulated** travel, rAF-throttled, passive. | Two ScrollTrigger versions failed because `self.scroll()` does not track upward movement under this project's Lenis, and a smoothed scroller reports settling reversals. Do not rewrite it. |
| **`heroAct` read in JS via `MutationObserver`** (`:193-210`). | The CSS variant `[body[data-hero-act=studio]_&]:text-paper` failed silently on colour while the ring beside it worked. A cue that fails on one property and not another is not worth keeping. The interface with `SummitHero.tsx:630` is untouched by every item below. |
| **One underline doing both jobs** — active and hover, same line (`:414-422`). | Item 5 gives it a third job rather than adding a second idiom. |
| **The mobile sheet's left-aligned single column with real 44px child rows** (`:754-768`, `:819`). | It replaced centred text and 11px wrapped chips. The shape is right; item 1 changes its ground, its order and its motion, not its structure. |
| **`relative z-50` on the logo and icon rails** (`:357-361`). | The sheet is a positioned sibling at `z-40` inside the same header; without this the close button paints under it and the menu can be opened but not dismissed. |
| **The 44px button around the 24×8 glyph** (`:542-559`). | The bars are one third of WCAG 2.5.8 in one axis; the button around them is a real target. Keep both facts. |
| **`solid` while a panel is down** (`:251`). | The panel hangs off something instead of floating over the hero with a seam of scenery between them. Item 1 adds `menuOpen` to the same expression. |
| **The two `tabular-nums` counters** (`:490`, `:502`). | The only lawful Space Mono in the file. They are figures. Everything else in mono is a word, and item 6 takes those. |

---

## 3. The action plan

Table and specs share the same numbering. Items **1, 2 and 3 alone visibly change the bar on a phone and on a laptop, in that order of who sees it.**

| # | Action | What | Why | Effort | Priority |
|---|---|---|---|---|---|
| 1 | update | The phone sheet: legible from the first frame, on the mountain at night, cart at the top | Hard constraint 2, broken on the site's entire sub-1024 navigation; the cart is 1,034px down a 730px screen | 4h | **P1** |
| 2 | update | The bar deepens, onto the page's own measure | The bar belongs to no measure; the menu is a 660px box floating in the air on a border-plus-shadow surface | 1.5d | **P1** |
| 3 | update | `--dawn` arrives when something is in the bag — and the cart stops lying | The one warm token is spent on a hover-only eyebrow; the bar asserts "Cart, 0 items" to a returning customer | 3h | **P1** |
| 4 | remove | The dead commerce links and the false counts | `?category=mugs` is a 404-by-another-name; Drinkware promises a department with no stock | 1h + data check | **P1** |
| 5 | remove | The spotlight ring and `animate-pulse` | An infinite opacity loop that runs for as long as a hero act holds — law 6, in the file | 30m | **P1** |
| 6 | update | One label voice. Mono keeps its figures and nothing else | Space Mono carries a word in five places, including a button face, and two of them are under AA | 2h | **P1** |
| 7 | update | The account menu comes home to the storefront palette | A white slate popover hanging off an ink bar — the admin theme leaking into the shop | 1h | P2 |
| 8 | update | The bar's ground answers the band under it | 1.10:1 on five bands, 16:1 on six. There is no middle setting today | 1d | P2† |
| 9 | remove | The blur, the hardcoded shadows, the half-second | `backdrop-blur-md` buys 5% of a backdrop across a 12,000px page; 500ms is double the motion band | 1h | P2 |
| 10 | update | The bar tells the truth about itself | No `aria-controls`, no `aria-current`, no focus trap, no focus restoration, no `role="dialog"` | 3h + keyboard pass | P2 |
| 11 | update | The brand name comes back to the phone | At 320px the bar is a cyan silhouette with `alt=""` and two zeros | 2h + type measure | P2 |
| 12 | remove | Dead code and lying comments | Three dead symbols, a duplicate SVG, and three comments describing code that no longer exists | 1h | P3 |
| 13 | add | The one figure in the bar that changes behaviour | What is left to free delivery, Archivo for the words, mono for the number | 2h | P3 |
| 14 | update | The Shop panel reads the shop's real taxonomy | A rename in `/admin/categories` can leave a dead link in the bar — it already has | 4h | P3 |
| 15 | update | The mark's `priority` comes off the nav instance | First paint fetches two optimized variants of one logo ahead of the hero | 20m | P3 |

† Item 8's **paper species is blocked** on the logo question — see §6, Q1. Its dark species is shippable alone and is byte-identical to today on every non-homepage page.

---

### The specs

**1 — The phone sheet: legible from the first frame, on the mountain at night, cart at the top.**

This is the whole navigation below 1024px, and three things are wrong with it at once: it fades, it is a flat black modal, and its commerce surface is two screens down.

*1a — the motion.* `:790-792`, delete the opacity keys: `initial={{ y: 18 }} animate={{ y: 0 }}`. Import `useReducedMotion` from `motion/react` and set `transition={reduce ? { duration: 0 } : { duration: 0.35, delay: 0.04 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}`. `y: 18 → 0` does the entire job and a stalled transform leaves a drawn row. **The sheet wrapper's own opacity at `:772-775` stays** — it is an overlay, and a stalled overlay is indistinguishable from a closed menu; a stalled *row* is a missing door. That distinction is the constraint understood rather than obeyed.

*1b — the ground.* `:776`, replace `bg-ink` with the page's own dark ladder, as an inline style (not a Tailwind arbitrary value — this repo's memory records `px-[--token]` compiling to nothing under Tailwind v4, and a multi-stop gradient with commas is the same class of hazard):

```
style={{ background:
  'linear-gradient(180deg, var(--ink) 0px, var(--ink) 96px, #101E17 58%, var(--forest-deep) 100%)' }}
```

Ink for the first **96px** so the bar's own scrim and the sheet agree at the seam; the hero's own value through the middle; `--forest-deep` at the foot. The sheet stops being a black modal and becomes the mountain at night, in values the site already owns, at zero risk — a gradient cannot jitter, stall or fail to arrive. Measured on `--forest-deep`: `--paper` 14.4:1, `text-paper/70` 7.7:1. `#101E17` is a hardcoded literal in three places already (`SummitHero.tsx:941`, `app/layout.tsx` viewport `themeColor`, and now here) — **add `--summit: #101E17` to `app/globals.css` and use it in all three**, so the hero's ground stops being a literal that three files repeat. That is the only globals.css edit in this plan (scope: §6, Q8).

*1c — the order, and the arithmetic.* Measured on a 390×844 device (≈730px of usable `dvh` behind Safari's chrome), the sheet today is **1,074px** of content: `pt-24` 96 + six 61px link rows 366 + Shop's five flattened children (−4 + 5×44 + 16) 232 + Collections' three (−4 + 3×44 + 16) 144 + the foot (pt-10 40 + a 12px eyebrow + mt-3 12 + 3×44) 196 + `pb-10` 40. Six live collections take it to **1,206px**. The cart row sits at **1,034px** — 300px below the second screenful — and shows no count at all (`:837-845`) while the bar 20px above it does. `mt-auto` at `:832` is consuming spare height that does not exist.

The three actions move to the **top** of the sheet, directly under the bar, as the first child of `<nav>`:

```
<div className="flex items-stretch gap-2">
  {/* Cart · Wishlist · Account (or Sign in) */}
  flex h-12 flex-1 flex-col items-center justify-center gap-0.5
  rounded-[var(--r-card)] bg-paper/[0.05] font-body text-[12px] text-paper/85
  count: font-mono text-[13px] tabular-nums text-paper   /* rendered only when hydrated — item 3 */
</div>
```

At 390px: 390 − 48 (`px-6`) = 342 across, minus two 8px gaps = **108.7px per tile**; `Wishlist` at 12px Archivo is ≈53px, so nothing wraps. Verify at 320px (**90.7px** per tile) before merge.

Then: `solid` at `:251` gains `|| menuOpen`, so the bar is 56px whenever the sheet is open and `pt-24` becomes `pt-20`. The foot block `:832-846` is **deleted entirely** — the 3.02:1 `Your account` eyebrow, its three stacked rows, and `mt-auto` with them. Shop's children drop from five to three (item 4 removes the two broken ones), −88px. Children at `:819` go `text-paper/55` (5.8:1) → `text-paper/70` (**8.7:1**). Add `data-lenis-prevent="true"` to the sheet — the same attribute `components/ui/dropdown-menu.tsx:73` already uses; the body lock at `:329-332` does not pause Lenis.

*1d — three of the six say what they are.* `NavLink` gains `note?: string`, set on the three doors that sell and nowhere else — a note on all six is a wall, and Shop, Collections and Trails already carry children or are self-evident:

- Customize — **`Your artwork, printed to order.`**
- Rent — **`Gear for a weekend, without buying it.`**
- Trek Buddy — **`Find people going the same way.`**

Rendered under the 28px name, inside the same `<Link>`, as `mt-1 block font-body text-[13px] leading-snug text-paper/65` — **7.7:1** on ink, 7.9:1 mid-gradient.

New arithmetic: 80 (`pt-20`) + 48 (tiles) + 24 (`mt-6`) + 429 (six rows + three notes) + 144 (Shop, three) + 144 (Collections, three) + 40 (`pb-10`) = **909px**, or **1,041px** with six live collections. It still scrolls once. But the cart, the wishlist and the account sit at **128–176px** instead of 1,034px, every one of the six destinations is inside one thumb-flick, and three of them now say what they are.

---

**2 — The bar deepens, onto the page's own measure.**

You reach for SHOP and the bar itself pulls down like a shade — full window width, a sage hairline riding its lower edge — and the menu is *inside* the bar, laid on the page's own grid. No floating box, no second surface, nothing hanging in the air over the hero.

Split `<header>` (`:342-355`) into one full-bleed ground with two stacked children.

*HEADER (ground only):* `fixed top-0 inset-x-0 z-50 border-b border-sage/60 transition-[background-color,border-color,transform] duration-[220ms] ease-[var(--ease-out)]`, plus the existing `hidden ? '-translate-y-full' : 'translate-y-0'`. Solid → `bg-ink/95`. Transparent → `bg-gradient-to-b from-ink/55 via-ink/20 to-transparent`. **Deleted from the header:** `h-14`, `h-[72px]`, `grid grid-cols-[1fr_auto_1fr]`, `px-6 md:px-10`, `border-b border-paper/10`, `shadow-[0_2px_24px_rgba(0,0,0,0.28)]`, `backdrop-blur-md`.

The rule is the system move. `border-sage/60` composites over the bar's own ink ground to rgb(79,105,72), which measures **2.9:1** against the bar (versus `border-paper/10`'s **1.27:1**, i.e. invisible) and **5.6:1** against `--paper` below it. One line that reads on ink *and* over every paper band on the page — which is exactly what the header's border has never done. The per-panel sage flourish at `:611-617` is **deleted** and promoted to this: the flourish becomes the bar's permanent edge rather than a decoration that plays on hover.

*CHILD A — the bar row:* `mx-auto grid w-full max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-6 md:px-10 transition-[height] duration-[220ms] ease-[var(--ease-out)]` + `h-14` / `h-[72px]`. The three existing rails move into it unchanged. `max-w-7xl` (1280) is the container every homepage section already uses — `CollectionsRow.tsx:55`, `ShopByCategory.tsx:70`, `DesignYourOwn.tsx:42`, `FooterSection.tsx:97` — verified. Below a 1360px viewport nothing moves (both are already at 40px); above it the drift stops: the measure's left edge is `(V − 1280) / 2` against the bar's 40px, so today's gap is **40px at 1440, 76px at 1512, 280px at 1920**, and after this it is zero at every width.

*CHILD B — the shade:* `AnimatePresence` wrapping `motion.section id="nav-shade" initial={{height:0}} animate={{height:'auto'}} exit={{height:0}} transition={{duration:0.22, ease:[0.22,1,0.36,1]}} className="overflow-hidden"`, inner `mx-auto w-full max-w-7xl px-6 md:px-10 pb-10 pt-8`. Under `useReducedMotion()` the transition is `{ duration: 0 }` — the height ease is a disclosure, not decoration, but it does not need to animate to be understood.

*MenuPanel sheds its shell.* `:603-606` loses `rounded-[var(--r-panel)]`, `border border-paper/10`, `bg-ink/97`, `shadow-[0_28px_70px_-28px_rgba(0,0,0,0.85)]`, `backdrop-blur-md`, `w-[660px]` and `w-[420px]`, and becomes a bare grid on the shared measure: columns → `grid grid-cols-[repeat(2,minmax(0,1fr))_1.25fr] gap-x-12` (one list group after item 4 → `grid-cols-[1fr_1.25fr]`); stack → `grid grid-cols-2 gap-x-12 gap-y-1`. Law 2 is satisfied by subtraction: the surface is now the bar, and the bar is held by one rule. Small `MenuRow` padding (`:713`) goes `px-2 py-1.5` (24px tall) → `px-3 py-2.5 min-h-[44px]` now that there is room.

Two holes the judging panel found in this idea, both closed here:

1. **A full-bleed shade is a far larger hover target than a 660px panel, and `closeSoon` only fires on `mouseleave`** — the pointer can wander 1,200px sideways and never leave, so the menu feels stuck. Fix: move `onMouseLeave={closeSoon}` off the individual trigger wrappers and off the shade, and put it on the `<header>` itself. Any exit from the bar-plus-shade rectangle closes; moving between two triggers never does. One handler, one rectangle.
2. **The header is `fixed` and now grows to ~400px, and `--nav-h` becomes a lie while open.** Fix: `--nav-h` (`:337-339`) continues to publish **the bar row's** height only, 56/72, never the shade's — with a comment saying so. Its one consumer is `AuthShell.tsx:68` (`calc(100vh - var(--nav-h,0px))`), which is about the bar it must clear, not about a hover menu that exists only at ≥1024px on pages AuthShell does not render.

`overflow-hidden` lives on the shade only, and the Radix account popover portals out of it (`components/ui/dropdown-menu.tsx:68-73`, verified) — so it is not clipped.

Same pass, the centre rail's overflow guard: `<nav>` at `:381` gains `min-w-0`, its gap goes `gap-7 xl:gap-9` → **`gap-6 xl:gap-9`**, and the trigger at `:405` gains `whitespace-nowrap`. *(The proposal as filed said `gap-6 lg:gap-7 xl:gap-9`; that buys nothing, because the nav is `hidden … lg:flex` and `lg:gap-7` overrides `gap-6` at the only width it is shown. `gap-6 xl:gap-9` reclaims 5 × 4px = **20px** at exactly 1024, the width the wordmark collision was measured at.)*

**Risk, and how to settle it:** the transparent-state `from-ink/55` stacks on top of the hero's own centred clearing, which shipped as 01-hero item 3b. `from-ink/55` is a starting value, not a measurement. It must be tuned against the **brightest** weather state (snow) with the clearing already in place — `design/01-hero.md:186` killed a second centred radial for exactly this class of double-darkening. A linear, top-anchored scrim over 72px is a different animal from a second radial, but the burden of proof is the same. Drop to `from-ink/40` if the ridge muddies.

---

**3 — `--dawn` arrives when something is in the bag, and the cart stops lying.**

The system has exactly one warm accent and a written rule about where it goes — *where the light arrives* — and it is currently spent on a 9px mono eyebrow inside the Shop panel, a surface that exists only at ≥1024px and only while a pointer is held over a label. Meanwhile the two most commercially loaded state changes in the header render in the same cream as the dead chrome around them. Move the token to the moment that earns it.

*3a — the token leaves the menu.* `:647`, the `Made yours` eyebrow, is deleted outright by item 6. That returns `--dawn` to unspent.

*3b — the cart count becomes a pill.* `:502`:

```
count > 0
  ? 'rounded-[var(--r-tag)] bg-dawn px-1.5 py-[3px] font-mono text-[11px] leading-none tabular-nums text-ink'
  : 'font-mono text-[11px] tabular-nums text-paper/55'
```

`--ink` on `--dawn` measures **8.6:1**. Mono is legitimate: it is a figure. An empty cart stays cold; a full one catches first light.

*3c — the heart fills with first light, and only the cart gets a pill.* `:487`, when `wishlistItems.length > 0`, `fill="var(--dawn)"` with the stroke left `currentColor`; the count span stays `font-mono text-[11px] tabular-nums text-paper/70`. Two warm pills side by side read as an alert cluster — this is the cap.

*3d — and it must not announce itself with a jump.* The pill is conditional on `count > 0`, which is false in the server HTML and true after hydration, so without this half a returning customer gets a pill popping in and the whole icon cluster shifting on every page load. Three parts:

- `providers/CartProvider.tsx` — add `hydrated` to `CartContextValue` and to the provider value at **`:125`**. It is already computed at `:42` and consumed at `:59` and `:70`, and the comment at `:45` claims it exists "precisely so consumers can tell 'empty cart' from 'not read yet'" — it was never actually exported. Verified.
- `providers/WishlistProvider.tsx` — has no such flag at all (`:40` is `value={{ items, toggleItem, hasItem }}`). Add one, mirroring CartProvider's.
- `NavBar.tsx:484-502` — reserve the box so nothing reflows, and never assert a number you have not read: `<span className="inline-flex h-[17px] min-w-[24px] items-center justify-center …">` whose **content is empty until `hydrated`**, not `0`. `aria-label={hydrated ? \`Cart, ${count} ${count === 1 ? 'item' : 'items'}\` : 'Cart'}`, and the same for the wishlist. The server HTML today announces "Cart, 0 items" and "Wishlist, 0 saved" to a returning visitor holding four things, then repaints.

Mirror the pill and the count into the mobile sheet's three tiles (item 1c), which today carry no numbers at all.

---

**4 — The dead commerce links, and the counts that were never true.**

The bar is the site's only always-present commerce door and three of its five product links are wrong.

- **`:85`, `{ label: 'Mugs', href: '/shop?category=mugs' }` — delete.** `supabase/migrations/092_client_brief_23aug.sql:74-79` is `UPDATE categories SET name='Coffee Mugs', slug='coffee-mugs' … WHERE slug='mugs'`. `filtersFromParams` parses `category=mugs` into `categories:['mugs']`, and `matches()` (`lib/shop-filter.ts:172-178`) resolves a product's `category_id` to a slug and tests membership in a flat `Set` with no parent walk — so the visitor lands on `/shop` with an active filter chip and an empty grid.
- **`:87`, `Tumblers & Bottles` — the label is stale too.** Migration 092:81-90 split that one category into `Tumblers` (which kept its slug and its products, deliberately, so existing links keep pointing at something) and a new `Bottles`. One label now names two categories.
- **The whole `Drinkware` group, `:82-88` — delete from the static list.** `supabase/migrations/050_launch_taxonomy.sql:63-72` puts all three products on `t-shirts`, `hoodies` and `sweatshirts`; nothing is on any drinkware category. Migration 092:105-109 states the consequence in the repo's own words: *"with no products listed against Caps, Coffee Mugs, Bottles or Tumblers yet, the default rule would filter all four away."* `stockedCategories()` (`lib/shop-filter.ts:90-96`) is why the shop's filter rail hides them, on the stated principle *"a control must never promise a result it cannot deliver."* The nav is the more prominent control and must obey the same rule. Item 14 later makes this self-maintaining; this item stops the bleeding today.

With one group left, the columns layout takes `grid-cols-[1fr_1.25fr]` inside the shade and the lists wrapper takes `grid-cols-1` (spec: `const cols = Math.min(2, menu.groups.length)`).

- **`:106`, `All three collections` → `Every collection`.** The query is `.limit(6)` (`actions/products.ts:180`) — the string was never true by construction, and a fourth active collection makes the navigation state a false fact about the catalogue. Item 6 gives it the live count.
- **`:131`, `Rent` → `Rent gear`.** It is the only item in the bar naming a thing you can hold, and today the bar, the footer (`FooterSection.tsx:63` — `Rent Gear`) and the page itself use three different names for one destination. 43 characters across five gaps versus today's 44 across five, so the centre rail does not grow. *(Client confirmation — §6, Q3.)*

Keep the three static collection entries as the pre-fetch fallback. Proposal 18's deletion was killed: `o-collection`, `mist-and-morning` and `silent-altitude` are the seeded production collections, so the fallback renders the true names instantly and the fetch replaces them with identical strings — which is precisely why the file's own comment says text-only means a slow reply cannot shift anything.

**Before shipping:** run the three surviving `?category=` slugs against the live `categories` table. This is a data check, not a code review, and it is the check that would have caught `mugs`.

---

**5 — The spotlight ring and `animate-pulse`.**

Delete `:423-430` in full. `animate-pulse` is an **infinite** opacity loop that runs for as long as a hero act holds — law 6 broken in the file, not a matter of taste, and this client has rejected ambient motion twice by name. `rounded-full` is also not on the radius ladder, and the 500ms opacity fade beside the pulse is unguarded for reduced motion even though the pulse is.

Then give the underline the third job, at `:419-421`:

```
absolute -bottom-0.5 left-0 h-px w-full origin-left transition-transform duration-[220ms] ease-[var(--ease-out)]
${spotlit ? 'bg-sage-lit' : 'bg-sage'}
${active || open || spotlit ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}
```

The line does not merely *appear* when the hero act lights it — it **changes colour**, so the connection to the frame still reads without a second idiom. `--sage-lit` measures **10.7:1** on the hero's flat `#101E17` and **5.6:1** over the brightest measured terrain (`design/01-hero.md`), against `--sage`'s 6.0:1 flat. `duration-300` → `duration-[220ms]` lands it inside the 140–260ms band. It is a transform, so a stalled animation leaves a drawn line rather than a hole.

`heroAct`, the `MutationObserver` at `:203-210` and the lit `text-paper` at `:410` all stay. The interface with `SummitHero.tsx:630` is a single boolean and is unchanged.

---

**6 — One label voice. Mono keeps its figures and nothing else.**

Space Mono carries a word or a sentence in **five** places and a figure in two. `globals.css:743` records the rule in the project's own words: *"Numbers are instruments; words are not."* The consequence is that the nav has no label voice of its own — mono is standing in for one, so every small word in the bar reads as telemetry.

One settlement, held everywhere. The micro-label voice is **`font-body text-[10px] uppercase tracking-[0.2em]`** — chosen because `ShopByCategory.tsx:111` already uses that exact utility for exactly this job, so the panel becomes a member of the page's system rather than a nav-local invention.

| Line | Today | Becomes | Measured |
|---|---|---|---|
| `:625` `Apparel` | `font-mono text-[9px] tracking-[0.22em] text-sage` | `mb-3 font-body text-[10px] uppercase tracking-[0.2em] text-sage` | 6.7:1 |
| `:647` `Made yours` | `font-mono text-[9px] text-dawn` | **deleted** — the 19px Fraunces title already opens the panel, and this returns `--dawn` to item 3 | — |
| `:657` `Open the studio` | `font-mono text-[10px] uppercase tracking-[0.16em]` | `mt-6 inline-flex items-center gap-2 font-body text-[12px] text-paper`, sentence case | 17.6:1 |
| `:680` the all-row | `font-mono text-[10px] uppercase tracking-[0.16em] text-paper/50`, 32px tall | `min-h-[44px] font-body text-[13px] text-paper/85`, sentence case | 4.99:1 → **14.4:1** |
| `:725` small row label | `text-paper/80` | `text-paper/85` | 14.4:1 |
| `:731` the note | `font-body text-[12px] text-paper/45` | `text-paper/60` + `line-clamp-2` | **4.22:1 → 6.7:1** |
| `:833` `Your account` | `font-mono text-[9px] text-paper/35` | **deleted** by item 1c | 3.02:1 → gone |

`:657` is the one law 3 names explicitly — a button face is never mono. `:680` is the row that takes a visitor into the entire range and it is currently the quietest thing in the panel, below the decorative headings above it, in a row shorter than the WCAG target. `line-clamp-2` at `:731` is defensive: that tagline comes straight from the `collections` table and nothing caps it, so a long one reshapes the panel today.

**And the all-row states a fact instead of a number of collections we guessed.** Pass `stackItems.length` into `MenuPanel` and render, hard right in the existing `justify-between` row (never inline, or it reads as a system readout):

```
Every collection    <span className="font-mono text-[12px] tabular-nums text-sage">{String(n).padStart(2,'0')}</span>
```

Falling back to `03` until the fetch lands, which is the number of seeded collections.

Mono then survives at exactly **three** sites in the file — `:490`, `:502` and this count — and all three are figures. Today it is seven, and five of them are words.

---

**7 — The account menu comes home to the storefront palette.**

It is the only surface in the navigation not on the storefront tokens: `bg-popover` #ffffff, `text-popover-foreground` #0f172a, `rounded-md` (6px — off the radius ladder), `border` + `shadow-md`. A white slate card hanging off an ink bar, and the single cheapest-looking surface in the header.

`:517`:

```
<DropdownMenuContent align="end"
  className="relative w-52 rounded-[var(--r-panel)] border-0 bg-ink/97 p-2 text-paper
             shadow-[var(--shadow-float)]
             before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-sage before:content-['']">
```

Law 2: a panel is shadow + radius, never both plus a border, so `border-0`. But `--shadow-float` is `rgba(12,16,13,0.50)` — near-black on near-black, so it does not read on ink and the popover would have no edge. The sage hairline item 2 promoted off the panel comes back **here**, on the one surface in the nav that still genuinely floats: an edge on one side is not an enclosure, and it is continuity rather than a new idiom.

Items `font-body text-[13px] text-paper/85 focus:bg-paper/[0.06] focus:text-paper`; separator `bg-paper/10`; the email label `text-mid` → `text-paper/55` (**5.8:1** — `--mid` #52504A is a *paper-ground* token and measures 1.9:1 here, effectively unreadable). Recase to match the rest of the file, which writes the same destinations in sentence case: `My account`, `My designs`, `Sign out`. One string cased two ways in one component is the defect; the recase is the fix, not churn.

**Scope every one of these on the instance's `className`. Never edit `components/ui/dropdown-menu.tsx`** — every admin surface in the app reads it. The primitive composes with `cn()` (`:67-70`), so the instance className wins; verify `border-0` actually survives tailwind-merge against the primitive's `border` before merging.

---

**8 — The bar's ground answers the band under it.**

This is the revival of an idea the panel killed, and it is worth saying exactly why it died and why this version does not. The original sampled `getComputedStyle(el).backgroundColor` down the page and classified by luminance. Verified against `app/page.tsx`: the direct children of `<main id="main">` are bare `<div data-trail-time=…>` wrappers with **no class and no background** — the ground lives on the `<section>` *inside* each component (`CollectionsRow.tsx:54`). So every sample returns `rgba(0,0,0,0)`, luminance 0, and the classifier returns `dark` for all eleven bands; the paper species never fires. Its failure mode was a bar in the wrong colour over a band — a cream plate floating on a forest section for a frame.

**Stop sniffing. Declare it.** `app/page.tsx` already hand-authors `data-trail-time`, `data-trail-alt` and `data-trail-label` on every wrapper — the idiom exists and is the file's own convention. Add `data-ground="dark" | "paper"` to each, in this order (verified against the components): hero `dark` · CollectionsRow `paper` · ShopByCategory `paper` · DesignYourOwn `paper` · TrekBuddyBand `dark` · HomeTrails `dark` · TrustBand `paper` · SeasonKit `dark` · TheClimb `paper` · BrandPulse `dark` · NewsletterBar `dark` · footer `dark`. A band that renders conditionally takes its wrapper — and therefore its declaration — with it, so the empty-data case is correct by construction rather than by luck.

NavBar runs one `IntersectionObserver` over `[data-ground]` with a thin band at the top of the viewport, takes the last intersecting entry in document order, and sets `ground` from the declared attribute. No `getComputedStyle`, no luminance maths, deterministic and testable. *(The exact `rootMargin` is in §6 — a zero-height root behaves inconsistently across engines and this needs a scrub test, not an assertion.)*

Two species. The header publishes `--nav-ground` so dependent parts follow it:

| | dark (default) | paper |
|---|---|---|
| ground | `bg-ink/95` | `bg-paper/95` |
| rule | `border-sage/60` (2.9:1 on its own fill) | `border-rule-warm` (#D2C4A4 — the token for a rule on paper-warm/paper-deep) |
| label, resting | `text-paper/70` | `text-mid` — **7.4:1** |
| label, active/open/spotlit | `text-paper` | `text-text` |
| underline | `bg-sage` / `bg-sage-lit` | `bg-forest` — **9.5:1** |
| cart pill | `bg-dawn text-ink` (8.6:1) | same, plus `ring-1 ring-ember` (3.7:1, decorative only — the numeral carries the meaning at 8.6:1) |
| presence dot ring | `ring-[color:var(--nav-ground)]` | same |

Transition `[background-color,border-color,color] duration-[220ms]`. It fires at band boundaries only — a handful of times down a 12,000px page — so it is not ambient; it performs and resolves. Every page without `data-ground` gets `dark` and is byte-identical to today.

**Blocked on the mark.** On `--paper` the cyan logo measures 2.38:1 and would half-vanish. The paper species cannot ship until Q1 is answered. The dark species can ship alone, today, and is a no-op everywhere.

---

**9 — The blur, the hardcoded shadows, and the half-second.**

- **`backdrop-blur-md` off the header (`:353`).** At `bg-ink/95` the backdrop contributes 5% of the band behind it — over `--paper` that is about 12 of 255 per channel, below the perceptual threshold. The site is running a full-viewport-width `backdrop-filter` compositing layer on a `fixed` element across a 12,000px homepage and over a live WebGL hero to render an effect nobody can see. The panel's `bg-ink/97` + blur (3%) goes with the shell in item 2.
- **Both hardcoded shadows go.** `shadow-[0_2px_24px_rgba(0,0,0,0.28)]` leaves the header with item 2 — the dark species is a scrim held by a rule, and law 2 forbids both. `shadow-[0_28px_70px_-28px_rgba(0,0,0,0.85)]` leaves with the panel shell. The only shadow left in the file is `--shadow-float` on the account popover (item 7), and it is a token. `--shadow-card/lift/panel/float` are currently unused by this component; after this, one is.
- **The 500ms becomes 220ms, and every property in the transition list is one the element actually changes.** Today `transition-[height,background-color,transform,border-color]` sits on an element that also changes `box-shadow` and `backdrop-filter` — so the shadow and the blur **snap** while the colour eases. What a visitor perceives at `SOLID_AFTER = 80` is a black shadow popping in under a bar whose colour did not visibly change: the transparent state's ground over the hero is rgb(30,49,41) and the solid composite is rgb(24,27,24), a **1.26:1** shift. After item 2 the header transitions `[background-color,border-color,transform]` and the bar row transitions `[height]`, both at 220ms, and there is no shadow or blur left to snap.
- **`--nav-h` keeps flipping instantly, and here is why.** The proposal to ease it over the same 220ms is not a thing that happens: a custom property set from JavaScript does not interpolate unless it is registered with `@property` and a `<length>` syntax. At 220ms the published number and the painted bar agree within about three frames. Add a comment at `:337-339` recording that the value is the **bar row's** height, never the shade's, and that `AuthShell.tsx:68` uses a 0px fallback during SSR.

---

**10 — The bar tells the truth about itself.**

Nothing a sighted visitor sees changes. This rides along inside items 1 and 2; it is not a proposal of its own.

- `:404` — `aria-expanded` currently sits on an `<a>` with neither partner attribute. Add `aria-haspopup="true"` and `aria-controls="nav-shade"` (the id item 2 gives the shade). The element is genuinely both a destination and a disclosure; test with VoiceOver, because that is a real ambiguity rather than a labelling bug.
- `:401-411` — `aria-current={active ? 'page' : undefined}`, which exists nowhere in the file. **And record the live defect it exposes:** on the homepage `active` is never true for any item, because no `href` is `/`. The bar's "where you are" state is dead on the page this council is about. Fix it at the source — `components/Logo.tsx:53`, the `<Link href="/">` that already carries `aria-label="DEWDROPZ — home"`, gains `aria-current={pathname === '/' ? 'page' : undefined}`.
- `:550` — the hamburger gains `aria-controls="mobile-nav"`; the id already exists at `:771`.
- `:770-776` — the sheet gains `role="dialog" aria-modal="true" aria-label="Menu"`. Set `inert` on `<main id="main">` and the footer while `menuOpen` (React is **19.2.4**, verified — the boolean prop renders). Store the hamburger in a ref and restore focus to it on every close path: the button, Escape at `:219-224`, and a link tap. Today the sheet is an overlay with the entire page still readable behind it and focus lands wherever it fell.
- Delete `navRef` (`:142`, attached `:343`, read nowhere) and `data-solid` (`:344`, one occurrence in the whole repo, its own). Keep the `useRef` import — `closeTimer` uses it. *(Counter-argument on the record: `data-solid` is exactly the hook a CSS-driven variant of this bar would want. If anyone plans to move the solid state out of the class string, keep it and add the consumer in the same commit rather than leaving an attribute waiting for a reader.)*

**Dependency, flagged:** the focus ring is still forest at **1.67:1** on the hero ground. `design/01-hero.md` item 8 fixes it by adding `on-dark` to this header's permanent class list and lifting `.on-dark :focus-visible` to `--sage-lit`. It is P2 and **not built** — verified, `on-dark` does not appear in `NavBar.tsx`. A keyboard pass on the nav is not meaningful until it lands.

---

**11 — The brand name comes back to the phone.**

Below 640px the brand's name is not on the page: a 45×26 cyan silhouette with `alt=""` is the entire assertion of who this is, and the two things paying for that deficit are counters that render zeros in the server HTML.

The measured deficit is at **320px**, not 390. At 390 the lockup (45 mark + 10 gap + ~92px wordmark at 16px/0.1em = 147) plus the icon cluster (heart 20 + gap-2 8 + digit 7, ×2, plus three 10px gaps, plus a 36px effective hamburger = 156) plus `px-6` ×2 = **351px**, which fits with 39px to spare. At 320 the same 303px of content has 272px to live in — a **31px** deficit, and that is why the wordmark stands down.

Reclaim it twice over, without inventing app furniture:

- **The two inline counters leave the bar below `sm`.** The count spans get `hidden sm:inline-flex` and the `gap-2` on both Links becomes `gap-0 sm:gap-2`. That is 2 × (8 + 7) = **30px**, and the counts are not lost — item 1c put them at the *top* of the sheet, one tap away, at 13px instead of 11px.
- **The wordmark returns at a phone size.** `:370` → `wordmarkClassName="font-display text-[15px] tracking-[0.08em] text-paper sm:text-base sm:tracking-widest"`. At 15px/0.08em the word sets at roughly **84px** against the 92px the 16px setting needed, another 8px.

Net **+7px of air at 320px**, +71px at 390px, and the bar reads mark + DEWDROPZ on every phone.

**This one gets measured, not estimated.** The em advances above are read off Fraunces' nominal metrics, not off the shipped subset. `design/01-hero.md` measured its subset directly out of `.next/static/media/*.woff2` and the plan was wrong by 1.5em when it did not; do the same here before merging. §6.

*(The rejected alternative, on the record: an absolutely positioned 10px badge over the 20px stroke icon. It reclaims the same 42px but it is app notification furniture, and on the transparent state over the hero it needs a `ring-2` to survive — a dot-and-ring cluster on a bar belonging to a warm, aged outdoor brand.)*

---

**12 — Dead code and lying comments.** Every claim verified by grep.

- `navRef` and `data-solid` — with item 10.
- `image_url` out of `getNavCollections`'s select (`actions/products.ts:175`) and out of its return type. Nothing has consumed it since the thumbnails were removed; it is the only reason this query costs more than the two strings it renders.
- Hoist the byte-identical person SVG (`:511-514`, `:535-538`) into one `const PersonIcon`.
- **Comment `:18-24`** lists `SHOP | COLLECTIONS | CUSTOMIZE | TREK BUDDY | TRAILS` and argues that "five items is the number at which a centred nav still reads as one line instead of a queue." `Rent` was added at `:131` under it and there are six. Rewrite to the real list and the real reasoning.
- **Comment `:476-480`** explains the icon gaps in terms of "the header's own justify-between" and "the only two flex children." The header has been a three-column grid since `:349` and is a two-child ground after item 2. Delete it.
- **Comment `actions/products.ts:165-169`** says the collections query is "called lazily — nothing runs until somebody actually opens the menu." It is not: `NavBar.tsx:178-191` fetches it on mount inside `requestIdleCallback`, and NavBar's own comment at `:158-165` explains at length why it is deliberately *not* on hover. Two files disagree; the code is right, so the comment is wrong.

Comments that lie are worse than no comments, and this file is roughly 40% prose.

---

**13 — The one figure in the bar that changes behaviour.**

Once there is something in the cart, the bar carries what is left to free delivery. `Space Mono` takes the figure, Archivo takes the words — which is exactly the split law 3 asks for, and the only place in this plan where a new string enters the header.

Read `free_shipping_threshold` from `store_settings` in its own thin server action (`actions/settings.ts:86`, default **200000** paise at `:113`). Do **not** bolt it onto the collections payload; that couples a settings read to a menu fetch for no reason.

```
hydrated && count > 0 && threshold > 0 && subtotal < threshold && pathname !== '/cart'
  → <span className="hidden font-body text-[11px] text-paper/85 xl:inline">
      <span className="font-mono tabular-nums">{formatPrice(threshold - subtotal)}</span> to free delivery
    </span>
subtotal >= threshold
  → <span className="hidden font-body text-[11px] text-sage xl:inline">Free delivery</span>   /* 6.7:1 */
```

`formatPrice` is `lib/utils.ts:12` and takes **paise** — the threshold is stored in paise, so it goes in raw. The phrase `Free delivery` is lifted verbatim from `CheckoutClient.tsx:484` so the two surfaces cannot contradict each other.

**`xl:`, not `lg:`.** The filed proposal defended the 375px case, which was never the problem; 1024 is, because that is where the centre rail is already tight enough that item 2 has to buy 20px back. Do not spend it here. Empty cart or `!hydrated`: nothing renders and the bar is byte-identical to today.

---

**14 — The Shop panel reads the shop's real taxonomy.**

The goal is right — a rename in `/admin/categories` should not be able to leave a dead link in the bar, and it already has (item 4). The filed mechanism was killed and stays killed: `groupCategories(await getProducts(), await getCategories())` calls `getProducts()`, which selects every active product with its collection, variants and categories, to derive two lists of category *names* — from a component mounted on every page. `actions/products.ts:48-50` exists specifically to record that this exact mistake was made once for a sitemap. "No extra round trip" is true and beside the point; the payload is the cost.

Build the shape it needs as its own thin query. A new `getNavShopCategories()` in `actions/products.ts` selecting `slug, name, parent_id, sort_order` from `categories`, inner-joined through `product_categories` to `products` where `is_active`, distinct, ordered by `sort_order`, `.limit(8)`. The mapper caps `.slice(0, 2)` on groups (the shade has two list columns) and `.slice(0, 6)` on items per group, so a bulk import cannot grow a 900px menu.

`MenuPanel` takes `const shopGroups = shop.length ? shop : menu.groups`, where `menu.groups` is now the single true apparel group item 4 leaves behind — a fallback that is correct rather than false. Zero state: with no stocked categories, the columns layout renders the feature panel and the all-row only, on `grid-cols-[1fr]` inside the shade. Both shapes stay text-only, so a late reply cannot reflow — the rule established when the thumbnails were removed.

---

**15 — The mark's `priority` comes off the nav instance.**

`components/Preloader.tsx:187` already requests `/logo/mountain-mark.png` at 168×97 with `priority`, and `NavBar.tsx:368` requests the same file at 45×26 with `priority`. First paint fetches **two optimized variants of one logo ahead of the hero**. Drop `priority` from the NavBar instance — the Preloader's copy paints above it and warms the cache.

Same instance, `components/Logo.tsx:34-42`: with fixed `width`/`height` and no `sizes`, next/image emits a 1x/2x srcset capped at 90px, so every DPR-3 Android — the bulk of this market — upscales a 90px bitmap 1.5× on a hairline mark. Adding `sizes="45px"` switches it to the `w`-descriptor srcset drawn from `imageSizes`. **Verify against the built `srcset`** before claiming the win (§6).

---

## 4. Removals, argued

**The spotlight ring and `animate-pulse` (item 5).** An infinite opacity loop, running for the entire length of a hero act, on a `rounded-full` that is not on the radius ladder, arguing with a sage underline on the same element that already means *this one*. This client has rejected ambient motion twice by name. The underline changing to `--sage-lit` says the same thing with one idiom, in a transform, at 220ms.

**The `Made yours` eyebrow (item 6).** A 9px Space Mono phrase spending the system's only warm accent in the place fewest people will ever see it — a surface that exists only above 1024px and only while a pointer is held. The 19px Fraunces title beneath it already opens the panel. Deleting it is what makes item 3 possible.

**The Drinkware group and the `Mugs` link (item 4).** Not a taste call. One is a dead slug that lands a customer on an empty grid; the other advertises a department the shop's own filter rail hides on the written principle that a control must never promise a result it cannot deliver. The nav is the more prominent control, and right now it and the homepage's own Choose Your Essentials tiles describe two different ranges to the same visitor on the same scroll.

**The `Your account` eyebrow (item 1c).** 3.02:1, at 9px, in Space Mono, carrying a phrase, above three rows that are self-evidently the account rows. Every part of it is wrong and it is worth nothing.

**The panel's floating shell — border, shadow, blur, 660px, 420px (item 2).** Law 2 broken (border *and* shadow), a hardcoded shadow where four tokens exist, a blur delivering 3%, and two fixed pixel widths that answer to nothing — so the same gesture on two adjacent labels produces two different surface widths, both centred on the *window* rather than on anything a visitor pointed at. Deleting the shell is what turns the menu from a box into the bar.

**`backdrop-blur-md` (item 9).** A full-viewport-width compositing layer on a `fixed` element over a live WebGL hero, buying 5% of the band behind it — below the perceptual threshold. Paid for on every frame of a 12,000px page and never delivered.

**The two inline counters below `sm` (item 11).** They occupy 30px of a 272px rail to render two zeros that are zeros by construction in the server HTML. The counts move to the top of the sheet, larger, and the brand's name comes back.

**Dead code (item 12).** `navRef` — one write, no read. `data-solid` — one occurrence in the repo, its own declaration. `image_url` — the last trace of the deleted thumbnails. A byte-identical SVG twice. Three comments describing a five-item bar that has six items, a flex header that has been a grid since line 349, and a lazy fetch that runs on mount.

---

## 5. Killed in judging — on the record

- **One bar, two grounds, by sniffing `getComputedStyle` down the page** — fatal as written: `main`'s children are unstyled wrappers and every sample returns transparent, so the paper species never fires. Revived as item 8 with a **declared** `data-ground` attribute — same idea, no luminance maths.
- **Delete the three hardcoded collections as "fake"** — they are not fake. `o-collection`, `mist-and-morning` and `silent-altitude` are the seeded production collections. The copy fix (`Every collection`) survives as item 4.
- **Delete `Trails` from the bar** — a traffic and content-strategy decision dressed as a typography fix, and not the council's to make unilaterally. Parked as §6 Q4. The `Rent` → `Rent gear` half survives as item 4.
- **`groupCategories(await getProducts(), …)` inside the nav** — loads every product with its embeds, on every page, to derive two lists of names. Goal survives as item 14 with a thin query.
- **Branch (a) of the logo redraw — inline the mark as SVG with `currentColor` + a `--dawn` path** — technically the right answer and impossible today: `public/logo` contains `mountain-mark.png` and `mountain.png` and no vector at all, so it means redrawing the brand mark from a 1425×820 raster. A redrawn mark that is 95% right looks worse than a slightly-off blue. §6 Q1.
- **`gap-6 lg:gap-7 xl:gap-9` on the centre rail** — buys nothing: the nav is `hidden … lg:flex`, so `lg:gap-7` overrides `gap-6` at the only width the nav is ever shown. Item 2 ships `gap-6 xl:gap-9`, which actually reclaims 20px at 1024.
- **Ease `--nav-h` over the same 220ms as the bar** — a custom property set from JS does not interpolate without `@property` and a registered `<length>` syntax. Either a no-op or an unscoped rewrite.
- **Five blurbs on the phone sheet, one per nav item** — three, on the doors that sell. A note on all six is a wall, and each string is one more thing to keep true as the catalogue moves.
- **Drop all five of Shop's category deep-links from the sheet** — a measurable commerce path traded away on an unconfirmed assumption about the shop's filter rail. Item 4 removes only the two that are broken.
- **An absolutely positioned count badge over the icon** — app notification furniture on a bar belonging to a warm outdoor brand, and it needs a ring to survive the transparent state. Item 11 takes the same pixels by moving the counts into the sheet.
- **Recasing the account rows as a standalone proposal** — correct but not a proposal; folded into item 7, where the surface is being rebuilt anyway.
- **Photographs back in the Collections panel** — the 20-line post-mortem at `:31-50` settles this. Do not revisit.

---

## 6. Open questions for the client

1. **The mark.** `public/logo/mountain-mark.png` is a cyan gradient — mean opaque rgb(89,170,208) ≈ #59AAD0. The palette contains no blue but `--altitude` #142536, which is a ground, not a mark colour. It is the most-seen brand element on the site and it belongs to no token. Two branches: **(a)** re-cut it to the system as an inline SVG (needs a vector source, which does not exist — a redraw); **(b)** tokenise the blue as `--mark: #59AAD0` / `--mark-deep: #1F6E96` and ship a second crop for light grounds. **Item 8's paper species is blocked until this is answered** — on `--paper` the mark measures 2.38:1.
2. **Cart pinned to the corner, or aligned to the measure?** Item 2 pulls the icon cluster 40px inward at 1440 and 280px at 1920, so the wordmark shares a left edge with every heading on the page. Some people expect a cart in the corner. Worth showing both ways — this is a taste call, not a correctness one.
3. **`Rent` → `Rent gear`?** It matches `FooterSection.tsx:63` and `/rent`, and it is the only item in the bar naming a thing you can hold. One character shorter across the whole bar.
4. **Six items, or five?** `Trails` and `Trek Buddy` are indistinguishable to a first-time visitor — both read as hiking. Moving `Trails` to the footer's Explore column is defensible, but it is a traffic decision. Check analytics before anyone touches it.
5. **`--dawn` on the cart pill.** First light arriving on the one moment that earns it, or a second brand colour that reads as an alert? One-line revert to `--sage`.
6. **The three phone notes.** Are `Gear for a weekend, without buying it.` and `Find people going the same way.` the right voice? The Rent line in particular asserts a rental model the pricing code owns.
7. **The transparent-state scrim.** `from-ink/55` is a starting value. It stacks on the hero's centred clearing, and `design/01-hero.md:186` already killed a second scrim on this hero for double-darkening.
8. **Scope.** Items here touch `app/page.tsx` (item 8), `app/globals.css` (item 1b, `--summit`), `providers/CartProvider.tsx` and `providers/WishlistProvider.tsx` (item 3d), `actions/products.ts` (items 12, 14), `components/Logo.tsx` (items 10, 11, 15) and `components/Preloader.tsx` (item 15). `components/ui/dropdown-menu.tsx` is **not** touched. Approved?
9. **No JavaScript, below 1024px, there is no navigation at all** — the sheet is `AnimatePresence`-gated and the six `<a>`s only exist above `lg`. Nothing in this plan fixes that. The honest mitigation is that `FooterSection` carries every destination in the server HTML, so a no-JS phone visitor can reach everything by scrolling. Is a `<details>`-based no-JS fallback worth a round of its own?

**What I could not specify exactly.** The `IntersectionObserver` `rootMargin` for item 8 — a zero-height root behaves inconsistently across engines, so the band's height and the "last intersecting entry" tie-break need a scrub test at three depths rather than an assertion. The transparent-state scrim's alpha (Q7). The 320px wordmark fit in item 11 — the em advances are read off Fraunces' nominal metrics, not measured out of the shipped `.woff2` subset, and the last plan that guessed at this was wrong by 1.5em. Whether `sizes="45px"` actually widens the emitted `srcset` in this Next version (item 15) — verify against the built markup, not the docs.

---

## 7. How we will know it worked

**Widths, every time.** 320, 360, 390, 768, **1023 and 1024** (where the whole nav changes species), 1279, 1280, 1360, 1440, 1920, 2560. At every one: the page body never scrolls horizontally; the six labels clear both rails; the shade never overflows the measure; and at ≥1360 the wordmark's left edge is the same pixel as the first heading below it.

**Degraded states, every time.**
- **JavaScript off** — ≥1024, the six top-level `<a>`s are in the server HTML and legible. <1024, there is no navigation, before or after; confirm the footer's full destination list is present and reachable (Q9).
- **A stalled animation** (background the tab through the sheet's entry, then return) — the six rows must be **readable**, offset or not. This is the pass/fail on item 1a and it is the reason this item is first.
- **`prefers-reduced-motion: reduce`** — no stagger, no pulse anywhere, the shade opens at `duration: 0`, and the whole bar is complete and still.
- **Motion chunk fails to arrive** — the sheet's overlay never mounts, which is indistinguishable from a closed menu. Acceptable. A stalled *row* is not.

**Empty and extreme data.**
- Zero active collections — the panel and the sheet fall back to the three seeded names (still correct); the all-row reads `Every collection 03`.
- Six active collections — the count reads `06`, the label stays true, the sheet grows to 1,041px and still scrolls in one flick.
- Zero stocked categories (item 14) — the Shop shade renders the feature panel and the all-row only, never an empty box.
- A 400-character admin-authored tagline — `line-clamp-2` holds the row's shape.
- Signed out, signed in, and the moment after `onAuthStateChange` fires.
- Cart at 0, 1, 3, 12 and 999 — the reserved 24px box absorbs one and two digits with no reflow; check three.

**Measurements, before and after.**
- **Sheet height at 390×844:** 1,074px → **909px**; cart reachable at 1,034px → **128px**.
- **`font-mono` uses in `NavBar.tsx`:** 7 today, 5 of them words → **3, all figures**.
- **Contrast, computed on `--ink`:** panel note 4.22:1 → **6.7:1**; the all-row 4.99:1 → **14.4:1**; sheet children 5.8:1 → **8.7:1**; `Your account` 3.02:1 → deleted; the account popover's email label 1.9:1 → **5.8:1**.
- **Bar against the band beneath it:** 1.10:1 on `--ink`, `#101E17`, `--forest-deep` and `--altitude` today → after item 8's paper species, labels at **7.4:1** on paper and the rule at 2.9:1 / 5.6:1 on either side.
- **Target sizes:** small `MenuRow` 24px → **44px**; the all-row 32px → **44px**; the desktop labels stay 32px (`py-2`) and that is recorded as unfixed.
- **First paint:** the number of `/logo/mountain-mark.png` variants requested before the hero — 2 → **1** (item 15).

**Interaction passes.**
- Hover SHOP, then move the pointer 1,200px sideways inside the shade, then out of the header — the menu must hold and then close once. This is the specific failure item 2 was rebuilt to avoid.
- Move between SHOP and COLLECTIONS without the shade closing between them.
- Tab from the top of the document through the bar, into an open shade, and out — the ring visible at every stop. **Not meaningful until `design/01-hero.md` item 8 lands**; today the ring is forest at 1.67:1 on the hero ground.
- Open the sheet, Escape, and confirm focus returns to the hamburger; confirm `<main>` is `inert` while it is open.
- The scroll contract, unchanged: retract and return at `FLIP = 48` of accumulated travel under Lenis, at three depths, with a shade open (it must never retract) and with the sheet open (it must never retract).
- Add something to the cart on a second page load: the pill must not pop in and the icon cluster must not shift.

**Housekeeping.** Two notes from experience, so nobody loses an afternoon: **a mobile check needs a full relaunch** — a stale bundle looks identical to "my change didn't work" — and **the browser pane must be visible**, or screenshots come back blank and `innerWidth` reads 0, which makes a correct responsive layout look broken.
