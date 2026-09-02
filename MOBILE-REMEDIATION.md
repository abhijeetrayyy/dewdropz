# DewDropz mobile (Expo / React Native) — Audit & Remediation Plan

Audited 2026-08-21 against `main` at `0b4adf8`. The app was **built and run** on an
iPhone 17 simulator (iOS 26, Debug, RN 0.86.2 / Expo SDK 57, new architecture) and driven
through browse → studio → design → cart. Pricing findings are computed directly from the
production `tax_rates` and `store_settings` tables, not estimated.

Android was audited **statically only**. Every finding below that is platform-specific
says so.

---

## 0. How to use this document

Work top-down. Each package names the files, the change, the guardrails, and a check that
proves it landed. §1 is the contract that keeps the fixes from costing something else.

---

## 0a. Status

**P0 — done in the working tree.** `tsc` clean on both sides, no new lint problems, the
web builds, and the app was rebuilt and re-run on the simulator.

| Package | State | Evidence |
|---|---|---|
| W-01 one price | done | `/api/mobile/quote` calls the same `priceCheckout` the order calls. On device the cart now reads **Subtotal ₹899 · Delivery ₹120 · GST ₹44.95 · Checkout ₹1,063.95**, matching the endpoint's `totalAmount: 106395` exactly. It read ₹1,049 with no GST before. |
| W-02 release guard | done | Outside `__DEV__` a loopback/emulator base is refused and `siteUrl` is used. Verified across six inputs: the three loopback forms fall back; LAN, staging and production pass through untouched. |
| W-03 dropped items | done | `skippedItems` is typed, carried to the success screen, and named there. The cart line is no longer silently cleared without a word. |

**What P0 removed from the app:** `FLAT_SHIPPING_RATE_PAISE` is deleted, and the product
page no longer prints a delivery figure at all — it printed the wrong one (₹150 against a
live ₹120), and a product page is where a wrong shipping number does the most damage.
No screen performs arithmetic on money any more.

**Not verified on device:** the checkout screen's own totals, because that screen gates on
sign-in and I did not sign in to a real customer account. It uses the identical
`useQuoteQuery` hook the cart does, which is verified. The Release-configuration build is
also unverified — it needs signing — so W-02 is proven by its logic, not by a release
binary.

---

**P1 — done in the working tree.** Both sides typecheck, the web builds, mobile lint is
identical to baseline (47 pre-existing problems, none added), and the app was rebuilt and
re-run.

| Package | State | Evidence |
|---|---|---|
| W-04 legal links | done | A **Legal** group in Settings opens `/privacy` in an in-app browser. Verified on device: the shield renders as a glyph, and the sheet opens against `dewdropz.shop` — the storefront origin, not the API base. No "Terms" row: the storefront has no such page, and a row that opens a 404 is worse than an absent one. |
| W-05 real deletion | done | `DELETE /api/mobile/account` verifies the bearer token and deletes only that token's own user. Verified: no token → 401, bad token → 401. Two Alerts before it fires. Admin accounts are refused. |
| W-06 addresses | done | The checkout route reuses a picked address after re-checking ownership on the admin client, instead of inserting on every order. New `/addresses` screen lists, defaults and deletes, linked from the account tab. |

### Two mistakes I made and caught on the device

- **The privacy link was only reachable signed in.** Settings returns early for a
  signed-out visitor, so the first version of W-04 put the one legal link behind the
  gate — exactly backwards, since the moment somebody most wants to read a privacy policy
  is before they hand anything over. It is in both branches now.
- **The new `/addresses` route rendered two stacked headers.** Every screen here draws its
  own; a route not declared in `app/_layout.tsx`'s `Stack` inherits the native one as well.
  Registered with `headerShown: false`.

### What P1 did not do

- **Adding** an address still happens at checkout, where the form already exists. A second
  form here would be a second thing to keep in step with it.
- The address-reuse path is **not verified end to end on device** — it needs a signed-in
  account and a real order. The server half is straightforward to read; the client sends
  `addressId` only when the form still matches the row that was picked, so an edited
  field writes a new address rather than silently shipping to the original.
- Deletion was **not executed against a real account**, for obvious reasons. Its refusal
  paths are verified; its success path is not.

---

**P2 — four of five done. W-07 (payments) is blocked and not attempted; see below.**
Both sides typecheck, the web builds with all seven mobile routes registered, mobile lint
is unchanged from baseline, and the app was rebuilt and re-run.

| Package | State | Evidence |
|---|---|---|
| W-08 coupons | done | A code is validated on its own through `fetchQuote` before it is allowed near the query that draws the total — a typo shows a field error instead of blanking the order total. Verified: `couponCode: "NOPE123"` → `{"error":"Invalid coupon code"}`, `validateCoupon`'s own words. The code is re-validated by `createOrder` at purchase, so one that expires between quoting and paying fails the order rather than billing an unagreed total. |
| W-09 cancel + return | done | `POST /api/mobile/orders/[id]/cancel` and `GET`/`POST .../return`, all three 401 without a token. Cancel reuses `cancelOrderInternal` (stock, coupon release, refund); the button only appears when the server would accept it. A new return screen picks items and quantities against server-supplied eligibility. |
| W-10 notification honesty | done | The app has no push capability — `expo-notifications` is not a dependency and no device token is ever registered — so three rows reading "Order updates · Packed, shipped, delivered" promised something that could never arrive. They now say "Emailed to you", and the group is "Email & inbox". The preferences are real; the channel was the lie. |
| W-11 cart revalidation | done | The quote already resolves every line against the database, so it now reports `unavailable` and the cart names those pieces and blocks checkout — before the button, rather than the parcel arriving short. |
| W-07 payments | **built, UNVERIFIED** | see below |

### W-07 is written and has never taken a rupee

Built on your instruction, with no credentials to test against. Everything in this row is
a claim about code that compiles, not about a payment that happened.

**What was built.** `POST /api/mobile/orders/razorpay` creates the order and its Razorpay
counterpart and stores the gateway id in `orders.payment_intent_id` — the column the
existing webhook matches on, so a mobile payment confirms through exactly the path a web
one does. The app opens `/pay/<orderId>` in a browser sheet rather than shipping
`react-native-razorpay`: no native module, and the publishable key never enters the
bundle. Returning is a deep link — `dewdropz://checkout/success` or `.../cancelled`.
Checkout's two greyed-out "coming soon" rows became one real choice, "UPI or card".

**What is verified:** the route refuses with a 503 and a sentence a customer can act on
when the keys are absent, and `/pay/<unknown-order>` 404s. Both sides typecheck, lint
clean and build; the app builds and runs.

**What is NOT verified — every branch that touches money:**

1. that a successful payment marks the order paid and confirmed exactly once
2. that an abandoned sheet leaves the order pending and re-payable
3. that a tampered signature is rejected by `/api/razorpay/verify`
4. that the webhook confirms the same order when the client never returns
5. that the amount charged equals `orders.total_amount` to the paise
6. that `payment.failed` renders differently from a dismissed modal

Every one of those is marked `⚠ UNVERIFIED` in the files themselves. **Do not enable this
for customers until all six are exercised against test keys.**

**Two deliberate omissions.** The cart is not cleared when the sheet opens — no money has
moved yet, and clearing it would strand somebody who dismisses the sheet; the success
screen clears it instead, idempotently. And an abandoned order is left payable rather than
cancelled, because a closed browser tab is not a decision.

**One thing worth adding before real volume:** `/pay/<orderId>` is secured only by the
order id being an unguessable UUID. Somebody holding one can see the order number and the
amount, and can pay it. A single-use `pay_token` column minted per attempt would close
that; it needs a migration and was not written.

### Why W-07 could not be verified

**There are no payment credentials in this repository.** `.env.example` documents
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` and the Stripe set;
`.env.local` contains none of them. The web's own Razorpay and Stripe flows are equally
non-functional locally as a result.

A payment integration is the one thing in this plan that cannot be shipped on the strength
of reading the code. Signature verification, amount rounding, the success/abandon/failure
branches and the webhook race are all things that are either exercised against a real
gateway or not known to work at all. Writing that blind, on the path that moves money,
would produce something that compiles, looks finished, and has never once taken a rupee.

The plumbing is already in place and does not need rewriting: `createRazorpayOrder`,
`verifyRazorpayPayment`, `/api/razorpay/verify` and the webhook all exist and are used by
the web. What mobile needs is a route that creates the Razorpay order for a token-authed
caller, a hosted payment page the app opens in `expo-web-browser`, and a deep link back —
deliberately NOT `react-native-razorpay`, which would add a native module and put the key
in the bundle. That is perhaps half a day once test keys exist.

The plumbing above was written anyway, on your call, with every unverified branch marked
in the source.

---

**P3 — done in the working tree.** Both sides typecheck, the web builds, mobile lint is
identical to baseline (100 pre-existing problems, none added), and the app builds and runs.

| Package | State | Evidence |
|---|---|---|
| W-12 saved designs | done | New `/designs` screen listing what this member has made, linked from the account tab. Reads through the session client so `045_custom_design_privacy.sql` decides. Shows the recorded print DPI when it is poor, so a design made before W-13 existed can still tell you. |
| W-13 DPI warning | done, **logic verified** | `printQuality.ts` computes the DPI an image will actually print at, from the source dimensions the picker was already capturing and discarding. Checked against the tee's real zone (12in over 212.37px, read from the database): a 120px image lands at **14 DPI**, a 1200px screenshot at **143**, a real iPhone photo at **480**. Shrinking a 400px image walks it 48 → 95 → 190 → 317 DPI, which is exactly what the copy tells people to do. It shows live in the edit panel, and an unprintable design asks once before going in the cart. |
| W-14 share links | done | `/product/` → `/products/`. Verified: the old path **404s**, the new one 200s. Journal shares now carry a URL at all — `/journal/why-we-go` 200s. Collections were already correct. |
| W-15 multipart upload | **server verified, client not** | see below |
| W-16 unsaved-work guard | done, **verified on device** | Leaving the studio with layers on the garment now asks "Leave without adding it?" with Keep editing / Discard. Screenshotted. |

### W-15 is half-verified, and the half that matters is the half I could not test

The endpoint is verified three ways with real requests: a multipart PNG uploads and returns
a URL, the base64 path still works so an older build of the app keeps functioning, and a
text file mislabelled `image/png` is still refused by the magic-byte check.

**The React Native side is not verified.** `FormData` with `{ uri, name, type }` is the
standard RN upload idiom and it typechecks, but I could not complete an image pick on the
simulator — the photo picker kept returning cancelled, so the app never sent a multipart
request. What that means precisely: I have no evidence the client change works, and none
that it is broken. It needs one real pick on a device before it is trusted.

I initially misread a 400 in the server log as the app failing. It was my own curl test of
a deliberately-invalid file. Worth recording because it nearly became a bug report about
code that was fine.

### Not attempted in P3: universal links

M-13 also covers app links — so a `dewdropz.shop` URL opens the app rather than Safari.
That needs an `apple-app-site-association` file signed against a real Apple Team ID and an
`assetlinks.json` carrying the Android signing key's SHA-256 fingerprint. Neither exists in
this repository, and inventing placeholder values produces a config that fails silently.
The share links themselves now resolve, which was the actual bug.

---

**P4 — done in the working tree, with W-17 deliberately partial.** Both sides typecheck,
the web builds, mobile lint is identical to baseline (101 problems, none added), and the
app builds, runs and was driven on the simulator.

| Package | State | Evidence |
|---|---|---|
| W-17 virtualization | **partial, by decision** | `saved.tsx` converted to `FlatList` with `numColumns={2}` and verified rendering on device — header, gutter and 48% cells all intact. The catalogue grids were left alone; see below. |
| W-18 image states | done | New `components/ui/Img.tsx` gives every remote image a ground while it loads and a fallback if it fails. Adopted across **23 files by changing one import line each** (`import { Img as Image }`), so all 33 existing `<Image>` call sites picked it up without being touched. `CustomizeStage` keeps the real `expo-image` alongside it for `Image.loadAsync`, which has no component equivalent. |
| W-19 accessibility | done | Every icon-only button in the app now has a name: gallery close, password reveal, save/unsave (with `accessibilityState`), remove-from-pack, undo, redo, bold, italic. Found by a scan for `<TouchableOpacity>` wrapping an `<Icon>` with no sibling text — 13 of them, all fixed. The remaining flagged rows contain visible text, so the OS derives the name. |
| W-20 polish | done | The toast moved from `insets.bottom + 92` to `+ 168`: it was landing exactly on the pinned Checkout and Place-order CTAs — screenshotted, covering them completely. The studio's rotate handle moved to the opposite corner from resize; both used to sit on the right edge, so on a line of text two 38pt slots stacked on a ~25pt box and covered the word being edited ("Your text" rendered as "Your tex" under two circles). |

### A finding the audit missed, caught while driving the app

**M-24 · The product page claimed "INCL. ALL TAXES", and it was false.** GST is *added*
(`subtotal + shipping + tax − discounts`), so a ₹1,899 hoodie carries ₹227.88 of 12% GST
on top of the figure that line sat under. It is the same class of thing as M-01, on the
first screen where anybody reads a price. Now reads "PLUS GST · SHOWN IN YOUR CART".

The web says "Inclusive of all taxes" under the **Total**, where it is true. Mobile had
copied a correct sentence into a place that made it wrong. The web needs no change.

### A correction to M-18

The finding implied the catalogue query pulls a heavy payload. It does not:
`PRODUCT_SELECT`, `CUSTOMIZABLE_SELECT` and `PRODUCT_DETAIL_SELECT` are already three
deliberately separate column lists, with comments explaining that list screens must not
pull the detail fields. That work was already done. What stands is the absence of a
`limit` and the client-side filtering — not the payload width.

### Why the catalogue grids were not virtualized

`shop`, `category`, `collections/[slug]` and `search` are still `ScrollView` + `.map()`.
This is a judgement, not an oversight:

- **The shop grid is not a list.** It interleaves `CollectionBanner`s between runs of
  products and uses `stickyHeaderIndices={[2]}` for the filter bar. A faithful conversion
  means flattening banners and product-pairs into one row-item union and rebuilding the
  sticky header, on the app's single most important screen.
- **I cannot observe the benefit.** The catalogue has three products. Virtualization is
  invisible below a screenful and only bites at a few hundred; I would be restructuring
  the main browsing surface with no way to verify either the fix or a regression.
- **The risk is asymmetric.** A subtle layout break on the shop tab costs more than the
  frame budget it would save today.

What it needs, when the catalogue grows: one `FlatList` per screen whose `data` is a
discriminated union of `{ kind: 'row', products }` and `{ kind: 'banner', collection }`,
with everything above the grid in `ListHeaderComponent` and the rails below it in
`ListFooterComponent`. `saved.tsx` is the worked example of the simple half.

---

## 1. The quality contract — non-negotiables

### 1.1 Money is computed in exactly one place, and it is not the client

This is the lesson the web app already learned and wrote down in
`lib/checkoutPricing.ts:12-24`:

> "The obvious fix — compute a display total in the checkout component — is the wrong
> one. Two implementations of the same pricing rules drift, and the day they drift the
> shop either quotes less than it charges or charges more than it quoted. So there is
> exactly one function, and both the quote the customer approves and the order that bills
> them call it."

The mobile app does the forbidden thing, and it has already drifted (M-01). After this
plan, **no rupee figure a customer sees may be arithmetic performed on the device**.
Subtotals of what is in the cart are fine; totals, shipping, tax and discounts are not.

### 1.2 A release build may never depend on a development host

`app.json` currently ships `apiUrl: http://localhost:3010`. Anything that resolves against
it — checkout, design save, image upload, and every garment mockup — is dead in a
TestFlight or Play build. The fix is not "remember to change it before release"; it is a
guard that makes a loopback API base impossible outside `__DEV__`.

### 1.3 Nothing is fabricated

The app already honours this and it is worth keeping: `lib/data.ts:105-112` deleted a
hardcoded demo catalogue because "an empty or unreachable database silently rendered
products that don't exist and can't be ordered. An empty shop is the truth."

### 1.4 The upload endpoint's trust boundary is validation, not identity

`/api/mobile/uploads` is deliberately unauthenticated so a shopper can design before
signing in. What protects it is magic-byte sniffing, a hard size cap, raster-only formats
(no SVG, which can carry script), and a random server-side filename. Do not add auth
there as a substitute for any of those, and do not relax any of them.

### 1.5 The studio's fonts and the renderer's fonts are one set

`lib/customize/renderDesign.ts` registers TTFs vendored from the same `@expo-google-fonts`
packages the app bundles, under private family names. Adding a font to `StudioToolbar`
without vendoring the matching TTF means the phone shows one thing and the press prints
another. Italic sans deliberately falls back to upright rather than letting the rasterizer
synthesise a slant the phone never showed — keep that.

### 1.6 Every list is virtualized

There is currently no `FlatList` in the app (M-18). New lists use `FlatList` (or
`FlashList`), with `keyExtractor`. A `ScrollView` + `.map()` is only acceptable for a
bounded, non-data-driven list.

### 1.7 Every remote image has a placeholder and a failure state

There are currently zero `onError` handlers and zero placeholders (M-19). `expo-image`
supports both. A blank box is not a loading state and it is not an error state.

### 1.8 Definition of done, per package

1. `npx tsc --noEmit` clean in `mobile/`.
2. `npm run lint` adds no new problems.
3. The iOS app builds and launches, and the touched screen is exercised on the simulator.
4. Any pricing change is verified against a figure computed from the database, not by eye.

---

## 2. Findings ledger

Severity: **S1** breaks the product or costs money · **S2** blocks release or breaks a
promise · **S3** incomplete against "a complete ecommerce system and a complete custom
print designer" · **S4** quality.

| ID | Sev | Finding | Evidence |
|----|-----|---------|----------|
| M-01 | S1 | Checkout quotes a total the server does not charge. GST is additive and omitted; shipping is hardcoded ₹150 against a live **zone rate of ₹120**; promotions and coupons are ignored. Payment is **cash on delivery**, so a courier collects the server's number. | `mobile/app/checkout/index.tsx:56`, `mobile/lib/constants.ts:9-10` vs `lib/checkoutPricing.ts:171`. Measured through the new quote endpoint: hoodie **+₹197.88**, sweatshirt **+₹161.88**, tee **+₹14.95** |
| M-02 | S1 | `apiUrl` ships as `http://localhost:3010`. Checkout, design save, image upload and every garment mockup resolve against it. Cleartext is enabled only in the **debug** Android manifests; iOS ATS is `NSAllowsArbitraryLoads: false`. | `mobile/app.json`, `mobile/lib/env.ts:20`, `mobile/lib/customize/assetUrl.ts:13`, `android/app/src/debug/AndroidManifest.xml` |
| M-03 | S1 | `skippedItems` — lines the server dropped for stock — is returned and discarded. The cart is then cleared and success is shown. | `app/api/mobile/checkout/route.ts:86` vs `mobile/lib/queries.ts:215` |
| M-04 | S2 | No privacy policy link anywhere in the app. Required by both stores. | `grep -ri privacy mobile/app` → nothing |
| M-05 | S2 | Account deletion opens a support email. Apple 5.1.1(v) requires in-app deletion. | `mobile/app/settings.tsx:41-58` |
| M-06 | S2 | Every checkout inserts a **new** address row, even when a saved address was selected. No add/edit/delete anywhere in the app. | `app/api/mobile/checkout/route.ts:38-53` |
| M-07 | S3 | Payment is COD only. UPI and card are rendered at 45% opacity as "coming soon". Web has Stripe and Razorpay. | `mobile/app/checkout/index.tsx:309-330` |
| M-08 | S3 | No coupon entry on mobile. | no `coupon` in `mobile/app/checkout` or `cart.tsx` |
| M-09 | S3 | No order cancel and no return request. Both exist on web. | `mobile/lib/queries.ts` mutations: notifications, prefs, review, checkout |
| M-10 | S3 | Settings offers three notification toggles; `expo-notifications` is not a dependency. No push can ever arrive. | `mobile/package.json`, `mobile/app/settings.tsx:104-118` |
| M-11 | S3 | No saved-designs surface. A design is unreachable after checkout — it cannot be found, reused or reordered. Web has `/account/designs`. | `find mobile/app -name '*design*'` → the studio tab only |
| M-12 | S3 | No print-resolution warning. The picker captures `asset.width`/`asset.height` and never uses them for DPI. A 400px photo across a 12″ zone prints at ~33 DPI, silently. | `mobile/app/customize/[slug].tsx:180-183` |
| M-13 | S3 | Product share builds `/product/{slug}`; the web route is `/products/{slug}`. **Every shared product link 404s.** Journal and order shares carry no URL at all. No universal links / app links. | `mobile/app/product/[slug].tsx:413`, `app/products/[slug]`, `mobile/app/journal/[id].tsx:126` |
| M-14 | S3 | Uploads go base64-over-JSON: a 10MB image is a ~13.3MB body, fully in memory on device and server. `next.config.ts`'s `bodySizeLimit: 12mb` covers **Server Actions only**, not this route handler. | `mobile/lib/customize/save.ts:15`, `next.config.ts:27` |
| M-15 | S4 | `quality: 0.9` re-encodes the source photo before it is ever printed. | `mobile/app/customize/[slug].tsx:163` |
| M-16 | S4 | Cart never revalidates stock or price before submitting. Compounds M-03. | `mobile/app/(tabs)/cart.tsx` |
| M-17 | S4 | No unsaved-work guard when leaving the studio. | no `beforeRemove` / `BackHandler` in `customize/[slug].tsx` |
| M-18 | S4 | **No `FlatList` or `FlashList` in the app.** Every list is `ScrollView` + `.map()`. `getProducts()` has no limit or pagination, and every category/collection screen filters the whole catalogue client-side. | `grep -rl FlatList mobile/app mobile/components` → empty; `lib/data.ts:93-101,167` |
| M-19 | S4 | Zero `onError` handlers and zero image placeholders. A failed image is a silent blank box — observed live when the API host went down. | `grep -rn onError mobile/app mobile/components` → 0 |
| M-20 | S4 | ~83% of touchables carry no accessibility label (258 `TouchableOpacity` vs 44 `accessibilityLabel`). | counted |
| M-21 | S4 | The toast stack sits at `bottom + 92`, directly over the pinned Checkout CTA. | `mobile/components/ui/Toast.tsx:69` |
| M-22 | S4 | Studio selection handles overlay short text, obscuring what is being edited. | observed on device |
| M-23 | S4 | Category cards render as bare grey gradients — `categories.image_url` is null and there is no designed fallback. | observed on device |
| M-24 | S1 | The product page printed "INCL. ALL TAXES" under a price that is tax-EXCLUSIVE. A ₹1,899 hoodie carries ₹227.88 of GST added at checkout. Found while driving the app during P4, not during the audit. | `mobile/app/product/[slug].tsx:209` vs `lib/checkoutPricing.ts:171` |

### A fourth correction, found while fixing M-01

The audit put the gap at **+₹177.88 / +₹141.88 / −₹5.05**, computed by hand from
`store_settings.flat_shipping_rate` (₹100). That was wrong: there is an **active shipping
zone charging ₹120**, which `calculateShippingCost` prefers over the flat default. The
real figures, taken from the endpoint that now does the pricing, are **+₹197.88 /
+₹161.88 / +₹14.95** — and the tee, which the audit reported as the app *over*charging by
₹5, actually undercharges by ₹14.95 like the rest.

The correction is the argument for the fix. Even a careful manual computation against the
right tables got it wrong, because shipping and tax rules live in the database and change
without a deploy. That is precisely why the number has to be asked for, not derived.

### Three things the audit got wrong and corrected

- "0 COLLECTION" on a product card is the real collection name **O Collection**.
- "Add to Cart" **is** correctly disabled on an empty design (`disabled={!hasAnything || saving}`);
  the pale styling was the disabled state.
- The blank cart thumbnail was load latency on a 590KB preview, not a broken URL. The
  missing placeholder (M-19) is why it read as broken.

### What is already strong, and must not regress

- **The server-side design pipeline.** Layers are sent as data and rasterised server-side
  with the same TTFs the app bundles. A verified render came back as a correct 800×1000
  composited mockup. Both platforms produce identical print files.
- **The upload endpoint's validation** (§1.4).
- **The gesture layer**: shared values, clamped so a layer can never be dragged out of
  reach, one undo entry per gesture rather than per frame.
- **No mock-data fallback** (§1.3).
- Auth is complete including password reset. Product-page stock handling is correct.
  Theme shadow tokens include Android `elevation`. `tsc` and the iOS build are clean.

---

## 3. Work packages

### P0 — money, and whether a release build works at all (M-01, M-02, M-03)

#### W-01 · One price, computed on the server

**Fixes** M-01 · **Files** new `app/api/mobile/quote/route.ts`; `mobile/lib/queries.ts`;
`mobile/app/checkout/index.tsx`; `mobile/app/(tabs)/cart.tsx`; delete
`mobile/lib/constants.ts`'s pricing constants.

**Change** A `POST /api/mobile/quote` that takes the same `items` shape checkout already
sends, resolves them server-side, and returns `priceCheckout`'s result. The app renders
that object and performs no arithmetic. Shipping needs a destination to be exact, so the
quote takes an optional `state`/`postalCode` and the checkout screen re-quotes once an
address is chosen.

**Guardrails** The quote must call the *same* `priceCheckout` the order calls — not a
copy. Until an address is known, label shipping and tax as not-yet-known rather than
guessing; a wrong number is worse than an absent one. Never fall back to a client
estimate on network failure — block checkout instead.

**Done when** the figure on the cart and checkout screens equals `total_amount` on the
created order, verified against a database-computed figure for all three products.

#### W-02 · A release build cannot point at a laptop

**Fixes** M-02 · **Files** `mobile/lib/env.ts`, `mobile/app.json`

**Change** Outside `__DEV__`, a loopback or emulator-alias API base is refused and
`siteUrl` is used instead. `extra.apiUrl` keeps working for device/LAN development.

**Guardrails** Keep the Android `10.0.2.2` rewrite — it is load-bearing for the emulator
and the comment explains why. Do not point mockups at a different origin than the API
without checking `resolveAssetUrl`'s callers.

**Done when** a Release-configuration build resolves `ENV.apiUrl` to `https://dewdropz.shop`
with `app.json` untouched.

#### W-03 · An order that dropped items says so

**Fixes** M-03 · **Files** `mobile/lib/queries.ts`, `mobile/app/checkout/index.tsx`

**Change** Type the response as `{ orderId, skippedItems }`, carry it to the success
screen, and name what was dropped. Do not clear those lines from the cart.

**Guardrails** The order was still placed — this is a notice, not an error. If *every*
line was skipped the server already refuses, so an empty order is not this package's case.

---

### P1 — release blockers (M-04, M-05, M-06)
W-04 privacy + terms links in Settings and the account tab · W-05 in-app account deletion
through a real endpoint · W-06 reuse the selected address instead of inserting a duplicate,
and add address management.

### P2 — completing the ecommerce system (M-07…M-10, M-16)
W-07 real payment (Razorpay first — it is what the web uses for India) · W-08 coupons ·
W-09 cancel and return · W-10 push notifications, or remove the toggles that promise them ·
W-11 revalidate the cart before checkout.

### P3 — completing the designer and the growth loop (M-11…M-15, M-17)
W-12 a saved-designs surface · W-13 a DPI warning from dimensions already captured ·
W-14 fix the product share path and add universal links · W-15 multipart uploads ·
W-16 unsaved-work guard.

### P4 — performance and polish (M-18…M-23)
W-17 virtualize every list and paginate `getProducts` · W-18 image placeholders and error
states · W-19 accessibility labels · W-20 toast placement, studio handles, category art.

---

## 4. Verification

- `cd mobile && npx tsc --noEmit`
- Build: `mcp__Claude_Code_iOS_Simulator__build` on `ios/DewDropz.xcworkspace`, scheme `DewDropz`
- Pricing: compute the expected total from `tax_rates` + `store_settings` and compare to
  what the screen renders. Never eyeball a rupee figure.
- Release config: `ENV.apiUrl` must not match `/(localhost|127\.0\.0\.1|10\.0\.2\.2)/`
  when `__DEV__` is false.

## 5. The Android pass

Everything above was audited and verified on the iOS Simulator. Android was read
statically only, which the plan said and which was the weakest claim in it. Run on
a Pixel 8 emulator, API 35 / Android 15:

**Confirmed working, for the first time on the platform it was written for.**

- `forEmulator()` in `mobile/lib/env.ts` — the rewrite this whole P0 turned on.
  Glide loaded `http://10.0.2.2:3010/custom/tshirt/tshirt-front.jpg`. Before the
  rewrite that URL was `localhost`, which on an emulator is the emulator, so the
  studio would have opened with no garment in it.
- Server-driven totals (W-01). The cart rendered ₹899 + ₹120 delivery + ₹44.95
  GST = ₹1,063.95, and `/api/mobile/quote` returns
  `{subtotal: 89900, effectiveShipping: 12000, taxAmount: 4495, totalAmount: 106395}`
  — equal to the paise. The ₹120 is the shipping *zone* rate, which is the figure
  the original audit got wrong by reading `store_settings.flat_shipping_rate`.
- GST banding: 5% on ₹899, correct for HSN 6109 under ₹1,000.01.
- Free-shipping progress: "₹1,101 to free shipping" = 200000 − 89900.
- Studio: blanks list, editor, print-area overlay, text layer, `Add to Cart`
  disabled until a layer exists, custom mockup thumbnail in the cart.

**Two defects Android exposed that iOS had been hiding.** Both fixed in `8d42da3`.

| | What | Why only Android |
|---|---|---|
| A-01 | The clock and battery were white on the cream checkout gate | Android keeps the status bar style globally and across navigations; iOS resets it per presentation. The signed-out branch returns before the `<StatusCap />` further down the file, so it inherited `light` from the cart's ink hero. |
| A-02 | The privacy policy was unreachable when signed out | Not platform-specific in principle — it was found by walking the signed-out app on a fresh install, which the iOS pass never did. Settings renders a signed-out state *with* the link; both routes into Settings sat in the signed-in branch. |

A-02 is the more serious of the two: both stores require the policy to be
reachable by someone who has not made an account, and that is precisely the
person the app was hiding it from.

**Still unverified, unchanged by this pass.** Razorpay (W-07) — no credentials
exist, so none of the six money-touching branches in §3 P1 have run. The RN half
of the multipart upload (W-15) still needs one real image pick; the emulator has
an empty photo library.

---

## M-24 · The collapsing header fought the scroll on Android

**Reported 1 Sep 2026:** *"wherever there is a header that need to be scrolled
and it became small, while scrolling, it is flickering and also not able to
scroll very easily."*

### Cause

`ScreenHeader` collapsed by animating its **`height`** from `useAnimatedStyle`,
and it sat in the layout column as a **sibling directly above** the list.

`height` is a layout property. This app runs **Reanimated 4.5 on the New
Architecture**, so every frame of the collapse committed a fresh layout to the
shadow tree — and because the panel was in flow, that commit **resized the list
underneath it while the finger was still dragging**. Both reported symptoms fall
straight out of that:

* **flicker** — the layout commit races the scroll's own frame, and the panel's
  children are re-measured through invalid intermediate states;
* **hard to scroll** — the scroller's viewport is being moved under it mid-gesture,
  so momentum and offset are computed against a frame that keeps changing.

Android feels it far more than iOS: its commit is more expensive and is not
synchronised to the scroll frame.

A second, independent flicker source sat on top of it. The measured view lives
inside the block being animated, so the collapse re-triggered its `onLayout`;
the old guard (`Math.abs(h - naturalH) > 1`) let those intermediate heights
through to `setState`, re-rendering the header mid-scroll and re-attaching its
animated style.

### Fix

| | |
|---|---|
| **The panel floats** | `position: absolute` whenever it is collapsing, so its height animation cannot touch the list's frame. The list is told how much room to leave via a new `onHeight` callback → `contentContainerStyle.paddingTop`. 17 collapsing headers across 14 screens. |
| **Measurement only grows** | `setNaturalH` accepts a height only when the content got *taller*. That keeps the case it was written for — a panel that renders before its data and then gains a stats row — and rejects every height produced by the collapse itself. |
| **`Topography` is memoised** | Its path data was memoised; the component was not, so each header re-render handed react-native-svg ten fresh `<Path>` elements to reconcile for an unchanged texture. |
| **No `elevation`** | The floating panel orders with `zIndex` only. On Android `elevation` is a material shadow, not a z-order knob — it would have drawn a hard drop shadow under a flat ink plate on every one of these screens. |
| **`zIndex: 10`, under `StatusCap`** | The cap is absolute at 20 and exists to keep the clock legible for the whole life of the screen. Nothing may paint over it. |
| **`progressViewOffset={headerH}`** | On 8 screens with pull-to-refresh. A floating header would otherwise hide the spinner. |

### Verified on the emulator, and measured

**Why it was "still happening".** The APK on `emulator-5554` was a RELEASE build
installed at 13:32; the fix was written at 18:12. A release build has the JS
bundle compiled into it (`flags=0x0`, no `DEBUGGABLE`), so it cannot load
anything from Metro — the app under test could not have contained the change,
and no amount of reloading would have made it. It was replaced with a debug
build (`./gradlew assembleDebug`) served by Metro on 8081.

**A crash in the first version of the fix, caught only on the device.** The
collapse was factored through a `shift()` helper declared in the component body.
That function lives on the JS runtime and `useAnimatedStyle` runs on the UI
runtime, so the first scroll threw *"[Worklets] Tried to synchronously call a
Remote Function"*. The interpolation is now written out inside each worklet.
`tsc` cannot see this class of bug; only running it can.

**The structural fix, proved.** The scrollable node's bounds, dumped with
`uiautomator` before and after a scroll:

| | at rest | after scrolling |
|---|---|---|
| before | `[0,663][1080,2211]` | resized by the collapse |
| after | `[0,0][1080,2400]` | `[0,0][1080,2400]` — **unchanged** |

The list now spans the whole screen with the panel floating over it, and its
frame does not move while the header collapses. That is the fighting-the-scroll
symptom gone at the root.

**Frame timing, same screen, same device, same build** — `dumpsys gfxinfo`
around six full scroll cycles on `/rent`:

| | before | after | after (repeat) |
|---|---|---|---|
| Janky frames | **91.4 %** | 45.7 % | **42.2 %** |
| 50th percentile frame | **150 ms** | 40 ms | **38 ms** |
| 90th percentile frame | 300 ms | 69 ms | **65 ms** |
| Missed Vsync | 37 | 27 | **16** |
| Frames delivered | 58 | 175 | 166 |

Median frame time is **~4× faster** and the app delivers roughly **three times
as many frames** through the same gesture.

**Context for the numbers that remain.** 42 % janky still looks high, and it is
not the header: a screen with NO collapsing header at all (`/shop`) measured
**78.6 % janky, 69 ms median** on the same run. The collapsing screen is now
*better* than a plain one. What is left is the debug build and the emulator —
neither is a fair proxy for a release build on real hardware.

### Still worth doing

Re-measure on a physical device against a release build before calling the
number good. The structural result — a list whose frame never changes during
the collapse, and a collapse that touches no layout property — holds regardless
of what hardware it runs on.

---

## M-25 · "Errors on every action" is a backend URL, not a bug in the app

**Reported 1 Sep 2026:** *"it was showing all kind of errors while adding to the
cart and all kind of issues with this supabase or any kind of vercel API… it is
showing error while doing any kind of action."*

### The app is fine. Verified on the emulator, end to end.

Against a debug build with the local Next server running: the shop lists real
products from Supabase, a product page opens, **Add to pack works** (two taps →
2 pieces, ₹5,600, GST ₹280, checkout ₹5,880), and **Checkout works** — it
correctly stops at "Sign in to check out" carrying the cart. No error, no
redbox, nothing in the JS console.

### What actually breaks, and only in a release build

`mobile/lib/env.ts` refuses a loopback API base outside `__DEV__` and falls back
to `extra.siteUrl`:

```
const apiUrl = !__DEV__ && LOOPBACK.test(configuredApiUrl) ? siteUrl : forEmulator(configuredApiUrl)
```

`app.json` sets `apiUrl` to `http://localhost:3010` and `siteUrl` to
`https://dewdropz.shop`. So every release build points its API calls at
`https://dewdropz.shop`.

**That domain does not resolve.** `nslookup dewdropz.shop` → *"Can't find
dewdropz.shop: No answer"*. There is no deployment behind it.

So in the release APK, everything that goes through `/api/mobile/*` fails:
checkout, the price quote, rental quote, rental booking, rental cancellation,
design save and image upload. Everything that talks to Supabase **directly** —
browsing, product pages, the cart, wishlists, auth — keeps working, which is
exactly why the app looks healthy right up until you try to do something.

### Why a LAN IP is not a workaround for a release build

`usesCleartextTraffic="true"` is set **only** in
`android/app/src/debug/AndroidManifest.xml`. The release manifest does not set
it, so Android 9+ blocks plain HTTP. A release build cannot talk to
`http://192.168.1.13:3010` even with the address configured.

### What is needed

**A deployed HTTPS backend.** The `/api/mobile/*` routes are served by the same
Next app as the storefront, so one deployment fixes all of it; then set
`extra.siteUrl` (and `extra.apiUrl` for a device) to that origin and rebuild.

Until then:

| build | API target | works? |
|---|---|---|
| debug + Metro, emulator | `10.0.2.2:3010` → the dev machine | **yes**, verified |
| debug + Metro, phone on the same wifi | needs `extra.apiUrl` = `http://192.168.1.13:3010` | yes, while `npm run dev` runs |
| release, standalone | `https://dewdropz.shop` | **no — domain does not resolve** |

### RESOLVED — 1 Sep 2026

`https://dewdropz.vercel.app` is live and serving the mobile API. Verified
before changing anything: `/` and `/shop` return 200, and a real
`POST /api/mobile/quote` priced a live product correctly — ₹1,899 subtotal,
₹120 delivery, 12% GST, ₹2,246.88 total.

**One line changed:** `extra.siteUrl` in `mobile/app.json`, from the
non-resolving `https://dewdropz.shop` to `https://dewdropz.vercel.app`.

`extra.apiUrl` is deliberately left at `http://localhost:3010`. That is the
correct development default — `forEmulator` rewrites it to `10.0.2.2` on the
emulator — and `env.ts` already refuses a loopback base outside `__DEV__` and
falls through to `siteUrl`. So one value fixes every release build without
disturbing local development.

**Verified on the emulator with a standalone release APK** (`assembleRelease`,
no Metro, no DEBUGGABLE flag):

* the embedded `assets/app.config` carries `siteUrl: https://dewdropz.vercel.app`;
* the app launches and loads the storefront;
* **Add to pack works**, and the cart shows 1 × Microspikes ₹2,800, delivery
  free, **GST ₹140**, checkout ₹2,940.

Those tax and delivery figures are computed by `priceCheckout` on the server,
not on the device — the app has not done pricing arithmetic since the drift bug
in `/api/mobile/quote`'s header. Their presence is proof the release build
reached the deployment and got a real answer, which is exactly what failed
before.

The APK is at `mobile/android/app/build/outputs/apk/release/app-release.apk`.
It is signed with the **debug keystore** (`build.gradle:115`), which is fine for
sideloading and not acceptable for Play — that needs a real keystore.

---

## M-26 · Release builds — where they are, and what iOS still needs

Both built 2 Sep 2026 from `app.json` v0.2.0 with
`siteUrl = https://dewdropz.vercel.app`, and both carry a bundled JS payload —
neither needs Metro or a dev server.

```
mobile/dist/DewDropz-0.2.0-android-release.apk        111 MB
mobile/dist/DewDropz-0.2.0-ios-simulator.app.zip       31 MB
```

`mobile/.gitignore` already ignores `dist/`, so neither is committed.

### Android — installable, verified

`assembleRelease`. Embedded `assets/app.config` confirmed to carry the Vercel
origin. Installed on `emulator-5554` and driven through the flow that was
failing: **Add to pack works**, cart shows 1 × Microspikes ₹2,800, delivery
free, **GST ₹140**, checkout ₹2,940 — server-computed figures, so the release
build reached the deployment.

**Signed with the debug keystore** (`android/app/build.gradle:115`, which says
so itself: *"Caution! In production, you need to generate your own keystore"*).
Fine for sideloading, rejected by Play.

### iOS — builds and runs, but cannot be installed on a phone

`xcodebuild -configuration Release -sdk iphonesimulator` → **BUILD SUCCEEDED**.
Installed on the iPhone 17 Pro simulator: launches, loads the storefront and the
gear room from Supabase, no crash reports. `EXConstants.bundle/app.config`
carries the Vercel origin, and `main.jsbundle` is embedded.

**It is a simulator binary and cannot run on an iPhone.** The blocker is not
this repo:

```
security find-identity -v -p codesigning  →  0 valid identities found
```

An iPhone-installable build (`.ipa`, ad-hoc, TestFlight or App Store) needs an
Apple Developer Program membership, a distribution certificate and a
provisioning profile for `com.dewdropz.app`. None of those exist on this
machine, and none can be created without the account.

Once that account exists, the build itself is unchanged — only signing is
added.

### The two remaining signing gaps, in one place

| | needs | blocks |
|---|---|---|
| Android | a real upload keystore | Play Store submission (sideloading works today) |
| iOS | Apple Developer account + certificate + profile | **any install on a physical iPhone**, TestFlight, App Store |
