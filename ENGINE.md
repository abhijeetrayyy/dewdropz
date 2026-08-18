# DEWDROPZ — Commerce Engine

Living document. The state of the engine, what has been verified, and what is
still missing to call this a mature platform. Updated as work lands — every
"Done" line below was verified against the running system, not assumed.

Benchmark: Shopify / Medusa. Not feature parity — those carry a decade of edge
cases we do not need. The bar is: **the money is always right, the stock is
always right, nothing silently lies to a customer, and one person can operate it
without a runbook.**

---

## 1. Verified working

Checked against the live database and the running app.

| Area | State | How it was verified |
|---|---|---|
| Order totals | Recomputed server-side from the cart; client prices never trusted | Read `createOrder`; Zod-validated, coupon revalidated |
| Stock | Decremented by DB trigger on `order_items`; CHECK stops negative | `021_stock_integrity.sql`; `createOrder` catches 23514 |
| Oversell | Blocked at table level, every write path | CHECK constraint, not per-function |
| Payment webhooks | Stripe `constructEvent`; Razorpay HMAC + `timingSafeEqual` | Read `actions/payments.ts` |
| Webhook replay | Idempotent by unique index, 23505 as dedupe signal | Read; same pattern reused for shipment events |
| Privilege escalation | `profiles.role` pinned by BEFORE UPDATE trigger | `021_stock_integrity.sql` |
| Coupon races | UNIQUE `(coupon_id,user_id)` + conditional increment | `021_stock_integrity.sql` |
| RLS | **33/33 tables** at the time of the audit; 40 tables today, each shipped with its policies in the same migration | Live query against `pg_class.relrowsecurity` |
| Admin auth | Role read from the DB, never a client claim; memoised per request so a page checks once | Read `lib/adminAuth.ts` |
| Cancellation | Compound: restores stock, releases coupon, refunds | Read `cancelOrderInternal` |
| Rate limiting | Postgres-backed, row-locked, fails open | Live: 3 allowed, 4th refused, other caller unaffected |
| Shipping (manual) | Multi-parcel, status derived, event history | Live end-to-end: admin Ship → customer sees parcel |
| Action reachability | Every admin-only action guarded; no unguarded reads | Enumerated all exports against their callers; 0 left |
| Session refresh | Refreshed in middleware, where cookies can be written | Live: stale-cookie request 200s and emits `Set-Cookie` |
| Money aggregates | Payment and analytics totals summed in Postgres | Field-by-field equality vs the JS they replaced |
| Inline edits | A cleared price or stock cell cannot save `0` | Live: field emptied past the debounce, DB still 25 |
| Storefront cache | Catalogue pages static + ISR 60s, admin edits revalidate | Live: `x-vercel-cache: HIT`, 5.35s → 0.22s |
| Admin lists | All ten server-rendered; no page fetches its first rows on mount | Rows present in the server HTML, search still filters |

### Shipping — verified end to end
Clicked **Ship** in admin → `shipments` row created (`provider=manual`,
Delhivery, AWB) → status `in_transit`, `shipped_at` stamped, 1 event → order
status derived to `shipped` → customer page shows *1 parcel*, AWB, track link and
scan history. Constraints proven live: two parcels on one order OK, duplicate AWB
rejected (23505), invalid status rejected (23514), replayed event deduped.

### How the admin was checked, and what that does not cover
Worth stating plainly, because "verified" is doing a lot of work in this
document. Admin screens sit behind a login, so they were exercised through a
**temporary local auth bypass** — an env-gated short-circuit in `ensureAdmin`
and `proxy.ts`, applied to a local production build, then restored from backup
and confirmed removed by checksum and a repo-wide grep every time. It was never
committed and never ran against production.

What that proves: the pages render, the queries return the right rows, the
tables lay out, the confirm dialogs open and cancel cleanly, an emptied number
field does not save zero.

What it does **not** prove: that a real admin session behaves identically —
above all `ensureAdmin`'s own redirect paths, which the bypass replaces. The
storefront, the database and the cron endpoints were all checked normally and
carry no such caveat. **A human click-through while genuinely signed in is still
the last mile on anything admin-side.**

---

## 2. Known gaps — prioritised

### P0 — correctness / risk
- [x] **`addTrackingInfo` retired.** ~~Two sources of truth.~~ Deleted; shipping
      goes through `actions/shipments.ts`. Migration `032` backfilled every
      legacy-tracked order into a real shipment (**0 left unbackfilled**). The
      old columns remain read-only fallbacks for pre-shipments orders.
- [x] **Admin audit log.** `admin_audit_log` + `lib/audit.ts`. Append-only by
      construction: **SELECT is the only policy**, so writes happen through the
      service role and nobody can rewrite their own trail. Never throws — a
      failed log line must not roll back the refund it describes. Wired into
      order status changes; refunds/cancels next.
- [x] **`createOrder` idempotency.** Caller-supplied key per checkout attempt,
      partial unique index. Two layers: a pre-check returns the original order,
      and a 23505 catch handles the race where both requests read "none" before
      either wrote. Verified live: duplicate key rejected, distinct keys fine.

### P0 — remaining
- [x] **`auditLog` extended** to refunds, cancellations, product price/stock/SKU
      edits and stock adjustments — 5 call sites. Product edits log **only the
      fields that actually changed**, from an allow-list, so real changes are not
      buried under every unrelated save. Verified live through the admin UI:
      `order.status_changed`, actor `abhijeet11ray@gmail.com`, `shipped →
      delivered`.
- [x] **Idempotency on the gateway paths.** Razorpay and Stripe entry points now
      take the key and pass it through; the client mints one per attempt and
      clears it after the order lands. This is the path that mattered most —
      without it a retried "pay" created a second order *and* a second gateway
      intent, so a customer could be charged twice for one basket.

**P0 is clear.**

### P1 — operability (the team has to run this daily)
- [x] **Admin order detail page** — `/admin/orders/[id]`. Items and totals,
      shipping address, parcels, and the order's **audit history** in one place.
      Needed two new admin-scoped reads: `getOrderForAdmin` and
      `getShipmentsForOrderAdmin`, because the existing ones go through RLS
      keyed to `auth.uid()` — an admin would have seen zero parcels on every
      order but their own.
- [x] **Shipment management UI.** Add a parcel, step its status, read its scan
      history. Transitions are **forward-only by design** — a parcel cannot
      un-deliver, so only the moves that make sense from the current state are
      offered rather than a dropdown of nine mostly-backwards options.
      Verified live: stepped a real parcel *In transit → Out for delivery*, a
      second event appended, actions advanced.
- [x] **Saved views** — *Unfulfilled (to pack)*, *COD not collected*,
      *Returning (RTO)*, above the raw statuses in the same control. These are
      questions with answers, not status values: the daily worklist, money not
      yet collected, and stock coming back. RTO resolves through `shipments`
      because it lives on the parcel, not the order. Verified live: Unfulfilled
      correctly drops the delivered order (2 → 1).
- [x] **CSV export** — respects the active view, so "export what I am looking
      at" needs no thought. Every field quoted with internal quotes doubled, or
      an address containing a comma silently shifts every later column. Money is
      converted to rupees because this is the one place a human reads the number
      directly and paise get misread.
- [ ] **No bulk actions beyond status.** Bulk status exists; bulk print/ship do
      not. Deferred — label printing belongs with a courier integration.

### P2 — commerce features
- [x] **Promotions.** Migration `034` (applied): `promotions` (percentage /
      fixed / free shipping / BOGO, JSONB conditions, priority, stackable,
      scheduling window) and `order_promotions` — which campaign fired on which
      order and for how much, so "what did this cost us" has an answer.
      **The coupons table was deliberately left alone.** It works, its races are
      already closed (`021`), and a code someone types is a different product to
      an offer the shop applies whether or not the customer knows about it.
      Rewriting one into the other would have put a correct money path at risk
      for no gain. Coupons now apply *on top of* promotions, against the
      already-discounted subtotal.
      Split deliberately in two: `lib/promotions.ts` is pure arithmetic with no
      server imports (16 cases tested, including "never discounts past zero" and
      "a non-stacking winner ends evaluation"), `lib/promotions.server.ts` does
      the I/O. The pricing preview at checkout and the charge at `createOrder`
      run the *same* resolver — a preview computed a second way is a preview
      that eventually disagrees with the invoice.
      Stacking rule: promotions are evaluated in priority order against a
      subtotal that shrinks as discounts land, and the first non-stackable one
      that applies ends evaluation. Otherwise "best offer" silently becomes
      "every offer at once", which is how shops give away margin by accident.
      Verified live end to end: an offer created through the admin UI applied at
      checkout, was named on the customer's order, and wrote its cost to
      `order_promotions`; the window query was tested against the real database
      with scheduled / expired / inactive rows to prove each is excluded.
      **Bug caught while writing it:** the free-shipping flag was an accumulator,
      so once one free-shipping offer fired, any later zero-value promotion was
      recorded as "applied" for nothing.
      Test orders and the test promotion were deleted afterwards; the stock
      trigger restored both units.
- [x] **Returns / RMA.** Migration `033` (applied):
      `returns` + `return_items`, own lifecycle (requested → approved →
      received → refunded), RMA numbers, per-line quantities and a per-line
      `restock` flag. `actions/returns.ts`: eligibility (7-day window from
      delivery, already-returned quantities subtracted so nothing can be
      returned twice), request, admin decide, and receive.
      **The rule it is built on: money and stock move on RECEIPT, never on
      approval** — refunding for a parcel that never arrives is the expensive
      mistake, so `received_at` gates both. Restock is per line, because a
      damaged return should be refunded without going back on the shelf, and
      `refundOrder` is called with `restock: false` so a one-of-three-items
      return does not put back two items that never came back.
      Verified live: duplicate RMA blocked, invalid status blocked, zero
      quantity blocked, RLS is SELECT+INSERT only (a customer cannot approve
      their own refund).
      **UI done:** customer request form on the order page (line quantities
      capped at what is actually returnable, reason, note, and a refund estimate
      labelled as an estimate — promising a number that later changes is worse
      than showing none), plus an admin queue at `/admin/returns` with tabs and
      counts. The queue offers only the moves the lifecycle allows, and says in
      words that "Mark received" restocks and refunds only if an amount is
      entered — a button that silently issues a refund is a nasty surprise.
- [x] **Partial fulfilment.** `shipment_items` supported split parcels from day
      one but nothing ever read it back, so the team could see that *a* parcel
      existed and never whether the order was actually complete.
      `getFulfillmentForOrder` answers "what is still owed", the order page shows
      it, and the add-parcel form lets you pack a subset — defaulting to the full
      remainder, since shipping everything left is the common case and should
      cost no clicks. Cancelled parcels correctly return their contents to owed.
      **Bug caught by looking at it:** counting only itemised rows reported every
      ordinary whole-order shipment as "nothing shipped". A parcel with no
      `shipment_items` rows means the whole order — now handled explicitly.
- [x] **Abandoned-cart recovery.** Migration `035` (applied), `lib/abandonedCarts.ts`,
      a cron route matching the existing `release-stale-orders` shape, a recovery
      landing page, and an admin list at `/admin/abandoned-carts`.
      **What had to be fixed first:** the storefront cart lives in localStorage,
      so the server only ever saw a cart at the moment someone pressed Place
      Order — recovery would have covered failed payments and nothing else. The
      cart is now mirrored server-side for signed-in customers, debounced, and
      deliberately **not** on mount: mirroring on every page load would bump the
      cart's clock and no cart would ever look abandoned.
      **The column that did not exist:** `carts.updated_at` was not "last
      activity". The trigger from `002` fires only on updates to the carts row
      (items live in cart_items, so it never moved when a cart changed) and it
      sets NOW() on *every* update — meaning the recovery job stamping its own
      bookkeeping would have reset the very clock it was reading. Hence
      `last_activity_at`, written by exactly one thing: item changes. Verified
      that the reminder and recovery stamps leave it untouched.
      Runs are idempotent: a cart is stamped before its email goes out and the
      sweep only looks at unstamped carts, so a double-fired schedule cannot mail
      anyone twice. `?dryRun=1` previews without writing.
      Guests are out of scope by construction — there is no address to write to.
      **Not built:** drip sequences, discount-bearing "come back" codes, or a
      campaign engine. One reminder, one email. Training customers to abandon
      carts because a coupon always follows is an expensive habit to buy.
      **Scheduled** by `.github/workflows/recover-abandoned-carts.yml`, hourly
      from 09:00 to 22:00 IST (`30 3-16 * * *` — GitHub cron is UTC). Hourly is
      enough for a 6-hour window, and the waking-hours restriction is deliberate:
      a cart reminder at 4am is a worse experience than one that waits for
      breakfast, and small-hours mail is what teaches an inbox to treat a sender
      as spam.
      **Email delivery itself is unverified** — no `RESEND_API_KEY` is set in
      this environment. Until one is, the route **refuses real runs with a 503**
      and the workflow treats that as a warning rather than a failure. That
      refusal is not tidiness: stamping happens before the send and the sweep
      only reads unstamped carts, so one unguarded run would have marked every
      abandoned cart as reminded, mailed nobody, and made those customers
      permanently unreachable by recovery. Putting the sweep on a schedule is
      what made that reachable without anyone deciding to. `?dryRun=1` is exempt
      — it neither sends nor stamps — so the list is still previewable.
      Everything either side of the send is verified live.
- [x] **Tax rules.** Migration `036` (applied): `tax_rates` (HSN + price band +
      rate), `products.hsn_code`, per-line tax snapshotted onto `order_items`,
      a `tax_breakdown` summary and `tax_is_igst` on the order, and
      `store_settings.origin_state` / `gstin`.
      The single store-wide percentage was wrong three separate ways, each of
      them a wrong number on an invoice: rates differ by product; apparel's rate
      is a function of the PIECE price (5% at or below ₹1,000, 12% above), which
      no store-wide setting can express; and an intra-state sale is CGST+SGST
      while an inter-state one is IGST.
      Rates are rows, not constants — when a slab changes the team edits a row
      instead of waiting for a deploy — and `gst_percentage` survives as the
      fallback for unmapped products so nothing goes untaxed by accident. The
      admin page names the unclassified products rather than letting them hide.
      Split as usual: `lib/tax.ts` is pure arithmetic (20 cases tested,
      including "quantity must not push a piece into a higher slab" and
      "apportioned discount shares sum to exactly the discount"), `lib/tax.server.ts`
      does the I/O.
      **The subtle part is the discount.** Lines can sit at different rates, so
      an order-level discount cannot just be subtracted from the total — it is
      apportioned across lines in the ratio each contributed, with the last line
      absorbing the rounding remainder so the shares add back up exactly. Tax is
      then the SUM of the per-line figures, not a recomputation on the total,
      which would disagree with what the invoice prints.
      Verified live with real orders: a cart holding a ₹899 tee (HSN 6109 → 5%)
      and a ₹1,899 hoodie (HSN 6110 → 12%) charged ₹44.95 + ₹227.88; order tax
      equals the sum of its lines, the total reconciles, and the same order
      prints as CGST/SGST to Uttarakhand and IGST to Maharashtra. Orders placed
      before this still render their single stored Tax line.
      **Issuance** happens at dispatch (`actions/shipments.ts`), which was the
      only trigger there was. An order dispatched while the shop had no GSTIN is
      refused at that moment — correctly, since a parcel must still be able to
      leave — and lands in `uninvoiced_supplies`, where nothing ever revisited
      it. Filling in the GSTIN later fixed future dispatches and left past ones
      uninvoiced forever. `issueInvoiceNow` (`actions/invoicing.ts`), reachable
      from the order page, is the way back: it refuses an order that never
      dispatched or was cancelled, and passes no supply date so the RPC's own
      chain (dispatch → confirmation → placement) picks it. The invoice is
      therefore dated when the goods left, not when the button was pressed.
      Verified live that the refusal path spends nothing: with no GSTIN set, the
      call returns "store_settings.gstin is not set" and both `invoices` and
      `document_serial_counters` stay empty.
      **Not built:** tax-inclusive (MRP) pricing, reverse charge, e-invoicing/IRN,
      or place-of-supply rules for services. The store prices tax-exclusive today
      and those are separate decisions, not switches.

### P3 — scale
- [x] **Re-checked with `EXPLAIN ANALYZE` at 10,000 orders** (plus 2,000 reviews,
      500 returns, 5,000 promotion links), then the data was removed.
      Most of the engine was already fine: the order list, all four saved views,
      the abandoned-cart sweep, the live-promotion lookup and the shipment joins
      all came in under a millisecond on an index. Four things were not, and
      migration `037` fixes them:
      * **Admin order search was a full table scan at 34.7ms.** `ILIKE '%term%'`
        cannot use a btree index, and this is the query an admin runs while a
        customer is on the phone. Trigram GIN indexes took it to **0.2ms**.
      * **The per-product review list was a sequential scan** — on the storefront's
        critical path. The partial index from `030` only covers the homepage's
        recent-reviews query.
      * The admin reviews queue and the returns list had no index to sort on.
      * The promotions page read **every** `order_promotions` row into Node to
        show "cost so far" — 5,000 rows to produce eight numbers. Now a
        `promotion_spend()` aggregate.
      Two things worth knowing rather than fixing: an exact `count` is an index
      scan that grows with the table (2.3ms at 10k), and offset pagination at
      page 450 costs 6.3ms. Both are fine now and both want revisiting at ~1M.
- [x] **Pagination.** The large lists (orders, products, customers, payments,
      collections, messages, newsletter) already had it. The three that did not
      were exactly the ones that grow on their own: reviews (loaded all 2,000),
      returns (**entirely unbounded** — every return ever filed, with items and
      order joined, on every visit), and abandoned carts (a flat `.limit(200)`
      that silently hid the rest).
      Returns moved its tab and page into the URL because filtering had been
      happening in the browser across the whole table; its tab counts are now
      index-only counts. The abandoned-carts header numbers describe the whole
      set, so they became an `abandoned_cart_summary()` aggregate rather than
      something computed from the rows on screen — page-scoped totals would have
      quietly shrunk as the list grew.
- [x] **Background job runner.** Migration `038`: a `jobs` table, `claim_jobs()`
      using `FOR UPDATE SKIP LOCKED`, and `release_stuck_jobs()`.
      The case for it: the order-confirmation email was sent from three
      payment-success paths, each written `.catch(() => {})`. A Resend outage
      meant the customer paid, heard nothing, and no record existed that
      anything had been missed. Those, the payment-failed email and the Slack
      alerts now enqueue instead.
      The contract is **at-least-once** — every handler must be safe to run
      twice, because a duplicate confirmation is a far better failure than a
      missing one. Failures back off (1/5/15/60/240 min) and give up after five
      attempts; an unknown job type fails immediately rather than retrying
      forever; a job a dead worker abandoned is reclaimed after 15 minutes,
      while one still legitimately in flight is left alone.
      `/admin/jobs` exists because a permanently failed job otherwise lives only
      in a Slack message — and only if `SLACK_WEBHOOK_URL` happens to be set. It
      lists failures with their real error and offers one-click requeue.
      Verified: three overlapping cron runs claimed 60 jobs with **zero** claimed
      twice; a throwing handler retried with backoff and then failed permanently;
      an orphaned job was reclaimed and completed; a live one was untouched; and
      the admin Retry button took a failed job back through to done.

### Open — surfaced while doing the above, not yet fixed
- [ ] **Product weights are calculated, not weighed.** They were all 200g — the
      same placeholder on a tee and a hoodie — which is harmless while shipping
      resolves on a flat rate and wrong the moment `weight_based` is switched
      on, which `shipping_rates` already supports. Now 230 / 420 / 590g, derived
      from the GSM each product already publishes against a size-M panel area
      (0.95 / 1.18 / 1.51 m²). Confirmed no customer charge moved: both live
      rates are `flat`, and the quote is identical at 200g and 1,200g.
      **Still worth weighing one of each before enabling weight-based rates.**
      A calculation cannot know about trims, ribbing density or the packaging
      the courier bills for, and per-product weight cannot express that an XL
      is heavier than an S.
- [x] **Two different fallbacks for a missing weight.** ~~`ProductDetail` passed
      `product.weight ?? 500` to the delivery estimate while `createOrder` summed
      `?? 0`.~~ One constant now, `ASSUMED_PRODUCT_WEIGHT_GRAMS`, read by both,
      so a quote and an invoice cannot be computed on different bases — the same
      discipline the promotions and tax paths already follow by sharing one
      resolver. 500 rather than 0 because a missing weight is missing data, not
      a weightless product: assuming zero drops a heavy parcel into the cheapest
      band and the shop quietly absorbs the difference. A backstop, not a
      substitute for a weight.
- [ ] **`getProducts` still selects `*`.** The unused `attributes` embed is gone
      and the sitemap has its own two-column query, but description and
      `customization_config` still travel to pages that render neither. Left
      alone because the honest measurement said it saves ~0.1KB of 8.4KB on this
      catalogue — a scale fix with nothing to show for it yet, and narrowing the
      columns is the kind of change that breaks a page for a field nobody
      noticed was in use.
- [x] **Lint errors.** ~~41 across the storefront.~~ Zero. Thirty of them were
      one pattern in five files: reading members off the object
      `useMagneticHover` returns, during render, which the compiler treats as
      touching a ref — destructuring at the call site clears it. The rest were
      real: `any` where a union already existed, four `@ts-ignore`s hiding
      whatever came next rather than declaring `window.gtag`, and two
      apostrophes. The six remaining are browser-only reads on mount
      (localStorage, matchMedia, document.fonts) where the second render pass is
      the point — those carry a one-line reason each, not a file-wide disable,
      so the next genuine violation still fails. 28 warnings remain, unchanged.
- [ ] **Functions run in `iad1`, the shop is operated from India.** See §5. The
      database is co-located with the functions, so moving the functions closer
      to the team would move them away from the data; the fix is fewer
      round-trips, which is what was done, not a region change.

---

## 3. Shipping roadmap

**Now (done):** manual. Team pastes courier + AWB + tracking URL; status stepped
by hand; customer sees parcels and history.

**Next:** shipment management UI (step status, second parcel, fix AWB).

**Later — provider integration.** Deliberately *not* built yet: no account, no
keys, nothing to test against. When it happens the schema does not change —
`provider` and `provider_payload` already exist. Scope will be: serviceability,
rate quote, create shipment, buy label, and a webhook writing `shipment_events`
(dedupe already enforced by unique index). Shiprocket aggregates
Delhivery/Bluedart/DTDC behind one API with COD; Delhivery direct is cheaper at
volume, one carrier.

---

## 4. Admin UI principles

Not styling — operability. The team lives here.

1. **Every destructive action is reversible or confirmed.** Cancel and refund
   move money; they confirm and they log.
2. **Never show a control that cannot work.** Category filters pointing at empty
   categories, a price slider wider than the catalogue — a control that can only
   fail is worse than no control. (Fixed on the storefront; audit admin for the
   same.)
3. **Show the count.** Every filter and tab states how many rows are behind it.
4. **One order, one page.** Full history in one place.
5. **Fast paths for the common case.** Ship, print, mark delivered should be one
   click from the list.
6. **Dense over pretty.** Tables, not cards. Ops staff scan.

---

## 5. Where the time goes

The single most useful fact about this deployment, and the one that made two
earlier performance guesses wrong: **the functions run in `iad1` (US East) and
the people operating the shop are in India.** Confirm it any time with
`x-vercel-id: bom1::iad1::…` — the first segment is the edge, the second is
where the code actually ran.

The database is in the same region as the functions, so function-to-database is
cheap. What is expensive is every hop between the browser and the server. From
India, measured against production:

| | |
|---|---|
| Static page from the Mumbai edge | 0.22s |
| Dynamic route, rendered in US East | 2.27s |

Two consequences shape how anything here should be written.

**Server actions from a client queue.** Next runs them one at a time, so N
actions fired on mount are N sequential Atlantic crossings, even when the code
looks concurrent — three `.then()` calls with no awaits between them still
serialise. The product editor's nine measured 2,348ms of query time to do 706ms
of work. Fetch on the server, in one call, and pass the result down.

**Prefetch is not free when the target is dynamic.** `<Link>` prefetches
everything on screen, and a prefetch of a dynamic route makes the server
authenticate and fully render that page. The admin sidebar's 23 links turned one
navigation into **38 requests, 37 of them for pages nobody asked for**. It is
`prefetch={false}` there now. On the storefront the opposite fix applied: the
targets were made static, so prefetching them costs nothing.

**What is cached.** `/`, `/shop`, `/cart`, `/about`, `/collections` and
`/products/[slug]` are prerendered with `revalidate = 60`. Two calls used to
prevent that by reading cookies for data that is not per-customer —
`getStoreSettings` and `getFeaturedReviews` — and both now use the anon client.
The 60-second window exists because an edit revalidates its own path
immediately, but a **sale** moves stock through a database trigger no
application code observes, so without a window a sold-out size could read as
available indefinitely. Nothing can be oversold in the meantime regardless: the
CHECK constraint is the real guarantee, so a stale page costs a clear error at
checkout rather than an order that cannot be filled.

---

## 6. Reachability

A `'use server'` file exposes **every exported async function as a public POST
endpoint**, whether or not any UI calls it. Server action ids are discoverable
in the client bundle, so "nothing links to it" is not a control.

Every action was enumerated against its callers. The writes were already
correct. The reads were not, and two were real exposure rather than hygiene:

- `getOrderPromotions` — no auth, service-role client (so RLS bypassed), and an
  arbitrary order id. It could not simply require admin, because a customer
  reads it for their own order, so the **client is chosen by who is asking**:
  customers go through RLS, only a verified admin gets the service role.
- `sendOrderConfirmationIfFirstTime` — no auth, service-role, arbitrary order
  id, and it **sends mail**. Moved to `lib/`, which removes the endpoint rather
  than guarding something that should never have been reachable.

The rule this leaves behind: **if it is not called from a client, it does not
belong in `actions/`.** And an admin read needs a guard even when RLS would
cover it, because the next edit may switch it to the service-role client.

---

## Changelog

- **2026-08-17** — Lint errors to zero, from 41. Most of it was one mistaken
  pattern repeated five times rather than 41 separate problems. Two fixes were
  worth more than the count: `window.gtag`/`window.fbq` are declared now instead
  of being `@ts-ignore`d — a suppression hides whatever error lands on the next
  line, including one you did not mean to silence — and the shipping rate form
  holds the union the actions declare, so the two `as any` casts on save are
  gone. `/admin/shipping` also became server-seeded like the other nine lists,
  which removed its mount effect rather than suppressing it — verified after
  deploying: both zones and their rates render from the server with no spinner,
  and the zone-delete dialog opens with its real copy and leaves both zones in
  place on Cancel. Warnings unchanged at 28, checked against HEAD at the same
  scope.
- **2026-08-17** — Weight fallback unified. The delivery estimate assumed 500g
  for a product with no weight and `createOrder` assumed 0, so the two would
  have quoted and charged on different bases the moment a weight-based rate
  existed. Both read `ASSUMED_PRODUCT_WEIGHT_GRAMS` now. Nothing changes today:
  every product has a weight, and both live rates are flat.
- **2026-08-17** — Product weights set: 230 / 420 / 590g, replacing the 200g
  placeholder every product shared. Derived from the GSM each already publishes,
  not weighed — the distinction is recorded in §2 because the number looks
  authoritative either way. Checked first that both live shipping rates are
  `flat`, so nothing a customer is charged could move; the quote is identical at
  200g and 1,200g. Found while doing it: the delivery estimate falls back to
  `?? 500` for a missing weight while `createOrder` sums `?? 0`, so the two
  would disagree on a product with none.
- **2026-08-17** — **Attributes existed and had never been assigned.** The
  Specifications panel had therefore never rendered on any product page, on any
  visit, since the feature was built — `product_attribute_values` was empty.
  Material and Weight are now set on all three garments, taken from each
  product's own description rather than invented (Capacity and Waterproof Rating
  left unset; they belong to the bottles and shells the catalogue is heading
  toward). Verified live on production, reading the opened accordion rather than
  the HTML: 380/340/240 GSM on the right products.
  **The bug it exposed matters more than the data.** `setProductAttributes`
  called no `revalidatePath` at all, and `setProductCategories` and
  `setProductTags` refreshed only the admin list — never the storefront page
  they change. Harmless while product pages rendered per request; not harmless
  once they were cached the day before, which is a fair warning about caching
  something before checking what invalidates it. All three now go through
  `revalidateProductPaths`.
- **2026-08-17** — Analytics aggregated in Postgres (migration `042`). It read
  every order in the range **together with all their line items** and reduced
  them five ways in Node. The SQL reproduces the JavaScript exactly, quirks
  included: cancelled orders are excluded from revenue but present in the status
  mix, the trend is zero-filled and buckets by UTC date because the old code
  keyed on `created_at.slice(0, 10)`, and top products fall back to
  `product_name` so a product deleted after the sale keeps its sales attributed.
  Checked field-by-field at 7/30/90 days, then on synthetic orders inside a
  transaction that was **rolled back** — eight orders, three products competing
  for the ranking, a cancelled order, a deleted-product line. All identical;
  nothing written.
  Learned in the process: an `order_items` row cannot be INSERTed with a null
  `product_id`, because `record_inventory_movement_on_order` writes a movement
  whose `product_id` is NOT NULL. Null product ids only ever arrive later, via
  ON DELETE SET NULL.
- **2026-08-16** — Payment totals aggregated in Postgres (migration `041`).
  `getPaymentsSummary` selected **every order ever placed**, no filter, no limit,
  to produce four numbers. Same shape as `promotion_spend()` in `037`. The live
  table holds two pending orders, so a before/after comparison would have
  exercised neither SUM nor GROUP BY — the arithmetic was instead checked
  against the old JavaScript over synthetic rows in a CTE shadowing `orders`,
  covering paid sums across methods, a null method reported as `unknown`, and
  both refund statuses. Identical. `SECURITY INVOKER`, EXECUTE to `service_role`
  only; anon gets 42501.
- **2026-08-16** — **The admin was establishing identity twice per page.**
  `app/admin/layout.tsx` carried its own copy of the admin check — its own
  `getUser()`, its own profiles read through the service-role client — while
  every page also ran `ensureAdmin` inside its actions. Four round-trips to
  answer one question; two now, via a request-memoised check. It also removed
  that file's only reason to hold the service-role client: reading your *own*
  profile row is something RLS already permits.
  Alongside: the last eight admin list pages take their first page from the
  server render instead of fetching on mount. Search and paging are untouched —
  they skip only the mount fetch — so there was no URL plumbing and nothing to
  re-learn. Verified that search still filters, which is the check that matters:
  a skip guard that is too greedy leaves the page frozen on its first result.
- **2026-08-16** — Native `confirm()` removed from the admin. Eleven destructive
  actions across nine pages were guarded by the browser's grey box, including
  "delete all rates in this zone" and, on orders, **cancel — which releases stock
  and auto-refunds a captured payment**. `useConfirm()` returns a promise so a
  call site stays a one-liner, which is what made converting all eleven safe
  rather than a rewrite. The copy now says what actually happens: deleting a
  category moves its children up, deleting a coupon leaves past orders charged
  as they were.
- **2026-08-16** — **Storefront made cacheable.** `/products/[slug]` measured
  5.35s from India against 0.88s for a static page, for no reason: two calls read
  cookies for data that is not per-customer, and reading cookies makes the page
  dynamic. Switching `getStoreSettings` and `getFeaturedReviews` to the anon
  client made `/`, `/shop`, `/cart`, `/about` and the collection and product
  pages static. **5.35s → 0.22s, `x-vercel-cache: HIT`.** `revalidate = 60` on
  everything showing a price or stock level; see §5 for why the window exists.
  The build failing was useful: `/cart` became prerenderable and its
  `useSearchParams` had no Suspense boundary, a latent bug the dynamic rendering
  had been hiding.
- **2026-08-16** — **One click into a product cost 38 requests.** Thirty-seven
  were sidebar prefetches of dynamic admin routes, each making the server
  authenticate and fully render a page nobody asked for. Now 3, two of which are
  7ms. The editor also became a server component, folding two Atlantic crossings
  (fetch the page, then fetch its data) into one.
- **2026-08-16** — Admin product screens rebuilt. The editor awaited **nine**
  server actions in sequence — 2,348ms of query time to do 706ms of work, before
  counting nine round-trips and nine auth checks — and is one call now that
  reimplements none of those queries, because calling a server action from
  server code is an ordinary function call.
  **The bug that was costing money:** clearing a price or stock cell saved
  ZERO. `parseInt('') || 0` on a 400ms debounce, so select-all-and-retype could
  publish a product free before the new digits landed. The same code was in
  `VariantRow`. `parseInt` also truncated `1899.50` to `1899` on every edit.
  Sorting was client-side over the loaded page, so "sort by price" reordered
  twenty rows rather than the catalogue. Eight of nine admin reads had no auth
  guard, one of them using the service-role client. Fixed table layout with one
  unsized column to absorb slack — sizing all eight put the row 74px wider than
  a 1280 laptop and pushed Edit and Delete off screen. Seven Save buttons became
  one, with dirty tracking, because switching tabs used to discard edits in
  silence.
- **2026-08-16** — **Production was down on every product page and the cause was
  a missing environment variable.** `SUPABASE_SERVICE_ROLE_KEY` was absent from
  the deployment, so `createClient` threw `supabaseKey is required`. Only
  `/products/[slug]` failed, because it was the one public page reaching for the
  service role — via the offers strip, `getOffersForProduct` →
  `getLivePromotions`. It reads with the anon key now: `promotions` has carried
  an "Anyone reads active promotions" policy since `034`, the row set is
  identical, and a public page no longer depends on a server-only secret.
  Two real bugs found on the way, neither of them this one: a Server Component
  cannot write cookies, and supabase-js refreshes an expiring token from an
  async callback nothing awaits — so the throw escaped as an **unhandled
  rejection** and took the whole invocation down; and the middleware returned
  early for public routes, so the refresh happened where it could not be saved,
  which with rotating refresh tokens signs a browsing customer out. Both fixed;
  the redirects now carry their `Set-Cookie` across, since a redirect is a new
  response and was discarding it.
  **Recorded because the diagnosis was wrong twice:** I read a chunk hash and an
  error digest as evidence of "no new build" when neither measures that, and
  concluded auto-deploy was broken. It was not — every push had built within 90
  seconds. Check the deployments API, not artefacts that only look like
  fingerprints.
- **2026-08-15** — **Print files were being produced at the wrong resolution.**
  Two renderers disagreed and nothing recorded the result. The web studio
  derived its export scale from the zone's physical size and hit 300 DPI; the
  server renderer behind the mobile design API used a hardcoded
  `PRINT_SCALE = 4`, which on the tee's 212px zone produced an **849px file for
  a 12-inch print — 71 DPI**, and unusable. Measuring the three designs in the
  database found 25, 71 and 300 DPI.
  The DPI rule now lives once in `lib/customize/printSpec.ts` and both renderers
  import it (13 tests, including a regression for the 4× scale). Migration `040`
  records the achieved DPI per side, existing rows were backfilled by measuring
  the real files, and the admin flags anything under standard instead of letting
  it reach the press.
  **The download was also broken independently:** the button linked straight at
  Supabase storage with a `download` attribute, which browsers ignore
  cross-origin — so it opened the PNG in a tab, and when saved it was named
  after a UUID. There is now an admin-gated same-origin route that streams the
  file as an attachment named `DDZ-20260728-7048_front_Custom-Print-Tee_S.png`.
- **2026-08-15** — Admin orders rebuilt as a dense clickable table (a row per
  order instead of a card with a nested items table — nine orders on screen
  where one and a half fit, and the list finally links to the detail page).
  Custom-design production built end to end: migration `039`, a print queue at
  `/admin/production`, and an artwork panel on the order detail with previews,
  print-file downloads and a readable spec parsed out of the studio's canvas
  JSON. Settings split up — Shipping, Homepage and Tax now have their own
  sidebar pages.
  **Two customer-facing defects found while doing it:** there was no coupon
  input anywhere on the storefront, so the entire coupons feature was
  unreachable despite `validateCoupon` and `createOrder`'s `coupon_code` both
  existing; and the product page advertised "Free shipping over Rs. 3,000"
  while the cart, the footer and the actual store setting all said ₹2,000.
  Both fixed, and the threshold now reads from settings in both places rather
  than being hardcoded twice.
- **2026-08-15** — P3 closed. Load-tested at 10k orders and fixed what the
  planner actually complained about (migration `037`), paginated the three
  lists that grow on their own, and built a durable job queue (migration `038`)
  so a failed confirmation email is retried and visible instead of lost. All
  load-test data removed afterwards; stock and row counts verified back to
  where they started.
- **2026-08-15** — Tax rules: migration `036` applied, per-line GST by HSN and
  price band, CGST/SGST vs IGST, admin Tax Rules page, origin state and GSTIN in
  settings. This was not cosmetic — under the old flat 5% the verification cart
  was taxed ₹139.90 against a correct ₹272.83, i.e. the shop was under-collecting
  and under-declaring GST on every item above the apparel threshold and on every
  non-apparel product it is about to start selling (bottles and mugs are 18% and
  12%). Band labels also fixed: the stored bound is exclusive, so the table read
  "Under ₹1,000.01" where a human says "Up to ₹1,000".
- **2026-08-15** — Abandoned-cart recovery: migration `035` applied, server-side
  cart mirroring, sweep + cron route, recovery landing page, admin list.
  Two bugs caught while building it: `dryRun` stamped the carts it was only
  supposed to preview (consuming exactly the ones the operator wanted to see),
  and the admin list showed "Queued" against carts past the give-up window that
  the job will never email. Also corrected a variable I had invented —
  `NEXT_PUBLIC_SITE_URL` — to the `NEXT_PUBLIC_APP_URL` the rest of the app
  already uses, so recovery links point at the right host. `CRON_SECRET` and
  both cron endpoints are now documented in `.env.example`, which had never
  mentioned the existing one.
- **2026-08-15** — **Tax was charged on the pre-discount subtotal.** Found by
  placing a real order to verify promotions: GST was computed off the list price
  before any discount came off. Under s.15(3)(a) CGST a discount given at the
  time of supply and shown on the invoice is excluded from the taxable value, so
  this overcharged the customer and overstated output tax on every discounted
  order — coupons included, quietly, since long before promotions existed.
  `createOrder` now computes tax on `subtotal - discount_amount`. Re-verified
  with a second live order: ₹1,899 cart, ₹189.90 off → tax ₹85.45 rather than
  ₹94.95, total ₹1,914.55.
  Also fixed `formatPrice`, which rendered ₹189.9 for 18990 paise — harmless
  while every catalogue price was a whole rupee, wrong the moment a percentage
  discount produced real paise.
- **2026-08-15** — Promotions engine: migration `034` applied, resolver +
  checkout preview + admin CRUD at `/admin/promotions` with per-campaign cost.
  Deletion is blocked once a promotion has touched a real order (the DB says
  RESTRICT and the admin action says so in words) — retiring an offer must not
  erase what an order was charged.
- **2026-08-15** — Rate limiting (`029`), index audit (`030`), shipments schema
  (`031`) written and **applied to the live database**. Manual shipping built:
  `actions/shipments.ts`, admin Ship wired to real shipments, customer parcels +
  history on the order page. Verified end to end.
- **2026-08-15** — Returns UI: customer request form + admin queue, wired into
  the sidebar. Build caught a Next.js constraint tsc could not — a 'use server'
  file may only export async functions, so RETURN_WINDOW_DAYS moved to constants.
- **2026-08-15** — Returns engine: migration `033` applied, `actions/returns.ts`
  built. Found and fixed a gap mid-build — restock flags were recorded but never
  acted on, so stock would never have come back.
- **2026-08-15** — P2 (partial). Partial fulfilment built and verified; found
  and fixed a counting bug in it on screen before it shipped.
- **2026-08-15** — P1 closed bar bulk print. Saved views (unfulfilled / COD
  pending / RTO) and CSV export on the orders list, both verified in the browser.
- **2026-08-15** — P1 (partial). Admin order detail page + shipment management
  built and verified in the browser. Two admin-scoped read paths added to avoid
  an RLS trap that would have shown admins empty parcel lists.
- **2026-08-15** — P0 closed. Audit logging across refunds, cancellations,
  product and stock edits; idempotency extended to Razorpay/Stripe. Verified in
  the browser: marking an order delivered wrote a real audit row naming the
  admin and the before/after status.
- **2026-08-15** — P0 pass. Migration `032` applied: order idempotency key +
  unique index, `admin_audit_log`, and backfill of legacy tracking into
  `shipments`. `addTrackingInfo` deleted. Verified in the browser: admin Ship →
  parcel created → order derived to *Shipped* → customer sees the parcel, AWB,
  track link and scan history.
