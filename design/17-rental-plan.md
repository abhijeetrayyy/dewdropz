# 17 · The rental system — what is missing, and the plan

Read after `design/16-rentals.md`. That council fixed the money and the
lifecycle. This one is about the two things it left: **nobody can find the
gear, and a third of the back office still has no screen attached to it.**

---

## What the code actually says today

Verified by reading, not by trusting the last record.

| Claim | Reality |
|---|---|
| `rental_items` has a category | **No column.** `/rent` is one flat, ungrouped grid. |
| `/rent` can be searched | No search, no filter, no sort. Seven items, one list. |
| The shelf is visible before you commit | It is not. Both storefronts are pick-then-find-out. |
| `recordCounterPayment` gets the counter paid | **Zero callers.** Written last pass, never wired to a button. |
| `rental_events` is read somewhere | **21 writes, 0 reads.** Verified by grep. |
| `rental_events` is append-only (096:207) | No trigger. `service_role` — every rental write — can rewrite it. |
| `period` is derived so a caller cannot forget it (096:174) | Hand-built template string at `rentals.ts:533` and `:1100`. |
| `getMyRentalPaymentState`, `getMyRentalExtensions` | Zero callers each. |
| Admin bookings can be filtered by status | `getRentalBookings(status?)` accepts one. No UI passes it. |

The shop next door has `lib/shop-filter.ts` — pure functions, tested, URL as
the single source of truth — and a 280px filter rail with counts on every
facet. The rental locker, which is the harder browse (availability is a
calendar, not a number), got none of it.

## The one sentence

**Availability is the whole product and it is invisible until checkout.** Every
storefront item below follows from that; every admin item below follows from
"the log exists and nothing shows it".

---

## Phase 1 · Foundation — schema and pure functions

**`109_rental_taxonomy.sql`** · `rental_categories` (slug, name, blurb, sort)
and `rental_items.category_id`. Single-select, not a junction table: a tent is
a shelter and nothing else, and `product_categories` exists for a catalogue
with a different problem. Plus the specs that can actually be filtered on —
`weight_grams`, `capacity`, and `specs JSONB` for the display table. Seeded
with the six shelves the seven items fall into.

**`110_rental_day_availability.sql`** · `rental_item_day_availability(item,
from, to)` and `rental_items_availability(from, to)`. Count-only, no customer,
no dates, `SECURITY DEFINER` with a pinned `search_path` — exactly the reasoning
097 wrote and for exactly the same reason. This is the function the terms page
used to promise.

**`111_rental_period_derived.sql`** · The council's own recommendation, cheapest
it will ever be. Freeze `buffer_days` on the reservation, add `returned_on`,
derive `period` in a BEFORE trigger from `[starts_on, coalesce(returned_on,
ends_on) + buffer_days + 1)`, and `CHECK (lower(period) = starts_on)`. Ships in
the same commit as the `returnBooking` change, because `:1100` currently frees
the shelf by writing a narrowed period and would silently stop working.

**`112_rental_events_append_only.sql`** · A trigger that refuses UPDATE and
DELETE. The comment at `096:207` becomes true.

**`lib/rental-filter.ts`** + tests · Search, category, fulfilment, price band,
capacity, availability, sort — pure functions over plain data, the shape
`lib/shop-filter.ts` established so `npm test` can hold them to account.

## Phase 2 · The storefront

**Date-first browse.** A date bar at the top of `/rent`. Pick a range once and
every card reports its own shelf — *4 free*, *2 left*, *none free* — and the
range travels into the item page, so the dates are chosen once for the whole
visit. This is the feature; the rest is navigation.

**The rail.** Category, availability, collect/post, price band, weight. Counts
on every value. URL is the state, so a filtered locker is shareable and the
back button works.

**Search.** Over name, summary, description and category. Client-side over an
already-loaded list, because seven items do not need a round trip — and said
plainly rather than pretending to be more than it is.

**Sort.** Rate, name, and lightest-first, which is the one an outdoor list
actually needs.

**The item calendar.** A month grid of per-day free counts on `/rent/[slug]`,
replacing two bare `<input type="date">` you fill in blind and get refused
after. Click a day to start, click another to end.

## Phase 3 · The back office

**Wire the counter payment.** `recordCounterPayment` exists, is correct, and has
no button. Four of four bookings are counter sales reading `unpaid`. This is the
smallest change on the list and the only one that touches every trade the shop
has actually done.

**The booking drawer.** One reader for `rental_events`, with the damage photos
`getRentalPhotos` already returns. Built once, per the council's warning about
one artefact and three proposed readers.

**A bookings list that can be worked.** Status filter (the action already takes
it), overdue first, search by number, email or phone, and a count — replacing
`.limit(100)` newest-first with no filter.

**Catalogue management.** Category and specs in the editor, bulk unit add
(six tents, one paste), and unit condition with its history.

## Phase 4 · Consistency

Rental admin screens carry grey shadcn utilities while the rest of the surface
is the forest/paper token system. Scoped to the rental screens only.

---

## Deliberately not doing

| | Why |
|---|---|
| A multi-item cart | Open question 6 for the client — it changes deposits, delivery and the refund policy at once. |
| Cancellation-band, GST-on-late-fee, weight-based-delivery changes | Commercial decisions, still open questions 1/3/5. |
| Barcode scanning, carrier integration, drag-and-drop calendar | Upheld from the council's Killed table. |
| A server-side search index | Seven items. Revisit at fifty. |
| Re-pitching the palette or type | Standing constraint. |

---

## Built — 2026-08-31

`npx tsc --noEmit` clean · `npm test` **227 pass / 0 fail** (67 new) · `npm run
build` succeeds · `eslint` clean on every touched file · all four migrations
applied and verified against the live database.

### Schema

**109 · taxonomy and specifications.** `rental_categories` with six shelves,
`rental_items.category_id`, and `weight_grams` / `capacity` / `specs`. The eight
items in the locker are shelved and their capacities filled in from what their
own names already claim; weight is left NULL rather than guessed, because an
invented figure on a facet people choose gear by is worse than an honest gap.
The `specs` CHECK went through an immutable function — a CHECK constraint may
not contain a subquery, which is how the first attempt failed.

**110 · the shelf, before you commit to it.** `rental_items_availability(from,
to)` for the whole grid in one call, and `rental_item_day_availability(item,
from, to)` for the picker. Both `SECURITY DEFINER` with a pinned `search_path`
and both returning counts only — the reasoning 097 wrote, for the same reason:
an anonymous caller sees zero reservation rows under RLS, so any count computed
under the caller's privileges reports everything free, always.

**111 · `period` is derived.** The exclusion constraint that makes overbooking
unreachable tests `period` and nothing else, and `period` was a template string
in two files. It is now a trigger over `starts_on`, a FROZEN `buffer_days`, and
a new `returned_on` — so an early return still frees the shelf, by stating the
fact rather than restating the arithmetic. Verified by writing
`[2020-01-01,2020-01-02)` into a live reservation and watching it come back
`[2026-09-12,2026-09-17)`.

**112 · the append-only log is append-only.** `096:207` claimed it; nothing
enforced it, and `service_role` — which every rental write uses — could rewrite
any row. Verified: both UPDATE and DELETE are now refused.

### The storefront

**`lib/rental-filter.ts`** — search, shelves, fulfilment, rate bands, capacity,
availability, sort. Pure, URL-round-tripping, 40 tests. Three asymmetries are
deliberate and each has a test named after it: gear with no capacity is never
hidden by a capacity filter (a trip for two still needs poles); unweighed gear
sorts LAST under "lightest first"; and "only what is free" is inert without
dates rather than emptying the page.

**`lib/calendarGrid.ts`** — a deliberate port of `mobile/lib/rent/dates.ts`
across a package boundary the bundlers cannot share, with a test that imports
BOTH and asserts they agree over four years of months. Duplication that is
checked rather than hoped for.

**`/rent`** — the dates are the first control on the page and part of the URL,
so every card reports its own shelf and "the tents free that weekend" is a link.
A rail with a count on every value, a search box, five sorts, chips, and shelf
headings that disappear the moment somebody narrows. The phone gets the same
rail in a sheet, with the focus trap and scroll lock the shop's rail had to
learn the hard way.

**`/rent/[slug]`** — a two-month availability calendar instead of two date
fields you filled in blind and were refused after. Two months because a hire
that starts on the 31st and ends on the 4th is the most ordinary thing this
shop sells, and on one month it showed a single highlighted cell under a line
reading "5 days selected". Plus a breadcrumb through the shelf, the recorded
specifications, and the dates carried in from the locker.

### The back office

**The counter gets paid, on a screen.** `recordCounterPayment` was written,
correct, and had zero callers; every booking this shop has taken is a counter
sale reading `unpaid`. It is a button carrying both figures, with a disclosure
for part payments. **This is the smallest change in this record and the one
that touches every trade the shop has actually done.**

**The history that nothing read.** `rental_events` had 28 write sites and no
readers. `getRentalHistory` is one function with one authorisation rule — admin
via the service role, customer via the RLS policy migration 096 already had —
and `RentalHistory.tsx` is the one component that draws it, on the operator's
card and the customer's. Not `requireAdmin()`, which redirects, and would have
bounced a customer opening their own booking to the homepage.

**A bookings list that can be worked.** Status tabs including a synthetic
Overdue resolved from the dates, search across number/email/phone with LIKE
wildcards escaped, pagination with an exact count, and overdue marked on the
card rather than only findable under a filter.

**Batches.** `expandUnitCodes` understands `FST-005..010`, is tested at the
boundary, and reports partial success — "4 added, 2 already there" and "6
added" are different facts about a shelf.

### Still open

The admin's grey shadcn utilities, against the forest/paper tokens everything
else uses — the new controls are tokenised, the surrounding cards are not.
Partial returns, the payment webhook and reconciler, and extension per-line
money are unchanged from the last record. Every "open question for the client"
in `design/16-rentals.md` is still open and none was pre-empted here.

---

## Paid to reserve — 2026-08-31, second pass

`npx tsc --noEmit` clean · `npm test` **250 pass / 0 fail** (23 new) · `npm run
build` succeeds · mobile `tsc` clean · migration 113 applied and its invariants
verified against the live database.

**The rule: gear is held when the rental is paid, not when the form is
submitted.** The deposit is unchanged and deliberately so — collected gear has
a counter and a counter can take cash, which is cheaper for the shop and
several thousand rupees less out of somebody's account while they are on a
mountain. A posted rental has no counter, so its deposit goes through the
gateway before dispatch.

### The state that had to exist

"Pay first" cannot mean "write the booking after the payment clears": the
thirty seconds to two minutes while a bank OTP arrives is exactly when two
people would otherwise pay for the same last tent. So `pending_payment` is a
claim on the shelf with a deadline —

    pending_payment ──paid──> reserved ──> out ──> returned ──> closed
          └──expired──> cancelled

**The deadline is the whole design.** Without it, an abandoned checkout holds a
unit forever, and because the exclusion constraint is doing its job that unit is
genuinely unbookable — a pay-to-reserve flow without an expiry is a
denial-of-inventory feature. Verified live: a hold takes a tent from 4 free to
3; the moment its deadline passes all three availability functions report 4
again *before any sweep runs*; the sweep then cancels the booking and its
reservations, stamps `cancelled_by = 'expired'`, and writes the event.

The real release happens **inline in the booking write**, not on the cron, so a
customer never loses the last tent to somebody else's dead payment sheet. The
cron is tidying. That distinction is written into both functions, because a
future reader who gets it backwards will shorten the window to compensate.

### The cancellation policy, rewritten

The old bands were 100 / 50 / **0**, and they were written for a shop where
nobody had paid anything. That last band cost a customer nothing — the rent was
still in their pocket. The moment a reservation requires payment, the identical
sentence means the shop keeps 100% of money already taken from a card, which is
the most reliable way to turn one disappointed customer into a chargeback and a
review.

What the shop actually loses is the chance to re-let the unit — near zero a
fortnight out, near total the night before — plus the gateway fee, which is not
returned on a refund. So: slope the bands, never reach zero, never charge for
notice that costs nothing.

| | |
|---|---|
| Within 24h of booking | **everything back**, however close the dates |
| 7+ days | everything back |
| 3–6 days | three quarters |
| 2 days | half |
| inside 2 days | **a quarter — never nothing** |
| the deposit, always | **all of it**, no exception |
| **the shop cancels** | **everything back, whatever the notice** |

That last row closes a real defect rather than adding a feature: the old code
had **no way to express who cancelled**, so an admin calling off a booking the
night before — because a tent came back damaged — applied the *customer's* band
and the shop kept three quarters of their money. The shop must never profit
from its own failure. `cancelled_by` is the column; the test named after it is
the proof.

### Said upfront, in four places

The figure and the date are on screen **before** the money moves — "Cancel free
until 13 September", above the button, not in fine print. The breakdown now
separates **Pay now to reserve** from **Deposit, at the counter**; it used to
sum both into one strong line reading *At the counter — ₹11,124*, a figure due
in two places at two times, which is the most expensive kind of wrong. The
cancel dialog fetches the real quote and shows what comes back **and what is
kept**, with the rule that decided it. `/rent/terms` gained a whole section on
how paying works, which it had never had.

Every one of those numbers is the same `cancellationQuote` the refund itself
runs. Not a second implementation that agrees today.

### What the tests caught

A band-only convenience wrapper, added for the refund path, passed epoch `0` for
both timestamps to mean "no grace window here" — and zero hours apart is very
much inside a 24-hour grace window. It granted a **full refund on every
cancellation in the shop**, on the one code path that moves money. It was
deleted rather than fixed: a function whose safe use depends on remembering a
sentinel will eventually be called without it. There is a test asserting it
stays deleted.

### Deliberately not done, and why

**Mobile cannot complete a rental payment.** The Expo app has no rental payment
step, and its one Razorpay pattern is itself marked *⚠ UNVERIFIED — there are no
Razorpay credentials in this repository*. Shipping an unverifiable payment flow
into a store build is worse than saying so. What was done instead: the mobile
API now returns `requiresPayment` and `holdExpiresAt` so a client cannot mistake
a hold for a reservation by reading the field it always read, and the screen's
"Nothing is charged now" — false on three surfaces the moment this shipped — was
corrected. **The Expo payment step is the next piece of work, and until it
lands, mobile bookings are holds that expire.**

**The gateway leg is untested end to end here.** There are no Razorpay keys in
this environment, so `startRentalPayment` returns "Payments are not configured".
Everything around it — the hold, the expiry, the availability recovery, the
sweep, the policy arithmetic, the confirmation path's guards — is verified.

**Bookings can no longer be hard-deleted once they have history.** Migration
112 made `rental_events` append-only and the cascade now refuses, which is
correct for financial history and worth knowing before somebody tries. The one
`DELETE` in the codebase is the booking-creation rollback, which runs before any
event exists.

### Still open

Guests can look a booking up but cannot cancel one — `cancelMyRentalBooking`
needs a session, and that gap predates this pass. Store credit as an alternative
to a cash refund would be the brand-safest instrument of all and needs a
subsystem that does not exist. The admin's surrounding grey utilities, partial
returns, and the payment webhook/reconciler are unchanged.

---

## The phone catches up — 2026-09-01, third pass

`npx tsc --noEmit` clean on both packages · `npm test` **277 pass / 0 fail** (27
new) · `npm run build` succeeds · **`npx expo export` bundles clean** · eslint
clean on every touched file.

The last pass ended with a stated gap: *"until the Expo payment step lands,
mobile bookings are holds that expire."* This closes it, and brings the rest of
the locker to parity.

### The payment step

A hosted page, `/rent/pay/[bookingId]`, opened by the app in a browser sheet and
returned by deep link — the same shape as the shop's `/pay/[orderId]`, and for
the same reasons: `react-native-razorpay` is a native module to maintain, a
store rebuild to adopt, and the publishable key inside the app bundle.
Razorpay's checkout **is** a web widget. The page doubles as the web's own
"finish paying" link for a dismissed sheet.

**One deep link, not two,** and it is the interesting decision. `/pay/[orderId]`
returns to a success route or a cancelled route depending on how the sheet
closed. A rental HOLD cannot work that way: it can be paid, still held, or
already swept, and *the browser is not the authority on which* — the sweep runs
server-side and may fire while the sheet is open. So every exit returns to the
same place, the app **re-reads the booking from the database**, and says what is
actually true. A flow that guessed would eventually tell somebody "reserved"
about gear that went back on the shelf while they typed an OTP.

### One refund, three callers

`cancelMyRentalBooking` (web action), `cancelRentalBooking` (admin, cancelling
as the SHOP) and now a REST route for Expo all needed the same behaviour. The
first two shared a private function inside `actions/rentals.ts`; the third could
not reach it. So the whole cancellation subsystem moved to `lib/rentalCancel.ts`
behind `server-only`.

Adding the phone by writing the refund a second time was never an option — a
second implementation of a refund is a second opinion about somebody's money,
and this repo has the receipts: `lib/checkoutPricing.ts` exists because the app
once quoted ₹2,049 for a hoodie the server billed at ₹2,226.88.

`GET` and `POST` live on **one** route so the price and the act cannot drift —
one pricing with the grace window and the other without is exactly the failure
the shared library exists to prevent.

### Parity in the locker

`mobile/lib/rental-filter.ts` is a port, and the header says why an import was
refused: `mobile/tsconfig.json` carries a `@dewdropz/web/*` alias pointing at
the web root, it is used by nothing, and Metro has no matching `watchFolders`.
**An import through it typechecks cleanly and fails at runtime, on a device,
after a store build.** That is worse than duplication.

The drift it invites is closed by `mobile/lib/rental-filter.test.ts`, which
imports **both** implementations and asserts they agree across every dimension,
every sort and all three deliberate asymmetries — gear with no capacity is never
hidden by a capacity filter, unweighed gear sorts last, "only what's free" is
inert without dates. Fourteen filter combinations, compared by resulting ids and
order.

The rent tab now leads with the dates, shows a live shelf badge on every row,
searches, filters through a sheet with counts on every value, sorts five ways,
and groups by shelf until somebody narrows. The item screen's calendar shows
per-day counts with full days struck through. Bookings gained the hold state
with its "finish paying" bar, cancellation with the quote shown first, and the
`rental_events` timeline the app had a policy for and no screen using.

`reserved` also moved from clay to forest on the status pill, and it had to:
under pay-to-reserve, `pending_payment` and `reserved` mean opposite things —
a countdown versus money received — and leaving both in clay made the
distinction invisible on the one screen where it decides whether there is
anything left to do.

### What is verified, and what is not

**Verified:** both typecheckers, 277 tests including the drift guard, the web
build, an `expo export` bundle (which is what proves every new import resolves
under Metro), and the hosted pay page rendering a real booking's number and
amount off the live database.

**Not verified:** the gateway leg, still — there are no Razorpay credentials in
this repository, so no payment sheet has ever opened, on either surface. And
**the mobile screens have not been seen running.** They compile, bundle, lint
and share their logic with a web implementation that was checked in a browser;
that is not the same as a screenshot on a device, which is what
`mobile/DESIGN-PLAN.md` sets as the bar for "done". Those screens should be
walked through on iOS and Android before this is called finished.

---

## Run on a device — 2026-09-01

iPhone 17 Pro simulator, iOS 26.5, Xcode 26.6. Native build succeeded, app
installed, Metro serving a fresh bundle. `mobile/DESIGN-PLAN.md` sets the bar
for "done" as a screenshot of the whole screen and a sentence saying why it is
now good; this is the first pass at clearing it for the rental screens.

### What was seen working

The locker with its forest masthead and "8 IN THE LOCKER"; the date band with
its three presets; **tapping "This weekend" set 5 → 6 Sep and every row grew a
live shelf badge** — 8 FREE, 6 FREE, 3 FREE — read from the real database;
shelf headings with their blurbs and counts; the search field; the filter sheet
with a count on **every** facet, whose rate bands sum to 8 exactly as the
partition test asserts; the item screen with dates carried in from the locker,
the split `Pay now to reserve` / `Deposit, at the counter`, the cancellation
assurance, and `Pay and reserve ₹236` with the figure on the control; the month
calendar with the carried dates selected; the quantity stepper, the
collect/post toggle, and "6 free for those dates"; the signed-out bookings
screen.

Three different items priced correctly against the server — ₹2,124, ₹236 and
₹2,006 — and the tent's figures matched the web browser check exactly.

### The bug it found

**"Cancel free until 29 Aug." — on the first of September.**

`fullRefundDeadline` returned `start − 7 days` unconditionally. For a hire
beginning inside the next week that date is in the PAST, so both storefronts
printed a promise about money, before payment, that had already expired. It was
invisible in the browser check because the start date I happened to use was far
enough out to hide it, and invisible in review because the arithmetic is
obviously correct — it is the *applicability* that is wrong.

`today` is now a required parameter, the function returns null once the day has
gone, and both surfaces fall back to the grace window — which is not a fallback
but the genuinely applicable rule: cancel within a day of booking and
everything comes back, however close the dates. Two tests guard it, one named
after the bug.

**This is the argument for running the thing.** Typecheck, lint, 279 tests, a
web build and an `expo export` bundle all passed with that copy in place.

### A correction to the record

Mid-session I wrote that the item screen "does not scroll — that is a real
finding". It was not. Taps were landing ~36 device points high because the
Simulator window's chrome height was assumed rather than measured, so the back
button was hitting the status bar; the OS reported it as a `UIStatusBarTapAction`
while the screen sat there looking merely unresponsive. Calibrating against that
log signal fixed it and everything scrolled. Noted because "the app is broken"
and "my tooling is lying to me" produce identical screenshots.

### Still not verified

**Signed-in bookings.** The simulator has no session, so the hold bar with its
"finish paying" tap, the cancellation sheet with its live quote, and the
`rental_events` timeline were not seen running. They need an account.

**The payment sheet.** Still no Razorpay credentials anywhere in this
repository, on any surface.

### Noticed while looking

`Microspikes` carries a photograph of a **downhill skier**. It is seed data from
`scripts/seed-rental-catalogue.mjs` (`snowTraction`, described there as "edging
across hard snow") and predates this work, but it is wrong for the product and
it is the first thing a customer sees on that row.
