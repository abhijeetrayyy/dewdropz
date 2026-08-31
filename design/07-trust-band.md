# Trust strip — Action Plan

*Section 7 of the homepage. Written against `components/sections/TrustBand.tsx` (51 lines), `lib/constants.ts`, `lib/trail.ts`, `app/page.tsx`, `app/globals.css`, `actions/settings.ts`, `actions/shipping.ts`, and the two neighbours `components/sections/HomeTrails.tsx` and `components/sections/SeasonKit.tsx`, on branch `mobile-remediation`. Every line number and every contrast ratio below was verified against the working tree — the ratios were computed from the token hexes in `app/globals.css`, not quoted from a comment. Where I could not specify a value exactly, it is in §6, not hidden behind an adjective.*

---

## 1. The verdict

This is the only bright band in roughly 1,400 pixels of dark page, and it is built as a seam rather than a section. Three facts carry the diagnosis. **It is too thin to be seen as a thing:** it computes to ≈99px at `md` — 3px of bar, 56px of padding, ~40px of type — while `HomeTrails` above spends 128px per side on padding alone and `SeasonKit` below spends 96px. Those two neighbours are `--forest-deep` `#16290F` and `--altitude` `#142536`, which measure **1.01:1** against each other: they are the same value in two hues, so they read as one dark slab with a cream scanline scratched through it. **It breaks the two laws it touches:** Space Mono carries four common nouns (Payment, Shipping, Returns, Tested) while every actual figure on the band — ₹2,000, 7 days, 5,200 m — is set in Archivo, an exact inversion of Law 3; and it runs `max-w-6xl` (1152) between two sections that both run `max-w-7xl` (1280), so at 1440px the word "Payment" starts 208px from the left edge while both neighbours start their content at 120px, and this band is made of nothing *but* vertical rules, so the misalignment is maximally visible. **And it is lying:** `free_shipping_threshold` is a live store setting that already drives the cart, the PDP and checkout, and this band prints "Free over ₹2,000" as a string literal — a bug whose post-mortem is already a comment in this repo at `components/sections/ProductDetail.tsx:49–52`.

The fix is not to tidy the strip. It is to make it **a ledger: four measured figures, in Space Mono, at 22–30px, on a golden-hour ground, at the one point on the page where the reader is deciding.** Give the section the day's light instead of a decorative bar of it — `--paper-deep` is the ladder step the token file literally comments *golden hour*, it is unused as a ground anywhere on this page, and this band's stop is 16:20, directly after 15:30 · Golden hour. Put the four numbers in the face reserved for numbers, put the sentences in the face that explains, take the free-shipping figure from the setting an admin can move, and give the band enough height that it stops reading as the gap between two dark sections. Everything below is that idea, itemised.

---

## 2. What stays — do not touch

| | Why it is right |
|---|---|
| **Exactly four facts, always.** No `length` guard, no empty state, no admin control. | This is the right call for a reason the file does not state: an empty return would butt `--forest-deep` straight against `--altitude` at **1.01:1** and break Law 1 outright. This band must never be allowed to vanish. Do not make it data-driven and do not add a `return null`. |
| **Server component, zero JavaScript, copy in the server HTML.** No `'use client'`, no transition, no animation. | Hard constraints 1, 2, 3 and 4 are all satisfied today and every item below preserves that. This section is the page's proof that a band can be felt without a frame of motion. |
| **Row species, no card.** Hairline only — no radius, no shadow, no background panel. | Law 2 is correctly obeyed: enclosure carries the species and this is a row. Items 2 and 3 change the hairline's colour and where it is drawn, never its species. |
| **The band is bright and its neighbours are dark.** `paper-warm` measures 12.79:1 against `forest-deep` and 12.89:1 against `altitude`. | Law 1 is satisfied emphatically. Item 3 moves the ground *down* the ladder to `--paper-deep`, which still measures **11.09:1** and **11.18:1** — the separation survives with room to spare. |
| **`aria-hidden` on the decorative bar, and the decision to keep the section free of links.** | `/shipping` and `/returns` do not exist as routes, and `SeasonKit`'s "Add the full kit" — the page's only add-to-cart — sits roughly 100px below. A second call to action here would compete with it. Proposal 18 was killed for this (§5). |
| **`app/globals.css:882` is correct. Do not "fix" it.** | Recon filed the comment's "`--ember` on `--amber-wash` is 5.21:1" as a wrong measurement that had licensed unsafe use of ember. It is not wrong. That comment sits inside the **`.trek-scope` block**, where `--ember` is redefined to `#8A5A17` (`globals.css:325`) — and `#8A5A17` on `#F7F0E2` is exactly **5.21:1**, computed. The storefront's `--ember` `#C2662A` on the same ground is 3.54:1. Two different tokens with one name; both comments are true in their own scope. The storefront ember problem in item 1 is real, but this is not its cause. |

---

## 3. The action plan

Table and specs share the same numbering. Items **1, 2 and 3 alone remake the band** — they change what it says, how wide and how tall it is, and what colour it stands on. Items 4 and 5 make it true and give it a name.

| # | Action | What | Why | Effort | Priority |
|---|---|---|---|---|---|
| 1 | update | **The ledger** — four figures in Space Mono at 22–30px, one sentence under each | Law 3 is exactly inverted today; and deleting the 9px label deletes the page's worst contrast failure (3.32:1) by subtraction rather than by tinting | 2h | **P1** |
| 2 | update | **One measure (1280), real height, dividers only where they read** | 1152 between two 1280s, on a band made of vertical rules; ≈99px tall against neighbours whose padding alone is 96–128px per side; `--rule-warm` on `--paper-warm` is 1.43:1 and invisible on a phone | 1.5h | **P1** |
| 3 | update | **Golden hour, landing** — `--paper-deep` ground, 80px of light from the top edge, and the 3px dawn bar deleted | The ladder's golden-hour step is unused as a ground on this page; the band's stop is 16:20, right after 15:30 · Golden hour; the bar is raw hex, 3× the file's own "hairline", and reads as a progress bar | 1h + stills | **P1** |
| 4 | update | **The shipping figure comes from the setting**, with the real zero branch | An admin who moves `free_shipping_threshold` updates the cart, the PDP and checkout and leaves the homepage advertising a discount checkout will refuse. This bug already shipped once | 1h | **P1** |
| 5 | add | **The numbered rule** — heading, hairline across the measure, the stop at the far right | The only section on the page inside a trail stop that renders no part of it, uses none of the three opening species, and has no accessible name. Its two neighbours both open eyebrow-over-heading | 1h | **P1** |
| 6 | update | Cell 4 becomes the dispatch promise, so the HUD's "Made to order" is finally earned | "Tested / On the range at 5,200 m" quotes the altitude the trail HUD already prints at the 05:50 stop, and is a boast in a logistics row. The dispatch figure is already public at `lib/constants.ts:197` | 20m | **P1** |
| 7 | update | `<dl>` of `<div>` cells, and an accessible name | Label and value are two unassociated sibling divs; a screen reader hears "list, 4 items" with no context | 45m | P2 |
| 8 | remove | `TRUST_POINTS`, the index-parity class soup, three dead classes, and the stale header comment | The comment describes a 05:50 section that was moved ten hours down the clock in the 23 August re-cut | 30m | P2 |
| 9 | remove | The footer's logistics row | Three of its four facts are these three facts, on every page of the site | 20m | P3† |
| 10 | update | The last two hardcoded ₹2,000 (`FooterSection`, `WishlistView`) | Same class of bug as item 4, filed rather than left | 30m | P3 |

† P3 **pending client confirmation** — see §6, Q5. Show it *after* the new band, never before.

---

### The specs

**1 — The ledger: four figures in mono, one sentence each.**

Replace the two sibling divs at `TrustBand.tsx:40–45` with a figure and a sentence. The 9px `text-ember` label is deleted outright, not recoloured: `--ember` `#C2662A` on `--paper-warm` `#F1E9D7` measures **3.32:1** (AA normal text is 4.5:1, and 9px is large text under no definition), and on the new `--paper-deep` ground it gets *worse*, at **2.88:1**. Subtraction is the fix.

```
figure:   font-mono tabular-nums text-[clamp(22px,3.2vw,30px)] leading-none
          tracking-[-0.02em] text-forest-deep        /* 11.09:1 on --paper-deep */
sentence: mt-3 font-body text-[12.5px] md:text-[13px] leading-snug text-mid
                                                     /*  5.78:1 on --paper-deep */
```

`tabular-nums` on a monospace face is a no-op; keep it, it documents intent.

**The exact copy.** Every sentence is between 36 and 41 characters — a deliberate ±5-character band, because the four cells sit in a 2×2 on a phone and unequal wrap is what makes a considered row look assembled:

| figure | sentence | chars |
|---|---|---|
| **₹0** | Pay cash at your door, anywhere in India. | 40 |
| **₹2,000** | Order above this and we ship it free. | 36 |
| **7 days** | To send it back, unused, tags still on. | 38 |
| **2 days** | Cut, printed and dispatched from Dehradun. | 41 |

**The character budget, stated.** At 390px with item 2's chassis: 390 − 48 (`px-6`) = 342px of grid, − 24px (`gap-x-6`) = 318 / 2 = **159px per cell**. Archivo at 12.5px averages ≈6.3px per character, so the line holds **≈25 characters** and every sentence sets to exactly **two lines**. At `md`/1280: 1280 − 80 (`md:px-10`) = 1200, − 3 × 1px gaps = 1197 / 4 = **299px per cell**, − 56px (`md:px-7`) = **243px of text**, ≈37 characters per line at 13px, so every sentence sets to **two lines** there too. The rows come out even at both ends. Any rewrite must stay inside 36–41 characters or re-derive these numbers.

The figures fit with room: Space Mono advances 0.6em, so `₹2,000` is 6 × 13.2 = **79px** at the 22px floor (159px cell) and 6 × 18 = **108px** at the 30px ceiling (243px cell).

Reading order is figure-then-sentence, so a screen reader hears "₹2,000. Order above this and we ship it free." with no ARIA needed. This is the one place on the page where Law 3 is finally obeyed: mono carries four figures and nothing else.

**2 — One measure, real height, and dividers only where they read.**

Wrap the grid in `<div className="relative mx-auto max-w-7xl px-6 md:px-10">` — 1280, matching `HomeTrails.tsx:75` and `SeasonKit.tsx:97`. At 1440px the first figure's left edge moves from **208px to 120px**, the same as both neighbours. Put the section's vertical padding here: `py-14 md:py-16`.

Delete the whole index-conditional class string at `TrustBand.tsx:34–38` and replace the grid with:

```
<dl className="grid grid-cols-2 gap-x-6 gap-y-10
               md:grid-cols-4 md:gap-x-0 md:gap-y-0 md:gap-px md:bg-clay">
  <div className="md:bg-paper-deep md:px-7 md:py-2"> … </div>
```

At `md` the 1px grid gaps show the container's `--clay` through as three dividers, perfectly centred with 28px of air on each side, with no per-index classes at all. **Below `md` there are no rules whatsoever** — spacing separates the four figures. That is honest, not lazy: `--rule-warm` `#D2C4A4` on `--paper-warm` measures **1.43:1**, and on the new `--paper-deep` ground it drops to **1.24:1**; a 1px line at that contrast is not on a phone. `--clay` `#B8826B` on `--paper-deep` measures **2.34:1** — a hairline you can actually see, in a hue that belongs on a golden ground, with no alpha compositing to get wrong. If it reads too warm in the browser, `bg-clay/70` composites to `#C69C84` = **1.77:1**; do not go below that.

**Two things that will bite if missed.** (a) The `md:bg-clay` container must carry **no horizontal padding** — the `px-6 md:px-10` lives on the wrapper *outside* it, or the divider colour paints into the page gutter as two stripes. (b) `md:bg-paper-deep` on the cell must be the **same token** as the section ground; if item 3's ground is ever changed, both values move together or a seam appears.

**Height, computed.** At `md`: 128px padding + 61px heading row (item 5) + 78px cell (30px figure + 12px `mt-3` + two 13px lines at `leading-snug`) ≈ **267px**, against today's ≈99px. At 390px: 112px padding + 55px heading + two 68px rows + 40px `gap-y-10` ≈ **344px**, against today's ≈215px. The band stops being thinner than its neighbours' padding.

While in the file, delete the three dead classes recon found: `border-rule-warm` on `i === 0` (draws nothing in either layout), and the unconditional `md:border-t-0` on `i === 0` and `i === 1` (they never receive `border-t`). All three disappear with the class string anyway.

**3 — Golden hour, landing.**

Three edits, in this order.

*3a — the ground.* `TrustBand.tsx:19`: `bg-paper-warm` → `bg-paper-deep`. `--paper-deep` `#E7D9BE` (`globals.css:34`) is the ladder step the token file comments **"golden hour"**, and it is unused as a ground anywhere on this homepage — `ShopByCategory.tsx:69` and `Community.tsx:59` are both already `bg-paper-warm`, making this the page's third band on one step. This band's stop is 16:20, immediately after 15:30 · Golden hour. Separation from the neighbours survives: **11.09:1** against `forest-deep` above, **11.18:1** against `altitude` below.

*3b — delete the dawn bar.* Remove `TrustBand.tsx:21–28` entirely — the `aria-hidden` `h-[3px]` div and its inline `linear-gradient(90deg, transparent 0%, #E39B3F 22%, #F6DCA8 50%, #E39B3F 78%, transparent 100%)`. It fails on four counts: the colours are **raw hex literals**, not `var(--dawn)` / `var(--dawn-soft)`, so they sit outside the token system and outside the `.trek-scope` redefinitions at `globals.css:323–325`; it is **3px** where every other line in the file is 1px, while the file's own comment at `:9–10` calls it "a single hairline of real dawn"; it sits directly under `HomeTrails`, which already spends dawn four times (`:79` eyebrow, `:101` link, `:128` season chip, `:154` badge), so "the ONE warm accent, used where the light arrives and nowhere else" cannot also be the top edge of the next section; and at full viewport width a 3px saturated band with faded ends **reads as a progress bar** — it promises motion that never comes.

*3c — the light, as a ground event instead of a stripe.* Give the section's currently dead `relative` (`TrustBand.tsx:19` — it positions nothing today) its first job:

```
<div aria-hidden
     className="pointer-events-none absolute inset-x-0 top-0 h-20"
     style={{ background: 'linear-gradient(180deg, var(--paper) 0%, transparent 100%)' }} />
```

80px of light falling from the top edge and dying before the figures start, so the band is brightest exactly where the photograph's black ends and settles toward dusk as `--altitude` begins. The day continues *through* the section break instead of a cream sliver with an orange line drawn on it. Tokens, not hex — this is the fix for 3b's real defect, not a re-introduction of it.

**The banding risk, with the number.** `--paper` → `--paper-deep` is R 248→231, G 245→217, **B 237→190** — 47 levels of blue over 80px, i.e. one step every **1.7px**. That is at the edge of visible on an 8-bit panel; Chrome dithers it. **Do not make the ramp taller** (a 160px ramp doubles the step to 3.4px and will band), and **do not add a third colour stop**. Shorter is safe; taller is not.

Everything above the ramp only gets lighter, so every contrast figure in this plan is a floor, not an estimate.

**4 — The shipping figure comes from the setting, not from a string.**

`app/page.tsx:124`:

```
<TrustBand
  stop={TRAIL_STOPS.trust}
  freeShippingThreshold={settings.free_shipping_threshold}
  flatShippingRate={settings.flat_shipping_rate}
/>
```

`settings` is already awaited at `app/page.tsx:47` and `TRAIL_STOPS` is already imported at `app/page.tsx:28`, so this costs **zero new queries and zero new imports**. Both columns are already in `STOREFRONT_COLUMNS` (`actions/settings.ts:84`, `:86`). `TrustBand` imports `formatPrice` from `@/lib/utils` and builds its array in the component body.

**The zero branch is not optional.** `actions/shipping.ts:57` reads `if (settings.free_shipping_threshold > 0 && subtotal >= threshold) return 0` — a threshold of **0 genuinely disables free shipping**. Rendering "Free over ₹0" would be absurd, and every other proposal in this round missed it. Branch on it, and keep the cell a ledger entry by using the other live figure:

```
freeShippingThreshold > 0
  ? { figure: formatPrice(freeShippingThreshold),   // ₹2,000
      line:   'Order above this and we ship it free.' }
  : { figure: formatPrice(flatShippingRate),        // ₹100
      line:   'Flat shipping, anywhere in India.' }
```

`formatPrice` takes **paise** (`lib/utils.ts:12`): `formatPrice(200000)` → `₹2,000`, `formatPrice(10000)` → `₹100`. At the default settings the rendered string is byte-identical to today's literal — **the fix is invisible until someone moves the setting, which is the point.** Say so in the commit message so it is not mistaken for a no-op, and verify against `lib/formatPrice.test.ts`, which already pins the helper's output, rather than by eye.

**5 — The numbered rule: the species neither neighbour is using.**

Above the grid, inside the same `max-w-7xl` wrapper:

```
<div className="flex items-baseline gap-5 pb-9 md:pb-10">
  <h2 id="trust-heading"
      className="font-display font-light text-[19px] md:text-[21px] leading-none text-forest-deep">
    Before you decide
  </h2>
  <span aria-hidden className="h-px flex-1 bg-clay" />
  <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-forest sm:inline">
    {stopEyebrow(stop)}
  </span>
</div>
```

and `aria-labelledby="trust-heading"` on the `<section>`.

Law 5 names three opening species and forbids two in a row. `HomeTrails` above opens mono-eyebrow-over-display-heading (`HomeTrails.tsx:79`), `SeasonKit` below opens with a pinging dot, a mono eyebrow and a display heading (`SeasonKit.tsx:104–108`). A fourth eyebrow here would be the third in a row across ~250px of scroll; **the numbered rule is the one species neither neighbour uses**, and it stops those two reading as twins across the seam.

Colours: `--forest-deep` **11.09:1** on the new ground; `--forest` `#27481F` **7.41:1** at 10px. Note the trap this catches — `--clay-deep` `#8A5A44`, which two proposals wanted for these labels, measures 4.79:1 on `paper-warm` but only **4.15:1 on `paper-deep`**, i.e. it fails AA on the ground item 3 introduces. Use `--forest`. This is the one cross-proposal conflict in the round and it is easy to ship by accident.

`stopEyebrow(stop)` (`lib/trail.ts:84`) prints **"16:20 · Made to order"** — the page's single stop format, already set in mono at `HomeTrails.tsx:79` and `TheClimb.tsx:157`. **Do not rename the trail stop.** Recon proposed changing `lib/trail.ts:78` to "Before you decide" or "Checkpoint"; both are wrong here. Those labels are the client's own vocabulary, drawn from their mock-ups; the only element that renders them is `TrailSpine`, which `HOMEPAGE-COUNCIL.md` records as rejected twice and which the 2026-08-30 correction records as **back on the page in its original form and awaiting the client's decision**. Item 6 makes the existing label true instead, which costs nothing and asks nobody.

**No `07`.** A section number would put two numbering schemes — an invented `07` and the page's real `16:20 · 3,750M` coordinate vocabulary — inside one 40px line. The stop carries it.

The heading is deliberately held at 19/21px: it is a label for the ledger, not a competitor to it, and the figures below it run 22–30px.

**6 — The fourth fact.**

`Tested / On the range at 5,200 m` goes. It is a brand claim in a logistics row, the odd participle among three category nouns, and it quotes **5,200M** — which `lib/trail.ts:69` already assigns to the *collections* stop at 05:50, so the band and the HUD contradict each other about where 5,200 m is.

It is replaced by `2 days` / "Cut, printed and dispatched from Dehradun." Nothing here is invented: `lib/constants.ts:197` already tells customers "Orders dispatch within 2 business days from our Dehradun facility", and the PDP already renders it. This is also the one move that turns a generic Indian-storefront logistics strip into *this shop's* strip — print-to-order is the business model, it is the trail stop the band has been wrapped in since the 23 August re-cut, and until now nothing in the section rendered it.

**Two flags.** The dispatch promise becomes a public commitment on the homepage; if fulfilment slips, the fix is one number in one place. And the FAQ says "business days" while the cell says "days" — see §6, Q3.

**7 — Semantics.**

`<ul>`/`<li>` → `<dl>` with a `<div>` cell per pair, each holding `<dt>` (the figure) and `<dd className="m-0 …">` (the sentence). The per-cell `<div>` wrappers are **load-bearing and must not be optimised away**: a `<dl>` used directly as a grid container has historically broken `dt`/`dd` pairing in shipping screen readers, and the wrapper `<div>` is the documented workaround. It is also exactly what item 2's chassis needs anyway. The explicit `m-0` is because Tailwind preflight zeroes `dl` margins but not `dd`'s inherited indent in every engine.

The accessible name comes from item 5's real `<h2>`, not from an `sr-only` heading or an `aria-label` — a visible heading names the section for the eye *and* for the screen reader, and this band has needed one for both.

**8 — Dead code and a lying comment.**

Delete `TRUST_POINTS` from `lib/constants.ts:131–138` — `TrustBand` is its only web consumer, and the array of the same name at `mobile/lib/editorial.ts:187` is a separate, divergent list (four full sentences, different wording, no label/value split, consumed as a marquee at `mobile/app/(tabs)/index.tsx:264`). It is **out of scope**; do not try to unify them in this pass.

Rewrite the header comment at `TrustBand.tsx:3–16`. It opens "05:50 — first light, and the page's first light ground" and describes a section sitting "immediately after a deliberately restrained hero", breaking "the dark run of sections beneath it". None of that is true: the 23 August re-cut moved this band below Trails, its stop is now **16:20 · 3,750M** (`lib/trail.ts:78`), 05:50 belongs to `CollectionsRow` (`lib/trail.ts:68`), and what sits beneath it is one dark section, not a run. The replacement should record three things the next session will otherwise undo: why the label is mono-free (Law 3), why the ground is `paper-deep` and not `paper-warm`, and why there is no `return null` (Law 1 — see §2).

**9 — The footer's logistics row.** See §4.

**10 — The last two hardcoded thresholds.** `components/layout/FooterSection.tsx:181` ("Free shipping over ₹2,000") and `components/sections/WishlistView.tsx:116` ("free shipping over Rs. 2,000" — note it also spells the currency differently). `FooterSection` is already an `async` server component awaiting `getCollections()`/`getCategories()`, so it can await `getStoreSettings()` alongside them for one line. If item 9 lands, the footer copy disappears and only `WishlistView` remains. Filed here so the fourth copy of this figure does not outlive the first three.

---

## 4. Removals, argued

**The 3px dawn bar (item 3b).** The brand's one warm accent, spent on a decoration, ten hours late on the clock, in raw hex outside the token system. Its own comment calls it "a single hairline" and it is three times the width of every other line in the file. It sits directly beneath a section that already spends dawn four times, which is precisely what "used where the light arrives and nowhere else" forbids. And at full viewport width a saturated 3px band with faded ends reads as a progress bar — the one register this client has rejected twice on the hero. **Nothing warm is lost:** item 3 replaces a stripe of dawn with a ground of golden hour and 80px of light arriving at the top edge, which is more warmth, better argued, and inside the palette.

**The 9px ember label (item 1).** `#C2662A` on `#F1E9D7` is **3.32:1**, carrying the smallest and most tracked-out type in the section (9px uppercase at 0.24em = 2.16px of letter-space on a 9px glyph). On the new ground it is **2.88:1**. `globals.css:55` defines ember as "dawn's shadow side — *for text on dawn grounds*" and this is a paper ground. It could have been recoloured to `--forest` (7.41:1) — but the label is also the Law 3 inversion, four common nouns in the face reserved for measurement. Deleting it fixes both defects with one cut and leaves the figure as the loudest thing in the cell, which is what a ledger is.

**"Tested / On the range at 5,200 m" (item 6).** The band's only piece of brand voice, and this is the real cost of the plan — flagged honestly, and it is Q6. Three defences. It is a boast in a row whose entire job is answering doubts. It re-argues the altitude claim that `HomeTrails` spent a full-bleed dark section making, 100px above. And it quotes an altitude the page's own HUD assigns to a different stop. Its replacement is not a neutral logistics line either: "cut, printed and dispatched from Dehradun" is the business model stated as a fact, which is a stronger version of the same argument.

**`TRUST_POINTS` and the index-parity class soup (items 2, 8).** The dividers are computed from array index parity (`i > 1`, `i % 2 === 1`), so the component is only correct at exactly four items: three leaves a hanging cell with a stray top border, five wraps into a second `md` row where `md:border-t-0` erases the row divider and the fifth cell draws a left border it should not have. `px-1` beaten by `pl-5` also puts **4px on one side of every mobile hairline and 20px on the other**, so the rule is glued to the left column instead of dividing two equals — and it silently self-corrects at `md`, which is why nobody has caught it. The `md:gap-px` chassis removes the whole class of bug.

**The footer's logistics row (item 9).** `FooterSection.tsx:178–183` carries `COD · UPI · Cards` / `Free shipping over ₹2,000` / `7-day returns` / `Fast dispatch across India` at 11px uppercase in `text-white/35`, on every page of the site. Three of those four facts are the three facts this band carries, and the shipping figure is a third hardcoded copy. Keep the `border-t` as the sign-off's top edge by moving `border-t border-white/10 mt-14 pt-6` onto the wordmark block at `:186`, or the footer's rhythm breaks. **This is a copy decision, not a design one:** show it to the client *after* the new band, never before — its own risk is that a visitor loses their last reassurance before the fold, and that risk is only acceptable once the band above is loud enough to have been read.

**`relative` — kept, not removed.** Recon filed it as dead (it positions nothing) and two proposals wanted it deleted. Item 3c gives it its first real job. Leave it.

---

## 5. Killed in judging — on the record

- **A live pincode delivery estimator in the band** — FATAL. It calls `getDeliveryEstimate` with `subtotal: 0`, so with no `shipping_zones` configured the homepage would quote a flat shipping charge two cells away from a promise that shipping is free over ₹2,000; a visitor reads that as a contradiction, not a service. It also adds the section's first client JS and ~56px of mobile height to duplicate a control that already exists on the PDP, at the moment of decision, with a real subtotal. The engineering was disciplined (true server fallback, transform-only motion, 44px targets) — it fails on judgement, not on craft.
- **`divide-x` / `divide-y` on the wrapping grid** — FATAL, and it was asserted with confidence. Those utilities draw in **DOM order, not visual-row order**: with four cells at `grid-cols-2` the rules land on the wrong edges — a stray horizontal under the bottom-left cell and an unbalanced vertical in row one. That is precisely why the current file uses the index-parity classes it proposed to delete, and the claim that it "renders correctly at three, five or fifty items" is the opposite of true. Item 2's `md:gap-px` over a coloured container is the mechanism that actually works. The rest of that bundle was salvaged into items 1, 2, 7 and 8.
- **Renaming the trail stop** (`'Made to order'` → `'Checkpoint'`, or → `'Before you decide'`) — the finding is right and the fix is wrong. `Checkpoint` is generic mountaineering furniture beside a set that reads First light / Pack check / Golden hour / Who is coming / The way down. And these labels are the client's vocabulary, rendered only by an element the council records as rejected twice and currently un-adjudicated. Item 6 makes the existing label true instead.
- **A `07` section number in the rule** — two numbering schemes in one 40px line, one of them invented, beside the page's real coordinate vocabulary. Dropped from item 5.
- **`--clay-deep` for the labels and the eyebrow** — measures 4.79:1 on `paper-warm` and **4.15:1 on `paper-deep`**, so it fails AA on the ground item 3 introduces. `--forest` at 7.41:1 replaces it. Recorded because two separate proposals reached for it independently.
- **A fifth grid cell holding a "Shop everything →" link** — `md:grid-cols-[repeat(4,1fr)_auto]` is genuinely tight at 768–840px, the link duplicates the nav, `SeasonKit`'s add-to-cart sits ~100px below, and a ragged fifth cell is what makes a considered four-square look assembled. The contrast and focus ring were correctly specified; the idea was not.
- **Deleting the dawn bar with nothing offered back** — subtraction that argues against the file's own reasoning without replacing it. Item 3 deletes the same three lines and gives the whole band golden-hour light instead.
- **An `sr-only` `<h2>` for the accessible name** — names the section for a screen reader and does nothing for the eye. Item 5's visible heading does both, and Law 5 sanctions the species.
- **Setting the facts themselves in Fraunces light with an inline mono span at `0.86em`** — characterful, and the cleanest reading of Law 3 on paper. But it puts two faces with different x-heights and baselines on one line, and if the optical alignment is not tuned the number reads as pasted in. The ledger gets the same law obeyed with one face doing one job.
- **Demoting Space Mono at every word-setting site across the page** — right rule, wrong scope. Section 7 fixes section 7.
- **Widening the measure without also raising the height** — accurate diagnosis, self-defeating outcome: wider columns collapse wrapped values to one line and drop ~19px from a band that is already only 99px tall. Item 2 does both together, which is the only version that is not a regression.

---

## 6. Open questions for the client

1. **The ground.** `--paper-deep` `#E7D9BE` instead of `--paper-warm`. It is the ladder step the token file calls "golden hour", it is unused as a ground on this page, and it matches the band's 16:20 stop. Show one still against the current band. *(Related: with `SeasonKit` disabled, the section below becomes `TheClimb`'s `bg-paper` — `paper-warm` against `paper` is **1.11:1**, a Law 1 failure an admin can produce from the settings screen; `paper-deep` against `paper` is **1.28:1**, a real ladder step. Item 3 fixes a latent bug as well as making a picture.)*
2. **"₹0".** The first figure in the ledger. Read as "free" and understood in half a second, or read as an error? It is the most brand-shaped line in the set for a Dehradun COD shop, and it is the one figure I would want two people to look at cold.
3. **"2 days" or "2 business days".** The FAQ at `lib/constants.ts:197` says *business* days. The cell says days. Keeping "business" costs 9 characters — the sentence goes from 41 to 50, which still sets to two lines at 390px but leaves the four cells less even. If legal wants the qualifier, take it; if not, the copy stands as written.
4. **The trail stop.** Item 6 makes "Made to order" true rather than renaming it — but this is only visible at ≥1280px, through `TrailSpine`, which the council records as rejected twice and which the 2026-08-30 correction records as back on the page. **If `TrailSpine` is being removed, item 5's right-hand `stopEyebrow` becomes the only place the stop is printed at all**, which is an argument for keeping it, not against.
5. **The footer's logistics row (item 9).** Delete the four-fact line from every page of the site, now that the homepage states three of them properly? Copy decision. Show it after the new band.
6. **Losing "On the range at 5,200 m."** This is the band's only non-logistics claim and the sentence that makes the strip belong to this brand. The altitude story survives in `BrandPulse` — but `BrandPulse`'s stats block renders conditionally on `settings.home_config.stats` and can be absent entirely, so the defence is weaker than it sounds. Is the dispatch promise a fair trade?
7. **Scope.** Items 4 and 8 touch `lib/constants.ts` and `app/page.tsx`; items 9 and 10 touch `FooterSection.tsx` and `WishlistView.tsx`, both outside section 7. Approved?

**What I could not specify exactly:** the divider colour — `--clay` solid measures **2.34:1** on `--paper-deep` and `clay/70` measures **1.77:1**, and which of those is a hairline rather than a stripe is a judgement that has to be made at 1440px in a browser, not in a spreadsheet. The 80px light ramp's height is a ceiling derived from banding (47 levels of blue, 1.7px per step) rather than from taste; whether 80px, 64px or 48px reads best needs eyes at three widths. And the heading at 19/21px against figures at 22–30px is a deliberately narrow gap — if the heading competes with the ledger in the render, drop it to 17px rather than raising the figures.

---

## 7. How we will know it worked

**Widths, every time.** 320, 360, 390, **767 and 768** (the only breakpoint in the file), 1024, 1280, 1440, 2560.

- At every width, all four sentences set to the **same number of lines** as each other, so the 2×2 rows and the 4-up row are even. At 320px specifically — the tightest point, 320 − 48 − 24 = 124px per cell, ≈19 characters per line — confirm the longest sentence (41 chars) sets to **three lines, not four**, and that all four do the same. If one cell breaks ranks, recut to 36 characters across the board rather than shortening one.
- At `md`+, the three dividers are **1px, perfectly centred**, with 28px of air on each side, and none of the divider colour paints into the page gutter. Below `md` there is **no rule anywhere**.
- At 1440px, measure the left edge of the first figure: it must be **120px**, matching `HomeTrails` and `SeasonKit`, not today's 208px. Screenshot the two seams — the band's content edge must align with the section above and the section below.
- The page body never scrolls horizontally at any width.

**Degraded states, every time.**
- **JavaScript off** — the entire band is present and correct. It is a server component with no client code, and it must stay that way; this is the pass/fail on the whole plan.
- **CSS off / unstyled** — reading order is figure, then sentence, four times, under one heading.
- **`prefers-reduced-motion: reduce`** — identical. Nothing here animates and nothing should.
- **`free_shipping_threshold = 0`** (set it in `/admin/settings`) — cell 2 must read `₹100` / "Flat shipping, anywhere in India.", **never** "Free over ₹0".
- **`free_shipping_threshold = 250000`** — cell 2 reads `₹2,500`, and the cart, the PDP and checkout agree. This is the bug item 4 exists to kill; test it by changing the setting, not by reading the code.
- **`free_shipping_threshold = 249950`** — `formatPrice` prints `₹2,499.50`. Confirm it does not wrap awkwardly at 320px; it is the same string the cart shows, so it is correct even if it is ugly.
- **`SeasonKit` disabled** — the section below becomes `TheClimb` on `bg-paper`. Confirm the ground step is still legible (1.28:1, up from 1.11:1) and that the 80px top ramp does not make the band's own bottom edge disappear into it.
- **`HomeTrails` with no featured trails** — it returns `null` and the section above becomes `TrekBuddyBand` on `bg-ink` `#0C100D`. Confirm the band still reads as light arriving, not as a stripe.
- **Both neighbours absent at once** — confirm the band never renders zero cells and never returns `null`. This is the Law 1 guarantee in §2.

**Measurements, before and after.**
- Section height at `md`/1280: **99px today → ≈267px**. At 390px: **≈215px → ≈344px**.
- Smallest-type contrast: **3.32:1 today (ember 9px) → no type below 10px, and nothing under 5.78:1.** Sample the figure (`forest-deep`, target 11.09:1), the sentence (`mid`, 5.78:1), the heading (`forest-deep`, 11.09:1) and the stop (`forest`, 7.41:1) from the live render, **inside the 80px ramp and below it**, because the ground changes value across the top of the section.
- Divider contrast against ground: **1.43:1 today → 2.34:1** at `md`, and **no divider at all** below it.
- Content left edge at 1440px: **208px → 120px**.
- Count of Space Mono glyphs that are not a digit, a currency mark or a time separator, inside this section: **today 28 (four nouns) → 0 in the ledger**, with `stopEyebrow` at the far right as the single deliberate exception (the page's one stop format, already mono in two other sections).
- Count of hardcoded free-shipping figures in the repo: **4 today → 3** after item 4, **→ 2** after item 9, **→ 1** after item 10 (`mobile/lib/editorial.ts:189`, out of scope).

**Reading passes.**
- Screen reader, top to bottom: the section announces as "Before you decide", then four term/definition pairs, each heard as "₹2,000. Order above this and we ship it free." — not as eight unrelated strings.
- Tab through the section: there should be **no focus stops inside it at all**. If one appears, something was added that should not have been.
- Read the four sentences aloud in order and confirm they answer four *different* questions — how do I pay, what does delivery cost, what if it is wrong, when does it come. Three of those are currently answered twice on this page and the fourth is not answered at all.

**Housekeeping.** Three notes from experience, so nobody loses an afternoon: **the browser pane must be visible** or screenshots come back blank and `innerWidth` reads 0, which makes a correct responsive layout look broken; **`px-[--token]` compiles to nothing** in this repo's Tailwind v4 — every arbitrary value in this plan that references a token is written as `var(--token)` inside a `style` attribute for exactly that reason, and none of them should be "simplified" into a bracket utility; and **a class-shaped string in a `.md` or `.mjs` file can 500 every page through `globals.css`** in this repo's Tailwind v4 setup, because the content scan reads raw text and does not respect code fences. `design/01-hero.md` already quotes class names heavily and the site builds, so the precedent is safe — but if `pnpm dev` starts 500ing on every route right after this file lands, this document is the first place to look, and the fix is to break the offending string, not to hunt in `app/`.
