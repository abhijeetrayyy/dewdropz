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
