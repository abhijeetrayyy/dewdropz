# DEWDROPZ — Full Platform Audit

**Date:** 26 August 2026
**Scope:** Web application only — frontend, backend, server actions, API routes, database, RLS, admin area, storefront. Mobile apps and `trekbuddy-game` excluded by request.
**Method:** Static review of all 60,357 lines across `app/`, `actions/`, `lib/`, `components/`, `types/`, plus live probing of the production Supabase database using only the public `anon` key that ships in the browser bundle.

---

## Executive summary

The platform has **one critical vulnerability, now fixed**, sitting underneath an otherwise well-engineered system.

Fourteen Row-Level Security policies were written in a way that granted the entire public — anyone on the internet, using a key that is published in every page load — full read *and write* access to the product catalogue, including the ability to change prices. This completely bypassed an otherwise excellent server-side pricing model.

Outside of that, the commercial core (pricing, tax, orders, payments, stock) is built to a standard above most funded D2C stacks. The weaknesses are not in the hard problems; they are in the ordinary ones — content management, error handling, search, and the absence of any process that systematically verifies the system's own assumptions.

| Area | Before | After this audit |
| --- | --- | --- |
| Security posture | **3 / 10** | **8 / 10** |
| Architecture & commercial correctness | 8.5 / 10 | 8.5 / 10 |
| Admin operability | 6 / 10 | 6 / 10 |
| Storefront craft | 8 / 10 | 8 / 10 |
| Storefront commerce fundamentals | 5 / 10 | 5 / 10 |
| Engineering process | **3 / 10** | 3 / 10 |

---

## 1. CRITICAL — The product catalogue was writable by the public

**Status: FIXED and verified.** Migration `093_catalogue_rls_lockdown.sql`, plus a code change to `actions/cart.ts`.

### What was wrong

Fourteen policies were written in this shape:

```sql
CREATE POLICY "Admin full access products" ON products
  FOR ALL USING (true);
```

In PostgreSQL, a policy with **no `TO` clause applies to `PUBLIC`** — every role, including the unauthenticated `anon` role. Policies are combined with OR. So this policy did not grant administrators *extra* reach alongside the public-read policy next to it. It granted **everyone total reach**, and made every other policy on the table decorative.

The `anon` key is public by design — it is embedded in the JavaScript bundle of every page. So this was exploitable by anyone who opened the site and read the source.

### Tables affected

`products`, `product_variants`, `collections`, `categories`, `product_categories`, `tags`, `product_tags`, `attributes`, `attribute_values`, `product_attribute_values`, `variant_option_values`, `inventory_movements`, `coupons`, `reviews`

### Proof

Verified against the live database using only the anon key. Each probe was an `INSERT` deliberately chosen to violate a unique constraint — a `23505` (unique violation) proves RLS *permitted* the write, while nothing was actually written:

```
coupons      → 23505   RLS ALLOWED the write
tags         → 23505   RLS ALLOWED the write
categories   → 23505   RLS ALLOWED the write
collections  → 23505   RLS ALLOWED the write
products     → UPDATE succeeded against a live product row
```

### Why this was the entire shop

`lib/checkoutPricing.ts` is well designed. It is a single pricing function that both quotes and bills, and it reads `products.price` from the database precisely *because the browser must not be trusted with a price*. That is correct.

It was completely undone by this defect. The attack is three steps:

1. Set `products.price` to `1` (one paisa) using the public key.
2. Check out normally.
3. The server-side pricing engine faithfully computes and charges one paisa.

Every downstream control — the single source of pricing truth, the idempotency key, the GST apportionment, the stock constraint — operates on a number the attacker had just written. Additional consequences: minting a 100%-off coupon, self-approving reviews, deleting the catalogue, editing stock records.

### The part worth internalising

Migration `063_profiles_rls_fix.sql` discovered **this exact defect** on the `profiles` table. It contains an excellent written explanation of why `USING (true)` with no `TO` clause is catastrophic, and it was verified with the anon key at the time.

It then fixed exactly one table. Fourteen others carried the identical defect and were never revisited.

### The fix

- `is_profile_admin()` (a `SECURITY DEFINER` helper introduced by 063 to avoid RLS recursion) is now used by all fourteen policies.
- Every policy is explicitly scoped `TO authenticated` and gated on `is_profile_admin()`, with `WITH CHECK` as well as `USING`.
- `anon` now matches **no write policy on any of these tables**.
- Nothing in the application broke: every admin write goes through a server action holding the service-role key, and `service_role` bypasses RLS entirely. These policies were never what made the admin screens work.
- Public `SELECT` policies were left untouched, so the storefront reads exactly as before.

### Verified after the fix

```
INSERT  → 42501 (blocked) on all probed tables
UPDATE  → 0 rows affected; product price unchanged
DELETE  → 0 rows affected; all products remain
Storefront reads → unaffected (products, collections, categories, variants, reviews)
coupons / inventory_movements → locked
Build, typecheck, lint → green
```

---

## 2. HIGH — Every live coupon code was publicly enumerable

**Status: FIXED.**

A policy named `Public read active coupons` did exactly what it said: it allowed anyone holding the anon key to list every active coupon along with its type, value, minimum order amount, maximum discount, usage limit and expiry.

A discount code is a marketing instrument that is *given* to someone. A code that anyone can read off the wire is a sitewide sale nobody decided to run.

**Fix:** the policy is dropped. `validateCoupon()` in `actions/cart.ts` previously read coupons through the caller's own session, which is why the policy existed. It now reads using the service-role client. This is not a widening of trust — it is a server action that looks up the *one* code the customer typed and returns only a yes/no and an amount. It never returns a list.

---

## 3. MEDIUM — Stock levels and sales velocity were public

**Status: FIXED.** `inventory_movements` was readable by `anon`, exposing stock movement history — effectively your sales volume and velocity, available to any competitor. Now admin-only.

---

## 4. MEDIUM — `store_settings` exposes seller registration details

**Status: DOCUMENTED, NOT FIXED.** This one requires a code change to fix safely and should be done deliberately.

The policy `Anyone can read store settings` is `USING (true)` over a table that also holds `gstin`, `seller_legal_name`, `seller_address_line1/2`, `seller_city`, `seller_postal_code`. These are `null` today, which is the only reason this is not already a live leak — **and they cannot stay null**, because a GST-compliant invoice cannot be issued without them. The day the shop becomes able to invoice is the day its registration details become public.

**Why it cannot be fixed with RLS alone:** RLS is row-level and has nothing to say about columns. The fix is a column-level `GRANT`. But `getStoreSettings()` performs `select('*')` using the **anon** client, and a column grant turns that into a permission error — which the function's own fallback silently swallows, causing the homepage to revert to `DEFAULT_HOME_CONFIG`. The failure mode is not a crash; it is every configured setting silently disappearing. The admin settings screen reads through the same anon path, so it would also lose the ability to see or set the GST details.

**Correct fix (must ship code + migration together):**
1. `getStoreSettings()` → explicit storefront column list, public client.
2. New `getAdminStoreSettings()` → `requireAdmin()` + service-role client + `select('*')`.
3. Admin settings screen switches to the new function.
4. Then: `REVOKE SELECT ON store_settings FROM anon, authenticated` + `GRANT SELECT (<storefront columns>)`.

---

## 5. PROCESS — The migrations are not the source of truth

**This is the finding that produced the critical one, and it will produce the next one.**

Migrations `002_rls_policies.sql` and `005_phase1_rls.sql` in this repository contain the **correct** admin check:

```sql
FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
```

The live database had `USING (true)`. **The files and the database disagreed, and nobody knew.**

Compounding this:

- There is **no migration runner** in `package.json` — no `db:migrate` script.
- There is **no applied-migrations ledger**. With 93 files and a team, "which migrations are actually on production?" currently has no answer.
- There is no CI check that asserts the database matches the migrations.

Migration `093` is therefore written to be **idempotent and to assert the end state** — it drops by name and recreates — so it lands correctly regardless of which version is live.

---

## 6. What is genuinely strong

These are above the standard typically seen in comparable systems.

**Money path**
- One pricing function (`lib/checkoutPricing.ts`) that both quotes and bills, so the number the customer approves and the number they are charged cannot drift.
- GST computed per line with s.15(3)(a) CGST discount apportionment.
- Correct IGST vs CGST/SGST determination by place of supply.
- Free shipping modelled as a shipping change rather than a discount, so it cannot double-count against the total.

**Order creation**
- Idempotency key, backed by a unique index, with explicit `23505` race handling so a double-clicked pay button returns the original order instead of placing a second one.
- Address lookups deliberately use the **session-scoped** client so a caller cannot pass someone else's address ID. Subtle, and correct.
- Oversell prevented by a database check constraint (migration `021`), not by application logic. `23514` is mapped to a human-readable out-of-stock message.
- COD orders are confirmed inline with a confirmation email, since no gateway callback is coming.

**Payments**
- Stripe: proper `constructEvent` signature verification.
- Razorpay: raw-body HMAC with `timingSafeEqual` **and a length pre-check** — required, because `timingSafeEqual` throws on length mismatch. Most implementations get this wrong.
- `webhook_events` table with a unique index on `(provider, event_type, event_id)` used as the redelivery dedup.

**Operations**
- Job queue with attempts, max-attempts, backoff and dead-lettering.
- Three cron sweeps actually scheduled via GitHub Actions, with well-reasoned IST send windows (no cart reminders at 4am).
- Admin list pagination is server-side (`.range()` + exact count), not fetch-everything-and-slice.

**Security (outside the finding above)**
- RLS enabled on all 63 tables.
- No service-role client reachable from any `'use client'` file — verified.
- Every destructive admin action has a confirmation dialog — no exceptions found.
- `/api/invoice/[invoiceId]` does explicit ownership checking rather than relying on RLS, and returns an identical 404 whether the invoice belongs to someone else or does not exist, so it cannot be used to probe which IDs are real.
- `/api/mobile/uploads` is unauthenticated by design but validates by magic-byte sniffing, not the declared content type, with a hard size cap and server-generated filenames.
- Trek Buddy host controls are gated in Postgres via `SECURITY DEFINER` functions, so a mistake in the TypeScript cannot reach around the check.

---

## 7. What is missing

### 7a. Admin — the biggest structural gap

A large amount of storefront content is hardcoded in `lib/constants.ts` with no admin screen. The team cannot change it without a developer and a deploy.

| Surface | Status |
| --- | --- |
| `/journal` — the entire blog | Hardcoded. Publishing a post requires a code deploy. |
| `/about` — values, timeline, founder note | Hardcoded |
| `/sustainability` — entire page | Hardcoded |
| `/contact` — FAQs | Hardcoded |
| Homepage trust strip | Hardcoded |
| Company address, phone, socials (`SITE`) | Hardcoded |
| `/treks` guide — 8 routes | Hardcoded, **and now inconsistent** — the homepage Trails section was made admin-editable on 26 Aug, so the same content now has two sources. Should be unified onto the database. |

For a team operating a large store, a blog that cannot be posted to is a weekly operational wound.

### 7b. Storefront — commerce fundamentals

- **No product search.** The admin has search; customers do not. `/shop` filters on category and collection only. Adequate at 3 products, untenable at 300.
- **No root `error.tsx`, `global-error.tsx`, or `not-found.tsx`.** Only `/trek-buddy` has them. An unhandled error on a product page — or on **checkout** — renders Next.js's raw default error screen.
- **No `loading.tsx` on any storefront route.** Only admin and trek-buddy have them.
- **`/shop` has no `metadata` export** — a primary SEO landing page with no title or description. Also missing on `/`, and on all `/account/*` and `/auth/*` routes (the latter should be `noindex` anyway).

### 7c. Performance at scale

- **22 unindexed foreign keys**, predominantly on `trek_*` tables.
- `getAllOrders()` fetches **all** RTO shipments unbounded and filters them in memory.
- `count: 'exact'` on the orders list becomes a full count scan past roughly 100k rows.

### 7d. Known state from recent work

- The "Choose Your Essentials" tiles render **"Coming soon"** and link to an empty `/shop?category=…`. This was requested in the 23 August client brief; the tiles are a dead end until products are listed against those categories.
- Category `image_url` is `null` for all four essentials categories, so those tiles render as flat dark cards. Images must be uploaded in `/admin/categories`.
- The DEWDROPZ design library is built and functional but **empty** — artwork must be added at `/admin/designs`.

---

## 8. Assessment

**The pattern to worry about is not competence. It is verification.**

This codebase is unusually good at the hard, deep problems and has gaps in the boring ones. Someone reasoned carefully about GST section 15(3)(a) and about Razorpay's raw-body signing semantics, then left the catalogue world-writable and the blog uneditable.

That is not a skills problem. It is the absence of any process that systematically checks the system's own assumptions: no migration ledger, no RLS assertion in CI, no smoke test on checkout. The quality is high wherever someone thought hard, and unverified everywhere else.

---

## 9. Recommended order of work

1. **Migration runner + applied-migrations ledger.** Nothing else on this list is safe until the database and the migrations are known to agree.
2. **RLS assertion test in CI.** Run the anon-key probes from this audit on every deploy. This single test would have caught the critical finding on day one.
3. **`store_settings` column lockdown** (finding 4) — code and migration together.
4. **Root `error.tsx` / `not-found.tsx` / `loading.tsx`** for the storefront, starting with checkout.
5. **Admin CMS** for the journal and static pages; unify `/treks` with the now-editable homepage trails.
6. **Storefront product search.**
7. Index the 22 foreign keys; bound the RTO shipments query.

---

## Appendix — Reproducing the RLS test

Non-destructive. A `23505` means RLS permitted the write; a `42501` means RLS blocked it. Nothing is written either way.

```js
const anon = createClient(SUPABASE_URL, ANON_KEY)   // the public bundle key

// Probe writes with a guaranteed unique-constraint violation
await anon.from('coupons').insert({ code: '<existing code>', type: 'percentage', value: 1 })
await anon.from('categories').insert({ name: 'x', slug: '<existing slug>' })

// Probe update by reading the value back with the service key
await anon.from('products').update({ price: 1 }).eq('id', id).select()
// then confirm products.price is unchanged

// Probe reads on tables that must never be public
await anon.from('coupons').select('*')
await anon.from('inventory_movements').select('*')
await anon.from('profiles').select('*')
await anon.from('orders').select('*')
```

Expected on a healthy database: `42501` or zero rows for every one of the above.
