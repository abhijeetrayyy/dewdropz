# 16 · The rental system — council record

The whole system: storefront, back office, domain model, money, jobs, mobile.
Eleven independent lenses, three adversarial judges, ~100 findings reduced to 65
distinct defects. Method as in `design/15-shop.md`.

**Read "Killed" and "Where this council is wrong" before proposing anything.**
Four proposals here were good reasoning and must not ship, and one of the
council's own headline findings dissolves on arithmetic.

---

## The number every proposal must be judged against

The council wrote, in eleven different voices, about "the failure that happens in
week three of the season". The database says:

| | count |
|---|---|
| `rental_items` | 8 |
| `rental_units` | 39 |
| units in `repair` or `retired` | **0** |
| `rental_bookings`, ever | **4** — all `pickup`, all `payment_status: 'unpaid'`, oldest 3 days |
| `rental_reservations` | 4 — no booking has ever had two lines |
| `rental_extensions` | **0** |
| `invoices`, any kind | **0** |

**Week one has not happened.** The findings are almost all real and the sharpest
were independently re-verified. But the framing systematically over-rates defects
on paths that have never executed — extension rounding, invoice reconciliation,
gateway deposit verification — and under-rates the one path that has run four
times out of four and is unrecorded end to end: **the counter sale**.

A defect on a path that has run zero times is a pre-launch correction. A defect
on the only trade the shop currently does is the live problem.

---

## The verdict, in one paragraph

The primitives are unusually good and the surface on top of them is thin. One row
per physical unit; a GiST exclusion constraint that makes double-booking
unreachable; a GST invoice on the shared statutory series with an advisory lock
and a reconciliation check; evidence photos in a genuinely private bucket; seven
RLS tables with zero write policies and every read owner-scoped. **That is
already industrial.** What is missing is not sophistication — it is that roughly
a third of the back office has no screen attached to it, and that five server
actions hold the service-role key with no gate in front.

So the answer to "make it more complex, more industrial" is mostly: **finish
wiring what is already built, and close the holes underneath it** — then add
capability on top of a system whose arithmetic is right and whose shelf tells the
truth.

---

## Fixed during the council

**`claimGuestRentalBookings` — an anonymous booking-takeover endpoint. CLOSED.**

Four lenses filed it; the security lens made it its one thing and ran the exploit
against the dev server. It took both halves of the identity as parameters, had no
`getUser()`, no rate limit, and opened the service-role client. Worse than
"claim bookings for an address you know": the match was `.ilike('email', …)` on
unescaped input, and `email ILIKE '%'` matches every row. One request with
`["<any uuid>", "%"]` took every unclaimed rental booking in the database — and
because the web form never sends a `userId`, *every* website booking is
unclaimed. The customer list with home addresses and phone numbers, plus the
power to cancel the season.

It is migration 093's defect — a control whose name asserts a check it does not
perform — one layer above where 093 looked.

Now: no parameters, identity from `getUser()`, body in `lib/rentalClaim.ts`
behind `import 'server-only'` so it registers no endpoint, matching on `.eq`.

**And the fix introduced a regression, which the synthesis judge caught.**
`.eq` is case-sensitive and nothing normalised `rental_bookings.email`, so every
guest booking made by somebody who typed a capital letter became permanently
unclaimable. `bookingSchema` now lowercases on write, migration
`103_rental_email_normalised.sql` backfills, and a CHECK stops a future writer
bypassing zod from reintroducing it. Recorded because a security fix that quietly
breaks a feature is how security fixes get reverted.

---

## Built — 2026-08-31

`npx tsc --noEmit` clean · `npm test` **140 pass / 0 fail** (15 new) · `npm run
build` succeeds · `eslint` clean on every touched file · mobile `tsc` clean.

**Security.** `claimGuestRentalBookings` takes no parameters, derives identity
from `getUser()`, and lives in `lib/rentalClaim.ts` behind `server-only` so it
registers no endpoint. Migration `105` normalises `rental_bookings.email` and
adds a CHECK, closing the regression the `.eq` swap introduced.

**Money.**
- `106_rental_deposit_binding.sql` adds `deposit_order_id` and `deposit_taken`.
  `startDepositPayment` now stores the order and reuses a live one instead of
  minting a second; `verifyDepositPayment` loads the booking FIRST, refuses
  unless the stored order matches, and signs against the **stored** id. The
  forgeable deposit is closed.
- `recordCounterPayment()` — the counter gets paid, in the database. It writes
  `amount_paid`, `payment_status`, `paid_at`, the cash `deposit_taken`, a
  `payment_received` event, and enqueues `rental.invoice`, which had only ever
  fired for gateway money. This was 4 of 4 bookings and entirely unrecorded.
- Cancellation is a money event. `lib/rentalPolicy.ts` holds the bands (full
  refund ≥7 days, half inside a week, none inside two days, **deposit always
  returned in full**); `cancellationRefund()` is pure and tested; both cancel
  paths refund through the gateway, write `payment_status: 'refunded'` and the
  `refunded` event — two values the schema has had since migration 100 that no
  code path could reach. `/rent/terms` renders the same object, so the page and
  the refund cannot drift.
- The settlement guard is `deposit_settled_at`, not `deposit_refunded > 0`, so a
  full forfeiture can no longer be settled repeatedly.

**Lifecycle.** Every transition now claims with `.select('id')` and reads the
result — the idiom already in `rentalOps.ts`. `handOverBooking` no longer
reports success on a booking it did not touch, and refuses a posted booking
whose gateway deposit is unpaid instead of dying on a CHECK. `returnBooking`
requires `status = 'out'`, takes a **`returnedOn`** date, ignores cancelled
lines, checks every reservation release (recording the ones that fail rather
than leaving a unit silently unbookable), and leaves `deposit_state` to
`refundRentalDeposit`, so the recovery button renders for the case it was
written for. `cancelRentalBooking` refuses an `out` booking outright.

**The clock.** `lib/shopTime.ts` + 7 tests that pass under any `TZ`. Applied to
`bookingNumber()`, `returnBooking`, `setUnitCondition`, the reminder sweep, the
day sheet and the reports. `bookingSchema` now floors `startsOn` at the shop's
today and caps it a year out — the quote endpoint used to price a hire starting
in January 2025 with `errors: []`.

**Reliability.** `sendEmail` throws on Resend's error return, reconnecting all
fourteen templates to the retry queue and `/admin/jobs`. The sweep is IST,
bounded (`.limit(500)`), self-healing (`<= tomorrow` within a 7-day window
instead of exact equality, so a missed run no longer loses that day's reminders
forever), and rolls its claim back when `enqueue` fails. `.github/workflows/
rental-reminders.yml` schedules it at 09:00 IST — **after** the mail fix, not
before — and the route refuses to run without `RESEND_API_KEY` so a
misconfigured run cannot burn every claim.

**Storefront.** The coupon is in the quote's dependency array, so the price on
screen is the price on the row; a rejected code no longer unmounts its own
Remove button or blocks Reserve. `id="main"` on all five rental pages. Seven
`text-sage` body uses → `text-forest` (2.61:1 → 9.48:1). The availability live
region is mounted empty so it actually announces. The Reserve button keeps full
contrast when disabled instead of dropping to 1.33:1 on every re-quote.

**Back office.** `/admin/rentals/today` — the day sheet, printable, overdue
first, unit codes leading, tappable phone numbers. The query had existed with
zero callers since the rental work began. Its `coming` list now filters on
`status = 'out'`, so gear returned this morning stops showing as due back this
afternoon.

**Mobile.** The address is in the quote's cache key (keyed on state + postcode
only, so a street name does not refetch), closing the measured ₹7,168.20 →
₹7,073.80 gap. The "you pay when you collect" promise now branches on
fulfilment in all three places it appeared — app, confirmation email, and the
account card that rendered it beside a Pay button.

### Not yet built, in the order the plan puts them
Extension per-line money (`rental_extension_lines`); the `period` trigger; a
reader for `rental_events`; partial returns; the webhook + reconciler; the
availability calendar; the admin token restyle; mobile pay/extend/cancel.

### Noted while building
`lib/trek-lifecycle.test.ts` has two tests that fail under a non-IST `TZ`
(`TZ=America/New_York npm test`). Pre-existing, unrelated to rentals, and the
same class of bug `lib/shopTime.ts` was written to end.

---

## Ships first — the seven cheap corrections that are live today

None needs a migration, none needs a client decision, together they are under a
day. Ordered.

**0 · `lib/email.ts:20` — throw on `res.error`.** Three lines, and it governs
everything else that sends. Resend v6 returns `{data:null, error:{…}}` rather
than throwing, so a 429 or an unverified-domain 403 resolves normally, the job is
marked `done`, and a `reminder_sent` row is written asserting the customer was
told. This reconnects all fourteen templates in the shop to the retry, backoff,
`last_error` and admin screen that already exist and are already correct. Expect
`/admin/jobs` to light up with real pre-existing failures; that is the point.

**1 · Guard every transition** (`actions/rentals.ts`). Adopt the idiom already in
the repo at `rentalOps.ts:328` — a claiming update whose result is read:
`handOverBooking` gets `.select('id')` and a row-count test with the reservation
update and both events moved inside the success branch; `returnBooking` gets
`.eq('status','out')`; `cancelRentalBooking` gets a status guard and claims the
booking *before* cancelling reservations, so a failed claim never frees a shelf
holding gear that is in somebody's rucksack.

**2 · Settle the deposit before calling it settled.** `returnBooking` writes
`deposit_state: 'refunded'` and only then attempts the gateway refund; on failure
the row says refunded, `deposit_refunded` is 0, and
`RentalBookingOps.tsx:94` — which gates the recovery button on `state === 'held'`
— cannot render it. The comment promising manual recovery is false. Let
`refundRentalDeposit` own that column.

**3 · The coupon dependency** (`RentBooking.tsx:89`). `coupon` is read at `:79`
and sent at `:106` and is not in the effect's deps, so applying a code re-quotes
nothing while the booking re-prices with it. **The price on the screen is not the
price on the row whenever a code is used.** Lift the field out of the block that
unmounts it, and split `couponError` from `quoteError`.

**4 · Rate limits.** `createRentalBooking` and `quoteRental` have none while five
neighbours in the same file do. 25 unauthenticated booking POSTs were fired at
the mobile route; 25 reached the business logic. The one endpoint that consumes
physical inventory is the one that is unthrottled.

**5 · The five-line accessibility patch.** `id="main"` on the five rental
`<main>` elements (the skip link is dead across the entire flow); `text-sage` →
`text-forest` on seven body-text uses (2.61:1 → 9.48:1); lift
`RentBooking.tsx:182`'s `aria-live` out of the conditional that renders it, so
the region is mounted empty and the sentence the whole booking turns on —
*"3 free for those dates"* — actually announces.

**6 · Stop promising the wrong thing about money.** `mobile .../[slug].tsx:414`
tells every customer "you pay when you collect"; for a posted rental there is no
collection, and three other surfaces disagree with the code.

**7 · One `shopToday()` on `Asia/Kolkata`**, replacing ~12
`toISOString().slice(0,10)` sites, plus a server-side floor on `startsOn` (the
quote endpoint prices a hire starting in January 2025 with no error). Port
`mobile/lib/rent/dates.test.ts` — it is written and it passes.

**Then the one that is actually live and unbuilt: the counter gets paid.**
`recordCounterPayment` + a `deposit_taken` column. Four of four bookings are
pickup and read `unpaid`; nothing in the system ever moves a cash rental to paid,
so no invoice is ever issued, no receipt exists, and the deposit taken in cash is
never recorded. Under-rated by its own lens; promoted here.

---

## The two builds that earn their size

**`period` as a database fact** (`103_rental_period_is_derived.sql`). The
exclusion constraint tests `period` and nothing else, and `period` is built by
hand as a template string in three files. `096:174` already claims the correct
design — *"it cannot be forgotten by a caller because no caller writes it"* — and
does not implement it. Freeze `buffer_days` on the reservation, add `returned_on`,
derive `period` in a trigger that ignores what the caller sent, `CHECK (lower(period)
= starts_on)`. **Cheapest it will ever be: four reservations to backfill.** Ship it
in the same deploy as the `returnBooking` rewrite, which currently frees the shelf
by writing a narrowed period and would silently stop working under the trigger.

**The availability calendar.** Three lenses want it; `/rent/terms:112` already
tells customers it exists — *"the calendar already accounts for it: if a date
shows as free, it is free."* There is no calendar. Both storefronts are
pick-then-find-out. A count-only, anon-safe `rental_item_day_availability(item,
from, to)`, following exactly the reasoning `097` wrote for
`rental_available_units`, serving one picker to web and app.

**But it goes after the guards.** It is a funnel pointed at a booking endpoint
that as of this council has no rate limit, no idempotency key, first-fit unit
assignment that maximises collisions, no retry, and a refusal message that lies
about why. A busier booking path is a worse booking path until those land. Delete
the false sentence on the terms page **now**, not on the day the calendar ships.

---

## Killed — do not re-propose

| Idea | Why |
|---|---|
| **Recover damage from the deposit before late fees** | `settleDeposit` is **order-invariant** — run over four cases in both orderings, the customer pays the same and the shop keeps the same in every one. The "damage recovers nothing" example is true as a label on the residue, not as a rupee. And the direction is wrong: `/rent/terms:76` waives late fees above the deposit but promises nothing about damage, so the proposal converts a recoverable claim into an unrecoverable one and calls it fairness. **This is this council's confidently-wrong finding.** |
| **Collapse the four coupon refusals to "not valid"** | Optimises oracle bits; costs a customer holding a real code being told it is fake. This is the shop council's overruled mistake verbatim — optimising a measurable quantity and losing what the measurement cannot see. The enumeration risk is closed by the *other* half of the same proposal (rate-limit the quote), which ships. |
| **Flip `Surface`'s `bordered` default repo-wide** | The finding is right: the component written to enforce Law 02 breaches it by default. The remedy is a repo-wide visual change to fix six rental call sites, touching `/shop` and `/account` — pages the client has already reviewed. Pass `bordered={false}` at the six call sites. |
| **A +1/+3/+7/+14 overdue escalation ladder** | Overturns a documented decision — *"a system that emails somebody daily about a tent is a system people mute"* — with no new evidence, for a shop with zero overdue rentals on a mailer with no scheduler. **One** extra chase at day 7 naming the amount and the cap passes, plus an operator alert, which the shop genuinely lacks. |
| **A four-column admin search box** | The shop council killed a search box at 10 products. This is 4 bookings. Pagination and a status filter pass — `.limit(100)` with no filter is a landmine — the search box revisits at ~50. |
| **Drag-and-drop calendar · barcode scanning · carrier integration** | Upheld from the admin lens's own Killed table, all three correctly reasoned. Reassignment via a menu gets 90% of the drag-and-drop value without a week of pointer maths. |
| **An `overdue` value in the status CHECK** | It is a function of dates; a stored one needs a sweep to set and another to un-set. A view and a filter. |
| **Re-running `returnBooking` as the damage-amendment path** | A money bug wearing a feature's clothes — it recomputes a larger late fee from a later `today` and re-settles the deposit. |
| **Re-pitching the storefront palette or type** | Standing constraint. The design lens correctly refines execution only. |
| **Adopting `PageHeader.tsx`** | Standing prohibition from the shop council: it animates opacity on content entry across seven pages. |

---

## Where this council is wrong about itself

- **Its most-cited P1 was fixed while it sat.** Four lenses proposed it; one filed
  a live `curl` proof that was true when it ran and false four minutes later. A
  council reading a working tree is reading a moving target — "verified live"
  carries a timestamp. `actions/rentals.ts` alone is +234/−44 uncommitted.
- **The damage-before-late-fees finding is arithmetically inert.** See Killed.
- **The `enable_tax` harm cannot happen as described.** The stated harm — an
  unregistered shop collecting unremittable tax — is blocked: `issue_rental_invoice`
  refuses without a GSTIN *before* the tax check. The real defect is narrower: a
  *registered* shop that unticks the box keeps charging rental GST and can then
  never issue an invoice for anything, including money already taken. P3, and the
  safer fix may be to refuse the toggle rather than silently zero the tax.
- **`weightGrams` → 1 kg has nil impact today.** Every configured shipping rate is
  `flat`, and weight is only read for `weight_based`. It was heading for the plan
  as a money leak; it is a latent P3.
- **"Block extensions on unpaid bookings" would block every extension the shop can
  make.** All four bookings are unpaid pickup, and nothing moves a counter rental
  to paid. Gate on `payment_method = 'razorpay'`, or ship it strictly after the
  counter-payment path exists.
- **Nine new emails were proposed into a pipe that is not connected.** No lens but
  one noticed that `sendEmail` cannot tell a rejection from a delivery and that no
  scheduler calls the rental cron at all. That ordering has to govern the whole
  plan, not one lens.
- **One artefact, three proposed readers.** `rental_events` — 21 writes, 0 reads —
  was found by four lenses proposing three different readers. It is one query with
  three presentations. Build it once, or it becomes the three hand-written
  `period` strings all over again.
- **A priority inversion.** The design lens rates "admin uses grey utilities" P1
  alongside "the sentence the booking turns on is unreadable". One is read by the
  owner; the other decides whether a customer can rent a tent.

---

## Open questions for the client

Each changes a customer-facing promise or a commercial rule. None is ours.

1. **Cancellation.** A customer cancels a booking they have paid for — what comes
   back, and by when? `/rent/terms` contains no occurrence of "cancel", and the
   code refunds nothing while the toast congratulates them.
2. **May we auto-cancel an unpaid reservation, and after how long?**
3. **GST on late fees and damage charges?** `096:45` says the intent is yes, the
   code does not, and the terms page tells the customer GST applies to "the rental
   and any delivery". Client *and* accountant — it is a tax position.
4. **"Capped at the deposit" — what does that mean when the deposit is zero?**
   Today the cap silently disappears.
5. **Weight-based delivery.** Everything posts as 1 kg and the charge is doubled
   for the return leg. Correcting it raises posted prices.
6. **Multi-item rentals.** Three items today means three bookings, three deposits
   and ₹240 × 3 to post one parcel. Cart, or "call the shop"?
7. **How far ahead may somebody book?** Today: 2031.
8. **"The return label is in the box" — is it?** The code emails it once and no
   other copy exists anywhere.
9. **Should a customer be able to extend before paying?**
10. **Should `/rent` list gear that is entirely in repair?** Label it, never hide
    it — the client has already overruled hiding once.
11. **`enable_tax` and rentals** — stop charging, or refuse the toggle?
12. **Mobile payments before the six Razorpay branches are tested?** Recommend no.
13. **Shop opening hours**, for `pickup_slot` — in the schema, the write path and
    the day sheet, and NULL on all four bookings.

---

## Corrections to the record

- `actions/rentalOps.ts` documents a day-sheet email the shop "wants in the
  morning"; `getRentalDaySheet` has zero callers and is `requireAdmin()`-gated, so
  the cron path its own docstring describes is impossible as written.
- `app/rent/terms/page.tsx:112` states the calendar accounts for the cleaning
  buffer. There is no calendar. Delete the sentence.
- `lib/rentalMath.ts:69` says `daysToBreakEven` is rate-independent. Measured
  across seven rates, it is not — it happens to be stable only at the 15% the test
  uses. The function has no production caller; fix the comment, not the function.
- `096:207` calls `rental_events` an append-only log. It has no append-only
  trigger and `service_role` — which every rental write uses — can rewrite it.
