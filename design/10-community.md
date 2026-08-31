# Community — Action Plan

*Section 10 of the homepage (18:30 · The way down). Written against `components/sections/Community.tsx` (216 lines), `actions/reviews.ts`, `app/page.tsx`, `app/globals.css`, `lib/trail.ts`, `lib/constants.ts`, `lib/utils.ts`, `supabase/migrations/001_initial_schema.sql` on branch `mobile-remediation`. Every line number and every contrast ratio below was checked against the working tree; ratios were computed from the tokens in `globals.css:32–69`, not estimated. Where I could not specify a value exactly, it is in §6, not hidden behind an adjective.*

---

## 1. The verdict

This is the only band on the homepage that carries proof of purchase, and it currently prints that proof at the lowest contrast on the page, one voice at a time, on a timer nobody asked for, in front of a picture that is not evidence of anything — and on the live site it does not render at all. Four facts carry the diagnosis. **The section is empty because nothing can fill it:** `createReview` exists, is validated, already computes `is_verified` from delivered/shipped orders (`actions/reviews.ts:12–60`), and is exported from the barrel at `actions/index.ts:105` — and has *no caller anywhere in the web app*. `app/products/[slug]/page.tsx` is 91 lines and contains the string "review" zero times; the only capture UI in the repo is `mobile/components/ProductReviews.tsx`. So `reviews.length === 0`, `app/page.tsx:143` gates the section out, and the 18:30 chapter silently vanishes from a day-arc that runs 05:50 to 21:00. **When it does render, it ships invisible:** `motion` writes its `initial` values as inline styles during SSR, so the blockquote goes out as `opacity:0` and the image wrapper as `opacity:0;transform:scale(1.04)` — a stalled hydration leaves a heading and a hairline standing over a blank column, which is hard constraint 2 broken in the server HTML, and the 7000ms `setInterval` at `:11,:37–41` is ambient motion on a page whose council record contains two separate client rejections of exactly that. **The proof is unreadable:** `✓ Verified buyer` is `--sage` on `--paper-warm` at 9px — **2.35:1** — and the whole `01…08` index plus the report counter are `--light` on the same ground at **2.63:1**; every word that has to be believed is set in the two lowest-contrast values in the file. **And the band ends on a promise the codebase cannot keep:** "Tag @dewdropz.shop to be featured →" points at `SITE.instagram`, the literal string `'https://instagram.com'` (`lib/constants.ts:188`, admitted in a comment at `:176`), in the same tab, with no UGC pipeline anywhere in the repo.

The fix is not more theatre. It is to **stop performing and start testifying**: put the band at golden hour where its own clock says it is, open it with the one sentence a customer's words earn instead of a fourth identical eyebrow, let nothing move until a visitor touches a number, take the type off the photograph and onto a solid dusk plate where its contrast is the same on every image a merchant will ever upload, and — the item that decides whether any of the rest is ever seen — build the route that lets a customer write the report in the first place. Everything below is that idea, itemised.

---

## 2. What stays — do not touch

| | Why it is right |
|---|---|
| **The refusal to fabricate.** The comment block at `:13–21` and the `if (count === 0) return null` at `:43`. | This section used to render four invented customers with invented treks, each stamped "✓ Verified buyer" on a live storefront. It renders nothing instead. That decision is correct and every item below preserves it — nothing here seeds a row, mocks a quote, or holds a shape with placeholder content. |
| **The section disappears with its trail wrapper.** `app/page.tsx:143–147`. | `TrailSpine` builds its chapter HUD from the `data-trail-*` attributes; a wrapper left standing would advertise an 18:30 stop with nothing behind it. Keep the gate exactly where it is. |
| **The refusal to borrow a stock trek shot.** Comment at `:155–157`. | Right instinct, wrong outcome today (§4), but the principle holds: the evidence column never gets a bought photograph of a stranger on a mountain. |
| **`stopEyebrow(stop)` as the one format for a stop.** `lib/trail.ts:84–86`. | Single source of truth for every section's clock. Item 1 moves *where* the stop prints, never how. |
| **The index, not dots.** `:123` and the `p-3 -m-3` tap-target trick. | Numbered reports are this brand's register and a dot carries no information. Item 3 keeps the control and fixes its arithmetic; it does not replace it with dots. |
| **The 44px forest initials disc.** `:99–101`. | `--paper` on `--forest` measures **9.4:1**. It is also the only honest avatar available — `avatar_url` is fetched but 100% of real rows will have it null until profiles get pictures. |
| **`revalidate = 60` on the page** and the public (anon) Supabase client in `getFeaturedReviews`. | An approved review is public by definition; the cookie client was making every page that shows one uncacheable. Items 10 and 11 add queries to the same client, inside the same 60s window. |

---

## 3. The action plan

Table and specs share the same numbering. **Items 1, 2 and 3 alone change what the band looks like from across the room** — a new ground, a new opening line, and nothing moving.

| # | Action | What | Why | Effort | Priority |
|---|---|---|---|---|---|
| 1 | update | Open with a statement; the clock signs off at the foot | Ninth consecutive section opening in the identical species; the one band whose content licenses a different opening | 45m | **P1** |
| 2 | update | Take the golden hour — ground to `--paper-deep`, with its two forced dependencies | 18:30 is the last daylight band and it sits on the *afternoon* token, one step brighter than the section below its own clock | 30m | **P1** |
| 3 | remove | The 7-second timer, and `opacity` from both entries | Two hard constraints broken at once: content ships `opacity:0` in the server HTML, and a `setInterval` that never resolves | 2h | **P1** |
| 4 | update | The photograph stops carrying type — a `--forest-deep` foot plate with the piece and its price | Every word on the panel is at the mercy of whatever the merchant uploads; measured **2.64:1** over a light pack shot | 2h | **P1** |
| 5 | update | Rebuild the author line: who, verified, what, when | The rating is printed twice 100px apart; the date is never printed at all | 1.5h | **P1** |
| 6 | remove | The measure, the caption, the dead clip, and the promise that lies | 1280px is the only band at its width on the page; a 240px caption hidden from every phone; a link whose copy names an account it does not reach | 45m | P2 |
| 7 | update | Small type: contrast, and words out of Space Mono | Four measured failures, all on the commerce signals; mono sets a garment name and the word "reports" | 1h | P2 |
| 8 | update | Retire the synthesised oblique; budget the measure at both ends | 2000 characters of running text in a browser-sheared roman, in a box with no floor and no ceiling | 1h | P2 |
| 9 | add | **Ask for the report** — a form on the PDP and a delivered-state mail | The only item that decides whether items 1–8 are ever seen by anyone | 2 days | P2† |
| 10 | add | One honest number, and it belongs to the store | The most prominent figure in the frame presents a sample of one as a store metric | 2h | P3‡ |
| 11 | add | Curate the reports, and cap at six | Newest-first with no floor: the best testimonial the shop ever gets is pushed off by time alone | 4h | P3 |

† Item 9 is three files **outside this section** and needs its own scope approval — §6, Q1. It should be the first thing raised with the client, not the last.
‡ Item 10 cannot be judged as built until item 9 exists; below five approved reviews it renders its own fallback.

---

### The specs

**1 — Open with a statement; the clock signs off at the foot.**
Delete the eyebrow `div` at `:63` and the entire `hidden md:block` paragraph at `:68–70`. Replace the whole header block (`:61–71`) with a single heading, no flex row:

```
<h2 id="reports-heading"
    className="mb-14 md:mb-20 font-display font-light text-[clamp(34px,6vw,68px)]
               leading-[1.02] max-w-[20ch] text-balance text-text">
  Nobody here was paid to say this.
</h2>
```

Give the `<section>` `id="reports"` and `aria-labelledby="reports-heading"` — it has neither today, so it contributes an `<h2>` to the outline with no accessible name of its own.

This is opening species 2 (a display statement alone at ~2x scale). `TheClimb` directly above opens species 1 — mono eyebrow at `text-[10px] tracking-[0.2em] text-forest` over a `clamp(32px,5vw,54px)` Fraunces `font-light` h2 (`TheClimb.tsx:157–159`) — which is character-for-character what this section does today. LAW 5 is satisfied by voice, not by rearranging furniture.

Set: 32 characters of Fraunces 300 run ≈15.4em, against a 20ch cap ≈10em, so the line breaks once — **"Nobody here was paid" / "to say this."** at 1440 (68px, 653px line 1 in a 680px cap) and again at 390 (34px floor, 326px line 1 in a 342px content box). **At 320px the content box is 272px and it sets three lines** — acceptable, but look at it; if three lines reads badly, drop the floor to 30px rather than touching `px-6`.

The clock is not lost, it moves to the close. Rebuild the footer row (`:203–212`) as:

```
<div className="mt-16 flex items-center justify-between gap-6 border-t border-rule-warm pt-8">
  <div className="text-[11px] tracking-[0.2em] uppercase text-forest">
    <span className="font-mono">{stop.time}</span><span className="font-body"> · {stop.label}</span>
  </div>
  {/* the Instagram line, reworded — item 6 */}
</div>
```

`border-rule-warm` is `--rule-warm #D2C4A4`, the token `globals.css:69` was created for exactly this ("rules that sit on paper-warm / paper-deep") and which this file has never referenced; `border-rule` `#DDD7C6` measures **1.19:1** on paper-warm and **1.03:1** on the paper-deep item 2 moves to — i.e. it is not a hairline, it is nothing. Splitting the time into `font-mono` and the label into `font-body` is LAW 3 read correctly: the figure measures, the noun does not.
`TrailSpine` reads the **wrapper's** `data-trail-*` attributes at `app/page.tsx:144`, not this element, so moving the printed stop does not touch the HUD. Delete the now-unused `stopEyebrow` import at `:3`; keep the `stop` prop and narrow the import to `type TrailStop` plus nothing else. Also delete the stale doc comment at `:27–30` — it warns of a `16:30`/`18:30` drift that `lib/trail.ts:78` fixed, and the file it warns about now prints `18:30 · The way down`, matching the wrapper exactly.

**2 — Take the golden hour.**
`:59` `bg-paper-warm` → `bg-paper-deep`. Two dependent edits are **forced by the change and must land in the same commit**:

- `:159` the panel's fallback fill `bg-paper-deep` → `bg-forest-deep`. It is currently the exact token the ground is moving to; left alone, a product with no photo becomes an invisible rectangle. Radius only, no shadow — LAW 2, and see item 4.
- every `border-rule` in the file → `border-rule-warm`, per item 1.

Measured on `--paper-deep #E7D9BE` (Y = 0.7034, L\* 87.2): `--text` **13.14:1**, `--forest` **7.39:1**, `--mid` **5.79:1**, `--rule-warm` **1.24:1** as a hairline. All surviving text passes AA. Ground edges: above, `--paper #F8F5ED` → `--paper-deep` is **1.28:1 / 9.4 L\*** (today `--paper` → `--paper-warm` is 1.11:1 / 4.1 L\*); below, `--paper-deep` → `--forest-deep #16290F` is **11.08:1**. LAW 1 improves on both edges and no other section moves.
`--paper-deep` is commented "golden hour" at `globals.css:33` and is used as a **ground by no section on the homepage** — the ladder was built with three steps and is being run with two. This band's own stop is 18:30, the last light before `BrandPulse` goes to night at 19:30, and it currently sits one step *brighter* than the clock allows while `TheClimb` at 17:50 sits on the brightest ground on the page. The clock descends; the light does not. This fixes that for the cost of one class.
**`--dawn` stays absent from this section.** It is "first light — the ONE warm accent, used where the light arrives and nowhere else". 18:30 is the light leaving. See §5.
Note honestly: light bands now step 96.6 → 92.5 → 96.6 → 87.2 L\* down the page, which is irregular — but monotonic in the only place it matters, the last three sections. That is the correct trade.

**3 — Nothing moves until someone touches it.**
Delete `ROTATE_INTERVAL` (`:11`), the `useEffect` (`:37–41`), the `paused` state (`:33`) and both mouse handlers (`:75–76`). The `01 02 03 …` index becomes the sole driver.

Strip `opacity` from both entries; both become transform-only, both inside the 140–260ms micro-motion band:

```
blockquote: initial={{ y: 14 }}  animate={{ y: 0 }}  exit={{ y: -10 }}   duration 0.22
image:      initial={{ scale: 1.03 }} animate={{ scale: 1 }} exit={{ scale: 1 }} duration 0.26
                                                              ease [0.22, 1, 0.36, 1] on both
```

The server HTML then ships `transform:translateY(14px)` and `transform:scale(1.03)` — fully legible, fully visible, 14px out of place. That is hard constraint 2 satisfied at the only point it can be satisfied, which is the markup.
Add reduced motion, which the **entire web app currently lacks** (`useReducedMotion` appears only in `mobile/app/(tabs)/index.tsx`; there is no `MotionConfig` anywhere): `const reduce = useReducedMotion()` from `motion/react`, and `transition={{ duration: reduce ? 0 : 0.22, ease: [0.22,1,0.36,1] }}`. It returns `null` on the server, so nothing about the first paint may depend on it — and after this item nothing does, because there is no opacity left to gate.

Fix the pagination row, which **overflows and is clipped today**. Measured at 390px: content box 342px; each button's outer width is `15.4px` (two Space Mono glyphs at 11px = 13.2px plus 0.1em tracking) — the `p-3` padding is exactly cancelled by `-m-3`, so it contributes nothing to layout — plus nine `gap-5` gaps at 20px = 180px, plus "08 reports" at ~66px, with the `flex-1` divider collapsing to 0 under overflow. **Min-content ≈ 369px against 342px available**, and the section carries `overflow-hidden`, so ~27px is cut off the right end: the counter loses its last four characters. At **320px** (272px box) the overrun is ~97px — the counter goes entirely and report **08's numeral is clipped in half**.
*Correction to the recon, on the record:* the reported ~566px min-content assumed the `p-3` padding counted twice; the negative margin cancels it. The bug is real, it is smaller than filed, and it lands on the counter and the last index rather than on reports 06–08.
The fix, in three parts: (a) row becomes `mt-10 flex flex-wrap items-center gap-x-6 gap-y-3` — at `gap-x-6` (24px) adjacent 39.4px padding boxes are separated by exactly 0px instead of **overlapping by 4px**, which is what `gap-5` does today, meaning two adjacent numbers currently share hit area; (b) the counter gets `basis-full lg:basis-auto lg:ml-auto` so it drops to its own line on a phone instead of being clipped; (c) cap the query at **six**, `getFeaturedReviews(6)` at `app/page.tsx:53` — six numbers at 15.4px plus five 24px gaps = 212px, which fits the 272px box at 320px on one line with room, and six is more reports than anyone reads. (Item 11 makes the cap a considered default rather than a magic number.)
Accessibility, in the same pass: wrap the report column in `<div aria-live="polite">`; add `aria-current={i === active ? 'true' : undefined}` to each button; change the grid from `items-center` to `items-start` so a 40-word report following a 200-word one no longer floats the picture; give the report column `min-h-[clamp(360px,42vw,560px)]`.
**Its own honest risk:** most visitors will now read only report 01. That is an argument for item 11 (choosing what sits at 01), not for restoring the timer. It also means the index must look unmistakably like a control — keep the active `border-forest` underline, and raise inactive numerals from `--light` (2.28:1 on the new ground) to `--mid` (**5.79:1**) per item 7.

**4 — The photograph stops carrying type.**
Delete the badge block (`:184–189`) and the unconditional gradient (`:182`) entirely. Inside the existing `rounded-[var(--r-card)] overflow-hidden` panel, add one solid plate:

```
<Link href={`/products/${report.product.slug}`}
      className="group absolute inset-x-0 bottom-0 flex items-end justify-between gap-3
                 bg-forest-deep px-4 py-3">
  <div>
    <div className="font-body text-[13px] leading-snug text-paper">{report.product.name}</div>
    <div className="mt-1 font-mono text-[12px] tabular-nums text-paper/70">
      {formatPrice(report.product.price)}
    </div>
  </div>
  <span className="font-body text-[10px] tracking-[0.14em] uppercase text-paper/80
                   transition-colors duration-200 group-hover:text-paper">Shop this piece →</span>
</Link>
```

Rendered **only when `report.product` exists**; with no product the panel is a plain `--forest-deep` rectangle and nothing is captioned. The plate is ~60px tall (12 + 17.9 + 4 + 14 + 12).
Measured on `--forest-deep`: `--paper` **14.17:1**, `paper/80` **9.51:1**, `paper/70` **7.68:1** — *identical on every photograph the merchant will ever upload*. Today's numbers depend on the upload: the bottom-left link at `text-paper/80` over a `from-ink/50` wash that has decayed to ≈ink/0.44 at 16px above the foot measures **2.64:1** on a `#E8E8E8` pack shot and 9.86:1 on a dark one — a 4× swing driven by data, on a store that prints to order and will mostly receive white-backdrop shots. The 8px caption over `bg-ink/70` on the same photo measures **3.83:1**.
Deletes the duplicated figure (item 5 removes its twin) and gives the section a real route to purchase: today the *only* buy-path is a 10px uppercase whisper in the corner of a moving photograph.
Data: extend the join at `actions/reviews.ts:95` to `product:products(name, slug, images, price)` and add `price: number` to `FeaturedReview['product']` at `:106–109`. **`formatPrice` takes integer paise** (`lib/utils.ts:12`) — passing rupees prints 100×.
While in the panel, fix two more things: delete `max-h-[520px]` at `:159` so the declared `aspect-[4/5]` is the crop that actually renders (at `max-w-6xl`, lg, the column is `(1152 − 64) × 0.85/1.85` ≈ **500px**, so the panel is 500 × 625 instead of today's 559 × 520 ≈ 1.075:1 — `object-cover` currently cuts the same shot into two different pictures at two breakpoints); and set `sizes="(max-width: 1024px) 100vw, 500px"` at `:174`, replacing `45vw`, which declares 648px at a 1440 viewport for a box that is half that.
LAW 2: the plate is a filled surface inside a radiused card. **Do not give it a top hairline and do not give the panel a shadow.**

**5 — Rebuild the author line: who, verified, what, when.**
Replace `:98–119`. Keep the 44px forest initials disc unchanged. Under it, three plain facts:

```
line 1  <div className="font-body text-[15px] font-medium text-text">{authorName}</div>
line 2  {report.is_verified && (
          <span className="font-body text-[12px] tracking-[0.08em] uppercase text-forest">
            Verified purchase</span>)}
line 3  <div className="mt-1 font-body text-[12px] text-mid">
          Bought the {report.product.name} · <span className="font-mono">{monthYear}</span></div>
```

Line 3 prints only the date when `report.product` is null. **DELETE the star string at `:113–117` entirely** — the rating survives once, in the panel; printing it twice 100px apart in two different voices is the section arguing with itself.
`monthYear` must be computed **deterministically** — this is a `'use client'` component inside a server-rendered page, and `toLocaleDateString` is a hydration mismatch waiting to happen (the server's ICU locale is not the browser's):

```
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const [y, m] = report.created_at.slice(0, 7).split('-')
const monthYear = `${MONTHS[+m - 1]} ${y}`
```

`created_at` is already fetched (`select('*')`) and rendered nowhere. An undated testimonial is the weakest form of one: nothing on this band tells a first-time visitor whether the report is from last month or 2023, which is precisely the doubt the section exists to answer.
Semantics, same pass: wrap the pair as `<figure><blockquote>…</blockquote><figcaption>…</figcaption></figure>` — the author is currently *inside* the `<blockquote>`, which says the customer quoted their own name. `motion`'s `key={report.id}` moves to the `figure`. Upgrade the index buttons' label from `Read report 1` to `aria-label={\`Report ${i+1} of ${count} — ${authorName} on ${productName}\`}`.
Also delete the unreachable `|| 'DZ'` at `:53`: `authorName` is guaranteed non-empty by the `|| 'DEWDROPZ customer'` fallback at `:46`, so the initials join always yields at least `DC`.

**6 — Subtract: the measure, the caption, the dead clip, the promise.**
(a) `:60` `max-w-7xl` → `max-w-6xl`. 1280px makes this the widest band on the homepage and the only one at its width, between `TheClimb` at 1152 above (`TheClimb.tsx:155`) and `BrandPulse` at 768/1024 below — a 128px step out for one band and a 256–512px step back in. LAW 4. It is also what makes item 4's `sizes` fix land at 500px.
(b) The `hidden md:block` caption at `:68–70` is deleted by item 1. Recorded here as a subtraction in its own right: it is a 240px right-aligned 14px paragraph sitting ~700px from the heading it modifies at 1280px, and it is `hidden` below 768px — invisible to most of this store's visitors. Its sentence ("Every word here was written by someone who bought the piece and used it") is what "Verified purchase" now says on every breakpoint.
(c) `:59` drop `overflow-hidden`. After item 3 the largest transform inside is 14px of `y` inside 96–128px of section padding; the image panel has its own clip. Today it does one thing only, which is hide the pagination overflow instead of letting anyone see it.
(d) The Instagram line at `:205–211`. `SITE.instagram` is `'https://instagram.com'` — Instagram's logged-out front page, not an account — and there is no UGC pipeline in the repo that could feature a tagged post. Copy becomes **`Follow along on Instagram →`**, and the anchor gains `target="_blank" rel="noopener noreferrer"`. Drop the "Spotted on the Trail" eyebrow at `:204` — its slot is the clock (item 1), and it is a `font-body` 10px/0.2em uppercase eyebrow that disagrees on face with the `font-mono` one 140 lines above it at identical size, tracking, case and colour. Whether the line survives at all is **Q4**; the promise to feature people does not survive either way.

**7 — Small type: contrast, and words out of Space Mono.**
Every value below is measured on `--paper-deep` (item 2's ground) unless stated.

| Where | Today | Becomes |
|---|---|---|
| `:107–111` verified badge | `text-sage` 9px — **2.35:1** on paper-warm, **2.04:1** on paper-deep | handled by item 5: `text-forest` at 12px — **7.39:1**. Drop the `✓` glyph; a screen reader announces it as "check mark" and the word carries the meaning |
| `:140` inactive index | `text-light` — **2.28:1** | `text-mid` — **5.79:1**; hover `hover:text-text` |
| `:148–150` counter | `text-light`, and mono sets the word "reports" | `text-mid`, split: `<span className="font-mono">{count}</span><span className="font-body"> reports</span>` |
| `:186` `RATED OUT OF 5` at 8px | **4.03:1** composited | deleted by item 4 |
| `:116` `· on the {name}` | `font-mono`, sets a garment name | deleted by item 5; the name moves to `font-body` line 3 |
| `:194` `{name} →` | `font-mono`, entirely words | deleted by item 4; `font-body` on the plate |

Nothing in the section sets below **10px** afterwards, and Space Mono is left carrying exactly three things: the clock time, the price, and the index numerals — a time, a figure, a count. That is LAW 3 as written.
The size ladder collapses from nine steps (48/30/14/13/11/10/9/8 plus the quote's clamp, four of them inside a 3px range where nothing is separable by rank) to **five**: the display statement, the review body, 15px Archivo medium for the name, 12px Archivo for everything secondary, 12px Space Mono `tabular-nums` for figures.

**8 — Retire the synthesised oblique, and budget the measure at both ends.**
`app/layout.tsx:49–54` declares Fraunces with `axes:['opsz']` and deliberately **no** `style`, and `globals.css:484–486` says so in words: `font-style: italic` on Fraunces here is a browser-**synthesised** oblique, a mechanical shear of the roman — no true single-storey a, no drawn g, left-leaning diagonals thinned by the skew. The hero earns its synthetic oblique because a choreographed turn cancels it exactly; this is up to 2000 characters of running text at 30px with no such reason, and `HOMEPAGE-COUNCIL.md:139` records loading Fraunces Italic as **blocked**.
`:94` becomes:

```
className="font-display text-[clamp(21px,2.4vw,28px)] leading-[1.45] text-text
           max-w-[46ch] text-pretty [text-indent:-0.42em]"
```

`italic` and `font-light` both go. `max-w-[46ch]` is the first measure this quote has ever had. The negative text-indent hangs the opening `&ldquo;` in the margin instead of letting it push line one right.
Guard the empty-string hole the query leaves open — `.not('content','is',null)` excludes NULL but **not `''`**, and such a row renders today as a lone `""` at 30px Fraunces. At the top of the component, before `count`:

```
const reports = reviews.filter((r) => r.content?.trim())
const count = reports.length
```

and read `reports` everywhere `reviews` is read. `if (count === 0) return null` then covers the all-blank case too. (Item 11 closes the same hole in SQL; this guard stays regardless, because the component must not depend on the query being fixed.)
Combined with item 3's `min-h-[clamp(360px,42vw,560px)]` and `items-start`, a twelve-word report and a four-hundred-word one occupy boxes with the same floor and the index no longer travels hundreds of pixels under the pointer between reports. **No `line-clamp`** — see §5.

**9 — Ask for the report.** *Three pieces, none of them in this component. Scope approval required — Q1.*
1. **A form on the PDP.** `app/products/[slug]/page.tsx` gets a reviews block below the story: `getProductReviews(product.id)` for the approved list, and a form posting to the existing `createReview` server action. The action already exists, is validated by `reviewSchema` (`lib/validations.ts:156–161`), requires a session, and already computes `is_verified` by joining `order_items` against the user's `delivered`/`shipped` orders (`actions/reviews.ts:26–48`). Ground it `bg-paper-warm` to keep the PDP's own ladder.
2. **Rate-limit it first.** `createReview` has **no** `rateLimit` call, while `subscribeToNewsletter` twelve lines below it does (`actions/reviews.ts:135`). A public form in front of an unlimited insert is a moderation queue full of spam by Tuesday. Match the newsletter's shape.
3. **A delivered-state mail** in `lib/orderEmails.ts`, which today has no review ask at all. Subject: **"How did it hold up?"** Body: *"You picked up the {product} a couple of weeks ago. If it has been somewhere worth mentioning, tell us in a line or two — it goes on the site with your name on it."* Link to `/products/{slug}#reports`.
**Seed nothing.** The null render stays, and the comment at `:13–21` explaining why four fabricated customers were deleted stays with it.

**10 — One honest number, and it belongs to the store.**
Add beside `getFeaturedReviews`, on the same public client:

```
export async function getStoreRating() {
  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase.from('reviews').select('rating')
    .eq('is_approved', true).not('content', 'is', null)
  if (error || !data?.length) return { average: 0, count: 0 }
  const total = data.reduce((s, r) => s + r.rating, 0)
  return { average: Math.round((total / data.length) * 10) / 10, count: data.length }
}
```

Call it in the `Promise.all` at `app/page.tsx:42–54` and pass to `Community`. Render it in the space item 1 frees to the right of the heading, at `md:` and up only:

```
<div className="text-right">
  <div className="font-mono text-[clamp(28px,3vw,40px)] leading-none tabular-nums text-forest">
    {average.toFixed(1)}</div>
  <div className="mt-2 font-body text-[10px] tracking-[0.2em] uppercase text-mid">
    Average of <span className="font-mono">{count}</span> reports</div>
</div>
```

`--forest` on `--paper-deep` **7.39:1**, `--mid` **5.79:1**. Render **only when `count >= 5`**; below that an average is noise and the block is simply absent (the heading then has the band to itself, which is item 1's default state).
This replaces the fabricated precision on the photograph: `{report.rating}.0` over "RATED OUT OF 5" is one stranger's integer score dressed with a decimal, presented at the largest figure size in the frame as though it were a store metric. `getProductRating` already exists at `actions/reviews.ts:111–124` but is per-product and has no web caller.
One extra query on a page that revalidates every 60s. If the store ever approves a 2-star review the public average drops — correct, and a reason for item 11.

**11 — Curate the reports, and cap at six.**
Add to `HomeConfig` (`types/database.ts:658–685`), following the `trails?` optional-key pattern at `:681–684` so settings rows written before the migration fall back:

```
community?: { enabled: boolean; review_ids: string[]; min_rating: number }
```

`review_ids: []` means "show all", the same convention `featured_collection_slugs` documents at `:674`. In `getFeaturedReviews(limit = 6)`: add `.gte('rating', minRating ?? 4)`, add `.neq('content', '')` to close the empty-string hole in SQL, and when `review_ids` is non-empty use `.in('id', review_ids)` and re-sort in JS to the admin's order, **filtering missing ids silently** — exactly as `TheClimb.tsx:150–151` filters missing products. Surface it in `app/admin/homepage/HomepageEngine.tsx` as a picker over approved reviews, mirroring the `stations` editor, and add a "Feature on homepage" action beside Approve in `app/admin/reviews/ReviewsClient.tsx`.
The cap of six is the one part of this item that is free and visible, and item 3 already takes it: six index numerals fit a 320px screen on one line.

---

## 4. Removals, argued

**The 7-second timer (item 3).** A `setInterval` that runs forever, off-screen included, never resolves, and has no `prefers-reduced-motion` guard, on a page whose council record contains two client rejections of ambient motion in the exact words "it is not looking good" and "reads as a screensaver". It also pauses on `mouseenter` only — a keyboard visitor tabbing the `01…08` buttons has the quote swapped out from under them, with no `aria-live` to announce it. Nothing is lost: the index it hides behind is a better control than the timer, and it stays.

**`opacity` on both entries (item 3).** Not a preference. `motion` writes `initial` as an inline style during SSR, so the two blocks that *are* this section leave the server invisible and depend on hydration to appear. A transform leaves the words where a fade leaves a hole.

**The floating rating badge and the unconditional gradient (item 4).** The badge prints a single stranger's integer score with a fabricated `.0` at the largest figure size in the frame, over "RATED OUT OF 5" at 8px — the smallest type in the section — at 4.03:1. The gradient is drawn whether or not there is a photograph under it, so a product with no image gets a black wash poured over a bare panel with a rating stamped on nothing. Both are replaced by a plate whose contrast does not depend on what a merchant uploads, and by a real number in item 10.

**The second copy of the rating (item 5).** `★★★★★` beside the author and `4.0 / Rated out of 5` on the photograph are the same figure, 100px apart, in two voices, one of which fails contrast on its unfilled half. One survives.

**The 240px caption (items 1, 6).** Right-aligned, 14px, capped at 240px, sitting roughly 700px from the heading it modifies at 1280px, and `hidden` below 768px — which is to say absent for most visitors to an Indian storefront. What it says, "Verified purchase" now says on every breakpoint, in the place where the claim is actually being made.

**`overflow-hidden` (item 6).** Its only measurable effect is to clip the pagination row's 27px overrun at 390px and its 97px overrun at 320px, turning a visible layout bug into an invisible one.

**"Tag @dewdropz.shop to be featured →" (item 6).** The last words of the last daylight band invite a visitor to do something no code in this repository can honour, name an account the link does not reach, and send them off-site in the same tab with no `rel` at the moment they are closest to buying. The invitation can survive; the promise cannot.

**The stale doc comment at `:27–30`, and `|| 'DZ'` at `:53` (items 1, 5).** A comment describing a bug `lib/trail.ts` already fixed, and an unreachable fallback. Both are small; both are how a file starts lying about itself.

---

## 5. Killed in judging — on the record

- **`--dawn` (or `--dawn-soft`, or `--ember`) on the rating figure** — fatal on the palette law: `--dawn` is "first light — the ONE warm accent, used where the light arrives and nowhere else". This section is 18:30, the way down. Spending the page's single warm accent at dusk breaks the rule that makes it mean anything. The contrast work in that proposal was real; the answer is that the figure is `--paper` on the plate, like everything else on it.
- **"Bought from us? Write your report" as a link on this band** — it would point at a page that cannot take a report: `createReview` has no caller in the web app. It replaces a link that lies with a link that lies. Revive it *after* item 9 ships, not before.
- **The wall — every report at once, as a static server component** — correctly diagnoses that the theatre costs seven of eight voices, and going back to a server component is the cleanest kill for the SSR-opacity bug. But the realistic state of this table is one to three approved rows, where the wall is a lone 38px quote over an empty three-column grid; and a three-column testimonial grid is the most template-shaped layout on the web, on a client who rejects the merely tasteful. Item 3 takes its constraint fixes without its layout.
- **Deleting the 4:5 panel in favour of a 64px product chit per report** — leaves a type-only cream band between two image-led sections, and on a one-review section it deletes the picture and adds nothing.
- **A glassy `bg-ink/70 backdrop-blur-sm` product bar** — same job as item 4, worse: the stock glass product card, the most expensive thing on the page to repaint on a mid-range Android, over a photograph that is already scrimmed. Item 4 took its price, its `sizes` fix and its full-panel link, and gave them a solid `--forest-deep` surface instead.
- **A filled forest chip reading "Verified purchase"** — 9.48:1, and the single most recognisable e-commerce badge on the internet, dragging an aged Dehradun brand toward a marketplace. The word in `--forest` clears 7.39:1 with no chip.
- **`clay-deep` for the unfilled stars** — moot; item 5 deletes the star row. Recorded because it introduced a fourth hue into a four-line block for no gain.
- **A hardcoded section number ("10") in a species-3 opener** — becomes a lie the moment `ShowcaseRails` is plugged back in above it (`app/page.tsx:138`, currently `{false && …}`).
- **A top hairline carrying `18:30` at one end and `3,400M` at the other** — a genuinely good instrument, and it is what `TrailSpine` already prints, vertically, at `xl` in its restored original form. Above 1280px the visitor would read the same pair twice inside one viewport. Revisit if and when the client rules on `TrailSpine` (Q5).
- **`line-clamp-[8]` on the review body** — a testimonial truncated mid-sentence with no "read more" looks cheap, and item 8's `min-h` floor plus `items-start` already stops the layout jumping. The long-report case is a content problem for item 11's curation, not a CSS one.
- **Deleting the footer row outright** — amputation where a constant fix would do, and it removes the only invitation on the page from a section named Community. Item 6 rewords it instead; §6 Q4 puts the deletion to the client as the fallback.
- **A large "4.8" average rating in the header, ungated** — survives only as item 10, at `count >= 5`, because an average of two is noise and a homepage that prints one is worse than a homepage that prints none.

---

## 6. Open questions for the client

1. **Item 9 — scope.** Nobody can write a review on this website. Building the ask means a form on the product page, a rate limit, and one new transactional email — three files outside this section, plus a moderation load on the admin. Approve? **Without it, items 1–8 improve a band that renders `null` in production.**
2. **The opening line.** "Nobody here was paid to say this." is a stronger voice than anything currently on the band. If it reads as defensive, the drop-in alternate is **"We did not write a word of this."** Both are two lines at every width above 360px. Which?
3. **The price on the plate (item 4).** Putting a price under a testimonial makes the band read a little more like a product card and a little less like a report. It is also the only route from proof to purchase on the page. Price, or just the name and "Shop this piece →"?
4. **The Instagram line.** Three options, in order of honesty: (a) give me the real handle and it becomes "Follow along on Instagram →" pointed at it; (b) keep it pointed at `instagram.com` with the promise removed; (c) delete the line and let the band end on the clock. The "to be featured" promise cannot survive any of them until something in the repo can feature a post.
5. **`TrailSpine`.** Recorded as rejected twice at `HOMEPAGE-COUNCIL.md:137`, and restored to `app/page.tsx:73` by the revert. It is the reason the top-hairline opener was killed. Still going, or still rejected?
6. **Low scores.** Item 11 defaults `min_rating` to 4. Should an approved 3-star review be allowed onto the homepage — it is more believable, and it lowers the public average in item 10 — or does the homepage show 4-and-up only?
7. **Six reports, or eight?** Six fits a 320px screen on one line and is more than most visitors read. Eight is the current cap and overflows.

**What I could not specify exactly:** the report column's `min-h-[clamp(360px,42vw,560px)]` is a starting value that needs eyes beside a 625px panel at 1152 and at 1440 — too tall and it opens dead space under a short report, too short and the index still travels; the `[text-indent:-0.42em]` hang for the opening quote is measured off Fraunces' comma advance and must be checked optically at 21px and at 28px, since the clamp changes the optical size axis under it; and whether the clock at the foot needs a `mt-16` or a `mt-20` above the rule depends on how much air the new ground wants, which is a browser decision.

---

## 7. How we will know it worked

**Widths, every time.** 320, 360, 390, 768, 1023, 1024 (the grid flip), 1152 (the measure cap), 1440, 2560. At every one of them: the page body never scrolls horizontally; **the pagination row is fully visible with no clipping** — including the counter, which is the thing being cut today; every tap target on the index is at least 24px and no two overlap (they overlap by 4px today at `gap-5`); the heading sets two lines from 360 up.

**Degraded states, every time.**
(a) **JavaScript off** — the first report's words, its author, the product name and its price must all be readable. This is the pass/fail on item 3: view source and confirm no `opacity:0` appears on any element in the section.
(b) **`prefers-reduced-motion: reduce`** — a complete, still, legible band; the index still works; no transition runs.
(c) **Hydration stalled** (throttle to Slow 3G and read the page before the JS lands) — same test as (a), from the other direction.
(d) **`count === 0`** — the section and its `data-trail-*` wrapper are both absent, and `TrailSpine`'s HUD has no 18:30 chapter. Nothing renders half.
(e) **`count === 1`** — no index row at all, no counter, and the band still reads as finished.
(f) **A review whose `content` is `''`** — insert one and confirm it is filtered out by item 8's guard, not rendered as a lone pair of curly quotes.
(g) **A review whose `product` is null** (delete a product that has an approved review) — the panel is a plain `--forest-deep` rectangle, no plate, no gradient, no rating; the author line prints the date alone; nothing throws.
(h) **A review whose product has no image** — same panel, and it must be *visible* against `--paper-deep`, which is the whole reason item 2's fallback moves to `--forest-deep`.
(i) **`is_verified === false`** — the line is simply absent, not an empty span with margin.

**Measurements, before and after.** All sampled from the live render, not computed from tokens:
- `Verified purchase`: **2.35:1 → 7.39:1**.
- Inactive index numerals and the counter: **2.63:1 (2.28:1 on the new ground) → 5.79:1**.
- The product link on the panel, over a **deliberately white** pack shot uploaded for the test: **2.64:1 → 9.51:1**, and the same number over a deliberately black one.
- Ground step above the section: **1.11:1 / 4.1 L\* → 1.28:1 / 9.4 L\***.
- Pagination row min-content at 390px: **369px in a 342px box → fits**, and at 320px: **369px in a 272px box → fits on one line at six reports**.
- Rendered panel aspect at 1440: **1.075:1 → 0.80:1** (the declared 4:5), and the `sizes` request falls from 648px to 500px.

**Interaction passes.** Tab from the section heading through every index button, the plate link and the footer link with a visible focus ring at each stop; press each index number with a screen reader running and confirm the new report is announced once by the `aria-live` region and that `aria-current` moves; confirm the quote does **not** change on its own after 30 seconds of sitting still; confirm the picture does not shift vertically when moving from the longest report to the shortest.

**Housekeeping.** Two notes from experience: `px-[--token]` compiles to nothing in this repo's Tailwind v4 — write `var(--token)` inside the bracket; and the browser pane must be visible or screenshots come back blank and `innerWidth` reads 0, which makes a correct responsive layout look broken.
