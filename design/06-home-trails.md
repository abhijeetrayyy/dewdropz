# Trails — Action Plan

*Section 6 of the homepage. Written against `components/sections/HomeTrails.tsx` (183 lines, server component, zero client JS), `app/page.tsx`, `actions/settings.ts`, `lib/constants.ts`, `lib/trail.ts`, `app/admin/homepage/HomepageEngine.tsx`, `components/sections/TrekBuddyBand.tsx`, `components/sections/TrustBand.tsx`, `app/globals.css` on branch `mobile-remediation`. Every line number and every constant below was read out of the working tree. Contrast figures are computed against the composited stack described in each item, worst case, and are marked where they need re-measuring in a browser. Anything I could not specify exactly is in §6, not hidden behind an adjective.*

---

## 1. The verdict

This section has the best raw material on the page and is doing four things wrong with it, and the fourth explains the other three. **It is not actually data-driven.** `normalizeHomeConfig` (`actions/settings.ts:42-52`) rebuilds `home_config` from six named keys and `trails` is not one of them, so every read on both paths (`:125`, `:154`) throws the key away: the storefront always falls back to `DEFAULT_HOME_TRAILS`, the admin editor opens showing zero routes and the message "No routes — the Trails section hides itself entirely" while the live homepage shows four, and the next save of any homepage setting persists a config with no `trails` key at all. A 116-line editor, a type, a migration and a fallback all exist to serve a value that is discarded forty lines into the read path. **The light is painted brown.** The section is called "15:30 · Golden hour" and its warm stop is `rgba(74,45,12,0.72)` — `#4A2D0C`, a mud that is in no token and is not `--dawn`; the brand's one warm accent is meanwhile spent on twenty-two solid `#E39B3F` calendar chips, which makes a data-viz swatch about months the loudest use of the colour reserved for where the light arrives. Because the occlusion is a tint rather than a neutral, five of the section's seven text roles fail AA and fail *unmeasurably*: the `/treks` link at 2.66:1, out-of-season month letters at 2.34:1, "When to go" at 3.38:1, the card meta at 3.87:1, the footnote at 4.11:1 — each of them over whatever JPEG an admin last pasted. **And the words say nothing.** 106 words say "before" three times, never name Uttarakhand, Garhwal, the Himalaya or DEWDROPZ, and the footnote makes a specific legal claim — "one is currently restricted by court order" — about `roopkund`, which is not one of the four cards it sits under and, because the list is editable, cannot be relied on to ever be.

The fix is not more photograph. **This section should stop being a picture with cards on it and become the page's calendar: an instrument that knows what month it is, prints the year as twelve bars under every route, and is lit by a real `--dawn` source rather than tinted brown.** Neutral occlusion does the contrast work so the type holds over any image; a screened `--dawn` ellipse in the upper right does the warmth, so the golden hour is a *light* and not a filter; the headline names the state and the axis in nine words; the month strip loses its twelve ambiguous 8px glyphs and becomes readable at a glance; and the whole thing reads the store's clock, so the homepage in December is a different homepage from the homepage in August. That is the answer to a client who wants ambition and has rejected three moving things: **ambition with no moving parts.** Server-rendered, no JavaScript, no motion, identical for reduced-motion and no-script visitors. Everything below is that idea, itemised.

---

## 2. What stays — do not touch

| | Why it is right |
|---|---|
| **The full-bleed photograph.** `HomeTrails.tsx:52-61`. | This is the page's only photographic band and the one thing that stops eleven paper sections reading as one document. Item 1 relights it; nothing here dims it further. Three stacked scrims is how you get mud, and mud is what makes a photograph look like stock. |
| **The month strip as a device.** The idea, not its execution. | Season is the single most consequential decision on any of these routes, and twelve cells say it faster than a paragraph. It is the one piece of real data on the homepage. Item 3 makes it legible; it does not remove it. |
| **The whole card is one destination.** `guideHref()` at `:45-46` — deep-link when the guide has the route, index when it does not. | Correct: an admin can add a route `/treks` has never heard of, and a link to a list is better than a link to a 404. Item 9 changes the *markup* that carries this, never the rule. |
| **`bestMonths` matched against exact three-letter strings** (`:147`), with `HomeTrail.bestMonths` documented as such (`types/database.ts:740-742`). | Anything else silently fails to light a cell rather than breaking the strip. Item 3's live-month lookup uses `Intl` `month:'short'`, which returns `'Aug'` — the same alphabet, by design. |
| **Copy in server HTML, zero client JS, no entrance animation, nothing ambient.** | Constraints 1–4, already satisfied. Every item below preserves them. There is no `'use client'` in this file and none is added. |
| **The card carries a border and no shadow** (`:116`). | Law 2's border-XOR-shadow rule is already honoured. Item 7 changes the radius token and the fill alpha; it does not add `--shadow-card`. |
| **`stop` arrives as a prop from `TRAIL_STOPS.trails`** (`lib/trail.ts:74`), never as a literal. | That file exists to stop time strings drifting across sections. Item 2 stops calling `stopEyebrow()` but reads every value off the `stop` prop, so drift stays a type error. |
| **`TrailSpine` is not this section's call.** | `HOMEPAGE-COUNCIL.md:137` records it rejected twice; `:143-153` records it back on the page after a revert, and the hero plan's item 7 is explicitly waiting on the client. Item 2 moves this section's own eyebrow out from under it; nothing here removes the HUD. |

---

## 3. The action plan

Table and specs share the same numbering. **Items 1, 2 and 3 alone change what the section looks like and what it says**, on a phone and on a laptop.

| # | Action | What | Why | Effort | Priority |
|---|---|---|---|---|---|
| 1 | update | Light, not mud — the scrim rebuilt as three layers | The warm stop is `#4A2D0C`, a brown tint doing occlusion work; five text roles fail AA against an admin-swappable photograph | 2h + eyes | **P1** |
| 2 | update | The masthead: one measure, a rule that knows the month, nine words that name the place | `max-w-[19ch]` on a wrapper sets the whole masthead in 174px of a 390px phone; the copy says "before" three times and names nowhere | 3h | **P1** |
| 3 | update | The year, as a bar — and the current month marked | Twelve 8px letters at 2.34:1, six of them ambiguous, in a 15.7px cell. The section's one real datum is its least readable element | 3h | **P1** |
| 4 | update | The section becomes data-driven for real | `normalizeHomeConfig` discards `trails`; the admin editor has never once worked | 45m | **P1** |
| 5 | update | One exit, at the foot, where the ground is darkest — and a door to `/rent` | The only CTA is 11px `--dawn` at 2.66:1 in the deliberately unscrimmed third; the section sells nothing and `/rent` has no homepage door | 1h | **P1** |
| 6 | update | The plate becomes a constant, and the bare Unsplash URLs get sized | The same photograph renders full-bleed and again as card 01; four `TRAILS` URLs carry no transform params at all | 1h | P2 |
| 7 | update | One glass species, four tokens, `motion-safe:` | `rounded-[1px]` is off the ladder; the identical panel one section up is `--r-panel`; four transitions have no reduced-motion guard | 1h | P2 |
| 8 | update | Six sizes, three voices | Ten type sizes serving five roles; Space Mono carrying three strings with no figure in them | 1.5h | P2 |
| 9 | update | The card becomes an `<article>` with a stretched link | Four links whose accessible names are ~60 words each | 1.5h + AT pass | P2 |
| 10 | update | The rail, at every width it actually scrolls | At 1023px two cards fill the box, two are off-screen, the scrollbar is hidden and every affordance is `:hover` | 45m | P2 |
| 11 | add | The horizon — an edge event at the top, minus TrustBand's dawn strip | Sections 5 and 6 butt-joint into ~2,200px of continuous dark with no device at the seam | 1h | P2† |
| 12 | update | Zero, one and fifty — design the data states | An empty list leaves `TrailSpine` advertising a chapter with nothing behind it; a new route defaults to `image: ''` | 2h | P2 |
| 13 | remove | Dead code and comments that lie | A pure alias with an eight-line comment describing a selection it no longer performs; a fallback misstated by 2× | 30m | P3 |
| 14 | add | The kit line — one route, one thing to carry | The most persuasive block on the page, where intent is legible down to the month, and it sells nothing | 1 day | P3† |

† Item 11 edits `TrustBand.tsx`; item 14 adds a schema field and two admin inputs. Both are scope questions — see §6, Q5.

---

### The specs

**1 — Light, not mud. Rebuild the scrim as three layers.**

Delete both divs at `HomeTrails.tsx:67` and `:72` and the literals `rgba(74,45,12,0.72)` and `rgba(30,48,22,0.74)` with them. Replace with three `aria-hidden` divs inside `<div className="absolute inset-0 isolate">` (the `<Image>` stays exactly as it is, subject to item 6):

```
(a) occlusion — neutral, does ALL the contrast work
    absolute inset-0
    bg-[linear-gradient(180deg,rgba(12,16,13,0.52)_0%,rgba(12,16,13,0.60)_38%,rgba(12,16,13,0.93)_100%)]

(b) the light — real --dawn #E39B3F, screened so it reads as light on a ridge
    absolute inset-0 mix-blend-screen
    bg-[radial-gradient(ellipse_115%_75%_at_82%_10%,rgba(227,155,63,0.40)_0%,rgba(227,155,63,0.13)_36%,transparent_66%)]

(c) the reading ground — left-weighted as today, but neutral and reaching further
    absolute inset-0
    bg-[linear-gradient(100deg,rgba(12,16,13,0.70)_0%,rgba(12,16,13,0.22)_50%,transparent_74%)]
```

`rgba(227,155,63,…)` is `--dawn` written out because this is an arbitrary-value gradient outside the token's reach — **add a comment naming `globals.css` `--dawn` as the source of truth**, exactly as `01-hero.md` item 3a required for the poster. `rgba(12,16,13,…)` is `--ink`.

The point of the split: today's warm stop is a *tint applied to the occlusion*, so darkening for legibility also browns the photograph, and every extra point of alpha costs another point of mountain. Separating them means (a) can be pushed as far as the type needs while (b) supplies warmth that arrives from a place in the frame — 82% across, 10% down, over the right third the composition already keeps clear.

Computed against the worst case that exists, a pure-white photograph, so these are floors and not averages (arithmetic below; **re-measure in the browser against the real plate before merge**):

| Where | Composited ground | Role | Now | After |
|---|---|---|---|---|
| Masthead, top-left | `rgb(48,51,48)` | `text-paper` h2 | — | **11.7:1** |
| Masthead, top-left | `rgb(48,51,48)` | `text-dawn-soft` | — | **9.6:1** |
| Masthead, top-left | `rgb(48,51,48)` | body `text-paper/80` | — | **8.1:1** |
| Masthead, top-left | `rgb(48,51,48)` | `text-dawn` at 11px | 2.66:1 | **5.5:1** |
| Card interior (ink/45 over mid-band) | `rgb(43,46,44)` | `text-paper` h3 | — | **12.6:1** |
| Card interior | `rgb(43,46,44)` | `text-paper/70` | 3.87:1 (at /45) | **7.0:1** |
| Card interior | `rgb(43,46,44)` | `text-paper/60` | 4.11:1 (at /45) | **5.6:1** |
| Foot, bottom-left | `rgb(17,21,18)` | `text-dawn-soft` | — | **13.8:1** |
| Foot, bottom-left | `rgb(17,21,18)` | `text-dawn` | — | **7.9:1** |

**`isolate` on the wrapper is load-bearing**, not decoration: without it `mix-blend-screen` composites against everything behind the section and interacts with `TrailSpine`'s `mix-blend-difference` (`TrailSpine.tsx:81`, `fixed z-40`, `hidden xl:flex`) — so the failure only appears at ≥1280px, which is exactly the width nobody checks. Test there specifically.

Also add `object-[50%_42%]` to the plate `<Image>` (`:60`). It does not fix the phone crop — that is a box-aspect problem, see §6 Q1 — but it biases the visible slice toward the ridge line rather than the frame's dead centre.

**2 — The masthead: one measure, a rule that knows the month, nine words that name the place.** Four parts.

*2a — the measure.* `:75` `max-w-7xl` → `max-w-6xl`, giving 1152px + `px-10` = **1072px of content**, identical to `TrekBuddyBand.tsx:102` above and `TrustBand.tsx:30` below. Today's 1280px is a 128px jump in and a 128px jump straight back out, across two adjacent boundaries, on the one band where a full-bleed photograph makes the misalignment maximally visible. It also moves the masthead's left edge from x=40px to x=104px at 1280px, out from under `TrailSpine`'s `left-5` HUD.

*2b — the wrapper's fake measure.* `:78` — delete `max-w-[19ch] sm:max-w-2xl` entirely; the wrapper becomes `<div className="min-w-0">`. `ch` on that div resolves against its *inherited* font — Archivo 400 at the browser's 16px, whose `0` advance is 0.573em (read from `mobile/node_modules/@expo-google-fonts/archivo/400Regular`, upem 1000, glyph `0` advance 573) — so 19ch is **174.2px**, and below 640px the eyebrow, the 34px headline *and* the 143-character paragraph are all setting inside 174px of a 342px content box, with 168px of scrim empty beside them. Every other `ch` measure in this repo is on the heading element itself, where the unit resolves at display size (`components/trek/TrekHome.tsx:73`, `app/rent/page.tsx:25`, `app/trek-buddy/people/page.tsx:152`). Put the constraint back where it belongs: `max-w-[11em]` on the `h2`, which resolves in Fraunces at its own clamp — 374px at the 34px floor (inert on a 390px phone) and 660px at the 60px ceiling. Keep `max-w-xl` on the paragraph.

*2c — the opening species, and the live month.* Delete the eyebrow div at `:79-81`. This section currently opens with a mono eyebrow over a display heading, which is **the sixth consecutive section to open that way** and the second at near-identical scale immediately after `TrekBuddyBand.tsx:102-110` — Law 5 says never the same species twice in a row. Replace it with species 3, a rule across the measure, carrying the fact the section is actually about:

In `app/page.tsx`, beside the existing `trails` line:

```
// The store's clock, not the server's. An IST shop on a UTC host would
// otherwise show the wrong month for five and a half hours a day.
const month = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  timeZone: settings.timezone || 'Asia/Kolkata',
}).format(new Date())          // → 'Aug' — the same alphabet as MONTHS
```

`settings.timezone` is on the type at `types/database.ts:783`. Pass `month` as a prop. `export const revalidate = 60` (`app/page.tsx:32`) means the value flips within a minute of local midnight on the 1st, which is correct and cheap.

In `HomeTrails.tsx`, `const openNow = trails.filter((t) => t.bestMonths.includes(month)).length`, then as the first child of the container:

```jsx
<div className="flex items-baseline gap-4 border-t border-paper/25 pt-5">
  <span className="font-mono text-[11px] uppercase tracking-[0.18em] tabular-nums text-dawn">
    {month.toUpperCase()}
  </span>
  <span className="font-body text-[11px] uppercase tracking-[0.14em] text-paper/75">
    {stop.label}
  </span>
  {openNow > 0 ? (
    <span className="ml-auto flex items-baseline gap-2">
      <span className="font-mono text-[11px] tabular-nums tracking-[0.18em] text-paper/85">
        {openNow}/{trails.length}
      </span>
      <span className="font-body text-[11px] uppercase tracking-[0.14em] text-paper/60">open now</span>
    </span>
  ) : (
    <span className="ml-auto font-mono text-[11px] tabular-nums tracking-[0.18em] text-paper/60">
      {stop.alt}
    </span>
  )}
</div>
```

Then `mt-8` on the `h2` instead of `mt-4`.

Three things about this. **The `openNow > 0` branch is load-bearing** — without it, a January page on a summer-only list would assert that something is open when nothing is; the fallback prints the stop's altitude, which is always true. **`stopEyebrow()` stops being called here** — its job is to stop time strings drifting, and that job is preserved because every value is read off the `stop` prop and none is a literal; only the composition differs. Add a comment saying so. **`AUG` and `3/4` in Space Mono is Law 3 satisfied, not bent**: a month abbreviation on a calendar axis is a point in time, the same species as `15:30`, and `3/4` is a count. `Golden hour` and `open now` are words and are in Archivo. This is precisely the distinction the current file gets backwards.

*2d — the words.* Replace `:85-96` in full. The `h2` keeps `font-display text-[clamp(34px,4.8vw,60px)] font-light leading-[1.02] text-paper`, gains `max-w-[11em]` from 2b, and becomes exactly:

> **Uttarakhand,**
> *month by month.*

(`<span className="mt-1 block italic text-dawn-soft">month by month.</span>` — the existing construction, unchanged.) 12ch over 15ch: two lines at every width from 390px to 1152px, no ragged third line, no orphan.

The paragraph keeps `mt-6 max-w-xl font-body leading-relaxed`, flattens `text-sm md:text-[15px]` to a single `text-[15px]`, goes `text-paper/80` → `text-paper/85`, and becomes exactly:

> **We print in Dehradun, where most of these walks start. The strip on each card is the year — amber is the season.**

Two sentences, two jobs. The first states the business, in the one place the council record explicitly leaves open for it ("if the frame is to name the goods, it must be somewhere other than this sentence" — `HOMEPAGE-COUNCIL.md:138`, on the *hero's* line). The second teaches the month strip once, in the masthead, which is what licenses item 3 to delete the "When to go" label from all four cards. What goes: three restatements of "before", and "Curated trails, seasonal insights, and practical notes", which would sit unchanged on any trekking site in India.

Delete the historical comment at `:89-92` — it explains an absence, and the new line has no count in it anyway.

**3 — The year, as a bar. And the section knows what month it is.** Replace `:143-166` entirely.

Delete the `When to go` label div at `:144`. It is the section's clearest Law 3 violation (a phrase, in Space Mono, with no figure in it), it is 3.38:1, and item 2d's paragraph now says the same thing once instead of four times.

```jsx
<div className="mt-6">
  <div aria-hidden="true" className="flex gap-[3px]">
    {MONTHS.map((m) => (
      <span
        key={m}
        className={`h-2 flex-1 rounded-[var(--r-bar)] ${
          trail.bestMonths.includes(m) ? 'bg-dawn' : 'bg-paper/[0.12]'
        } ${m === month ? 'ring-1 ring-inset ring-paper/70' : ''}`}
      />
    ))}
  </div>
  <div aria-hidden="true" className="mt-1.5 flex justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-paper/60">
    <span>Jan</span>
    <span>Dec</span>
  </div>
  <p className="sr-only">
    {trail.bestMonths.length > 0
      ? `In season: ${trail.bestMonths.join(', ')}.`
      : 'Season not set.'}
  </p>
</div>
```

What this fixes, in order of size. **Twelve 8px glyphs go.** Six of the twelve are ambiguous (J×3, M×2, A×2) and the disambiguation lives entirely in `sr-only`, so a sighted visitor cannot read the axis at all; at `max-w-6xl` the desktop card interior is 221px and each cell is **15.7px wide** — an 8px letter in a 15.7px box, at 2.34:1. **The screen-reader paragraph goes.** Twelve `<li>`s each carrying `sr-only` "January — out of season" *plus* an `aria-label` on the `<ul>` saying the same thing (an `aria-label` on a `ul` also suppresses child list semantics in several AT, so the redundant copy is the one that survives) become one `aria-hidden` presentational row and one sentence. **The off-ladder radius goes:** `rounded-[1px]` is not on the ladder at all (legal: 2/3/4/6/8/10/14); `--r-bar` is 2px and is documented for exactly this — "rails, active underlines" (`globals.css:91`). **And the strip becomes readable at a glance:** two amber bars for Valley of Flowers against nine for Kuari Pass, visible without reading anything.

`bg-dawn` stays on the fill and that is the point: a season opening is where the light arrives, which is the one thing the brief says `--dawn` is for. Measured on the item-1 card ground: amber bar vs. out-of-season bar = **4.1:1**, against the 3:1 that WCAG 1.4.11 asks of a non-text graphic. The current-month ring adds a second, non-colour channel to the same information.

**Never animate this row's fill or width on entry.** The amber *is* the data; a stalled transition would leave every season blank, which hard constraint 2 forbids. It is a static row; keep it one.

`month` is the prop from item 2c. The `bestMonths.length > 0` guard matters because `HomepageEngine.tsx:184` defaults a new route to `bestMonths: []`, which would otherwise announce "In season: ." — twelve out-state bars and "Season not set." is the honest rendering.

**4 — The section becomes data-driven for real.** `actions/settings.ts:42-52` — add one line to the object `normalizeHomeConfig` returns:

```
trails: raw.trails ?? DEFAULT_HOME_TRAILS,
```

importing `DEFAULT_HOME_TRAILS` from `@/lib/constants` (it is already the documented fallback — `lib/constants.ts:422`). Add `trails: DEFAULT_HOME_TRAILS` to `DEFAULT_HOME_CONFIG` at `:15-36` too, so a settings row that fails to read does not silently lose the section. `HomeConfig.trails` is already declared optional at `types/database.ts:684`, so nothing else in the type changes.

Then `app/page.tsx:58-59` collapses to `const trails = settings.home_config.trails` and its comment is corrected: the fallback is **four** routes, not "the eight routes that used to be hardcoded" — eight is the size of `TRAILS`, the guide list, and the comment misstates it by 2×.

Nothing visible changes today. That is the point at which it becomes worth doing anyway: the entire premise this section was rewritten on — the DEWDROPZ team adding routes without a deploy — has never once worked, and because `updateStoreSettings` writes `input` raw, the next save of any homepage setting persists a `home_config` with no `trails` key. **Ship item 12's render guard in the same change**: rows written since the editor shipped may hold half-filled routes that were invisible and are about to render. Verify by adding a route at `/admin/homepage`, saving, reloading the editor, and confirming it is still listed.

**5 — One exit, at the foot, where the ground is darkest.** Delete the `/treks` link at `:99-105` from the masthead; delete the footnote at `:176-179`. The masthead then ends on rule → heading → paragraph, and the section ends on its exits.

Why move it rather than dress it. `md:justify-between` parks the section's only call to action at the far right of the masthead — the exact strip scrim (c) withdraws from, because the comment at `:68-71` wants the ridge visible there. It measures 2.66:1 over a bright sky pixel and 5.39:1 over dark rock, so it is non-deterministic as well as failing, and it depends on a photograph an admin can swap. A cream pill would fix the contrast by supplying its own ground, but `TrekBuddyBand.tsx:149` ends the section immediately above on exactly that pill, and two consecutive dark bands closing identically is the Law 5 problem one level up from headings. The bottom-left of this section, after item 1, composites to `rgb(17,21,18)` — where plain `--dawn` measures **7.9:1** and `--dawn-soft` measures **13.8:1**. The contrast problem solves itself by putting the control where the design already put the darkest ground.

Replace the footnote block with:

```jsx
<div className="mt-10 flex flex-col gap-4 border-t border-paper/20 pt-6 sm:flex-row sm:items-baseline sm:justify-between">
  <Link
    href="/treks"
    className="group border-b border-dawn/40 pb-1 font-body text-[11px] uppercase tracking-[0.14em] text-dawn-soft transition-colors duration-300 hover:border-dawn hover:text-paper"
  >
    All {TRAILS.length} routes in the guide{' '}
    <span aria-hidden className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
  </Link>
  <p className="max-w-md font-body text-[13px] leading-relaxed text-paper/60">
    Permits and closures change by season — the guide says which apply, on every entry. Tents, bags
    and spikes are in{' '}
    <Link href="/rent" className="text-dawn-soft underline underline-offset-4 hover:text-paper">
      the gear locker
    </Link>
    .
  </p>
</div>
```

`TRAILS` is already imported at `:4`, so the count is code and cannot go stale — and "All 8 routes" states the size of what is behind the door, which "The full guide" does not. A permanent underline is a real affordance on touch, where all four of this section's current hover states are unreachable.

Two deletions carried inside this. **The court-order sentence goes.** "One is currently restricted by court order" is a specific legal assertion about an editable list, and it is already false as shipped: the only such route is `roopkund` (`lib/constants.ts:374`), which is not among the four default cards and cannot be relied on to ever be. It is the exact failure mode the comment at `:89-92` was written to prevent, reintroduced eighty lines lower. The replacement is true regardless of what is on the page. **And `/rent` gets a homepage door.** It is currently reachable only from `NavBar.tsx:131` and `FooterSection.tsx:63`; the shop rents four-season tents, −10 °C bags, 60L packs, poles and microspikes (`scripts/seed-equipment.mjs:35-49`), and this is the one place on the homepage where intent is legible down to the month. Keep it in body weight and lowercase so it stays subordinate to the guide link — one primary exit per band.

**6 — The plate becomes a constant, and the bare URLs get sized.**

`lib/constants.ts`: `export const TRAILS_PLATE = DAY_ARC.theWayDown` — documented at `:63` as "16:30 — coming down, together", already carrying `?w=2400&q=80&auto=format&fit=crop`, and not one of the four card images. `HomeTrails.tsx:54` → `src={TRAILS_PLATE}`; delete `const lead = featured[0]` at `:40`. Today `featured[0].image` is used twice — full-bleed at `:54` and again as card 01's 22vw thumbnail at `:120` — so the same photograph appears at two scales in one viewport and card 01 reads as a thumbnail of the background rather than a route. It also means an admin reordering the rail silently changes the section's sky. (Note: `theWayDown` is also used by `lib/trekPreviewData.ts:94`, a Trek Buddy preview card on a different page. Acceptable; a purpose-shot golden-hour ridge would be better than either — §6 Q2.)

Then, in the same pass:

```
const sized = (u: string) => (u.includes('?') ? u : `${u}?w=1200&q=80&auto=format&fit=crop`)
```

and wrap the card `src` at `:120`. All four `TRAILS` image URLs are bare Unsplash ids with no transform params (`lib/constants.ts:239, 257, 275, 294`), while every `DAY_ARC` entry is parameterised — and the file's own comment at `:40-44` documents why: without params Unsplash returns a 5000px+ original and `next/image` requests `w=3840` of it, which is what made the hero's LCP a multi-megabyte decode. This is the only item in the plan that fixes a measured performance bug.

**Do not pass a `quality` prop as part of this.** Next 16 changed `images.qualities` to default to `[75]`, and a `quality` prop outside that list is silently coerced to the nearest allowed value (`node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md:788-817`). If a lower quality is wanted on the plate it needs `images: { qualities: [...] }` in `next.config.ts`, which is a site-wide config change — §6, Q5.

**7 — One glass species, four tokens, and `motion-safe:`.**

Radius, all four literals to tokens: `:116` card `rounded-[var(--r-input)]` → `rounded-[var(--r-panel)]`; `:118` photo tile `rounded-[2px]` → `rounded-[var(--r-input)]`; `:128` and `:131` badges `rounded-[2px]` → `rounded-[var(--r-stamp)]` (globals' own comment for `--r-stamp` is "a caption burned into a photograph", `globals.css:92`, which is literally what these two are); `:153` month cells — already handled by item 3's `--r-bar`. Fill `bg-ink/45` → `bg-ink/50`, `hover:bg-ink/60` unchanged. That makes the card's class list identical to `TrekBuddyBand.tsx:167` — `rounded-[var(--r-panel)] border border-paper/20 bg-ink/50 backdrop-blur-md` — apart from the hover, instead of contradicting the identical glass construct twenty pixels above it. Border `border-paper/15` → `border-paper/20`; be honest that this is cosmetic, not load-bearing (it measures 1.86:1 against its own fill, up from 1.58:1) — after item 1 the enclosure is genuinely being done by the ink wash, and the hairline is a seam, not a species.

Spacing. The card currently runs 16 / 4 / 16 / 6 / 14 px between its five blocks, which groups nothing. Photo → `mt-5` h3 → `mt-1` meta → `mt-6` strip → `mt-3` season: 20 / 4 / 24 / 12, so title+meta reads as one unit and strip+season as another. (`mt-6` on the strip is already in item 3's snippet.)

Motion. Add `motion-safe:` to all four transitions — `:126` `motion-safe:transition-transform motion-safe:duration-700 motion-safe:ease-[var(--ease-out)] motion-safe:group-hover:scale-105`, and the same prefix on the 300ms colour transitions at `:116` and on item 5's link. `globals.css` has no global transition kill-switch; its reduce blocks at `:714` and `:1100` name only `.trail-marquee`, `.tb-pulse` and `.tb-rise`, so nothing in this section is currently guarded.

**8 — Six sizes, three voices.** Ten distinct sizes serve about five roles, and Space Mono alone runs 10 / 9.5 / 9 / 8.5 / 8px — five sizes inside one voice, all within 2px of each other, four below the 10px floor where Space Mono's apertures close on a dark ground.

*Mono, one size, 10px.* `:128` and `:131` badges `text-[9px]` → `text-[10px]`, padding `py-1` → `py-[3px]` so the pills do not grow. Item 2c's rule and item 3's Jan/Dec axis are already 11px and 10px.

*Archivo, three sizes — 11 / 13 / 15.*
- `:137-139` the meta line **leaves mono entirely**: `font-mono text-[9.5px] tracking-[0.12em] text-paper/45` → `font-body text-[11px] uppercase tracking-[0.1em] text-paper/70`. This is the Law 3 fix — `Moderate` is a word, not a measurement. 3.87:1 → **7.0:1**.
- `:168` season copy `text-[12.5px] text-paper/60` → `text-[13px] text-paper/70` (→ **7.0:1**).
- `:93` paragraph, and `:176`'s replacement in item 5, at `text-[15px]` and `text-[13px]` respectively — already specified.

*Fraunces, two sizes.* `:136` `text-xl` → `text-[22px] leading-[1.12] md:text-2xl`. Today the card name — the thing a visitor is meant to want — is set 20px, five pixels above the 15px paragraph in the masthead, and reads as body copy.

Stated cost, honestly: moving the meta line to a proportional face puts it next to `tabular-nums` badges, so duration figures no longer align column-to-column across cards. That is a real small loss and it is worth it; the alternative is Space Mono setting the word "Moderate" four times.

**9 — The card becomes an `<article>` with a stretched link.** Today the whole card is one `<Link>` (`:114-169`), so its accessible name concatenates the heading, the meta line, "When to go", twelve month cells with their `sr-only` expansions and the season paragraph — roughly sixty words per link, four times over. Item 3 removes most of that; this removes the rest and unblocks item 14, which needs a second anchor and cannot nest one.

```jsx
<li …>
  <article className="group relative flex h-full flex-col rounded-[var(--r-panel)] border border-paper/20 bg-ink/50 p-4 backdrop-blur-md transition-colors duration-300 has-[a:hover]:border-dawn/50 has-[a:hover]:bg-ink/60 has-[a:focus-visible]:border-dawn/50">
    …photo tile, badges…
    <h3 className="mt-5 font-display text-[22px] leading-[1.12] text-paper md:text-2xl">
      <Link href={guideHref(trail.slug)} className="after:absolute after:inset-0 after:content-['']">
        {trail.name}
      </Link>
    </h3>
    …meta, strip, season…
  </article>
</li>
```

The accessible name becomes the route name. `has-[]` variants need Tailwind v4, which this repo is on. Two cautions: the `group-hover:scale-105` on the photo now needs `group-has-[a:hover]:scale-105`, and the focus ring must be verified — `.on-dark :focus-visible` sets `outline-color: var(--sage)` (`globals.css:625-628`) and a stretched pseudo-element does not carry the ring, so check that focusing the card name shows a visible outline on the *name*, and add `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2` on the `<Link>` if it does not.

**10 — The rail, at every width it actually scrolls.** 768–1023px is the section's broken frame: `sm:w-[46vw]` gets no `md:` override while `md:mx-0 md:px-0` removes the edge bleed, so the rail keeps scrolling but terminates at a hard container edge 40px inside the viewport. At 1023px two 470px cards fill the 943px box and cards 03 and 04 are entirely off-screen behind that edge, with `[scrollbar-width:none]` hiding the scrollbar, no counter, no arrows, and all four affordances being `:hover` states that do not exist on a touch iPad.

`:111` — `md:mx-0 md:px-0` → `md:-mx-10 md:px-10 lg:mx-0 lg:px-0`, so the rail bleeds to the viewport edge at every width where it still scrolls.
`:113` — `w-[74vw] flex-shrink-0 snap-start sm:w-[46vw] lg:w-auto` → add `md:w-[300px]`. At 768px that shows two full cards plus 112px of card 03; at 1023px, three full plus a 35px sliver — enough that a visitor can see there is more.

Leave `lg:grid-cols-4` to item 12, which makes it conditional. Leave the inert `snap-x snap-mandatory` / `snap-start` classes alone at `lg` — they are inert, not wrong, and adding `lg:snap-none` to silence them makes the class list longer to no rendered effect. **Do not `slice(0, 4)` the list** — that is a product regression that directly contradicts item 4.

**11 — The horizon, and one fewer dawn rule at the bottom.** Two `aria-hidden` divs as the first children of the `<section>`:

```
absolute inset-x-0 top-0 z-10 h-px
bg-[linear-gradient(90deg,transparent_0%,rgba(227,155,63,0.12)_16%,rgba(246,220,168,0.8)_62%,rgba(227,155,63,0.22)_86%,transparent_100%)]

absolute inset-x-0 top-0 h-40
bg-[radial-gradient(ellipse_70%_100%_at_62%_0%,rgba(227,155,63,0.18)_0%,transparent_72%)]
```

(`rgba(246,220,168,…)` is `--dawn-soft`.) A line of first light across the top edge, brightest at 62% — the same source as item 1's layer (b), so the horizon and the raking light are one event rather than two decorations. It also puts a device at a seam that currently has none: `TrekBuddyBand`'s bottom-left composites to about `rgb(15,19,16)` and this section's top-left to `rgb(48,51,48)`, which is a butt-joint between two dark photographic bands and about 2,200px of continuous dark on desktop. Law 1's image escape clause is satisfied on paper; the eye is not fooled.

Then **remove the 3px dawn strip at `TrustBand.tsx:20-28`**. This section now closes at `rgba(12,16,13,0.93)` and TrustBand opens on `--paper-warm` `#F1E9D7` — L 0.014 → 0.79, already the largest value edge on the page — and the strip reads as a promo banner sitting on top of it. This edits another section's file; flag it to whoever owns section 7 rather than doing it silently (§6, Q5).

Risk: a 1px gradient can hairline-crack on fractional device pixel ratios. If it does, take it to `h-[1.5px]`.

**12 — Zero, one and fifty.**

`app/page.tsx:117` — wrap the `data-trail-*` div in `{trails.length > 0 && ( … )}`. `HomeTrails` returns `null` at `:38` but its HUD wrapper is unconditional, unlike the guarded siblings at `:99` and `:143` whose own comments state the rule: "a section that stands down has to take its trail chapter with it or the HUD announces a stop that is not there." Today an empty list leaves `TrailSpine` advertising a `15:30 · Golden hour` chapter with nothing behind it.

In `HomeTrails.tsx`:

```
const shown = trails.filter((t) => t.name.trim() && t.image.trim())
if (shown.length === 0) return null
const COLS = ['', 'lg:grid-cols-2', 'lg:grid-cols-2', 'lg:grid-cols-3', 'lg:grid-cols-4'] as const
```

interpolating `COLS[Math.min(shown.length, 4)]` into the `ul` at `:111` in place of the fixed `lg:grid-cols-4`. The literals live in a `.tsx` array so the Tailwind v4 scanner sees them — this repo's memory already records that a class-shaped string in the wrong file type breaks the build, and the inverse (a class name the scanner never sees) fails just as silently.

The `name`/`image` filter exists because `HomepageEngine.tsx:180-192` defaults a new route to `image: ''` with empty name, altitude, duration and season, and a save before pasting a URL ships an empty optimizer request — a 400 in production and a thrown E63 in dev (`node_modules/next/dist/shared/lib/image-loader.js:85`). **Silently filtering hides the admin's mistake**, so pair it with a line in HomepageEngine's Trails card: *"A route without a name and a photograph is not shown on the homepage."*

Cap the rail at eight and end a longer list with a tile rather than thirteen ragged rows: `const more = shown.length - Math.min(shown.length, 8)`, and after the map,

```jsx
{more > 0 && (
  <li className="hidden lg:block">
    <Link href="/treks" className="flex h-full flex-col items-center justify-center gap-2 rounded-[var(--r-panel)] border border-dashed border-paper/25 p-4 transition-colors duration-300 hover:border-dawn/50">
      <span className="font-mono text-2xl tabular-nums text-dawn">+{more}</span>
      <span className="font-body text-[11px] uppercase tracking-[0.14em] text-paper/70">more routes in the guide</span>
    </Link>
  </li>
)}
```

Also add `aria-hidden="true"` to the scrim divs from item 1 — the identical construct in `TrekBuddyBand.tsx:87, 96` already carries it and this file's does not.

**13 — Dead code and comments that lie.** Delete `const featured = trails` (`:36`) and the eight-line comment above it (`:27-35`) describing a selection the code no longer performs; read `trails` (or `shown`, after item 12) directly at `:38`, `:40`, `:112`. Correct `app/page.tsx:58` — the fallback is four routes, not eight (already carried in item 4). Note in a comment that `MONTHS` is declared twice, here at `:7` and at `HomepageEngine.tsx:24`, kept in sync only by a comment (`HomepageEngine.tsx:21-23`) and exported from neither — exporting one and importing it in the other is the fix, but the admin editor is not this section's file, so raise it rather than reach in (§6, Q5). Delete the comment at `:50-51` claiming the section's ground is `bg-forest-deep`-visible; it is 100% occluded by the plate and is a blur/failure ground only, which is worth saying accurately rather than not at all.

**14 — The kit line.** Under each route, one line: *"Spikes for the snow →"*, pointing at the gear locker.

`types/database.ts` `HomeTrail`: add `kit?: { label: string; href: string } | null`. `lib/constants.ts` `DEFAULT_HOME_TRAILS`: kedarkantha → `{ label: 'Spikes for the snow', href: '/rent/microspikes' }`; har-ki-dun → `{ label: 'A 60L pack for six days', href: '/rent/sixty-litre-pack' }`; valley-of-flowers → `{ label: 'Poles for wet ground', href: '/rent/trekking-poles' }`; kuari-pass → `{ label: 'A −10 °C bag', href: '/rent/down-sleeping-bag' }`. All four slugs exist (`scripts/seed-equipment.mjs:35-49`) and `app/rent/[slug]` exists. `HomepageEngine.tsx`: two inputs per route beside "Guide slug".

Rendered last in the card, inside item 9's `<article>`:

```jsx
{trail.kit && (
  <Link
    href={trail.kit.href}
    className="relative z-10 mt-3 inline-flex items-center gap-1.5 self-start font-body text-[11px] uppercase tracking-[0.14em] text-dawn transition-colors duration-200 hover:text-paper"
  >
    {trail.kit.label} <span aria-hidden>→</span>
  </Link>
)}
```

`--dawn` on the card ground measures **5.9:1** after item 1. This is P3 and last for a reason: it is the only item in the plan that adds a schema field, two admin inputs, and a second anchor inside a stretched-link card — which is exactly where cards develop dead zones and mis-targeted taps on touch. Two mitigations are not optional: the admin field must be a **select over `getRentalItems()`, not free text**, or an admin will point it at a 404 that is worse than `/treks`; and a blank `kit.href` must fall back to `/rent`. Test the tap targets on a real phone, not an emulator.

---

## 4. Removals, argued

**The court-order footnote (item 5).** "Some routes need permits, and one is currently restricted by court order" is a specific legal assertion about a list an admin can edit from a web form. It is already false on the default set — the only such route is `roopkund` (`lib/constants.ts:374`), which is not among `DEFAULT_HOME_TRAILS` (`:422`) — and it is one save away from being false in a different way. This is the exact failure the comment at `:89-92` was written to prevent, reintroduced eighty lines lower in the same file. It is also the section's third-lowest-contrast string at 4.11:1. The replacement in item 5 is true regardless of what is on the page.

**The body paragraph (item 2d).** "Curated trails, seasonal insights, and practical notes to help you discover your next adventure — before you take the first step." Twenty-four words, three brochure nouns, no fact, and it restates the headline's own metaphor for the third time in 106 words. It would sit unchanged on any trekking site in India. Nothing is lost that anyone could name.

**"When to go" (item 3).** A phrase in Space Mono with no figure in it — the clearest Law 3 violation in the section — at 8.5px and 3.38:1, repeated four times. The masthead paragraph now teaches the device once. Four labels become one sentence.

**The twelve month glyphs (item 3).** `J F M A M J J A S O N D`: six of twelve ambiguous, 8px, 2.34:1, in a 15.7px cell at desktop, with the disambiguation only in `sr-only` — so the axis is unreadable to a sighted visitor and a paragraph to a screen reader. What a visitor loses is the ability to point at a specific month without counting; what they gain is the ability to see, without reading, that Valley of Flowers has two months and Kuari Pass has nine. That is the comparison the strip exists to make.

**`max-w-[19ch]` (item 2b).** A design token hiding a broken mobile masthead. It resolves against inherited 16px Archivo, not the 34px Fraunces below it, so it is 174px — half a phone — and it snaps to full width in one step at 640px because `sm:max-w-2xl` (672px) is itself inert until ~720px. The constraint is not deleted, it is moved to the element where the unit means what it looks like it means.

**The `/treks` link's position (item 5).** Not the link — its address. It is currently pinned to the one part of the frame the code deliberately leaves unprotected, in the section's smallest type, at a ratio that depends on which pixel of an admin-uploaded photograph lands behind it. Moving it to the foot buys 7.9:1 for free, out of the composition rather than out of a third scrim.

**`const featured = trails` (item 13).** A pure alias, with an eight-line comment above it describing an editorial selection the code stopped performing. Every reference could read `trails`. A comment that explains behaviour the file no longer has is worse than no comment, because the next reader trusts it.

**TrustBand's 3px dawn strip (item 11).** It exists to make a value edge that, after this section closes at 0.93 ink against `--paper-warm`, is already the largest on the page. Two devices at one seam, and the strip is the one that reads as a promo banner.

---

## 5. Killed in judging — on the record

- **A photograph a phone can see, at `58vh`** — FATAL. On iOS Safari a `vh`-sized photographic band grows and shrinks as the URL bar collapses, so the seam between photograph and gradient moves under the reader's thumb on every scroll. That is unresolved, uninvited, permanent motion of the section's largest edge — hard constraint 4 failing in the most visible place on the page, and it reads as a rendering bug, not as design. The *diagnosis* survives as §6 Q1.
- **A third scrim layer over the masthead band** — three stacked scrims plus the existing brown tint is how you get mud, in the section whose entire stated purpose is being the page's one photographic moment. Item 1 delivers the same contrast from a stack that is neutral by construction rather than by patching. The proposal's own card-border change conceded it reached only 1.86:1.
- **`bg-paper/85` in-season month cells (dawn leaves the calendar)** — it buys contrast for glyphs that item 3 deletes anyway, and once the letters are gone only cell-versus-cell separation matters, which amber against `paper/[0.12]` has in abundance. What remains is a twelve-cell cream strip that is the brightest element in the card, brighter than the `h3` — a progress bar, not an outdoor guide. A season opening is exactly where the brief says `--dawn` belongs.
- **A solid `--dawn` pill beside the guide link** — a third button species on a page whose established filled control is the cream pill at `TrekBuddyBand.tsx:149`, twenty pixels above this section. Two exits in one masthead also splits the attention the heading needs. Item 5 keeps one primary exit and solves the contrast by location.
- **A cream `bg-paper` pill in the masthead** — right species, wrong adjacency: the section immediately above closes on that exact pill, so two consecutive dark bands would end identically. Superseded by item 5.
- **The altitude rule — `15:30 ——— GOLDEN HOUR ——— 3,900M` with two `flex-1` hairlines across the photograph** — handsome, and a legitimate species rotation, but two rules laid across a photograph read as a horizon whether or not the crop has one; on a lead image with a real skyline near that height it looks like a registration error. It also runs the full 1152px measure while the heading below sits in a 672px column. Item 2c takes the same species with less exposure and gives the rule something true to carry.
- **`role="img"` on the month strip with a `JAN`/`DEC` legend** — the same idea as item 3, rendered slightly worse: `role="img"` on a div where an `aria-hidden` row plus one `sr-only` sentence is simpler. Its one catch — the empty `bestMonths` guard — was taken into item 3.
- **`slice(0, 4)` on the trail list** — a product regression that contradicts item 4 directly: an admin adds a fifth route and it silently vanishes, in the same file as the change that exists to make added routes appear at all. Item 12's cap-at-eight-plus-a-tile does the layout job without the lie.
- **`lg:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]`** — with two routes it yields two ~590px cards whose 5:4 photo tiles become enormous. Item 12's explicit `COLS` array is deterministic at every count.
- **`lg:snap-none` / `lg:snap-align-none` to silence the inert snap classes** — makes the class list longer to no rendered effect. They are inert, not wrong.
- **A per-card "In season" tag beside the `h3`** — at `max-w-6xl` the card interior is 221px; "Valley of Flowers" plus a tag wraps badly, and item 3's current-month ring already says the same thing in the place the visitor is already reading. The rule and the ring survive; the tag does not.

---

## 6. Open questions for the client

1. **The phone crop.** At 390px this section runs about 1080px tall, so the plate is a 0.36-aspect box: `object-cover` shows a ~24%-wide vertical slice of a landscape ridge at roughly 4× magnification, which reads as texture rather than as a mountain. The `vh`-band answer is killed (§5). The honest options are (a) accept it, with item 1's `object-[50%_42%]` biasing the slice toward the ridge; (b) give the photograph a **fixed-aspect band** — e.g. `aspect-[4/5]` at the top of the section with the cards below it on flat `--ink` — which changes the section's silhouette on phones and is a bigger design decision than a remediation; (c) ship a separate portrait crop as a second source. I can specify (b) or (c) exactly once the client says which shape they want. **Not specified here on purpose.**
2. **The plate photograph.** Item 6 hardcodes `DAY_ARC.theWayDown` (16:30) under a 15:30 label — close enough that nothing contradicts, but it is a stock descent, not a golden-hour ridge, and it also appears on a Trek Buddy preview card. Is a purpose-shot DEWDROPZ frame available? If the team wants an admin lever back instead, it is one `home_config.trails_plate?: string` field and one input — but I would not add it speculatively.
3. **"Uttarakhand, month by month."** A one-word first line is a bigger swing than the sentence it replaces. It also makes a claim: it holds for both Garhwal and Kumaon and for all four default routes, but a Himachal or Ladakh route added at `/admin/homepage` would falsify it. Acceptable, or should the line name the range rather than the state?
4. **The live month.** The section will genuinely be a different section in December, and it cannot be screenshotted deterministically in August. That is the whole point of item 2c and item 3, and it is also the thing a client may be surprised by the first time a marketing screenshot does not match the site. Confirmed?
5. **Scope beyond this section.** Item 4 edits `actions/settings.ts`; items 4 and 12 edit `app/page.tsx`; item 11 deletes a strip in `TrustBand.tsx`; items 12, 13 and 14 add copy or inputs to `app/admin/homepage/HomepageEngine.tsx`; item 6 may need `images.qualities` in `next.config.ts`. Approved as one change, or split?
6. **`--dawn` on the bars.** Item 3 keeps amber as the season fill and item 5 puts `--dawn-soft` on the guide link, so the section spends the brand's one warm accent in two places. Is the calendar the right home for it, or should the bars go cream and the warmth live only in the light and the exit? One-line revert either way.
7. **The kit line (item 14).** It is the only sentence in this section that connects a mountain to something you can pay for, and it is also the highest-risk item on the list. Worth a day, or is item 5's in-prose gear-locker link enough of a commercial door for now?

**What I could not specify exactly:** item 1's dawn ellipse peak (0.40 at 82%/10%) is tuned for a mid-key frame and needs an eye on the real plate — a very dark photograph will show it as a visible glow rather than as light on a ridge; every contrast figure in this document is arithmetic against a pure-white worst case and must be re-measured from the live render before anyone claims AA; and item 11's 1px horizon may hairline-crack on fractional DPR, which is a browser observation, not a calculation.

---

## 7. How we will know it worked

**Widths, every time.** 320, 360, 390, 640, **768**, **1023 and 1024** (the rail's grid flip), 1280, 1440, 2560. At every one of them: the page body never scrolls horizontally; the masthead uses the full content width below 640px (the 174px ribbon is gone); the `h2` sets as exactly two lines, `Uttarakhand,` over `month by month.`, never one and never three; and at 768 and 1023 **part of a third card is visible** without hovering anything.

**Degraded states, every time.**
(a) **JavaScript off** — the section is complete: this file has no `'use client'` and must still have none. Every word, the month rule, the bars and both exits are in the server HTML.
(b) **`prefers-reduced-motion: reduce`** — a complete, still, legible section; confirm the four `motion-safe:` transitions from item 7 do nothing, and that the month bars have never been given an entry animation of any kind.
(c) **Touch, no hover** — the guide link's permanent underline is visible; the card is tappable across its whole area (item 9's stretched link); if item 14 shipped, tap the kit link and then tap 4px beside it and confirm the two go to different places.
(d) **Image fails to load** — with `images.unsplash.com` blocked in devtools, the section still reads: `bg-forest-deep` under three scrims, all type legible, no layout shift.
(e) **≥1280px** — `mix-blend-screen` is contained by `isolate` and does not interact with `TrailSpine`'s `mix-blend-difference`; the masthead rule starts at x=104px, clear of the HUD at `left-5`.

**Data states, all five.**
- **Zero routes** — `/admin/homepage`, delete every route, save. The section returns `null` **and** `TrailSpine` no longer advertises a `15:30 · Golden hour` chapter (item 12's guard at `app/page.tsx:117`).
- **One route** — a single card in `lg:grid-cols-2`, not marooned beside three empty columns.
- **A half-filled route** — add a route, save before pasting an image URL: no 400 from the optimizer, no E63 in dev, the route simply does not render, and the editor says why.
- **Nine routes** — eight cards plus a `+1 more routes in the guide` tile at `lg`; the sub-`lg` rail scrolls.
- **`bestMonths: []`** — twelve out-state bars and the screen reader hears "Season not set.", never "In season: ."

**The one that proves item 4.** Add a route at `/admin/homepage`, save, **reload the editor**, and confirm it is still listed — then reload the homepage and confirm it is on it. This has never worked. Then save an unrelated homepage setting and confirm the trails are still there afterwards.

**Measurements, before and after.** Sampled from the live render at 390 and 1440, in that order, against the real plate — not against the white worst case:

| Element | Today | Target |
|---|---|---|
| Guide/exit link | 2.66:1 (non-deterministic) | ≥ 7:1, deterministic |
| Out-of-season month cell vs in-season | 2.42:1 (text) | ≥ 3:1 (graphic) |
| Card meta line | 3.87:1 | ≥ 4.5:1 |
| Season paragraph | 5.81:1 | ≥ 4.5:1 |
| Foot line | 4.11:1 | ≥ 4.5:1 |
| Eyebrow / rule | — | ≥ 4.5:1 |

Plus: **warm-pixel share** of the section at 1440×900 (`R > G + 12`) before and after item 1 — the mechanism swaps a brown tint for a `--dawn` light and the number should rise, not fall; and **plate transfer size** before and after item 6's `sized()` wrapper, which is the only measured performance claim in the plan.

**Accessibility pass.** Run a links list of the homepage: the four Trails links must be named by their route, not by sixty words. Tab through the section with the ring visible at every stop, including the stretched card link. Confirm the month strip is announced once, as one sentence, and that no `aria-label` remains on a `<ul>`.

**Type and token audit.** `grep` the file for `rounded-[` and confirm every remaining value is `var(--r-…)`; count distinct `text-[` sizes and confirm six, not ten; confirm no `font-mono` string in the file lacks a figure except the calendar-axis tokens `AUG`, `Jan`, `Dec` and `3/4`, which are argued in item 2c.

**Housekeeping.** Two notes from this repo's own history, so nobody loses an afternoon: **a mobile check needs a full relaunch** — a stale bundle looks identical to "my change didn't work" — and **the browser pane must be visible** or screenshots come back blank and `innerWidth` reads 0, which makes a correct responsive layout look broken.
