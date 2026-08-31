# The Trail Dispatch — Action Plan

*Section 12 of the homepage, and the last content band before the footer. Written against `components/sections/NewsletterBar.tsx` (146 lines, clean in git), `components/sections/BrandPulse.tsx`, `components/layout/FooterSection.tsx`, `actions/reviews.ts`, `lib/trail.ts`, `app/globals.css`, `app/page.tsx` on branch `mobile-remediation`. Every line number and every contrast ratio below was measured against the working tree. Where I could not specify a value exactly, it is in §6, not hidden behind an adjective.*

---

## 1. The verdict

The page's only conversion object is the dimmest thing on the page, it is stranded in the middle of a void, and when it fails it says thank you. Four measured facts carry the diagnosis. **It lies.** `subscribeToNewsletter` *returns* `{ error }` — for a Zod failure (`actions/reviews.ts:131`), a rate-limit block (`:136`) and any Postgres error (`:149`) — it never throws, so the `try/catch` at `NewsletterBar.tsx:40-47` catches nothing, the returned value is discarded, and `setSubmitted(true)` fires on **every** outcome. A visitor who is rate-limited reads "You're on the list." and is not on the list. The comment beside it ("the CTA simply stays available") describes behaviour the code does not have. Alongside that, the fine print promises "Unsubscribe anytime with one click" on seven pages, and `unsubscribeFromNewsletter` (`actions/reviews.ts:165`) has **zero callers**, no route, no token, no link — and nothing anywhere in the repo ever sends a dispatch. **You cannot see the field.** Measured on `#16290F`: its entire enclosure is `border-b border-paper/25` = **2.17:1** (a form-control boundary needs 3:1), the placeholder is **2.55:1**, the fine print is **3.48:1**, the success box is **1.67:1** — and `focus:outline-none` (`:111`) deletes the sage ring that `app/globals.css:625-628` installs for `.on-dark`, three lines above a comment reading *"Never strip the ring without replacing it."* **It is stranded, and pinched.** `items-center` (`:65`) centres a ~102px form against a ~330px promise column, so at 1440 the 43px control row floats with roughly 114px of empty ground above and below it; and in the 1024–1152 window `lg:gap-20` plus `lg:pl-4` leave the `flex-1` input about **200px** — its narrowest anywhere, narrower than at 390px. **And the page ends as one black slab.** BrandPulse's scrim terminates at `--ink`, this band is flat `--forest-deep` (**1.24:1** from ink), the footer is `--ink`; the only seam marker is a hairline measuring **1.33:1**. The two bands declare byte-identical wrappers and byte-identical openings — mono sage eyebrow, `font-display font-light` h2, `italic text-sage` second clause — so Law 5 breaks at the ending, where attention is thinnest. After `TrustBand` (section 7) there is not one warm pixel left on the page.

The fix is not a redesign of a signup form. It is to make the last band **a lamp, and to put the field inside it.** The page opened at 05:50 in first light and has walked down to 21:00; the warm accent returns not as a sunrise but as a single source in the ground — one pool of `--dawn` at 14%, tracking the form across breakpoints, with the band fading to `--ink` at *both* edges so it sits in a continuous night instead of butting a 1.24:1 seam against its neighbours. The contour rings stop being a clipped 2.4px smudge and become that lamp's isolines, concentric with the light. The band opens on a rule carrying `21:00 · 2,700M` — a time and a coordinate, which is what Space Mono is for — so it stops reading as the same section as the one above. And the one object standing in the light gets a boundary you can see, a ring you can tab to, words for the outcome it currently has none for, and copy that stops promising three different cadences and one thing the product cannot do.

---

## 2. What stays — do not touch

| | Why it is right |
|---|---|
| **The two-column composition.** `:65` — argument left, ask right. | Proposal 0 wanted a single 768px column. That adds a **sixth** measure to a page already running 896/1024/1152/1280/1400 and drops `/collections` and `/journal` from a 1280 measure above to 768 here — a 512px step, which is the exact defect Law 4 names. The composition is fine; its *alignment* and its *gap* are the defects. |
| **`max-w-6xl` (1152px).** `:65` | It is the page's most-used measure. Nothing below changes it. |
| **The underline field, not a filled box.** `:111` | `bg-ink/40` in a 6px box turns an editorial control into an app field. The field's problem is contrast, not species. Raise the line; keep the line. |
| **`bg-paper text-forest` on the button, with `hover:bg-sage hover:text-ink`.** `:116` | 9.48:1 and 6.74:1. It is the only fully-passing colour pair on the section, and keeping the button cream is also what keeps `--dawn`-as-ground separate from Trek Buddy's `--dawn`-as-fill (`globals.css:741-742`). |
| **The contour rings exist.** `:53-63` | Contour lines are the most brand-native texture an outdoor shop in Dehradun could have. They are drawn wrong (item 2), not wrongly conceived. Deleting them leaves the closing band completely flat. |
| **`stop` is optional, and degrades to an empty prefix.** `:27`, `:68` | Six of seven mounts pass no `stop`. Every change below keeps that path rendering with no orphan glyph and no empty span. |
| **`stopEyebrow()` and `lib/trail.ts` as the single source.** `lib/trail.ts:84-86` | Item 2 reads `stop.time` / `stop.alt` / `stop.label` directly instead of calling `stopEyebrow`, because it prints a different pair — but it reads them from `TRAIL_STOPS`, never hardcodes a figure. Proposal 23's hardcoded `12` was killed for exactly this. |
| **`AnimatePresence mode="wait"`.** `:91` | The form must finish leaving before the receipt arrives, or the column jumps. Item 6 changes what animates, not the sequencing. |
| **The header comment's diagnosis.** `:8-11` | "Join the journey" asking for an email without offering anything back is the right reading, and "batches of 200–500 sell out in days" is the one genuinely scarce fact the band owns. Item 7 puts it on the page instead of leaving it in a comment. |

---

## 3. The action plan

Table and specs share the same numbering. Items **1, 2 and 3 alone visibly change the band on both a phone and a laptop** — the ground, the graphic, the opening and the field all move. Item 4 is the section's worst defect and is invisible in a screenshot, which is why it is fourth and still P1.

| # | Action | What | Why | Effort | Priority |
|---|---|---|---|---|---|
| 1 | update | **The lamp.** The band's ground becomes one warm source centred on the form, fading to `--ink` at both edges | Three dark bands at 1.24:1 with a 1.33:1 seam read as one slab; the brand's one warm accent has been absent since section 7 | 1.5h + eyes | **P1** |
| 2 | update | **The rings become the lamp's isolines** — non-scaling stroke, concentric with the light, four rings | A 480px graphic at 1.18:1, stroked 2.4× its declared weight, clipped into a corner | 1h | **P1** |
| 3 | update | **The field becomes visible** — boundary, placeholder, fine print, focus ring, one type ladder | 2.17 / 2.55 / 3.48:1 and no ring, on the one object the visitor is asked to touch | 1.5h | **P1** |
| 4 | update | **Read the result.** Error state, `role="alert"`, honest `source` | Every failure path currently prints "You're on the list." | 2h | **P1** |
| 5 | update | **A different opening** — a rule carrying `21:00 · 2,700M`, and `--sage-lit` on the display clause | Byte-identical species to the band above (Law 5); mono carrying a proper noun (Law 3); 5.44:1 where 8.73:1 exists | 1h | **P1** |
| 6 | update | **Composition** — `items-start`, gap 80→48, drop `lg:pl-4`, control row inline at `xl` not `sm` | 114px of dead air around the CTA at 1440; a 200px input at 1024 | 1h | **P1** |
| 7 | update | **The copy stops contradicting itself**, and the scarce fact leaves the comment | Three stated cadences, two promises that are one promise, a claim with no mechanism | 45m | **P1** |
| 8 | remove | The success panel's box; opacity on entry; `min-h-[120px]`; the dead `try/catch` | An invisible border round the one thing nobody acts on; a named hard constraint; a floor that never matched either branch | 45m | **P1** |
| 9 | update | `<br className="hidden sm:block" />` on the heading break | The break fires at 320px, setting two short lines for no reason | 5m | P2 |
| 10 | update | `source` becomes a prop; all seven mounts pass their own | Seven placements write one indistinguishable string; the admin CSV cannot attribute a signup | 30m | P2† |
| 11 | update | `.on-dark :focus-visible` → `--sage-lit` | Already specified as item 8b of `design/01-hero.md`; unbuilt. On the lit ground `--sage` measures 4.25:1 | 10m | P2 |
| 12 | update | `DISPATCH_PROMISES` becomes admin-editable via `home_config` | The highest-intent capture on the site is the only band `/admin/homepage` cannot touch | 1 day | P3‡ |

† scope: touches six pages outside section 12 — see §6, Q5.
‡ pending client answer — see §6, Q7.

---

### The specs

**1 — The lamp.**
Add to `app/globals.css`, inside `@layer base` immediately before its closing brace at `:1173`, directly beside `.studio-stage` (`:1164-1171`), which is the same construction and the precedent for writing tokens as rgba literals inside a layered `background-image`:

```css
  /* Section 12 closes the day arc. The light does not rise here — it is a
     lamp, one warm source sitting where the email field is, falling off into
     the ink the footer continues. rgba(227,155,63) is --dawn #E39B3F written
     out because color-mix() failing would invalidate the whole shorthand and
     take the ink ramp with it. Keep the two in sync with globals.css:53. */
  .dispatch-lamp {
    --lamp-x: 50%;
    --lamp-y: 68%;
    background-color: var(--forest-deep);
    background-image:
      radial-gradient(58% 62% at var(--lamp-x) var(--lamp-y),
        rgba(227, 155, 63, 0.14), transparent 68%),
      linear-gradient(to bottom,
        var(--ink) 0%, transparent 26%, transparent 74%, var(--ink) 100%);
  }
  @media (min-width: 1024px) {
    .dispatch-lamp { --lamp-x: 72%; --lamp-y: 44%; }
  }
```

On `NewsletterBar.tsx:51`: `bg-forest-deep border-t border-paper/10` → `dispatch-lamp`. **The top border goes with it** — see §4.

Measured. Lamp peak = `rgba(227,155,63,0.14)` over `#16290F` = **`#333916`**: **1.28:1** against flat forest-deep — a swell, not a colour block — and **1.59:1** against ink. Text on the peak: `--paper` **11.09:1**, `--sage-lit` **6.82:1**, `--paper/50` **4.05:1**, `--paper/65` **5.69:1**. Every ratio in item 3 is quoted against the peak, i.e. the worst case; anywhere else on the band they are higher. **`--sage` on the peak is 4.25:1, below AA for small text** — which is why item 5 moves the mono figure to `--sage-lit` and item 3 keeps no small sage text in the lit pool.

The lamp's anchors track the form, not the container. At `lg`+ the form is the right column: its control row centres at ≈**71% x, 44% y** of the band (1440: container 1152 starting at x=144, right column 552 wide starting at x=744, centre 1020 → 70.8%; band ≈520px tall, control row centre ≈227px → 43.7%). Below `lg` the form is the last block in a single column and its control row centres at ≈**50% x, 68% y**. Re-measure both after item 6 and item 7 land, since both change the band's height — see §6.

Seams. The `linear-gradient` puts `--ink` at 0% and 100%, so the band's top edge is the same colour BrandPulse's `to-ink` scrim terminates in (`BrandPulse.tsx:70`) and its bottom edge is the footer's `bg-ink` (`FooterSection.tsx:95`). **This is an argued exception to Law 1, not compliance with it:** the band does not differ from its neighbours by a rung of the paper ladder, it dissolves into them and separates itself by *light* instead. State it that way to the client. The alternative — a step of the ladder — is not available: there is no dark rung between `--forest-deep` and `--ink`, and `--ink-raised #191D1A` is Trek Buddy's card surface.

Fallbacks. `background-color: var(--forest-deep)` is a real fallback: under `forced-colors`, in print, or with gradients unsupported, the band is exactly what ships today. No motion is added, so `prefers-reduced-motion` is untouched.

**2 — The rings become the lamp's isolines.**
`NewsletterBar.tsx:53-63`, three changes and one addition.

(a) Add `vector-effect="non-scaling-stroke"` to every `<path>`. `strokeWidth="1"` in a 200-unit `viewBox` rendered at 480px is a 2.4× scale, so today's "hairline" renders at **2.4px**. This is the whole fix for the weight.

(b) Replace the wrapper className with:
```
pointer-events-none absolute h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2
left-1/2 top-[68%] lg:left-[72%] lg:top-[44%] text-dawn/[0.26]
```
The two anchor pairs are the *same* values as `--lamp-x` / `--lamp-y`, so the rings are concentric with the light at both breakpoints. Measured: `--dawn` at 26% over the lit ground `#333916` = **`#615221`**, **1.58:1** — visible as texture on a normal panel, still nowhere near reading as a shape, up from **1.18:1** today.

(c) A fourth, outermost ring, specified without new path data: wrap a duplicate of the **first** path (`:60`) in `<g transform="translate(100 100) scale(1.3) translate(-100 -100)">`. Scaling about the viewBox centre keeps it concentric; `non-scaling-stroke` keeps it 1px. Order it first, so it paints beneath the other three.

(d) Keep `aria-hidden="true"` and `pointer-events-none`. Keep the section's `overflow-hidden` — the outer ring is now *meant* to run off the edges, which is what a contour map does.

**No photograph here.** `BrandPulse.tsx:62-69` is already a full-bleed Unsplash sunrise at `opacity-45` directly above. Two stacked photographic bands closing the page read as a screensaver ending, and a photograph behind an email input is the fastest way to lose the field's boundary. This is the whole graphic budget for the band.

**3 — The field becomes visible.**
All on `NewsletterBar.tsx`. Every ratio is measured against the **lamp peak `#333916`**, the worst ground on the band.

Input (`:111`):
- `border-b border-paper/25` → `border-b-2 border-paper/50`. **2.17:1 → 4.05:1**, well clear of the 3:1 non-text minimum, and 2px is `--r-bar`'s own register ("rails, active underlines", `globals.css:91`).
- `placeholder:text-paper/30` → `placeholder:text-paper/55`. **2.55:1 → 4.68:1**, AA at 16px.
- **Delete `focus:outline-none`.** Do not replace it — `globals.css:620-628` already installs a 2px `:focus-visible` outline at 3px offset for `.on-dark`. The component opted out of a rule the site wrote for it. Keep `focus:border-sage-lit` (was `focus:border-sage`) as the second signal: **6.82:1** on the peak.
- Add `aria-describedby="dispatch-note"`, and `aria-invalid={error ? true : undefined}` (item 4).
- Clearance for the restored ring: 2px outline + 3px offset against `pb-3` (12px) and the 16px flex gap. No clipping.

Fine print (`:121`): `text-[11px] text-paper/40` → `text-xs text-paper/65`. **3.48:1 → 5.69:1**. Add `id="dispatch-note"`.

Label (`:100`): `text-[10px]` → `text-xs`, `text-paper/60` → `text-paper/70` (**8.82:1** near the band's ink-ward top). It stays visible — a phone in daylight, on a dark ground, is not the place to rely on a placeholder as the only label.

Button (`:116`): `text-xs` → `text-[13px]`; `duration-300` → `duration-200` (300ms sits above the 140–260ms micro-motion band); add `min-w-[13.5rem]` (216px) so the `Get the Dispatch` → `Joining…` face swap cannot reflow the row; `'Joining...'` → `'Joining…'`, one glyph rather than three periods. Colours unchanged.

Promise rows (`:81-82`): title stays `text-sm` (14px); detail `text-xs` → `text-[13px]`, `text-paper/55` → `text-paper/65`.

The resulting Archivo ladder is **12 / 13 / 14 / 16** — legal-and-instructional, action-and-detail, name, input — replacing today's 10 / 11 / 12 / 12 / 14 / 16, six sizes inside a 6px band doing four jobs.

**4 — Read the result, and say the true thing.**
Replace `NewsletterBar.tsx:37-48` entirely. Verified against `actions/reviews.ts:128-152`.

```tsx
const [error, setError] = useState<string | null>(null)

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setError(null)
  setLoading(true)
  // subscribeToNewsletter RETURNS { error } — for a Zod failure, a rate-limit
  // block and any Postgres error. It never throws. A try/catch here is dead
  // code, which is why this band congratulated people whose signup failed.
  const res = await subscribeToNewsletter({ email, source })
  setLoading(false)
  if (res && 'error' in res) {
    setError(
      typeof res.error === 'string'
        ? res.error
        : 'That address did not look right. Check it and try again.'
    )
    return
  }
  setSubmitted(true)
}
```

The `typeof` guard is load-bearing: a Zod failure returns `error.flatten().fieldErrors` (`actions/reviews.ts:131`), an **object**, and without the guard `[object Object]` reaches the page. A rate-limit block returns a string (`:136`) and is surfaced verbatim — that is the one case where the server knows something the component does not. **The duplicate-email path is preserved:** `23505` returns `{ success: true, message: 'Already subscribed' }` (`:147`) with no `error` key, so it falls through to `setSubmitted(true)` and still reads as success. Verify that path explicitly.

Render, inside the form branch immediately after the control row's closing `</div>`:
```jsx
{error && (
  <p role="alert" className="mt-3 font-body text-[13px] text-paper leading-relaxed">
    {error}
  </p>
)}
```
`--paper` on the peak is **11.09:1**, so the message needs no colour of its own. The *state* is carried by the boundary instead: when `error` is set, the input's underline swaps `border-paper/50` → `border-clay` — `--clay #B8826B` measures **3.71:1** on the lamp peak and **4.74:1** on flat forest-deep, clearing the 3:1 boundary minimum. Clay, not red: correction on paper, and it is already a palette token (`globals.css:58`). `--ember` was the other candidate and measures **3.01:1** on the peak — too close to the floor to ship.

`role="alert"` interrupts a screen reader mid-sentence. That is correct for a submit failure and **must not be reused** for validation hints.

Also delete the comment at `:44`, which describes behaviour the code does not have.

**5 — A different opening.**
Replace the eyebrow div (`:67-69`) with a rule row that is the grid's first child and spans it:

```jsx
<div className="lg:col-span-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-paper/30 pb-4">
  {stop && (
    <span className="font-mono text-[11px] tracking-[0.06em] text-sage-lit">
      {stop.time} · {stop.alt}
    </span>
  )}
  <span className="font-body text-[10px] tracking-[0.2em] text-paper/70 uppercase">
    {stop ? `${stop.label} — ` : ''}The Trail Dispatch
  </span>
</div>
```

Law 3, finally: **mono carries `21:00 · 2,700M`** — a time and a coordinate — and Archivo names the thing. `stop.alt` is passed into this section today via `app/page.tsx:151` and thrown away unrendered; only `TrailSpine` has ever printed it. Read `stop.time` / `stop.alt` / `stop.label` **directly**, not through `stopEyebrow()` — that helper prints `time · label`, which is a different pair; `lib/trail.ts` stays the source of the values.

Law 5: the band above (`BrandPulse.tsx:73-82`) opens mono-eyebrow-over-display-heading. This is the numbered-rule species, and no two consecutive sections now share one.

Measured on flat forest-deep, which is the ground at the band's top: `--sage-lit` **8.73:1**, `text-paper/70` **7.64:1** (**8.82:1** as the ground ramps to ink), rule `border-paper/30` **2.55:1** — decorative, and up from the 1.33:1 top hairline it replaces. `tabular-nums` is deliberately absent: Space Mono is already monospaced, so the utility does nothing.

The six non-homepage mounts pass no `stop`: the mono span does not render at all (guarded, not an empty span), the row degrades to one Archivo caps line reading `The Trail Dispatch`, and the `flex-wrap` container collapses with no orphaned separator and no stray gap.

Then the h2 (`:70-74`): `mt-4` → `mt-6`; `<span className="italic text-sage">` → `<span className="italic text-sage-lit">`. **5.44:1 → 8.73:1.** `globals.css:41-47` declares `--sage-lit` in so many words as the green "for large type on dark grounds only" — this 48px clause is precisely the case it was written for, and using `--sage` is why the coloured half of the headline recedes from the cream half at 14.19:1. `BrandPulse.tsx:80` repeats the same error one band up; fixing it there is out of this section's scope but should be filed.

**6 — Composition.**
`NewsletterBar.tsx:65`: `items-center` → `items-start`; `gap-12 lg:gap-20` → `gap-12 lg:gap-12`. `:89`: delete `lg:pl-4`. `:103`: `sm:flex-row` → `xl:flex-row`.

`items-center` is what strands the CTA: it centres a ~102px form block against a ~330px promise column, leaving ≈114px of empty ground above and below the 43px control row at 1440. With `items-start` the form's label sits on the heading's first line, and the eye no longer travels down the left column and back up to the right to find the input.

The pinch, measured. Today at 1024: container `min(1152, 1024−80)` = 944; `gap-20` splits it to 432; `lg:pl-4` takes 16 → 416px right column; the button measures ≈200px plus a 16px gap, leaving the `flex-1` input **≈200px, about 22 visible characters** — narrower than the same input at 768 (472px) or at 390 (342px). After: below `xl` the control row stacks (`flex-col`), so at 1024 the input is the full **448px** and the button is full-width beneath it; at `xl`+ the columns are 552px and the row goes inline, giving input = 552 − 216 (`min-w-[13.5rem]`) − 16 = **320px**, about 37 characters. At 768: **688px**. At 390: **342px**. The input is never again narrower on a laptop than on a phone.

The remaining cost, stated honestly: with `items-start` the right column is shorter than the left, so at `lg`+ there is a pocket of ground below the form. Item 7's cut from three promises to two closes most of it — the left column drops from ≈330px to ≈278px against a right column of ≈174px, so the pocket falls from ≈228px to ≈104px — and what is left is the exact region where the lamp falls off toward the footer's ink. Check it at 1280 and 1440 (§6, Q4). Also: at `lg`+ the grid row's height is set by the taller left column, so the form↔receipt swap causes **no reflow at all**; below `lg` the form is the last block in the band, so a shorter receipt only shortens the section. This is why item 8 deletes `min-h-[120px]` rather than inventing a replacement number.

**7 — The copy.**
Delete `DISPATCH_PROMISES[2]` (`:21-24`). "Behind the collections / The inspiration, sketches and stories behind every DEWDROPZ release" is item [1] wearing a different hat — both resolve to "stories" — and it is the only line on the band that shouts the brand name at its own customer.

Heading (`:71-73`):
> **Twelve a year.**
> *Plus the drop nights.*

Fine print (`:122`):
> Twelve issues a year, plus a note the night a batch lands.

Promise 1: title `The drop, before it is public` · detail `Batches run 200 to 500. Subscribers get the link the evening before it goes live.`
Promise 2: title `Where we actually went` · detail `One trail, one photograph, and one thing that went wrong. No affiliate links.`

Success body (`:135-137`):
> Next issue goes out at the start of the month. If a batch lands before then, you hear about it first.

What this fixes. The band currently states its cadence three times — "One email a month" (`:71`), "12 emails a year" (`:122`), "the start of the month" (`:135`) — while promise 1 sells being "the first to know when new collections and limited releases go live", which is **event-timed and cannot be delivered by a monthly digest**. "Twelve a year. Plus the drop nights." states the cadence and names the exception in five words. The 200–500 batch size — the one genuinely scarce commercial fact the band owns — moves out of the source comment at `:10-11` and onto the page. And the success copy stops inventing guides ("whatever the guides broke since the last one") for a print-to-order apparel shop, which is the exact error `BrandPulse.tsx:83-88` records as already having been struck from the band directly above.

**"Unsubscribe anytime with one click" is cut, not reworded** — see §4.

`Twelve a year.` sets in Fraunces, not mono: it is a word, and mono is rationed to figures (`globals.css:270`).

**This heading has a dependency.** See §6, Q1, and the one-line revert there.

**8 — Removals inside the component.** Each argued in §4.
- Success `motion.div` (`:126-132`): delete `className="border border-sage/30 rounded-[var(--r-panel)] p-6"`; add `role="status"`; `initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}` → `initial={{ y: 8 }} animate={{ y: 0 }} transition={{ duration: 0.24 }}`.
- Form `motion.form` (`:96-98`): keep `initial={{ opacity: 1 }} exit={{ opacity: 0 }}`; `duration: 0.3` → `0.2`. Exit opacity is legal — the constraint is on content *entry* — and a transform-only exit under `mode="wait"` makes the form snap rather than leave.
- Delete `min-h-[120px]` (`:90`).
- Delete the `try/catch` and the comment at `:44` (folded into item 4).

**9 — The heading break.** `:72`: `<br />` → `<br className="hidden sm:block" />`, matching `BrandPulse.tsx:81`. Today it fires at every width including 320px, setting two twelve-character lines.

**10 — `source`.** Props become `{ stop, source = 'footer' }: { stop?: TrailStop; source?: string }`, and `:41` uses `source` instead of the literal. No schema change is needed: `newsletterSchema` parses `email` only (`lib/validations.ts:163-165`) and `actions/reviews.ts:145` reads `input.source ?? 'footer'` straight through, so the default preserves current behaviour for any caller that omits it. Then pass a name at each of the seven mounts: `app/page.tsx:152` `"home-dispatch"`; `app/about/page.tsx:38` `"about"`; `app/journal/page.tsx:108` `"journal"`; `app/treks/page.tsx:30` `"treks"`; `app/sustainability/page.tsx:47` `"sustainability"`; `app/collections/page.tsx:95` `"collections"`; `app/collections/[slug]/page.tsx:71` `"collection-detail"`. Historical rows keep `footer`, which is honest — they genuinely cannot be attributed.

**11 — The ring's colour.** `app/globals.css:625-627`: `.on-dark :focus-visible { outline-color: var(--sage) }` → `var(--sage-lit)`. This is already written up as item 8b of `design/01-hero.md` and is recorded as unbuilt. It matters more here than there: on the lamp peak `--sage` measures **4.25:1** and `--sage-lit` **6.82:1**, and this band is where the site's most important focusable object lives. Site-wide change — spot-check every `.on-dark` section.

**12 — Admin control.** `DISPATCH_PROMISES` (`:12-25`) is a module-level const, always exactly two (after item 7). `/admin/homepage` edits `season_kit`, `climb`, `trails`, `stats` and the featured slugs, but cannot change a word of the highest-intent capture on the site. Moving it into `store_settings.home_config` alongside the others is the consistent answer. **P3 and gated** — it also means designing an empty-data path this component has never had (§6, Q7).

---

## 4. Removals, argued

**`border-t border-paper/10` (item 1).** Measured **1.33:1** against its own ground, marking a seam that is itself **1.24:1**. It is a rule doing nothing, and Law 2 is cleaner without it: after item 1 the band is held by its ground, not by an edge, and carries no `border` at all. The lamp's ink-to-ink ramp does the separating, and does it at both seams rather than only the top one.

**The third promise (item 7).** "Behind the collections / The inspiration, sketches and stories behind every DEWDROPZ release" and "Stories from the mountains / Slow travel, hidden places, trail notes" are one promise written twice. Cutting it removes the only line on the band that shouts the brand name, and it is also what rebalances the two columns in item 6 — the copy cut and the layout fix are the same fix.

**"Unsubscribe anytime with one click" (item 7).** This is a legal claim with no mechanism behind it. `unsubscribeFromNewsletter` (`actions/reviews.ts:165`) has **zero callers**; `find app -ipath "*unsub*"` returns nothing — no route, no token, no link. `confirmNewsletter` (`:155`) is likewise uncalled, so `is_confirmed` is false on every row this form has ever written and the admin's CSV prints a `confirmed` column that is permanently "no". Nothing in the repo sends a newsletter at all. The claim ships on **seven pages** today. Cut the sentence until the route exists; building it is Q2, not this pass.

**The success panel's box (item 8).** `border border-sage/30` measures **1.67:1** — decoration nobody can see — and it puts a `--r-panel` 10px object exactly where a `--r-input` 6px one was a moment earlier. Enclosure was inverted: the ask carried nothing and the receipt carried a frame. With it gone the receipt simply appears in the lit pool where the field was, which is also where the eye already is.

**Opacity on the success entry (item 8).** `initial={{ opacity: 0, y: 8 }}` on content entry is the council's named hard constraint. There is no `MotionConfig reducedMotion` anywhere in the repo and neither `prefers-reduced-motion` block in `globals.css` (`:714`, `:1100`) touches this section, so a reduced-motion visitor who submits gets the fade today. Transform-only entry at 240ms — inside the 140–260ms band, down from 400ms — leaves a stalled swap fully legible eight pixels low. `role="status"` is added with it: a screen reader currently hears nothing when the form is replaced.

**`min-h-[120px]` (item 8).** It never reserved either branch: the form measures ≈192px stacked and ≈110px inline, the receipt ≈80px. It is a floor that matches nothing. After item 6 nothing needs reserving — at `lg`+ the taller left column governs the row height so the swap causes no reflow, and below `lg` the form is the last block in the band so a shorter receipt only shortens the section. Deleting it is more correct than replacing the number.

**The dead `try/catch` and its comment (items 4, 8).** The `catch` is unreachable: the action returns rather than throws on all three failure paths. The comment claims "the CTA simply stays available" when the CTA is in fact replaced by "You're on the list." Code that cannot run, beside a comment that contradicts it, is how the next session rebuilds the same bug.

**`focus:outline-none` (item 3).** The component opted out of a ring the site installs for it, four lines below the rule that reads "Never strip the ring without replacing it." It replaced it with a border-colour change on a boundary already measuring 2.17:1 — that is, with nothing.

---

## 5. Killed in judging — on the record

- **Collapse to a single left-ranged 768px column** — adds a **sixth** measure to a page already running 896/1024/1152/1280/1400, and on `/collections` and `/journal` drops from a 1280 measure above to 768 here, a 512px step. That is the exact defect Law 4 names, cited by the proposal that commits it. Its pinch arithmetic was right and survives as item 6.
- **A filled `bg-ink/40` box with a `--r-input` border for the field** — reaches 3.85:1, but turns an editorial underline into an app field on a band whose species is editorial. Item 3 reaches 4.05:1 without the trade.
- **`setError(res.error)` straight into a `string | null`** — a Zod failure returns `fieldErrors`, an object. Item 4's `typeof` guard is what stops `[object Object]` from reaching the page.
- **"Drops sell out in days." as the display heading** (proposed twice) — streetwear scarcity, not a warm, slightly aged Dehradun shop, and a claim that becomes a liability the moment a batch sits. Both proposals conceded it in their own risks. Item 7 fixes the identical contradiction by naming the exception instead of pivoting the band.
- **A full-strength `--dawn` hairline across the top seam** — cheap and it reads, but once the lamp ships, dawn stops being the one accent and becomes the band's theme; and a glowing gradient rule is the most screenshot-common divider of the last five years, which is the "merely tasteful" trap this client keeps rejecting. Item 1 makes the seam out of light instead, at both edges.
- **Delete the contour rings** — its own premise is "nothing visibly changes", offered to a client who responds to what they can see, and it hands over the correct one-attribute fix inside its own fallback clause. Item 2 does something with them.
- **Fix the rings without the lamp** (non-scaling-stroke + `paper/[0.12]`) — correct diagnosis, and it admits 1.4:1 is still deliberately near-invisible. Folded into item 2, which gives the rings a reason to exist.
- **"14 pieces live in High Camp right now" as a live link** — a lovely conceit against a **three-product** catalogue, which is why `ShowcaseRails` is unplugged at `app/page.tsx:138`. It would ship reading "3 pieces live" directly under a heading about batches selling out, and it adds a second destination to a band whose whole job is one ask.
- **A "See what's in stock →" link in the success panel** — placed correctly, in the one state where it cannot split the CTA, but it is an addition to a state most visitors never see, on a band being judged for how it looks.
- **Build `/unsubscribe` with a signed token** — the observation is sharp and the security instinct (a bare `?e=` param is an unauthenticated delete-by-guess against `newsletter_subscribers`) is right, but a new route plus a signing secret plus a send pipeline that does not exist is not fundable inside a pass on one homepage band. Its buried fallback — cut the claim — ships as a removal in §4. Revisit as Q2.
- **A hardcoded mono `12` as the rule row's left anchor** — a cadence count that drifts the instant the copy changes, which item 7 does. `21:00 · 2,700M` reads from `TRAIL_STOPS`, which is what `lib/trail.ts` exists for.
- **An `sr-only` label on the field** — defensible with a placeholder and a named button, but it leaves the control visually unlabelled at rest on a dark band read outdoors. Item 3 keeps the label and fixes its size and contrast instead.
- **Delete `AnimatePresence` and both `motion` elements outright** — the safest resolution of the opacity violation, at the cost of the band's only transition. Item 8 keeps the swap and removes the opacity, which costs nothing more.

---

## 6. Open questions for the client

1. **Do drop-night emails exist?** "Plus the drop nights" (item 7) is the whole argument for the band, and **nothing in the repo sends a newsletter of any kind** — there is no newsletter path in `lib/email.ts`. If the client will not commit to a note on the night a batch lands, the one-line revert is: heading stays `Twelve a year.` alone with no italic clause, promise 1's detail becomes `Batches run 200 to 500, and subscribers see them first.`, and the fine print drops "plus a note the night a batch lands." Do **not** restore the contradiction.
2. **Unsubscribe.** The claim is cut in this pass because the mechanism does not exist. Does the client want the route funded — a signed-token `/unsubscribe` page plus the send pipeline — or is a monthly letter with a reply-to-leave policy the honest version? The answer also decides whether `confirmNewsletter` is ever called, which is why every row's `confirmed` column is permanently "no".
3. **`--dawn` as ground light.** `globals.css:741-742` reserves dawn as a **fill on a control** for Trek Buddy ("the board's is dawn"). Item 1 uses it only as light in the ground and the button stays `bg-paper text-forest`, so the two palettes stay separate — but this is the first time the shop's homepage uses dawn as a surface rather than as a hairline or a label. Confirm the separation reads before it is repeated anywhere else.
4. **The lamp's numbers need eyes.** 0.14 alpha, a 58%/62% ellipse, a 68% falloff, and the two anchor pairs (50%/68% and 72%/44%) are starting values derived from the measured position of the control row. They need looking at, at **1280, 1440 and 1920**: too tight and it reads as a spotlight; too wide and the band just looks lighter. The same eyes should judge whether the pocket of ground below the form at `lg`+ (≈104px after item 7) reads as the lamp falling off or as a gap.
5. **Scope.** Item 10 touches six pages outside section 12 (`/about`, `/journal`, `/treks`, `/sustainability`, `/collections`, `/collections/[slug]`) for a one-word `source` string each. Item 11 changes a site-wide focus-ring colour. Approved?
6. **Two promises or three?** Item 7 cuts to two, which is also what rebalances the columns. If the client wants three, the third must say something the other two do not — not a third synonym for "stories" — and the column balance in item 6 needs re-measuring.
7. **Should the dispatch's copy be admin-editable?** Item 12 is a day's work and it forces a decision this component has never had to make: what the band renders with zero promises, or with five. Today it is always exactly three and cannot be wrong.
8. **`--sage-lit` on `BrandPulse`'s heading.** `BrandPulse.tsx:80` makes the identical 5.44:1 error one band above. Fixing it is outside section 12 but the two headings sit within one screen of each other.

**What I could not specify exactly:** the lamp's alpha and falloff (Q4) — the numbers above are a measured starting point, not a finished value; the exact height of the band after items 6 and 7, which is what `--lamp-y` is derived from, so the two anchors must be re-measured in a browser once both have landed; and whether the field's boundary reads better at `border-b-2` (specified) or `border-b` at a higher alpha — a 1px line at 4.05:1 on a dark ground is a judgement that has to be made with eyes, not arithmetic.

---

## 7. How we will know it worked

**Widths, every time.** 320, 360, 390, 768, 1023, **1024**, 1279, **1280**, 1440, 2560. At every one: the page body never scrolls horizontally; the rule row's mono and its name sit on one baseline and wrap without an orphan; the heading is one line below 640px and two above it (item 9); the input is never narrower than **320px** at any width ≥1024, and never narrower on a laptop than on a phone.

**The lamp, at both extremes.** At 390 the pool must sit under the form, not under the promise list; at 2560 the container stops at 1152 but the lamp is positioned in **band** percentages, so confirm the pool has not drifted into the left margin. Screenshot the seam with `BrandPulse` above and `FooterSection` below in one frame: there must be no visible edge at either boundary, and the band must read as a swell of light, not as a lighter rectangle.

**Degraded states, every time.**
- **`prefers-reduced-motion: reduce`** — complete, still, legible band; the receipt appears with no fade and no slide; the lamp is unaffected (it is a static gradient).
- **A stalled `AnimatePresence` swap** — throttle or break the animation and confirm the receipt is fully legible eight pixels low. No `opacity` key exists on entry after item 8.
- **`forced-colors: active` and print** — the lamp falls back to flat `--forest-deep`, i.e. exactly today's band. Confirm the field's boundary and the button survive.
- **JavaScript off** — all copy is present in the server HTML (client components still SSR), and the form is **inert**: `<form>` has no `action` and the action is called from an event handler. This is a known, unchanged limit, not a regression. Do not claim it is fixed.
- **No `stop`** — load `/about`, `/journal`, `/treks`, `/sustainability`, `/collections` and one `/collections/[slug]`. The mono span must not render at all, the row must read `THE TRAIL DISPATCH` with no leading separator and no stray 16px gap, and the lamp must still centre on the form.
- **Screen reader** — VoiceOver and NVDA: submitting announces the receipt via `role="status"`; a failure announces via `role="alert"`; the fine print is read as the field's description via `aria-describedby`.

**The four submit outcomes, explicitly.** (a) A valid new address → the receipt. (b) A **duplicate** address → still the receipt (`23505` returns `{ success: true }`, no `error` key) — this is the path most rewrites break. (c) A **malformed** address that clears the browser's `type="email"` check → the fixed sentence, never `[object Object]`. (d) **Eleven submits inside ten minutes** → the rate limiter's own string, rendered verbatim, with the underline in `--clay`. In (c) and (d) the button must return to `Get the Dispatch`, not stay disabled.

**Measurements, before and after.** Sample from the live render, on the **lamp peak**, not from the token.

| Object | Today | Target |
|---|---|---|
| Input boundary (`:111`) | 2.17:1 | **≥ 4.0:1** |
| Placeholder | 2.55:1 | **≥ 4.5:1** |
| Fine print | 3.48:1 | **≥ 5.5:1** |
| Success panel border | 1.67:1 | *removed* |
| Display italic clause | 5.44:1 | **8.73:1** |
| Contour rings vs ground | 1.18:1 | **≈ 1.58:1** |
| Contour stroke width | 2.4px | **1.0px** |
| Top seam marker | 1.33:1 | *removed — ink to ink* |
| Focus ring on the input | none | 2px `--sage-lit`, ≥ 3:1 |
| Warm pixels on the band (R > G + 12) | 0.00% | **8–14%** |

**Layout, measured.** Input width at 1024: **200px → 448px**. Empty ground above and below the control row at 1440: **≈114px each → ≈0**. Left/right column heights at 1440: **≈330 / ≈102 → ≈278 / ≈174**. Band height change at 390 after item 7 — confirm the form is still reachable in one thumb-scroll from the bottom of the promise list.

**Keyboard.** Tab from the promise list into the field and confirm the ring is visible on the lit ground; Tab to the button and confirm it is visible on cream; submit with Enter from inside the field; confirm focus is not lost when the form is replaced by the receipt.

**Housekeeping.** Two notes from experience, so nobody loses an afternoon: **the browser pane must be visible** or screenshots come back blank and `innerWidth` reads 0, which makes a correct responsive layout look broken — and **Tailwind v4 auto-detects every file the repo does not gitignore, markdown included** — a class-shaped string in a design document used to be able to 500 every page through `globals.css`. A parallel change in the working tree now guards that with `@source not "../**/*.md"` at `app/globals.css:9`; do not remove it. Independently, every utility named in this file was checked against `@theme inline` (`globals.css:160-227`) — `clay`, `sage-lit` and `dawn` are all mapped — and every arbitrary value here (`text-dawn/[0.26]`, `min-w-[13.5rem]`, `lg:top-[44%]`, `text-[13px]`) is well-formed.
