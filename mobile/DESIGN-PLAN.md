# DewDropz Mobile — Design Plan

**Status:** living document. Started 28 Aug 2026.
**Scope:** every screen in the Expo app, the navigation above them, and the
component layer underneath. Web is out of scope here except where the two must
agree.

Each screen is signed off the same way: **design → implement → screenshot on
both iOS and Android → confirm in writing**. A screen is not "done" because the
code compiles. It is done when there is a screenshot of the whole page and a
sentence saying why it is now good.

---

## 1. What this business actually sells

This matters because the app currently presents about a third of it. Six
offerings, in the order a customer meets them:

| # | Offering | Where it lives today | Mobile surface |
|---|----------|---------------------|----------------|
| 1 | **Apparel & drinkware** — small-batch tees, hoodies, sweatshirts, mugs, bottles | `products`, `collections` | Shop tab ✅ |
| 2 | **The studio** — print your own artwork on a blank; design library; the custom range (finished pieces marked as studio work) | `customize`, `design_library` | Studio tab ✅ |
| 3 | **Rental** — tents, bags, packs, poles, traction, camp kitchen, bundles, by the day with a deposit | `rental_items` + 4 tables | Buried in Account ⚠️ |
| 4 | **Trek Buddy** — find people to walk with: plans, requests, co-hosts, messages, vouches, safety, recaps | **17 `trek_*` tables**, 14 web routes | **Absent** ❌ |
| 5 | **Trails** — the Uttarakhand guide: altitude, season, difficulty, base | `lib/trails.ts` (local) | Buried in Account ⚠️ |
| 6 | **The journal** — field notes and editorial | `lib/editorial.ts` (local) | Buried in Account ⚠️ |

Plus one the client has stated and we do **not** yet sell: **adventure equipment
for purchase** (as distinct from rental). Today a tent can only be rented. There
is no "buy the gear" path, no equipment category, no equipment product type.

**The headline problem:** the tab bar is Home / Shop / Studio / Pack / You. Two
of six offerings are top-level. Rental, Trek Buddy, Trails and the Journal are
either a row in a settings-style list or entirely missing. A person who installs
this app cannot discover most of what the company does.

---

## 2. What is wrong today — the evidence

From a contact sheet of all 29 reachable screens, captured 28 Aug:

1. **15 of 29 screens opened with the identical black header panel.** One
   `ScreenHeader` component served every pushed screen, so Collections, Saved,
   Orders, Addresses, Designs, Notifications, Settings, About, Sustainability,
   Journal, Trails and the gear locker were the same slab with different words.
   *(Partly addressed — see §3.2.)*

2. **The palette was barely used.** `altitude` (#142536), `clay` (#B8826B),
   `warmPaper` (#F4EBD7), `sage12`, `forest12`, `rust` all existed in
   `lib/theme.ts` and appeared on **none** of these screens. The dullness was
   unused paint, not a missing palette.

3. **Whole pages are a single flat cream field.** Addresses, Designs,
   Notifications, Saved, Rentals and the empty Pack were 80%+ empty `#FBF7EF`
   with small dark text and hairlines. No band, no photograph, no tonal shift.

4. **Structure was text, not objects.** An address was a paragraph with vertical
   padding. A saved design — the thing the customer *made* — was a 62px
   thumbnail in a list row.

5. **Full pages are shorter than they look.** Scroll-and-stitch shows most
   secondary screens end within 1.5 viewports. There is not enough on them.

---

## 3. The design language

### 3.1 The brief, in one line

**Mature and clear, with real life in it.** Not a joker. Not a flat cream page
either. The test for every screen: *does this page have a reason to be looked
at, or is it a list of facts on beige?*

### 3.2 The four tonal families (implemented)

Screens belong to a family, and the family owns the header ground, the status
cap, and the accent used for chips and rules. Every pairing below is measured,
not eyeballed.

| Family | Ground | Used by | paper-on-ground |
|--------|--------|---------|-----------------|
| **ink** | `#101512` | Journal, Trails, About, Sustainability — the editorial voice | 17.27:1 |
| **altitude** | `#142536` | Notifications, Settings — system and technical | 14.58:1 |
| **forest** | `#1B3315` | Rent, Rentals, Collections — gear and outdoors | 12.84:1 |
| **warm** | `#F4EBD7` (light) | Orders, Saved, Addresses, Designs — your own things | ink 15.56:1 |

Rejected on measurement, not taste: `clay` as a ground (3.05:1 with paper text),
sage eyebrow on mid-`forest` (3.63:1). Both fail for text and were dropped
rather than nudged.

`warm` is deliberately the light one. Four dark headers would be four slabs
again.

### 3.3 Rules that apply to every screen

1. **No screen is one flat field.** Every screen carries at least one of: a
   full-bleed photograph, a dark band, or a tinted ground. Cream is the paper
   between things, never the whole page.
2. **Colour encodes meaning.** A chip's colour is the family of the screen it
   opens. Unread is tinted; read is not. Default address is forest-edged.
   Nothing is coloured for decoration alone.
3. **Objects, not paragraphs.** Anything actionable is a card with an edge, a
   fill, or a plate. If a thing can be tapped it looks like a thing.
4. **Photography does the heavy lifting.** The rental catalogue proved it: the
   same layout went from dead to alive purely by having real photographs. Every
   list that *can* carry an image should.
5. **The full page is the unit.** Design to the bottom of the scroll, not to
   the fold. A screen that ends after 1.2 viewports needs more, or needs to
   merge into another screen.
6. **Contrast is computed before it ships.** Any new fg/bg pair gets checked.
   Text ≥ 4.5:1, non-text ≥ 3:1, disabled exempt.
7. **Motion is punctuation.** Entrance stagger on lists, the header collapse,
   nothing else. No bouncing, no confetti.

### 3.4 Where "pop" comes from

In order of power, and none of it is a bright accent colour:

1. **Photographs at size** — full-bleed heroes, 4:5 plates, two-up galleries.
2. **Dark bands as structure** — an ink or altitude section mid-page resets the
   eye and makes the cream feel deliberate.
3. **Scale contrast in type** — the display face is already there (hero → d1 →
   d2 → d3); most secondary screens only ever use one size of it.
4. **Tinted grounds per section** — `paperDeep`, `forest12`, `clay12`,
   `sage12`, altitude at 6%.
5. **Numbers set large** — the header stat block works; use the same idea
   in-page (days, altitude, DPI, deposit, count).

---

## 4. Navigation

### 4.1 The problem

Five tabs surface two of six offerings. Rent — a full commerce flow with its own
inventory, availability and lifecycle — is a row in the account list.

### 4.2 Proposal

**Tabs: Home · Shop · Rent · Studio · You**

- **Pack (cart) leaves the tab bar** and becomes a persistent header action with
  a count badge, the way every commerce app on a phone does it. It is a
  destination you visit with intent, not one of five equals.
- **Rent takes the freed slot.** It is the second-largest commerce surface in
  the business and currently undiscoverable.
- **Trek Buddy, Trails and Journal** are gathered under a redesigned **You →
  Explore**, and — more importantly — get real entry points on Home, which is
  where discovery actually happens.

### 4.3 Open question for the client

Trek Buddy is big enough to deserve its own tab (it has messages, requests and
notifications of its own — things people return to daily). Six tabs is one too
many. The honest options:

- **A.** Home · Shop · Rent · Buddy · You, cart in the header, Studio promoted
  on Home and inside Shop.
- **B.** Home · Shop · Rent · Studio · You, Buddy reached from Home and You.
- **C.** Home · Explore · Shop · Studio · You, where Explore holds Rent, Trails,
  Journal and Buddy.

**Recommendation: A**, if Trek Buddy is a product we are actually pushing.
Otherwise **B**. This one needs the client's answer because it is a business
decision, not a design one.

**BUILT: B (28 Aug).** A tab cannot point at a product with zero screens, and
Trek Buddy has none on mobile yet. So the bar is now **Home · Shop · Rent ·
Studio · You**, with the pack moved to the masthead beside search, saved and
notifications, carrying its count badge. Switching to **A** later costs one
line in `ICON`/`LABEL` plus a `Tabs.Screen`, once Buddy screens exist.

One trap worth recording: `href: null` on a `Tabs.Screen` removes a route from
expo-router's own tab bar and does **nothing** to a custom `tabBar`, which
renders `state.routes` directly — the pack duly reappeared as a sixth tab. The
bar now renders only routes present in `ICON`, so the guest list and the
lookup cannot drift apart.

---

## 5. Screen-by-screen

Legend — **DONE**: designed, built, screenshotted on both platforms, confirmed.
**NEXT**: planned, not built. **KEEP**: judged already strong, revisit later.

### 5.1 Tabs

| Screen | State | Plan |
|---|---|---|
| `(tabs)/index` Home | KEEP | Strongest screen in the app. Add entry points for Rent (done), Trek Buddy and Trails. Later: a "continue where you left off" band that includes an active rental. |
| `(tabs)/rent` Rent | **DONE** | Promoted from a buried account row to a tab. Forest header, no back arrow (tab roots have nothing behind them), reserves the floating pill's height. |
| `(tabs)/shop` The gear room | **DONE** | Category tiles now carry a real photograph borrowed from a product inside them; empty shelves are hidden rather than leading to "still being stocked"; a full-bleed forest band cross-sells the locker mid-page, which the shop never mentioned. Still to come: the Equipment category (§6.2). |
| `(tabs)/design` Studio | NEXT | The specs table (fabric/fit/print/turnaround) is genuinely good. The blank picker below it is small and grey. Make blanks 4:5 plates with colourway dots at size, and put one finished custom-range piece on the page as proof. |
| `(tabs)/cart` Pack — empty | **DONE** | Was the emptiest screen in the app on the tab closest to buying. Now three coloured route tiles (gear room / studio / rent), a `paperDeep` hero block, correct status-bar glyphs. |
| `(tabs)/cart` Pack — full | **DONE (correctness)** | Ink header, free-shipping rule and sticky summary are all good. Fixed a real defect: adding the same item from a card and from its own page produced two unmergeable lines of quantity 1. Still to do visually: line items as plates rather than rows. |
| `(tabs)/account` You | **DONE** | Eleven identical grey rows → chips colour-coded to the family each row opens. Ink chips for editorial, clay for your things, forest for studio/locker, altitude for system. |

### 5.2 Commerce

| Screen | State | Plan |
|---|---|---|
| `product/[slug]` | KEEP | Gallery, specs, reviews, size guide — already the second-strongest screen. Later: show rental availability when the item is also rentable. |
| `category/[slug]` | **DONE** | Hero was a black void; it now carries a photograph borrowed from a product in the category, and "the rest of the kit" no longer offers shelves with nothing on them. |
| `collections/index` | DONE (tone) | Forest header. Cards are good. |
| `collections/[slug]` | KEEP | Full-bleed hero, field conditions table. Strong. |
| `search` | **DONE** | Searched only the shop, so "tent" — a thing this business demonstrably offers — returned "nothing by that name". Now covers the locker too, with rates and photographs. |
| `saved` | DONE (tone) | Warm header. Empty state is honest. Revisit when it has content. |
| `checkout/*` | **DONE (gate)** | The signed-out gate was a sign-in form on an empty cream field, shown at the moment a person has decided to spend money — nothing on it acknowledged the pack they had just filled. It now shows their own items, a full-width CTA and three trust lines. The signed-in form itself is unchanged and still to be reviewed. |

### 5.3 Rental

| Screen | State | Plan |
|---|---|---|
| `rent/index` | **DONE** | Forest header, real photography, rate on the plate, fulfilment tag. |
| `rent/[slug]` | **DONE** | Photo pager with dots, rate row, calendar, server-priced bar, disabled-reason hint. |
| `rent/booked/[number]` | **DONE** | Forest header, booking number badge, honest guest-privacy state. |
| `rent/bookings` | DONE (tone) | Warm header. Needs content design once a real booking list exists: status timeline per booking, "extend", "report damage". |
| **`rent/[slug]/terms`** | NEW | Deposit, late fee, damage policy. Currently only prose on the confirmation screen. |

### 5.4 Your things

| Screen | State | Plan |
|---|---|---|
| `orders/index` | DONE (tone) | Warm header, status chips. Good. |
| `orders/[id]` | KEEP | Progress tracker is strong. |
| `orders/[id]/return` | NEXT | Not reviewed. |
| `addresses` | **DONE** | Cards, forest-edged default, pin badges, clay note aside. |
| **`addresses/new`** | NEW | **Real gap:** an address can only be created by checking out. There is no add-address form at all. |
| `designs` | **DONE** | Text list with 62px thumbs → two-up gallery, DPI warning as a chip on the plate. |
| `notifications` | **DONE** | Unread carries a tinted card and blue edge, not a 7px dot. Altitude family. |
| `settings` | DONE (tone) | Altitude header. Toggle rows are clean. |

### 5.5 Editorial

| Screen | State | Plan |
|---|---|---|
| `journal/index` | KEEP | Ink header, real imagery. |
| `journal/[id]` | KEEP | Strong article layout. |
| `trails/index` | KEEP | Altitude profile chart is the best data viz in the app. |
| `trails/[slug]` | KEEP | Good. Add: "rent what you need for this trail" — a direct line from a trail to the locker. |
| `about`, `sustainability` | KEEP | Pull quote and imagery carry them. |

### 5.6 Auth

| Screen | State | Plan |
|---|---|---|
| `auth/login`, `auth/signup` | NEXT | Dark panel + form. Serviceable but plain; the signup screen sells nothing. |
| **`auth/reset-password`** | NEW | Exists on web, missing on mobile. |

---

## 6. Screens that do not exist yet

Ordered by what they unlock.

### 6.1 Trek Buddy — the whole product (14 screens)

**DECIDED 28 Aug: web-only for now.** Not being ported this round; the effort
goes to commerce depth and equipment instead. This remains the largest single
gap in the app and the reason the tab bar stays at five with Studio in it.

Mobile has none of it. Web has: landing, basecamp, discover, new, yours,
`[id]`, `[id]/console`, people, `people/[id]`, messages, profile, safety,
setup, preview. Backed by 17 tables. When it is picked up it needs its own
plan and probably its own tab (§4.3 option A).

### 6.2 Equipment for sale — buy **or** rent, one item

**DECIDED 28 Aug: the same item carries both.** A tent has a buy price and a day
rate on one product page; the customer picks. This is better for the customer
than two near-identical listings, and it reuses the rental photography and
copy we already have.

Shape of the work:

1. **Model** — link the two catalogues rather than duplicating them:
   `rental_items.product_id → products.id`, nullable. A rental item with no
   product is rent-only (bundles, kits); a product with no rental row is
   buy-only (a tee). The pair is what makes an item both.
2. **Admin** — the gear editor picks the sellable product it corresponds to,
   and warns when only one half exists.
3. **Product page (web + mobile)** — a buy/rent choice, not two buttons of
   equal weight: buy is the primary, "or rent from ₹450/day" the secondary.
4. **Rental page** — the mirror: "own it instead — ₹12,000".
5. **Shop** — an **Equipment** category so gear is findable without going
   through the locker.

**BUILT 28 Aug.** Migration 098 adds `rental_items.product_id` (nullable,
unique where set, with a trigger refusing archived or inactive products).
`scripts/seed-equipment.mjs` creates six sellable pieces and links them; the
camp kitchen and the weekend bundle stay rent-only, which is the model working.
Both storefronts now offer the other half — "own it instead" on the rental page,
"rent it from ₹450 a day" on the product page — on web and mobile.

Settled, and written into the migration header: **stock and rental units do not
share a count.** `inventory_quantity` is what we can sell; `rental_units` plus
the exclusion constraint is what we can lend. Selling the last tent must not
empty the locker, and a tent coming back from hire must not become sellable
stock. Two questions, two mechanisms.

### 6.3 Support and trust

- **`contact` / help** — exists on web, missing on mobile. For a business where
  gear is collected in person and deposits are held, this is not optional.
- **`privacy`** — exists on web, missing on mobile.
- **Store / collection point** — rentals are collected in Dehradun. There is no
  screen saying where, when, or what to bring.

### 6.4 Smaller gaps

- `addresses/new` (see §5.4)
- Profile edit (name, phone) — settings has preferences only
- Reviews: write and see your own
- Rental terms (§5.3)

---

## 7. Component layer

The user asked for "every single component of React Native". Inventory, with
judgement:

**Strong, leave alone:** `Topography`, `AltitudeProfile`, `StatBand`,
`SpecTable`, `Marquee`, `Ridgeline`, `ProductGallery`, `StepIndicator`.

**Improved this pass:** `ScreenHeader` (four tones, height collapse that
actually collapses, re-measure on content change), `StatusCap` (follows the
tone), `Img`, account `NavRow` (tinted chips).

**Need work:**

| Component | Problem |
|---|---|
| ~~`EmptyState`~~ | **DONE** — takes a tone (neutral/warm/forest/altitude); the disc fills instead of outlining. Applied to 13 empty states across 9 screens. |
| `Card` | Barely used; most "cards" are ad-hoc `View`s with local styles. Either make it the one card or delete it. |
| ~~Status pills~~ | **DONE** — new `StatusPill` with one registry for orders and rentals. The two screens each kept their own copy of the same map, and the orders copy had already lost `refunded`. |
| `Button` | Five variants is right, but `primary` is the only one with presence. Needs a tinted variant for the family grounds. |
| `ProductCard` | Good, but hard-codes commerce assumptions; a rental and an equipment item need the same card. |
| `Skeleton` | Rectangles only. Should mirror the real layout (plate + two lines) so loading does not reflow. |
| `Sheet` | Used once. Size guide, filters and rental terms should all use it. |
| `Toast` | Fine. |

**Missing components we will need:** `StatusPill` (one shared status vocabulary),
`SectionBand` (the tinted/dark full-bleed band from §3.4), `Plate` (the 4:5
image tile used by designs, rentals, shop), `FigureRow` (large-number row),
`Timeline` (rental lifecycle + order progress share one), `Avatar` (Trek Buddy).

---

## 8. Order of work

1. **Navigation** — §4.3 answered, tabs restructured, cart moved to the header.
   Everything else depends on where screens live.
2. **Component layer** — `EmptyState` tones, `StatusPill`, `SectionBand`,
   `Plate`, `Skeleton` shapes. Cheaper to fix once than in twelve screens.
3. **Commerce depth** — Shop, Pack (full), Checkout, Category, Search.
4. **Equipment for sale** — model, admin, storefront.
5. **Trek Buddy on mobile** — its own plan.
6. **Support and trust** — contact, privacy, collection point.
7. **Sweep** — auth, order return, rental terms, address form.

---

## 9. Log

| Date | Screen | What changed | Verified |
|------|--------|--------------|----------|
| 28 Aug | `ScreenHeader` | Four tonal families; height collapse fixed; re-measures on content change | iOS + Android |
| 28 Aug | `StatusCap` | Follows the header tone (was hardcoded ink + light glyphs) | iOS + Android |
| 28 Aug | Addresses | Cards, forest-edged default, pin badges, clay aside | iOS + Android |
| 28 Aug | Designs | Two-up gallery, DPI chip on the plate | iOS |
| 28 Aug | Notifications | Unread tint + edge; "Mark all read" contrast 1.18 → 14.58 | iOS + Android |
| 28 Aug | Pack (empty) | Three route tiles incl. Rent; status-bar glyphs fixed | iOS + Android |
| 28 Aug | Account | Family-coloured chips on eleven rows | iOS + Android |
| 28 Aug | **Navigation** | Tabs → Home · Shop · Rent · Studio · You; pack moved to the masthead with its badge; `ScreenHeader` gained `showBack` so tab roots show no dead back arrow | iOS + Android |
| 28 Aug | `StatusPill` | One status registry for orders + rentals, replacing two drifting copies | iOS |
| 28 Aug | `EmptyState` | Four tones; 13 empty states across 9 screens now carry their family | iOS |
| 28 Aug | `SectionBand` | New full-bleed band (ink/forest/altitude) for interrupting a page and cross-selling between offerings | Android |
| 28 Aug | Shop | Photographed category tiles, empty shelves hidden, forest locker band; 4 products linked to their categories in the database | Android |
| 28 Aug | Category | Photographed hero, empty sibling shelves hidden | iOS + Android |
| 28 Aug | Search | Rentals included in results; empty state no longer double-navigates | Android |
| 28 Aug | **Equipment** | Migration 098 + 6 sellable pieces linked to their rental rows; buy↔rent offered both ways on web and mobile. 5 constraint probes | Web + Android |
| 28 Aug | Checkout gate | Pack summary, stretched CTA, trust lines; empty cream field gone | Android |
| 29 Aug | **Sign-in flow** | Sign-in stays mandatory; the journey around it rebuilt. Mobile gained return-to-intent (`afterAuth` + `?next=`); the guest cart is now adopted by the account on sign-in, joined with anything already saved there, by one shared server rule (`actions/cartAdoption.ts`). Proved on device: 2 tees local + 1 hoodie on the account → ₹4,297, landing on checkout | Android; web wiring static only |
| 28 Aug | Product page | **Bug:** the new rentable hook sat below an early return — "Rendered more hooks than during the previous render" crashed the screen. Moved above, with the others | Android |
| 28 Aug | Pack | **Bug:** `size` reached the store as `undefined`, `null` and `""` from different buttons, so `sameLine` split one line in two — two rows of qty 1, neither showing a size. Identity now normalises; 9 cases tested | Android |
| 28 Aug | `image_url ?? cover` | **Bug:** categories hold `''` not NULL, so `??` kept the empty string and every tile rendered a bare gradient. Swept the same trap in 4 more places (design preview fallbacks, web + mobile) | Android |

---

## 9 · The screen-variant audit — 1 Sep 2026

Driven by one question: *is the clock visible, and does this hold on the
thousands of phones that are not this one?* Every reachable screen captured on
the simulator and measured rather than eyeballed — a Swift tool that crops the
status-bar band and reports the WCAG contrast between its 5th and 95th
percentile luminance, which for that crop approximates glyph-against-background.

### Four defects, all fixed

**1 · The home screen's clock was near-black on a near-black photograph.**
Measured 3.0:1. `app/(tabs)/index.tsx` declared no `StatusBar` at all, so it
inherited `dark` from `app/_layout.tsx` — whose own comment says the full-bleed
dark-hero screens "mount their own light-icon override locally". This is one of
those screens and never did. Now light while the hero is showing, flipping on
scroll via `useAnimatedReaction` (not a second `onScroll`, which would fight
the `useScrollOffset` already on that ref). **3.0 → 9.6.**

**2 · `trails/[slug]` asked for light glyphs and never asked for anything
else.** They stayed white for the whole scroll, including over `C.paper` — the
cream this entire app is built on. White on #FBF7EF is not a low ratio, it is
an invisible clock. The hero is only 46% of the screen, so that state arrived
almost immediately. Now flips on the same threshold every other hero screen
uses.

**3 · Every icon in the app grew with Dynamic Type.** Material Symbols is a
ligature font, so an icon is a `<Text>` node — and Text scales. At
`accessibility-extra-large` the tab bar's 23px icons rendered at roughly 40px
inside a pill whose height is a layout constant: icons clipped through the
middle on all five tabs, labels ellipsised to "SH…", "STU…", "Y…". `TabBar`
already clamped its *labels* on exactly this argument and the icons were simply
never covered by it. `Icon` now sets `allowFontScaling={false}` — the `size`
prop **is** the intended dimension, and the text beside an icon still scales,
which is the channel carrying the meaning.

**4 · The rental item screen collapsed at accessibility sizes.** Its ScrollView
reserved a hardcoded `paddingBottom: 260` for a bottom bar that reflows; at
`accessibility-extra-large` the bar became ~60% of an 874pt screen, the content
area shrank to a sliver, and the product title was clipped through the middle of
its glyphs with the price, calendar and email fields unreachable. The bar is now
measured with `onLayout` — a number describing something that reflows cannot be
a constant — and its explanatory paragraph is capped at 1.6×, while the price
lines and the button label scale freely.

### Verified sound

Every other screen's clock ≥ 4.5:1. `OverlayHeader` already carries a scrim
behind the status bar and its comment documents why (product mockups are shot on
pale grey; white on near-white). All six tab screens reserve the floating tab
bar's footprint. Fixed bottom bars add `insets.bottom`; the cart correctly uses
`tabSpace` instead. Portrait-locked and `userInterfaceStyle: light`, so there is
no landscape or dark-mode surface to break. Every hardcoded width lives in a
horizontal rail or sits beside a flex/percentage sibling — nothing overflows a
narrow screen.

**iPad** (`supportsTablet: true`, 744pt): runs, nothing clipped or broken. It is
a phone layout stretched — body copy on the dark bands runs to ~90 characters,
above the comfortable measure. Constraining content to a max width is a design
decision, not a defect, and is not made here.

### Two things that looked like bugs and were not

A first capture pass reported **sixteen** screens failing. They were stacked
sheet cards: the harness deep-linked 28 routes onto one stack, and after a dozen
pushes iOS insets each screen below a dimmed backdrop with the status bar over
the backdrop. Sixteen screens measured identically and none of it was what a
user sees. The harness now resets to a tab root before each route.

The rent tab measured 1.09:1 on the iPhone 17e — a dark clock on dark forest.
It was a **stale bundle** captured mid-edit; a clean relaunch measures 5.2:1
with white glyphs, and `StatusCap` had been setting the right glyphs all along.
`memory: mobile-verification-needs-full-relaunch` says exactly this, and it cost
an hour anyway.

### Limits of this audit

- **No device narrower than 390pt exists in this simulator set.** Nothing at
  375pt (SE, 8) or 320pt (SE 1st gen) was tested. The static read says the
  layouts are fluid, but that is an argument, not a screenshot.
- **Screenshots are taken at scroll-top**, so scrolled states are largely
  untested by this method — defect 2 was found by reading code, not by capture.
- A freshly-installed app prompts **"Open in DewDropz?"** on its first
  custom-scheme URL, which silently blocked navigation on late-installed
  devices. Full-matrix capture on Pro Max and iPad is therefore spot-checks
  rather than the complete sweep it looks like.
- Android is untouched.

---

## 10 · The header flicker, and sizing by arithmetic — 1 Sep 2026

### The flicker was real, and it was on all fourteen screens

Reported on the gear locker; it belonged to `ScreenHeader`, which fourteen
screens use and all fourteen pass `scrollY` to.

**The cause.** The header animates its own `height`, and height is a LAYOUT
property — every frame of the collapse runs a full layout pass. While the
panel's content was free to size itself inside that shrinking box, the pass
re-flowed it. A frame captured mid-gesture showed the stats row gone, the lede
displaced to the bottom of the panel, and the locker's preset chips collapsed
from a row into a vertical stack with huge gaps. Not a wobble — a tear.

Measured, the header height went
`308 · 307.7 · 306.7 · 306.3 · 305.7 · 305.3 · 304.7 · 304.3 · 372 · 353`
— barely moving, then a 68pt excursion **above** its own resting height.

**The fix, in three views.** The wrapper clips (`overflow: hidden`); a middle
view is PINNED to the measured natural height so it is rigid and cannot reflow;
the innermost view stays free-sized and is what reports its height. The split
matters: pinning the measured view directly deadlocks it — it can never report
that it needs to be taller, so the locker's "8 IN THE LOCKER" figure would be
locked out the moment the data arrived, which is the exact bug the re-measure
was written to fix. Two earlier attempts failed for that reason and are recorded
in the file.

The fade was then pulled ahead of the clip (finishing at 0.62 of the handoff),
because a clip slices whatever it lands on and at the midpoint that was a
half-height line of the lede.

**After:** iOS `285 · 269 · 245 · 221 · 197 · 89`, Android
`255 · 231 · 77 · 77 · 77`. Monotonic on both, no excursion.

### Sizing is an argument, not a sample

Testing every device is neither possible nor the point. The property that makes
the layout device-independent is checkable by reading it:

**Anything that must relate to the viewport is expressed as a fraction of it.**
`HERO_H = SCREEN_H × 0.72` (home), `× 0.46` (trail), `× 0.44` (article),
`× 0.34` (category); grid cells at `48%`; frames at `100%` with an `aspectRatio`.
None of these has a pixel in it.

**Anything absolute is a physical object, and small.** Every absolute width
above 60pt is a thumbnail or a plate: 130 and 116 sit in horizontal rails where
width is unconstrained by definition; the largest inside a width-constrained row
is **96pt**. The narrowest device that has ever shipped an iPhone screen is
320pt; minus the 20pt gutter on each side that leaves **280pt** of content
width, so the flexible sibling beside a 96pt plate still gets 184pt. Roughly 3×
headroom, and it degrades gracefully rather than clipping. Android's common
360dp and this emulator's 411dp are both wider than the case that already
passes.

**Safe area is never a constant** — 25 files derive it from
`useSafeAreaInsets`, which is what makes a notch, a Dynamic Island and a bare
status bar all correct without a device list.

**The axis that actually breaks things is not width, it is type.** Both real
layout defects found in this audit were Dynamic Type, not screen size: icons
scaling inside fixed pills, and a bottom bar reflowing past its reserved
padding. Width has ~3× headroom by construction; type has none unless it is
bounded or measured.

### Android

Built and run on a Pixel 8 emulator (1080×2400 @ 420dpi = **411dp**). The gear
locker renders correctly — forest panel, white status glyphs, date band, chips
in a row, shelves, floating tab bar — and the header collapse is monotonic. No
Android-specific defect found on the screens exercised.

### What this pass did NOT establish

The fourteen screens other than the locker were not each re-checked after the
`ScreenHeader` change; the fix is in the shared component and the two platforms
agree, but that is an inference. No device narrower than 390pt exists in this
simulator set, so 320pt remains an argument rather than a screenshot. And only
the locker was exercised on Android.
