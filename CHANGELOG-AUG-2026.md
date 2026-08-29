# DEWDROPZ — Web Application Change Report

**Period:** 19 – 29 August 2026
**Scope:** The web application — storefront, checkout, account, admin, server actions, API routes, database and RLS. The Expo mobile app and `trekbuddy-game` are noted only where they share web code.
**Basis:** The last 20 commits (`5598349` → `23cabca`) plus the uncommitted work on `mobile-remediation`, read from the diffs rather than from the commit subjects.

> A note on the numbers in this document: every count is taken from `git` or from a re-run of the test suite. Where something is unverified or deliberately unfinished, it says so.

---

## At a glance

| | Committed (20 commits) | Uncommitted (working tree) |
| --- | --- | --- |
| Web files changed | 181 | 90 modified + 44 new |
| Lines added / removed | +24,657 / −4,993 | +2,467 / −1,399, plus ~7,400 new |
| Database migrations | 089 – 093 (5) | 094 – 099 (6) |
| Tests | 0 | **83 passing**, 17 suites |
| Design-system lint rules | 0 | 4 |

**The three headlines, in order of consequence:**

1. **The product catalogue was writable by anyone on the internet.** Fourteen RLS policies granted the public write access to `products` — including price. Fixed, verified against the live database, and written up in `PLATFORM-AUDIT.md`.
2. **The storefront got the design pass it never had.** Not a re-palette — the cream/forest system stays. The site had a complete design system defined in `app/globals.css` and was using almost none of it. ~240 off-ladder radii → 0; the elevation ladder went from 3 files to 18.
3. **Three commerce capabilities that did not exist now do:** a pre-set design library, a custom range that joins the studio to the catalogue, and gear rental with real date-range availability.

---

## 1. Security

This is the section that matters most, and it starts with a critical finding.

### 1.1 CRITICAL — the public could rewrite your prices · FIXED

*Commit `2d490a4`, migration `093_catalogue_rls_lockdown.sql`, full write-up in `PLATFORM-AUDIT.md`.*

Fourteen Row-Level Security policies were written as:

```sql
CREATE POLICY "Admin full access products" ON products FOR ALL USING (true);
```

In PostgreSQL a policy with **no `TO` clause applies to `PUBLIC`** — every role, including the unauthenticated `anon` role whose key ships in the JavaScript of every page load. Policies are OR'd together, so this did not give admins extra reach next to the public-read policy. It gave *everyone* total reach and made every other policy on those tables decorative.

**Tables affected:** `products`, `product_variants`, `collections`, `categories`, `product_categories`, `tags`, `product_tags`, `attributes`, `attribute_values`, `product_attribute_values`, `variant_option_values`, `inventory_movements`, `coupons`, `reviews`.

**Why it was the whole shop.** `lib/checkoutPricing.ts` is correctly built: one pricing function that both quotes and bills, reading `products.price` from the database precisely because the browser must not be trusted with a price. This defect undid it in three steps — set the price to one paisa with the public key, check out normally, and the server-side pricer faithfully bills one paisa. The idempotency key, the GST apportionment and the stock constraint then all operate on a number the attacker wrote. Also available: minting a 100%-off coupon, self-approving reviews, deleting the catalogue.

**Proved before the fix**, using only the anon key, with inserts chosen to violate a unique constraint so a `23505` proves RLS permitted the write while nothing was actually written:

```
coupons / tags / categories / collections   23505 — write allowed
products                                    UPDATE succeeded on a live row
```

**The fix.** All fourteen policies re-scoped `TO authenticated`, gated on `is_profile_admin()`, with `WITH CHECK` as well as `USING`. Nothing broke: every admin write goes through a server action holding the service-role key, and `service_role` bypasses RLS — these policies were never what made the admin screens work. Public `SELECT` policies untouched, so storefront reads are unaffected.

**Verified after:** `42501` on insert, zero rows on update and delete, price unchanged, storefront reads unaffected, build/typecheck/lint green.

**The process lesson.** Migration `063_profiles_rls_fix.sql` found this exact defect, explained it well — and fixed one table. Fourteen more had it and were never revisited. Worse, the migration files in the repository contain the *correct* admin check while the live database held `USING (true)`; nothing checks that the two agree.

### 1.2 HIGH — every live coupon code was publicly enumerable · FIXED

A policy named `Public read active coupons` allowed anyone with the anon key to list every active code with its type, value, minimum spend, maximum discount, usage limit and expiry. A discount code is something you *give* to someone; a readable list is a sitewide sale nobody decided to run.

Fixed by dropping the policy and moving `validateCoupon()` in `actions/cart.ts` to the service-role client. This is not a widening of trust — the action looks up the one code the customer typed and returns a yes/no and an amount. It never returns a list.

### 1.3 MEDIUM — stock levels and sales velocity were public · FIXED

`inventory_movements` was readable by `anon`, which exposed stock movement history — effectively sales volume and velocity, to any competitor. Now admin-only.

### 1.4 MEDIUM — `store_settings` exposes seller registration details · DOCUMENTED, NOT FIXED

`Anyone can read store settings` is `USING (true)` over a table that also holds `gstin`, `seller_legal_name` and the full seller address. Those columns are `null` today, which is the only reason this is not already a live leak — **and they cannot stay null**, because a GST-compliant invoice cannot be issued without them. The day the shop can invoice is the day its registration details go public.

RLS cannot fix it: RLS is row-level and has nothing to say about columns. The fix is a column-level `GRANT`, and it must ship with a code change, because `getStoreSettings()` does `select('*')` on the anon client and a column grant turns that into a permission error the function's own fallback silently swallows — every configured setting would quietly disappear and the homepage would revert to defaults.

**Sequence when it is done:** storefront column list on the public client → new `getAdminStoreSettings()` behind `requireAdmin()` + service role → admin screen switched over → then `REVOKE`/`GRANT`.

### 1.5 Third-party tracking was firing without configuration or consent · FIXED

*`providers/AnalyticsProvider.tsx`, new `providers/ConsentProvider.tsx`, `components/ConsentBanner.tsx`, `components/CookieChoicesLink.tsx`.*

Both analytics IDs fell back to placeholders (`G-XXXXXXXXXX`, `XXXXXXXXXXXXX`) and the scripts loaded unconditionally. Every visitor fetched Google Tag Manager and Facebook's `fbevents.js`, handed Meta a pageview keyed to a pixel that does not exist, and picked up third-party cookies. That collected nothing useful and cost something real: two ad-network requests per page load, and personal data leaving the site with no lawful basis under the DPDP Act or GDPR.

Now **two conditions, both required**: a real ID *and* an explicit yes from that visitor. A placeholder is not a configuration — if the ID is absent or still the placeholder, nothing loads at all. The banner is built to the two rules that are law rather than taste: refusing is as easy as agreeing (two buttons, same size, same prominence), and nothing loads until the answer is yes. It takes focus on appearing, so keyboard and screen-reader users meet it in order.

### 1.6 Stripe removed end to end

*`actions/payments.ts` (−140), `lib/stripe.ts` deleted, `app/api/webhooks/stripe/route.ts` deleted, dependency dropped, migration `099_drop_stripe.sql`.*

Razorpay is the gateway and COD is the other way to pay. What was left of Stripe was a half-integration: a checkout-session builder, a webhook route, a client, a dependency — and a database `CHECK` constraint still listing `'stripe'` as a permitted payment method. That constraint is how a removed integration comes back: some future path writes the string, nothing rejects it, and an order exists that no refund path can service. The constraint now permits `razorpay` and `cod` only.

Verified empty before dropping: zero orders on `'stripe'`, zero refunds, zero webhook events. Nothing was invalidated.

### 1.7 Smaller hardening

- **Guest-cart adoption fails safe.** The merge on sign-in (§2.4) is wrapped so a failure never blocks a successful sign-in — the local cart is untouched and checkout still syncs it, so the worst case is the status quo.
- **Rental availability is checked twice, on purpose** (§2.3): once in the action to produce a sentence a person can act on, and once by a database exclusion constraint, which is what actually makes a double booking impossible when two people book the last tent in the same second.
- **Rental pricing never trusts the browser.** A request carries slugs, dates and quantities; every rupee is resolved from `rental_items` and every unit from the same `rental_available_units(...)` function the storefront calendar reads.
- **Site origin unified** (`be0ad52`). New metadata introduced a second env var, `NEXT_PUBLIC_SITE_URL`, alongside the existing `NEXT_PUBLIC_APP_URL` that seven call sites — including `robots.ts` and `sitemap.ts` — already read. A parallel variable fails in the quietest way: sitemap and robots come out on the real domain while the canonical link and OG image keep pointing at a hardcoded fallback, and nothing errors.

---

## 2. Commerce features

### 2.1 The pre-set design library

*Commit `2dd248d`, migration `092`, `actions/designLibrary.ts`, `app/admin/designs/`, `components/customize/DesignLibraryPicker.tsx`.*

The client brief asked that "customer can select from our pre-set design ready library". It had no implementation at all — the studio offered exactly one door, *upload your own*, which silently excluded everybody who is not a designer.

New table, an admin screen at `/admin/designs` to curate artwork, and a picker in the studio that drops a design onto the garment **through the same path an upload takes** — so placement, print-quality checks and save all behave identically whether the artwork came from a customer's file or the shop's library.

### 2.2 The custom range — the studio joined to the catalogue

*Migrations `094_custom_range_links.sql`, `095_custom_range_is_a_flag.sql`; `actions/customRange.ts`, `components/sections/CustomRangeBanner.tsx`, `components/customize/BlankSwitcher.tsx`, `lib/customize/carryDesign.ts`.*

The studio and the catalogue had never known about each other. A *blank* is a product with `is_customizable` and print zones; a finished printed garment is an ordinary product row. Nothing joined them, so a printed tee could not say it came from the studio, a shopper looking at it had no route to "what else can go on this shirt", and the design library was free-floating artwork with no idea which garments it suited.

Three edges were added between rows that already exist — no new entity, because a printed tee *is* a product and library artwork *is* a design. The design is `is_custom_range` as a tick on the product, with `custom_blank_id` optionally naming the blank it was printed on. When the parent is known, the storefront can send a shopper straight into the studio on that exact garment; when it is null the page says so plainly and offers the blanks that do exist — a better answer than hiding the offer or opening the studio on the wrong shirt.

`carryDesign.ts` and `BlankSwitcher` let a shopper move a design they have already placed onto a different blank rather than starting again.

### 2.3 Renting gear

*Migrations `096_rentals.sql`, `097_rental_availability_sees_bookings.sql`, `098_gear_can_be_bought_or_rented.sql`; `actions/rentals.ts`, `lib/rentalPricing.ts`, `lib/rentalMath.ts`, `app/rent/`, `app/account/rentals/`, `app/admin/rentals/`, `app/api/mobile/rentals/`.*

A whole rental system, and it is deliberately **not** a flag on `products`. Every sale decrements `inventory_quantity` under a table-level `CHECK (inventory_quantity >= 0)`, which makes overselling impossible for every write path at once. That model cannot express a rental: a tent is not *gone* when somebody takes it — it is unavailable between the 12th and the 16th and back on the shelf after. Availability is a function of overlapping date ranges, not an integer, so it needed its own tables: `rental_items` (rate, deposit, limits, tax code), `rental_units` (the physical copies, each with its own condition), bookings and reservations.

Rentals check out separately from purchases — one booking, one lifecycle, one tax treatment. Nothing in migration 096 touches `orders`, `order_items` or `lib/checkoutPricing.ts`; the code that already bills people correctly was left exactly as it is.

**Pricing has its own function, for three reasons that are genuinely different from a sale:**

1. **GST is a service rate, not an HSN rate.** Hiring equipment is a supply of *service* (SAC, commonly 18%), not of goods. `priceCheckout` reads HSN per line and would charge a garment's 5%/12% on a tent hire.
2. **The deposit is not taxed and is not revenue.** It is refundable security, not consideration for a supply. Taxing it would overcharge every renter and overstate output tax. It sits outside the taxable base and is reported separately.
3. **Posted gear pays its return leg.** A hired tent has to come back; charging one-way delivery means the shop silently absorbing the return on every posted hire. Pickup pays nothing.

Migration 098 then joins the two catalogues: `rental_items.product_id` points at the sellable product, so the same tent can be bought *or* rented without a second listing that drifts the first time somebody edits one of them. `product_id IS NULL` means rent-only (bundles, the camp kitchen); a product with no rental row is buy-only; both means the customer chooses on either page.

The pure date and money rules live in `lib/rentalMath.ts` so they can be tested without a database — and they are, including a test pinning the bug that "today" must be the *local* date rather than UTC.

### 2.4 The cart now follows the account

*`actions/cartAdoption.ts`, wired into `components/auth/LoginForm.tsx`.*

Checkout requires an account, so every customer meets a sign-in screen while holding a full cart. Until now that cart lived only in the browser's `localStorage` and reached the database once, at checkout. Two consequences: add three things on a phone, sign in on a laptop, and the laptop's cart was empty; and signing in was a moment where a cart could be silently lost or doubled, because nothing defined what should happen when a guest cart and a saved cart both exist.

The rule, stated once so web and mobile behave identically:

- **The union of the two carts wins.** Nothing a person put in a cart is thrown away by the act of signing in — that is the one outcome nobody expects.
- **Identical lines** (same product, same variant, same custom design) have their quantities **added**, because two of a thing in two places is two of it.
- The merged cart is written to the account and handed back, so the client replaces its local copy rather than keeping a second, diverging one.

The same sign-in also claims any rental booked as a guest under that email, so it appears under "your rentals" instead of being reachable only through the lookup form.

### 2.5 The shop filter, rebuilt

*`components/sections/ShopContent.tsx` (+636/−…), new `components/shop/FilterSidebar.tsx`, `lib/shop-filter.ts`, 29 tests.*

Nine real defects in the old single scrolling strip. The functional one:

> **Filter state never reached the URL.** `ShopContent` read `?category=` on mount and had no `useRouter` at all. So a filtered shop could not be shared or bookmarked, the back button did not undo a filter, and opening a product and returning discarded the entire selection. For a commerce surface that is a functional defect, not a polish item.

The others: every dimension crammed into one horizontally-scrolling rail (so on a phone the price bands rendered *after* every category chip, past the right edge behind a drag, while on desktop 1280px of page width sat unused); single-select chips dressed as multi-select; department headings inside the scroll rail, so a group's heading was off-screen exactly when you had scrolled to that group; product counts at 50% opacity, failing contrast at 11px — the one thing that stops you selecting an empty result, rendered as decoration; collections acting as a filter dimension while looking nothing like the other controls; no size or colour filter at all, despite `product_variants` and `customization_config.colors` both existing; a raw OS `<select>` for sort in a page built from custom chips; and a `border-dashed` empty state on the one screen guaranteed to be seen by a frustrated user.

**What shipped** — after a first attempt at a two-tier disclosure bar was reviewed and replaced:

- **A left rail** with everything visible at once — Category (departments with children indented), Collection, Price, Size, Availability. No disclosure between the shopper and the choice.
- **Live facet counts** from `facetCount()`: the number a value *would* return with the other dimensions still applied. Zero-count options grey out and stop responding rather than disappearing, so the rail does not reflow under the pointer.
- **Sizes as a swatch grid**, four to a row — the control every apparel shop already uses.
- **Multi-select within and across dimensions**, with `aria-pressed` and checkbox semantics.
- **Every change writes to the URL** via `router.replace(..., { scroll: false })`. The URL is the single source of truth; there is no local copy to fall out of step.
- **The same rail on a phone**, in a sheet with a "Show N results" footer — not a reduced control. Body scroll locks, Escape closes.

Filtering moved out of the component into `lib/shop-filter.ts` as pure functions, which is what made 29 tests possible — and immediately earned itself: the rail surfaced a bug where a stocked *department* rendered both as a heading and as a loose checkbox below it, because the live catalogue assigns products directly to departments as well as to their children. Fixed in the tested module, with a test that pins it.

### 2.6 Checkout, cart and order lifecycle

- **Cart → checkout → success** reworked as one continuous flow rather than three separately-styled screens.
- **`app/pay/[orderId]`** — a standalone payment page (`PayClient`), which is what lets the mobile app hand an order off to a web payment surface.
- **Coupon validation** moved to the service-role client (§1.2).
- **Return eligibility** was split out of the server action into `returnEligibilityFor` so the mobile route runs *one* return policy rather than a second copy of it.
- **Stale-order release cron** and `lib/orders-internal.ts` adjusted alongside the Stripe removal.

### 2.7 Homepage and the 23 August client brief

*Commit `2dd248d`.*

The brief's changes in full, plus the two things it asked for that did not exist (§2.1, and editable trails below).

- **Hero:** "GO WHERE" removed; the line is *FEEL ALIVE.* — roman white, italic green, in the wordmark face. One line instead of two, so the ceiling goes 80 → 132px. Coordinate eyebrow, the drinkware sentence and the "from ₹899" on the button all struck out per the mark-up. Clear/fog/rain/snow left untouched, as asked.
- **The range reshaped:** sharper ridges, fewer and larger landforms, +16% relief with the valley floor pinned, and a lowered snowline so the peaks actually get caps.
- **A fourth act added second** — the collections, as a rack of three plates — because the film used to hand a stranger a design editor before showing them anything to design on.
- **New section order:** Hero → Collections → Essentials → Custom Studio → Trek Buddy → Trails, with the trust strip, season kit and climb moving below Trails, and the day-arc clock in `lib/trail.ts` re-cut to keep ascending.
- **Trails became editable.** The section read four routes hardcoded in `lib/constants`. They now come from `home_config` and are edited at `/admin/homepage`.

---

## 3. Colours and the design system

### 3.1 The palette decision — settled

The instruction was that the off-white cream reads sad. The finding was the opposite of a palette problem:

> **The site does not have a colour problem. It has a depth problem, and the two look identical from the outside.**

`app/globals.css` already defined a complete, carefully reasoned system — a three-step paper ladder (`--paper` → `--paper-warm` → `--paper-deep`), a lifted white card surface (`--surface`), a seven-rung radius ladder, a four-rung elevation ladder, and a warm accent (`--dawn`) introduced explicitly because the brand "read as tasteful but cold". Roughly 90 lines of comments explain why each rung exists.

Almost none of it was in use:

| Signal | Before | Meaning |
| --- | --- | --- |
| Files using the elevation ladder | **3** of 104 | Nothing on the site was lifted off the page. |
| `bg-surface` uses | 53 — all but 6 inside Trek Buddy | The storefront had no card surface. |
| Cream card on a cream ground | **75** | Cards were the same colour as the thing behind them. |
| Off-ladder radii | **≈240** | The enclosure hierarchy was flat. |

When a card is `#F8F5ED` on a `#F8F5ED` ground, separated by a 1px hairline and a 2px corner, it does not read as an object — it reads as a boxed-off region of the same sheet. Stack six of those and you get exactly the complaint: bland, flat, sad. **The cream was not doing that. The absence of a second plane was doing that.**

**The rule from here: cream is floor, not furniture.** A card is never cream; a card is white `--surface` with `--shadow-card` and the card radius rung. The ground steps `paper → paper-warm → paper-deep` to mark a change of subject. Dark anchors break long scrolls. `--dawn` is the single accent and stays rare.

This preserves the brand exactly as authored. It is a refinement of execution, not a re-pitch of the palette.

### 3.2 A new token: `--sage-lit`

*Commit `23cabca`.*

`--sage` at 132px over the hero terrain measures 4.75:1, while the cream half of the same headline measures 12.8:1. So "FEEL ALIVE." was one line carrying two different weights, and the green half visually receded — while the brief asks for that word to be the emphasis, not the quiet half. Same hue, luminance lifted until the two halves read as one line: **7.6:1**, a 1.6× gap instead of 2.7×. Scoped to large display type on dark grounds; `--sage` stays the UI green, where it was already correct.

### 3.3 Colour defects found and fixed

1. **`sand` and `rust` were never theme tokens** — used 17 times across the rent feature. In Tailwind v4 an undefined colour name compiles to nothing, so the rental cancel-confirmation button rendered **cream text on a transparent background**: an unreadable button on a destructive action. Two rental status pills had no background at all. Mapped to `--paper-deep` / `--clay-deep`.
2. **Sixteen form fields were invisible** — inputs across checkout, rent, Trek Buddy and the plan console filled cream on a cream page. No visible field until focused.
3. **Order status was encoded in colour alone** (`text-forest` / `text-sage` / `text-clay`), failing WCAG 1.4.1 — and sage against forest at 12px is a distinction almost nobody makes even with full colour vision.
4. **`--clay` was carrying small text at 3.26:1**, under AA, on the product page discount label, the low-stock warning and checkout errors. Moved to `--clay-deep` (5.79:1), which the palette had already defined for exactly this.
5. **Raw Tailwind palette colours in the account area** — `text-amber-600`, `bg-red-600`, `bg-red-700` — in a site with a defined semantic palette. `--clay-deep` and `--dawn` exist for these.
6. **Product cards with no photograph rendered as holes** — a bare cream rectangle where the image would be, which on a four-column row reads as a broken layout rather than a pending one. They now carry the brand's topographic motif on `--paper-deep` with the piece's initial in the display face.

### 3.4 The Studio — a correction worth recording

The first pass of the audit ranked the customizer 5.5/10 on grep signals alone (no `bg-surface`, no shadow tokens, 28 ad-hoc radii) and concluded it was styled as a utility. Reading the code showed the opposite: `components/customize/` runs on its own scoped token set, and that set is the most carefully reasoned in the codebase.

It is a dark, **achromatic** system, and deliberately so: the rest of the site is green, which is right for a brand about mountains and wrong for the one screen whose job is to judge colour. A green cast next to the garment "quietly lies about both — a warm print looks warmer against it, a grey marl looks green." Selection carries no hue either; it is signalled by luminance and an edge, so the tool never spends a colour it may need to show you honestly.

None of that was touched. What was actually wrong was the radii — 28 Tailwind defaults, so a colour swatch, a tool button and the canvas frame all enclosed at roughly the same value and read as one class of object. Mapped onto the ladder by enclosure size. 28 → 0.

### 3.5 The measured result

| Signal | Before | After |
| --- | --- | --- |
| Files using the elevation ladder | 3 | **18** |
| `bg-surface` uses | 53 (47 in Trek Buddy) | **94** |
| Off-ladder radii in `app/` (excl. admin) | ~120 | **0** |
| Off-ladder radii in `components/` (excl. ui, admin) | ~120 | **0** |
| Bare `rounded` (Tailwind's 4px default) | 17 | **0** |
| Undefined colour tokens (`sand`, `rust`) | 17 | **0** |
| Raw Tailwind palette in account | 5 | **0** |
| Invisible form fields | 16 | **0** |
| Shop filter tests | 0 | **29** |
| Design-system lint rules | 0 | **4** |

---

## 4. The header and navigation

*Commit `23cabca` (+516/−255 on `components/layout/NavBar.tsx`), plus `components/PageHeader.tsx`.*

The nav was substantially rebuilt:

- **A real mobile drawer**, with Escape-to-close and a scroll lock while it is open.
- **`aria-hidden` and `aria-label`** on the decorative and icon-only elements that had neither — icon-only buttons had no accessible name at all.
- **`PageHeader`** extended so section mastheads share one component rather than each page inventing its own.

Alongside it, the **auth form was split**. `AuthForm` carried login, signup and reset in one component branching on a `mode` prop. It became `AuthShell` (the frame), per-flow `LoginForm` / `SignupForm` / `ResetForm`, and a shared `fields` module. Every flow still submits through the server actions in `actions/auth` — nothing moved to the client, and no key or service-role client appears in any of the new files.

The **account area got its own header treatment** (§5): a full-bleed dark anchor band, because signing in should feel like crossing a threshold into somewhere, and a dark ground is the storefront's existing language for "the subject has changed".

---

## 5. The account pages

This is the area the brief named first, and it was measured as the least-finished on the site: seven pages, ~1,140 lines, **21 off-ladder radii and 0 on-ladder, 0 uses of `bg-surface`, 0 shadows.**

### What was wrong

| # | Defect |
| --- | --- |
| 5.1 | **Cards were invisible** — overview, addresses, designs and order detail all drew a cream card on a cream ground. The site-wide root cause at its most concentrated. |
| 5.2 | **2px corners on 600px panels.** Nothing was on the radius ladder at all. |
| 5.3 | **The sidebar was seven undifferentiated text links** — no active state, so you could not tell which page you were on. A nav that does not indicate position is failing its only job. |
| 5.4 | **Off-system colour** — `text-amber-600`, `bg-red-600`/`700` in a site with a semantic palette. |
| 5.5 | **Status was colour-only**, failing WCAG 1.4.1. |
| 5.6 | **The order number sat in a `bg-rule` pill** — a hairline border token used as a fill. It read as grey mud. |
| 5.7 | **The overview page had no content.** The signed-in landing screen was a three-cell box reading Name / Email / Orders Placed. The user already knows their name and email. No next action, no imagery, no in-flight order, no reorder path. |
| 5.8 | **A 72px headline over 12px grey text**, with nothing in between. Two extremes and no middle register is most of why the page read as empty. |
| 5.9 | **Pagination was two text arrows.** |

### What shipped

- **An account shell with a real rail** (`components/account/AccountRail.tsx`): white panel, panel radius, card shadow, `lucide-react` icons so each row has a silhouette and the list is scannable rather than read, an active state driven by `usePathname` — marked by fill *and* a rule down its left edge, so it survives being read in greyscale — and **live counts** on Orders, Designs and Rentals, because "Orders" and "Orders 12" are different invitations. The admin link is demoted to a properly tokenised footer entry rather than raw amber. The three counts are fetched in parallel so the shell is not three round-trips deep before it renders.
- **A dark anchor header** on the account layout, with a dawn hairline along its lower edge — the one warm note, and the reason the band reads as first light on a ridge rather than a dark box. The ground beneath steps to `--paper-warm`, so the white cards have something to sit on.
- **A dashboard worth landing on** (`app/account/page.tsx`, +258): the most recent in-flight order as a real card with its thumbnail, status track and delivery estimate; a reorder action; saved designs as a visual row; wishlist crossover. Name and email drop to a quiet identity strip.
- **`OrderTrack`** — four drawn stages (Confirmed → In the studio → On its way → Delivered). The account used to show order state as a single coloured word, which answers "what is it called" and not "how far along is it" — the only question the customer opened the page to ask. Cancelled and refunded orders never render it: a progress track for something that stopped is a lie about what happened next.
- **`StatusBadge`** — one shared component carrying **three** signals rather than one: a dot whose *form* differs (filled, ringed, hollow), a word, and a colour. Any two of the three are enough. Reused by account, admin and order tracking, which each previously re-implemented it, and it distinguishes *paid and waiting* from *on a van near you*, which the old single "not finished" green could not.
- **Every card on white with a shadow rung**, hover lifting a rung. `OrderCard`, `Pagination`, `CancelRentalButton` extracted as shared components.
- **Real pagination** with counts, on the chip language.
- **A typographic middle register** — an 18–24px step between the masthead and body text, so the pages have three levels instead of two.
- **`/account/rentals`** added, with cancellation.

All seven pages: **21 off-ladder radii → 0.**

---

## 6. Engineering quality and infrastructure

### 6.1 A test suite, where there was none

`npm test` / `npm run test:watch` on `node --test`. **83 tests, 17 suites, 0 failures.** Coverage is deliberately placed where money and correctness live rather than spread thin: `lib/shop-filter.test.ts` (29), `lib/rentalMath.test.ts`, `lib/formatPrice.test.ts`, and on the mobile side `mobile/lib/cartIdentity.test.ts`. The rental calendar suite includes a test pinning the bug that "today" must be the local date rather than UTC.

### 6.2 The design system, enforced

Four ESLint rules over `app/` and `components/`, exempting `components/ui/` (shadcn's own conventions) and admin (deliberately on the shadcn token block — it is an internal tool):

1. Off-ladder Tailwind radii.
2. A bordered box filled cream — an invisible card on a paper ground.
3. `sand` / `rust`, the tokens that compile to nothing.
4. Raw Tailwind palette colours, which bypass the semantic palette and miss the contrast work done on the real tokens.

They are **warnings, not errors**, so an intentional exception is a one-line disable comment rather than a blocked commit — but nothing drifts back silently.

### 6.3 The dev port disagreed with itself

*Commit `191dd3b`.* 3010 was already the real port — the launch config, `.env.local`, the mobile `apiUrl` and the Android emulator alias all used it. 3000 survived in `package.json`'s `dev` script, `.env.example`, the README and the robots/sitemap fallbacks. So `npm run dev` started the server on 3000 while the mobile client pointed at 3010, and the app simply could not reach its backend — nothing errored, the requests just went nowhere. Anyone who ran the documented command rather than the launch config hit it.

Also committed `.env.example`, which the blanket `.env*` ignore rule had been swallowing — the one env file that is useless unless it is committed. Verified before staging: every value is a short placeholder and none match a credential pattern.

### 6.4 SEO and metadata

`app/opengraph-image.tsx` added; `metadataBase`, canonical, `og:url`, `og:image` and every sitemap `<loc>` now resolve to the same origin from one variable (§1.7).

### 6.5 A performance change that was reverted, correctly

*Commits `e5036fe` then `f7344c2`.* The film grain overlay was baked from an `feTurbulence` filter to a tiled texture, on the back of a measurement claiming the overlay cost ~12% CPU. That measurement was wrong: it hid the grain and killed the WebGL hero in the same step and credited the drop to the grain, against a baseline that moved nearly six points between runs, read from a GPU process shared with the entire browser UI rather than this page.

Measured properly — in-page, a probe forcing a repaint under the overlay every frame, 180 frames per state, states interleaved to cancel drift — the page holds a locked 60fps either way: median 16.7ms with grain on and 16.7ms with it off, in both implementations. So there was no regression, and the change was reverted rather than kept for an 18 KB asset and a second way of doing the same thing.

Recorded because the discipline is the point: a change that cannot survive its own measurement does not ship.

### 6.6 A verification trap, recorded

Screenshots at a 390px window appeared to show every page clipping on the right — including pages the work never touched. A probe reporting its own `innerWidth` found the cause: **headless Chrome clamps the layout viewport to a 500px minimum** and then crops the image to the requested width. The overflow was entirely an artifact. Phone-width layout cannot be verified that way at all; use a real browser with device emulation.

Related and already in team memory: **Tailwind v4 scans `.md` and `.mjs` files.** Twice during this work a class-shaped string — first in a document, then in an ESLint rule message — generated invalid CSS and 500'd every route with an error pointing at `globals.css`.

---

## 7. Adjacent work (not storefront, same period)

Listed for completeness; these consumed a large share of the period's commits but are not ecommerce surfaces.

- **Trek Buddy remediation** (`0b4adf8` and the 19 August run): the mobile thumb bar rendered at the *top* of the screen because `backdrop-filter` on the header made it a containing block; 46 grids collapsed on phones because an implicit track is sized to `min-content` and `truncate` sets `nowrap`; `cost_paise = null` rendered as "Free" — the platform making a money claim on a host's behalf; the landing went from ~2,400 rendered words to 679 with nothing deleted (every removed sentence lives at `/trek-buddy/safety`); eleven accessibility failures fixed by measuring rather than looking; three migrations (089–091).
- **The Expo app** (`824f611`, `8d42da3`): the app computed `subtotal + FLAT_SHIPPING_RATE` on the device — GST is additive and was missing entirely, and the hardcoded ₹150 delivery is really a ₹120 zone rate. Measured: the app quoted ₹2,049 for a hoodie the server bills at ₹2,246.88, and because this is cash on delivery a courier collected the difference at somebody's door. `/api/mobile/quote` now calls the same `lib/checkoutPricing.ts` the web bills from, and no screen performs arithmetic on money. This is a *web* concern too: that endpoint, plus `/api/mobile/account`, `/cart`, `/rentals`, `/orders/[id]/cancel` and `/return`, are web routes serving the app.

---

## 8. What is still outstanding

| # | Item | Note |
| --- | --- | --- |
| 1 | **`store_settings` column leak** (§1.4) | Not a live leak *today* only because the GST columns are null. Must be fixed before the shop can invoice. Needs code + migration together. |
| 2 | **Razorpay on mobile is unverified** | Written with no credentials in the repository. It compiles and mirrors the working web flow; not one line has been run against the gateway. Six money-touching branches are flagged `⚠ UNVERIFIED` in the source. Do not enable it for customers until they are exercised against test keys. |
| 3 | **Migrations are not the source of truth** (§1.1) | The repository's migrations held the correct admin check while the live database held `USING (true)`, and nothing checks that they agree. This is the process gap that produced the critical finding, and it will produce the next one. |
| 4 | **Storefront commerce fundamentals: 5/10** | Per `PLATFORM-AUDIT.md` — search, content management and error handling are the weak areas. The hard problems (pricing, tax, orders, payments, stock) are built above the standard of most funded D2C stacks; the ordinary ones are not. |
| 5 | **Admin: 4/10** | Ranked last deliberately — staff-facing, and `ADMIN-AUDIT.md` covers its functional gaps. This period touched only the shared `StatCard`, `Sidebar` and table rhythm. |
| 6 | **The working tree is uncommitted** | Roughly 10,000 lines of the work described above — rentals, the custom range, the consent gate, the design-system pass, the tests — is unstaged on `mobile-remediation`. |

---

## Appendix A — commit ledger

| Commit | Date | Subject | Web relevance |
| --- | --- | --- | --- |
| `23cabca` | 27 Aug | Split the auth form, rebuild the nav, lift sage on dark | Header, auth, `--sage-lit`, shop sort/filter |
| `28744ce` | 26 Aug | Close the zoom seam, build the campfire properly | Homepage hero |
| `2d490a4` | 26 Aug | **The product catalogue was writable by anybody** | **Critical security** |
| `2dd248d` | 26 Aug | The 23 August client brief, end to end | Design library, hero, trails, section order |
| `dd14d44` | 21 Aug | Record the Android pass | Docs |
| `8d42da3` | 21 Aug | Two things Android found that iOS had hidden | Mobile |
| `824f611` | 21 Aug | Stop quoting a price the shop does not charge | Mobile API routes on the web |
| `0b4adf8` | 20 Aug | Trek Buddy: phone, money, provisions, front door | Trek Buddy + 3 migrations |
| `f7344c2` | 20 Aug | Revert the film-grain bake | Homepage perf |
| `e5036fe` | 20 Aug | Bake the film grain (reverted) | Homepage perf |
| `191dd3b` | 19 Aug | Make 3010 the port everything agrees on | Dev infra |
| `be0ad52` | 19 Aug | Read the site origin from one variable | SEO / config |
| `4cddb49` | 19 Aug | Homepage defects fixed against the existing page | Homepage, OG image, footer |
| `28f8455` … `5598349` | 19 Aug | Nine Trek Buddy commits | Trek Buddy |

## Appendix B — migrations

| Migration | What it does |
| --- | --- |
| `089_trek_plan_party` | Confirmed walkers on a plan |
| `090_trek_host_requests` | Hosting stays invite-only, but the gate is visible and requestable |
| `091_trek_recap_share` | Shareable recap tokens |
| `092_client_brief_23aug` | The design library table |
| `093_catalogue_rls_lockdown` | **The critical RLS fix — 14 policies** |
| `094_custom_range_links` | Three edges joining studio, catalogue and design library |
| `095_custom_range_is_a_flag` | `is_custom_range` on products |
| `096_rentals` | `rental_items`, `rental_units`, bookings, reservations |
| `097_rental_availability_sees_bookings` | Availability function accounts for bookings |
| `098_gear_can_be_bought_or_rented` | One tent, two ways to have it |
| `099_drop_stripe` | Payment method constraint narrowed to Razorpay + COD |

## Appendix C — companion documents

- `PLATFORM-AUDIT.md` — the full security and architecture audit, 26 August
- `WEB-POLISH.md` — the design-system programme, its route ledger and build rules, 29 August
- `TREKBUDDY-REMEDIATION.md`, `TREKBUDDY-OVERHAUL.md`, `TREKBUDDY-TIME-AUDIT.md`
- `MOBILE-REMEDIATION.md`, `mobile/DESIGN-PLAN.md`
- `ADMIN-AUDIT.md`
