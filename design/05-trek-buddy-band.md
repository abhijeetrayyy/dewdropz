# Trek Buddy — Action Plan

*Section 5 of the homepage. Written against `components/sections/TrekBuddyBand.tsx` (229 lines), its neighbours `components/sections/DesignYourOwn.tsx` and `components/sections/HomeTrails.tsx`, `components/trek/TrekLanding.tsx`, `actions/trekBuddy.ts`, `actions/trekAdmin.ts`, `lib/trail.ts`, `lib/constants.ts`, `app/globals.css`, `app/page.tsx` and `supabase/migrations/*` on branch `mobile-remediation`. Every line number and every contrast figure below was computed against the working tree, not recalled. Where I could not specify a value exactly, it is in §6, not hidden behind an adjective.*

---

## 1. The verdict

This band is a photograph nobody can see, at midnight, in the middle of the afternoon, selling a free product it never says is free, through two doors that both lead to a login form. Four measurements carry the whole diagnosis. **The picture is not there:** `opacity-45` under a vertical scrim at 0.72 and a horizontal scrim running 0.80→0.10 leaves composite transmittance of 5.6% under the type column and 11.3% at its brightest edge — the composited ground measures **1.01:1 to 1.11:1 against flat `--ink`**, so the section pays a full-bleed 2400px `sizes="100vw"` request, on cellular, for a rectangle indistinguishable from a colour. **The clock is wrong and so is the ground:** the wrapper at `app/page.tsx:112` stamps this stop `11:00 · Who is coming`, between `08:30` on `--paper` and `15:30` golden hour, and the section renders it on `--ink`, the token `globals.css:57` labels *night* — so the page's day arc reads midday → night → golden hour, and because `--ink` against `--forest-deep` measures **1.24:1**, sections 05 and 06 are not two bands at all but one unbroken ~1,800px slab of dark. **The words do not teach:** 186 words and ten chips, in which the visitor is never named, "free" appears **zero** times, and the 32-word paragraph spends its budget on "Individuals, hosts, adventure companies and communities" — a stakeholder list from a pitch deck. **And the doors are shut:** `/trek-buddy/people` redirects every signed-out visitor to `/auth/login` (`app/trek-buddy/people/page.tsx:91`), while the primary button prints `See what is on` — verbatim the destination page's own primary button (`TrekLanding.tsx:110`), which itself goes to `/auth/login?redirect=/trek-buddy`. A stranger clicks the same six words twice and arrives at a sign-in form.

The fix is not a better scrim. It is to **make section 05 the page's noon** — the one bright, flat, unlit band on the homepage, with the board's live state set down on it as a single solid dark object — **and to spend its first thirty words teaching the mechanism instead of narrating a community.** Invert the ground to `--paper-deep`, delete the photograph and both scrims that were hiding it, open with the day-arc rule instead of a third identical eyebrow, state in Fraunces the one thing no other board of this kind does — *you ask, the host says yes, then the address arrives* — and give the section two doors a person with no account can actually walk through. Everything below is that idea, itemised.

---

## 2. What stays — do not touch

| | Why it is right |
|---|---|
| **The three rules, and their order.** `TrekBuddyBand.tsx:57–70` — meeting point, host chooses, no contact details. | Every claim is backed in the schema: meeting-point release at `055_trek_expeditions.sql:44–46` and `components/trek/PlanRail.tsx:200–215`; contact refusal at `056_trek_moderation.sql:54, 128–144, 210–211`, including the leetspeak-normalising `trek_squeeze`/`translate`. Nothing here overstates what the platform does — which on a page of marketing bands is rare and is the section's whole asset. Item 9 shortens the prose; the three claims and their sequence are untouched. |
| **The refusal to invent a number.** The comment at `:163–165` and the `walks === 0` branch at `:187`. | Correct instinct, wrong rendering. Item 5 keeps the principle absolutely and only stops setting the absence at 36px twice. |
| **Reading counts live, server-side, with the service key.** `:31–35`, `createAdminSupabaseClient()`, three parallel queries under `revalidate = 60` (`app/page.tsx:32`). | The key choice is deliberate and documented against migration 063, where `anon` lost profile reads because that read was returning customer emails and dates of birth. Item 6 changes *which* query runs, never where it runs or which client runs it. |
| **The section is server HTML with no client component and no JavaScript.** | Hard constraint 1, and it is currently satisfied perfectly. Nothing below adds a `'use client'`, a hook, or a byte of JS. |
| **No choreographed moment here.** Two `transition-colors` and nothing else. | Law 6 gives the page one moment and the hero owns it. Item 4 brings the two transitions into the 140–260ms band; it does not add a third. |
| **`italic` as the emphasis half of the headline.** `:113`, and `HomeTrails.tsx:88` does the same. | It is a *synthesised* oblique — Fraunces is declared with `axes:['opsz']` and no italic style (`app/layout.tsx:49–54`) — and that is deliberate and load-bearing brand, recorded at `HOMEPAGE-COUNCIL.md:139` ("Loading Fraunces Italic — blocked"). Do not "fix" it, and do not remove it from 05 alone; that would leave 06 the only italic on the page. |
| **`lib/trail.ts` as the single source of the clock.** | Item 3 makes this section *start* obeying it. The file exists because four sections once contradicted the wrapper directly above them; 05 is the last brief-ordered section still hand-writing its own eyebrow. |

---

## 3. The action plan

Table and specs share the same numbering. Items **1, 2 and 3 alone change what this section looks like from across the room** — the ground goes from night to noon, the board's state becomes a solid object sitting on it, and the first thing anyone reads becomes the mechanism instead of a slogan.

| # | Action | What | Why | Effort | Priority |
|---|---|---|---|---|---|
| 1 | update | **Noon.** Ground inverts to `--paper-deep`; the photograph and both scrims are deleted; measure goes `max-w-6xl` → `max-w-7xl` | Composited image = 1.11:1, so nothing is lost; `--ink` vs `--forest-deep` = 1.24:1, so 05 and 06 are currently one slab; the page narrows 208px for one section and widens 128px again | 3h | **P1** |
| 2 | update | **One dark object.** The "Right now" panel becomes solid `--ink` on shadow, no border, no blur — the only dark rectangle on a daylight band | Law 2 (never border *and* shadow); the `backdrop-blur-md` is blurring a field that measures 1.05:1; and one dark instrument on warm paper is the felt idea | 1.5h | **P1** |
| 3 | update | **Species 3 opening.** A hairline across the measure carrying `11:00 · Who is coming` and `4,400M`, then the mechanism in four lines of Fraunces | 04, 05 and 06 all open species 1 today (Law 5) and 05 is the middle one; it is also the only brief-ordered section that hand-writes its eyebrow instead of printing `stopEyebrow(stop)` | 1h | **P1** |
| 4 | update | **Two doors a stranger can walk through.** Secondary → `/trek-buddy/safety`; primary label stops duplicating the destination's own button; radius onto the ladder; 300ms → 200ms | 100% of cold traffic on the second link hits `/auth/login`; the first link prints the next page's button verbatim so the click appears to do nothing | 45m | **P1** |
| 5 | update | **An empty board stops shouting a zero.** Three panel states; no numerals when there is nothing to count | Today's board is the launch board: the two largest objects in the section after the headline are `0` and `0` at 36px, above a 24-word apology | 1.5h | **P1** |
| 6 | update | **One set of numbers**, computed once and shared with the page this links to | The band's member predicate is strictly tighter than `getBoardPulse()`'s, so the homepage prints a number ≤ the one a click away, always, and the labels differ too | 1.5h | **P1** |
| 7 | add | **The chip list becomes true.** A migration for the three kinds that were never inserted, `revalidatePath('/')`, and the gate moved to the filtered list | On a database built from migrations alone the section renders 7 chips and "7 kinds of outing" under a brief that promises ten — and `092:62` asserts the opposite | 1h | **P1** |
| 8 | add | **The fourth rule** — the one that says why an apparel brand runs a walking board | Nothing in ~900px of storefront explains the connection, and the honest answer is already enforced in SQL | 30m | P2 |
| 9 | update | The three rules at 55 words instead of 90 | Three `dd` strings of 26, 29 and 28 words are the bulk of the phone stack | 30m | P2 |
| 10 | update | On a phone, the instrument comes before the ask | Below `lg` the proof stacks last: ~1,470px at 390px with the two live numbers at the bottom | 1h | P2 |
| 11 | update | Chips onto the radius ladder; the eleventh list item stops being Space Mono | `rounded-full` is not on a ladder that tops out at 14px; `+ name your own` is mono carrying no figure | 30m | P2 |
| 12 | remove | Dead comments, the orphan seed file, the lying docblock | 18 lines of comment describing code that is gone or copy that is replaced; a seed file nothing reads; a constant captioned 04:40 by headlamp that is Patagonia at noon | 45m | P3 |

---

### The specs

**1 — Noon.**

*1a — the ground.* `TrekBuddyBand.tsx:73`: `className="on-dark relative overflow-hidden bg-ink"` → `className="relative overflow-hidden bg-paper-deep"`. Dropping `.on-dark` returns `:focus-visible` from `--sage` to `--forest` (`globals.css:625–628`), which measures **7.41:1 on `--paper-deep`** — correct. The band keeps `relative overflow-hidden` because item 2's shadow and item 3's rule both need the containing block.

Ladder check, both seams: `--paper` (L 0.9138) → `--paper-deep` (L 0.7033) is **1.28:1**, one full step, so Law 1 is satisfied against `DesignYourOwn` above with no rule needed. `--paper-deep` → `--forest-deep` is **11.09:1**, which is the seam into golden hour this page has never had. For comparison, today's `--ink` → `--forest-deep` seam is **1.24:1**.

*1b — the photograph and both scrims go.* Delete the `<Image>` at `:74–82` and both `aria-hidden` scrim divs at `:85–100`, and drop `BLUR_DATA_URL, DAY_ARC` from the import at `:3` (`lib/constants.ts` keeps both — `DAY_ARC.theStart` still has two consumers at `TrekLanding.tsx:121` and `app/trek-buddy/setup/page.tsx:57`, and `BLUR_DATA_URL` is used across the page). Argued in §4. No replacement texture: this band becomes the page's one flat unlit surface and item 2's dark object is the thing on it. `ContourLines` is deliberately **not** added — `DesignYourOwn` runs it at `opacity-[0.13]` directly above, and two consecutive contour bands is drift, not a system. See Q4.

*1c — the measure.* `:102` `max-w-6xl` → `max-w-7xl`. Padding is unchanged: `px-6 py-24 md:px-10 md:py-32`. Content width at 1440 goes 1072 → **1200**, which is what `DesignYourOwn.tsx:42` and `HomeTrails.tsx:75` both already run, so the 208px inset followed by a 128px outset across two hard colour cuts disappears.

*1d — the type inverts.* Eight values, every one measured on `#E7D9BE`:

| Element | Today | Becomes | Measured |
|---|---|---|---|
| eyebrow → stop rule (item 3) | `text-sage` | `text-forest` | **7.41:1** |
| `h2` cream half `:109` | `text-paper` | `text-text` | **13.15:1** |
| `h2` emphasis half `:113` | `italic text-sage` (6.74:1) | `italic text-forest` | **7.41:1** — a 1.77× split, down from 2.6× |
| body paragraph `:127` | `text-paper/75` | `text-mid` | **5.78:1** |
| `dt` `:138` | `text-paper` | `text-text` | 13.15:1 |
| `dd` `:139` | `text-paper/70` | `text-mid` | **5.78:1** |
| `dl` rules `:135` | `divide-paper/12 border-t border-paper/20` | `divide-rule-warm border-t border-rule-warm` | 1.24:1 hairline — the token exists for exactly this (`globals.css`: "rules that sit on paper-warm / paper-deep") |
| primary CTA `:149` | `bg-paper text-ink hover:bg-sage` (hover 2.6:1) | `bg-forest text-paper hover:bg-forest-mid` | **9.48:1**, hover **5.84:1** |
| secondary `:156` | `border-b border-paper/25 text-paper/65` | `border-b border-forest/30 text-forest hover:text-forest-mid` | text 7.41:1, hairline 1.64:1 — byte-identical to `DesignYourOwn.tsx:74`, one section above |

*1e — `--dawn` stays out of 05, on purpose.* 11:00 is not where the light arrives. `HomeTrails` owns dawn in four places (`:79`, `:87`, `:101`, `:154`) one screen below; spending it here costs 06 its entrance. `--dawn` on `--paper-deep` measures **1.67:1** in any case, so it could only appear as a fill, never as type.

*1f — the left column gets one measure.* Add `max-w-[36rem]` (576px) to the `<dl>` at `:135`, which is uncapped today and sets the full 592–816px column while the `h2` and paragraph above it are capped at `max-w-xl` — the paragraph's right edge lands 96–240px short of the rules'. With `sm:w-52` → `sm:w-44` (176px) at `:138`, the `dd` fixes at 576 − 176 − 32 = **368px** at every width from `sm` up, instead of swimming from 352px to 448px with no breakpoint between. The `h2` keeps its own cap because a display line and a body measure are two roles, not five — see item 3.

Column arithmetic after 1c, with the grid from item 10: at **1024** viewport, 1024 − 80 padding − 64 gap − 340 aside = **540px** text column; at **1280 and up** the container caps, so 1200 − 64 − 340 = **796px**. The left column's content stops at 576px in both cases, so the 220px of air at 1440 between the paragraph's right edge and the instrument is a gutter, not dead space — `DesignYourOwn` already runs exactly this idiom (`max-w-7xl` container, `max-w-2xl` left block, link floated right).

---

**2 — One dark object, not one dark band.**

`:167`: `rounded-[var(--r-panel)] border border-paper/20 bg-ink/50 p-6 backdrop-blur-md` → `on-dark rounded-[var(--r-panel)] bg-ink p-6 shadow-[var(--shadow-panel)]`.

Three things happen. The border-**and**-shadow collision is retired in favour of shadow + radius, which Law 2 assigns to a panel. The `backdrop-blur-md` goes: composited, the panel interior today is (19,22,19), **1.05:1 against pure ink** — a full-bleed compositing layer and a blur pass spent blurring a flat field. And `--ink` on `--paper-deep` measures **13.75:1**, so the instrument reads as an object set down on a table rather than a rectangle drawn on a dark wall.

Inside it, all measured on `--ink`:

- Figures `:174`, `:180`: `font-mono text-[40px] leading-none tabular-nums text-paper` → `text-sage-lit`, **10.82:1**. This is the token's stated role — `globals.css`: "for large type on dark grounds only".
- Labels `:176`, `:182`: `font-body text-[13px] text-paper/70`, **8.84:1**. Up from `text-xs` (12px).
- Row dividers `:179`: `border-t border-paper/15` (1.48:1), replacing `/12` (1.35:1).
- `Right now` `:168–170` stops being Space Mono carrying no figure (Law 3) and becomes the heading the `<aside>` has never had: `<h3 id="tb-now" className="font-body text-[11px] font-medium uppercase tracking-[0.18em] text-paper/85">` — **12.75:1** — with `aria-labelledby="tb-now"` added to the `<aside>` at `:166`.

`.on-dark` is scoped to the panel alone, so a focus ring inside it is `--sage` (6.74:1 on ink) while the rest of the section rings `--forest` (7.41:1 on paper-deep). **Be honest about this:** nothing inside the panel is focusable today, so this is precautionary and costs nothing; it becomes load-bearing only if a link ever lands in there. Nothing else on the page pairs `.on-dark` with a light parent — the selector is `.on-dark :focus-visible`, a plain descendant, so it will work, but check it once.

**Fallback if the ink slab out-shouts the three rules beside it:** step the fill to `bg-forest-deep`. Contrast stays within one step in every direction — `--forest-deep` on `--paper-deep` is **11.09:1**, `--sage-lit` on `--forest-deep` is **8.73:1**.

The chip block below it (`:195–223`) stays on the paper ground, not inside the instrument: the instrument is the numbers, and the kinds are a list. Its label `:197` takes the same treatment as `Right now` but in the section's daylight voice: `<h3 className="font-body text-[11px] font-medium uppercase tracking-[0.18em] text-mid">` with the count alone in `<span className="font-mono tabular-nums">`. Mono then survives in this section on exactly three strings, all of them figures: the stop's time, the altitude, and the panel's numerals — plus the count in that `<span>`.

---

**3 — Species 3, and thirty words that teach the product.**

*3a — the section takes its stop.* Add a `stop: TrailStop` prop (importing `stopEyebrow` and the type from `@/lib/trail`) and pass `stop={TRAIL_STOPS.trekBuddy}` from `app/page.tsx:113`, exactly as `:107` and `:118` already do for its two neighbours. This is the last of the six brief-ordered sections still hand-writing its eyebrow.

*3b — the opening becomes a rule across the measure.* Delete the `<p>` eyebrow at `:105–107`. In its place, above everything:

```
<div className="flex items-baseline justify-between gap-6 border-t border-rule-warm pt-4">
  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-forest">{stopEyebrow(stop)}</p>
  <p className="font-mono text-[11px] tracking-[0.2em] text-mid tabular-nums">{stop.alt}</p>
</div>
```

That prints `11:00 · WHO IS COMING` on the left and `4,400M` on the right, both mono, both carrying a figure, which is Law 3 satisfied and Law 5's third species used. Tracking is `0.2em`, matching **both** neighbours (`DesignYourOwn.tsx:50` and `HomeTrails.tsx:80`) instead of today's orphan `0.28em`. The altitude is the coordinate `TrailSpine` prints — and `TrailSpine` is `hidden xl:flex`, so this is the first time a phone ever sees it.

*3c — the headline states the mechanism.* `:109–114`. Delete the 5-line comment at `:110–112` (it defends a decision item 3 supersedes) and replace the heading:

```
<h2 className="mt-7 max-w-[16ch] text-balance font-display text-[clamp(34px,4.6vw,56px)] font-light leading-[1.04] text-text">
  You ask to come. The host says yes.{' '}
  <span className="italic text-forest">Then the address arrives.</span>
</h2>
```

Three beats, in the type that is supposed to speak, stating the one thing no other board of this kind does. It replaces "The hills are better with someone else." — which is the generic line the component's own comment at `:18–24` says it refused to write, with hills in it, and which misreads besides ("someone else" scans as substitution, not company). `max-w-[16ch]` is the **display** measure and is the section's one deliberate second width; `max-w-[36rem]` from item 1f is the body measure. Two widths, two roles, stated. The exact `ch` value is a wrap judgement that must be made in a browser — see §6.

*3d — thirty words that name the product.* Delete the 11-line comment at `:116–126` and replace the paragraph at `:127–131`:

```
<p className="mt-6 max-w-[36rem] font-body text-[15px] leading-[1.65] text-mid">
  TrekBuddy is the free DEWDROPZ board for walks, camps and stargazing runs around
  Dehradun — post yours, or ask to join somebody else’s.
</p>
```

23 words, against 32 today, and they do four things the current 32 do not: they name the product, say it is free (the word appears **zero** times in the section today, in a band whose whole job is selling a free thing), name three of the ten kinds so the prose finally says what an outing *is*, and say where. The stakeholder list — "Individuals, hosts, adventure companies and communities" — goes; the visitor was not in it. `TrekBuddy` closed, matching `TrekLanding.tsx:99` and the `/trek-buddy/safety` metadata, which are the two places a visitor actually reads the name — but the repo is split 31/49 on this, so see Q1.

---

**4 — Two doors a stranger can walk through.**

*Secondary, `:154–159`:* `href="/trek-buddy/people"` → `href="/trek-buddy/safety"`, label `Who is out there` → `How a walk stays safe`. Verified: `app/trek-buddy/people/page.tsx:91` is `if (!membership.signedIn) redirect('/auth/login?redirect=/trek-buddy/people')` and that page is `robots: { index: false, follow: false }` (`:16`); `app/trek-buddy/safety/page.tsx` has no membership call, sets a canonical, and carries a specific `Allow: /trek-buddy/safety` in `app/robots.ts` that beats the blanket `Disallow: /trek-buddy/`. It is also the full-length version of the three rules the visitor has just read, so it is the right onward door and not merely the reachable one.

*Primary, `:147–153`:* keep `href="/trek-buddy"`, delete the conditional at `:151`, label becomes the single string **`Look at the board`**. `See what is on` is verbatim `TrekLanding.tsx:110`'s own primary button, so today the visitor clicks those six words and is shown them again over a link to a login form. Keep the `↗` and its `aria-hidden`.

*Both:* `rounded-full` → `rounded-[var(--r-input)]` (6px — `rounded-full` is not on the ladder, which tops out at `--r-shell` 14px), keeping `px-7 py-3.5` so the box stays **≈44.5px** tall, above the 44px target. `transition-colors duration-300` → `transition-colors duration-200 ease-[var(--ease-out)]` on both `:149` and `:156` — 300ms is outside the stated 140–260ms band and neither link uses an ease token today.

The colours for both come from item 1d. Note honestly: `/trek-buddy/safety` is a lower-intent second door than a people directory would be *if that directory were public*. The real fix is a signed-out state for `/trek-buddy/people`, which is a product decision about anonymous read policy and is out of this section's scope.

---

**5 — An empty board stops shouting a zero.**

Today, on the board as it exists, the two largest objects in the section after the headline are the numeral `0` at 36px Space Mono, twice, above a 12px apology that has to talk the visitor back out of what they just shouted. The instinct — never invent a number — is right; setting the absence at the section's second-largest type size is a typographic decision that makes a young board look abandoned rather than honest.

Branch the panel body (`:172–192`) into **three** states, and delete the `walks === 0` note at `:187–192`, which the second and third replace:

1. **`walks > 0`** — figures render, as specified in item 2, driven by item 6's data.
2. **`walks === 0 && people > 0`** — no walk numeral. `<p className="font-display text-[22px] leading-[1.25] text-paper">The board is open and empty.</p>`, then `<p className="mt-3 font-body text-[13px] leading-relaxed text-paper/75">Nothing here is invented. The first walk on it will be somebody’s real Saturday.</p>` (10.04:1), then the member figure **alone**, at the full 40px, because members are real evidence and there is no reason to hide them: `{people}` over `{people === 1 ? 'member' : 'members'}`.
3. **`walks === 0 && people === 0`** — the same two sentences and **no numerals at all**.

This closes the hole in the version this came from, which interpolated `{people}` into the zero-state sentence and so rendered "and 0 people are already signed up to see it" on a brand-new board — a second zero, in prose, in the sentence written specifically to avoid one.

`member` / `members` matches `TrekLanding.tsx:157` and replaces `person has joined` / `people have joined` (`:182`), which is the second of the two ways this panel currently disagrees with the page it links to.

---

**6 — One set of numbers, computed once.**

The band filters members on `trek_display_name` **and** `trek_terms_at` **and** `trek_suspended_at` (`:44–49`); `getBoardPulse()` (`actions/trekBuddy.ts:484–487`), which feeds the destination's own counter, filters on `trek_display_name` alone. The homepage number is therefore always ≤ the number one tap away, and strictly smaller the moment anybody half-onboards or is suspended.

**Fix it in `getBoardPulse`, not in the band** — adopting the looser predicate would make the homepage start counting suspended members. Add to `actions/trekBuddy.ts:485–487`:

```
.not('trek_terms_at', 'is', null)
.is('trek_suspended_at', null)
```

Then delete the two hand-rolled queries at `:38–49` and call `const [pulse, kinds] = await Promise.all([getBoardPulse(), getTrekKinds()])`. The band reads `pulse.open`, `pulse.weekend`, `pulse.members`, `pulse.completed`.

The panel then carries up to four rows in the existing `space-y-5`, each divided by `border-t border-paper/15 pt-4`, and **the two that are zero on a young board are gated on `> 0`**:

| Row | Gate | Label |
|---|---|---|
| `pulse.open` | always (item 5 governs the zero state) | `walk on the board` / `walks on the board` |
| `pulse.weekend` | `> 0` | `leaving this weekend` |
| `pulse.members` | always (item 5 governs) | `member` / `members` |
| `pulse.completed` | `> 0` | `walk already happened` / `walks already happened` |

So today's board shows one row and a sentence; a working board shows four figures that argue — what is on, what leaves this weekend, who is here, and the only evidence anyone actually turns up. All four labels are `TrekLanding.tsx:151–163`'s, verbatim, so the two pages can no longer print different words for the same integer.

**Cost, stated:** `getBoardPulse` selects plan rows rather than a head count, so this is a heavier query than the two it replaces. It already runs per request on `/trek-buddy`, and the homepage caches for 60s (`app/page.tsx:32`), so the cost is bounded — but re-check if the board ever passes a few thousand open plans.

---

**7 — The chip list becomes true.**

`092_client_brief_23aug.sql:62` states: *"The homepage's chip list filters it out, so the visitor still counts ten."* On a database built from migrations alone the visitor counts **seven**. `057_trek_platform.sql:83–100` INSERTs exactly eight keys — `trekking`, `bird_watching`, `cycling`, `running`, `stargazing`, `camping`, `expedition`, and the open-ended `other` — and `092:41–46` only `UPDATE`s `heritage_walk`, `snow_trek` and `photography`, which is a no-op when the rows are absent. `092:22–24`'s own claim that "a later pass added the rest" is false; the only definitions of those three live in `supabase/seed/kinds.json`, and `grep -rn "kinds.json"` across the repo returns **nothing** — no code path, no script, no `package.json` task.

*7a — the migration.* `supabase/migrations/103_trek_kinds_backfill.sql`. Three `INSERT`s with the full column set `057` requires (`key, label, blurb, day_part, start_min, start_max, default_start, default_back_by, ends_next_day, min_party, needs_night_note, is_open_ended, sort`), `ON CONFLICT (key) DO NOTHING`. Hours and blurbs from `kinds.json`; the label `Photography walk` and the sorts **70 / 80 / 100** from `092:41–46`, not `kinds.json`'s `Photo walk` (and note `kinds.json` carries no `sort` and no `is_open_ended`, so it could not be replayed as-is). `DO NOTHING` matters: an admin who deliberately switched one of these off in `/admin/trek-buddy` must never have it overwritten. The migration's header records the correction to `092:62` — **do not edit `092`**; it is applied.

*7b — the admin's lever can invalidate the page it changes.* `actions/trekAdmin.ts:272–273` revalidates `/admin/trek-buddy` and `/trek-buddy/new` but not `/`. Add `revalidatePath('/')`. `/admin/trek-buddy` → Kinds is the **only** admin control over this entire section — `home_config` (`types/database.ts:659–684`) has no Trek Buddy keys at all — and today it cannot invalidate the homepage; the change waits out the 60s window.

*7c — the gate moves to the filtered list.* Hoist `const shown = kinds.filter((k: TrekKind) => !k.isOpenEnded)` above the return, gate `:195` on `shown.length > 0` instead of `kinds.length > 0`, and map `shown` at `:208–217`. Today, if every active kind is open-ended, the gate passes and the block renders **`0 kinds of outing`** above a list containing nothing but `+ name your own`.

*7d — delete `supabase/seed/kinds.json`.* Argued in §4.

---

**8 — The fourth rule, which is the one that names the shop.**

The section is ~900px of the fifth band on a storefront with no link to a product, a collection or `/shop`, and it never explains why an apparel brand runs a walking board. The honest answer is already enforced in SQL and is the kind of thing nobody could invent. Add a fourth entry to the `RULES` array at `:57–70` — **no markup change**, the existing `<dl>` renders it:

> **k:** `Nothing on a profile is typed`
> **v:** `Five facts sit on every member: email confirmed, walks hosted, walks joined, vouches from people who were actually there, and whether a DEWDROPZ parcel has been delivered to you. Ordered does not count. It has to have arrived.`

Verified at `supabase/migrations/054_trek_people.sql:201–211`: the profile row is built from `EXISTS (SELECT 1 FROM auth.users WHERE email_confirmed_at IS NOT NULL)`, `EXISTS (SELECT 1 FROM orders o WHERE o.user_id = p.id AND o.status = 'delivered')`, and counts over `trek_plans`, `trek_plan_requests` and `trek_vouches`. Delivered, not ordered — the migration's own comment says "an unpaid pending order proves nothing."

**The risk is misreading it as pay-to-be-trusted, and the wording above is the defence:** it is listed fifth of five and framed as a fact that cannot be typed, not as a benefit. **Do not reword it into an incentive** — that rewrite is the one that turns it into the thing it is defending against.

Then add a third item to the CTA row at `:146` (already `flex-wrap gap-x-6 gap-y-4`, so it wraps cleanly at 390px), styled as a second quiet link identical to item 4's secondary, label **`What we make`**, `href="/shop"`. If the client rejects the fourth rule, the `/shop` link ships regardless — it is the only path from this band to anything purchasable.

Cost: the fourth row adds ≈90px to the left column, which is already the taller of the two.

---

**9 — The three rules at 55 words.**

Replace the three `v` strings at `:60`, `:64`, `:68` — 26, 29 and 28 words become 17, 25 and 19:

1. `Not on the board, not in the listing. It reaches confirmed walkers once enough people are going.`
2. `You ask to come; nobody is added. Every walk is one person choosing who they spend the day with, which is the only vetting a board like this can honestly offer.`
3. `Phone numbers, emails and handles are refused in every free-text field. Everything is arranged on the walk’s own page.`

Rule 2 **keeps** "which is the only vetting a board like this can honestly offer" — it is the most self-aware sentence in the file and the section's credibility rests on it; rules 1 and 3 pay for it. `dt` at `:138` gains `font-medium` so it stops relying on colour alone to separate from the `dd`, and both go `text-sm` (14px) → `text-[15px]` with `leading-[1.6]` on the `dd`, matching the body paragraph's size from item 3d.

---

**10 — On a phone, the instrument comes before the ask.**

Below `lg` the grid collapses in DOM order, so a 390px visitor reads eyebrow → headline → paragraph → ~110 words of rules → **both CTAs** → and only then the two numbers that say the board is alive. Measured stack today: 96 pt + ~92 h2 + 130 para + 453 dl + 80 wrapped CTA row + 48 gap + ~236 panel + ~180 kinds + 96 pb ≈ **1,470px**, 2.2 phone screens, with the payload at the bottom.

Split the two grid children into **four**, and place them explicitly at `lg`. Outer grid at `:103`:

```
grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_auto] lg:gap-x-16 lg:gap-y-0
```

| Child | Contents | Placement |
|---|---|---|
| 1 | stop rule, `h2`, paragraph, `<dl>` | `min-w-0 lg:col-start-1 lg:row-start-1` |
| 2 | `<aside>` — the instrument only | `lg:col-start-2 lg:row-start-1 lg:pt-2` |
| 3 | the CTA row | `flex flex-wrap items-center gap-x-6 gap-y-4 lg:col-start-1 lg:row-start-2 lg:mt-10` |
| 4 | the kinds block | `lg:col-start-2 lg:row-start-2 lg:mt-8` |

Phone order becomes text → **instrument** → CTAs → kinds. Crucially the chip block is child 4, *not* part of the aside: putting ten pills between the argument and the buttons is distance, not proof. At `lg` and up the render is the same composition as today with the aside's two halves now on two rows.

Check at exactly **1024**, where the aside is a hard 340px against a 540px text column, that row 2 does not open a gap under a short instrument — it will not, because both row-2 children are content-height, but look at it. Keep the item 5 branches inside child 2 only, so the two code paths stay visibly separate.

---

**11 — Chips onto the ladder; the eleventh item stops being mono.**

`:211–216`: `rounded-full border border-paper/20 px-2.5 py-1 font-body text-[11px] text-paper/75` → `rounded-[var(--r-tag)] border border-forest/25 px-2.5 py-1 font-body text-[12px] text-forest`. `--r-tag` is 4px and is the ladder value for "micro cost / difficulty tags"; `rounded-full` is not on the ladder at all. On `--paper-deep`, `--forest` type is **7.41:1** and the `forest/25` hairline is 1.5:1.

`:218–220`: `<li className="self-center font-mono text-[10px] text-paper/60">+ name your own</li>` → `<li className="self-center font-body text-[12px] text-mid">or name your own</li>` (**5.78:1**). Space Mono carrying a call to action is Law 3's clearest violation in the file. It stays plain text rather than becoming a link: `/trek-buddy/new` is auth-gated, and item 4's whole argument is that this section stops handing strangers login forms.

With items 2, 3 and 11 landed, the type ladder in this section is **11 caps label / 12 chip / 13 panel label / 15 body / 40 mono figure / display clamp(34–56)** — six sizes, down from ten — and there are exactly two trackings with a stated rule: **0.14em on interactive faces** (site-wide, matching `DesignYourOwn.tsx:81` and `HomeTrails.tsx:104`) and **0.18–0.2em on caps labels and the stop rule**.

---

**12 — Dead comments, the orphan seed, the lying docblock.**

- Delete `:200–206` — seven lines documenting a `.slice(0, 9)` bug and a count/list mismatch the code no longer has. It documents a fix, not the code.
- Delete `:116–126` (11 lines defending a paragraph item 3d replaces) and `:110–112` (5 lines defending a headline item 3c replaces) — both already listed in items 3c/3d; noted here so the count is honest.
- Delete `:83–84`, the scrim comment, with the scrims.
- Delete `supabase/seed/kinds.json` (item 7d).
- Rewrite `lib/constants.ts:56`. The docblock reads `/** 04:40 — two figures leaving the treeline by headlamp. The hero. */`; the file at that URL is two walkers under a white overcast sky at the Cuernos del Paine, Chile, whose top strip averages RGB (209,214,224), L=0.67. It is neither 04:40, nor headlamps, nor the hero — `SummitHero` does not use it. While in the file, correct `theRidge` at `:58` (documented "11:00 — the ridge walk, two on the line"; it is Horseshoe Bend, Arizona) and `firstLightPair` at `:61` (documented "a second pair of eyes on the same sunrise"; it is an empty jetty with nobody in it, under a file comment at `:50–53` insisting every image has people in it "deliberately"). **Descriptions only — do not change a URL**, because three other components render these files.
- Fix `app/page.tsx:110–111`, which calls this section "the hero's third act" — item 16 of the hero plan proposes cutting that act, and the comment is already the second place on the page asserting it.

---

## 4. Removals, argued

**The photograph and both scrims (item 1b).** Composited from the real pixels, the ground this band actually renders runs (13,17,14) to (25,28,26) against pure `--ink` (12,16,13): **1.01:1 under the headline, 1.11:1 at its very best**. The section pays a full-bleed 2400px request with `sizes="100vw"` — so a 390px phone downloads a full-width plate on cellular — for something no visitor can distinguish from a flat colour. It is also the **same file** as the header of the page this band links to (`TrekLanding.tsx:121`, `priority`, `aspect-[4/5]`, real alt text), so the one visible consequence today is that clicking through repeats a photograph the visitor never actually saw. Its own constant captions it 04:40 by headlamp while the wrapper stamps this stop 11:00, and `HomeTrails.tsx:50` calls itself "the page's only full-bleed photograph" while this is a second one — deleting it makes that comment true. **The council's alternative was to hold it at full strength in the aside with a caption; that is killed in §5,** because the caption proposed for it was near-verbatim `TrekLanding.tsx:135–138`'s, so the visitor would read the photograph and the sentence, click the button beneath them, and land on the identical photograph and the identical sentence.

**"Who is out there" and `/trek-buddy/people` (item 4).** A marketing band on a public homepage sending 100% of its cold traffic into a login screen, at a page that is `robots: index: false`, with nothing in the copy, the label or the underline styling warning of a wall. The cost is real and worth stating: that link is the section's only signal that this board has members with faces. If the client wants it back it belongs as a signed-in-only link or a plain sentence, not as a headline-adjacent CTA.

**The `walks > 0 ? … : …` conditional on the primary label (item 4).** Two labels for one door, one of which duplicates the destination page's own primary button verbatim. `Look at the board` is true in both states.

**Space Mono on `Trek Buddy · Dehradun and around`, `Right now` and `+ name your own` (items 2, 3, 11).** Six mono strings in the section; three of them carry no figure, and the one string here that legitimately *is* a figure — the trail stop — is the one mono refuses to print. Law 3 gives mono a number, a time, a count or a coordinate. After items 2, 3 and 11 it has exactly those.

**`supabase/seed/kinds.json` (items 7a, 7d).** Nothing in the repo reads it — no import, no script, no task. It is the only definition of three kinds the board is supposed to offer, plus eight that `092:51–56` switches off, and it labels `photography` "Photo walk" where `092:45` renames it "Photography walk". Once item 7a puts those three rows in a migration, the file is a second, disagreeing definition of the same data with no reader — which is exactly how the seven-versus-ten discrepancy happened in the first place. Delete it in the same commit as the migration, not before.

**`rounded-full`, twelve times (items 4, 11).** One CTA plus ten chips plus a stray, against a ladder whose top value is `--r-shell` 14px. The chip row also mixes species today: ten bordered pills and one unenclosed mono string in the same flex list.

**The `backdrop-blur-md` on the panel, and its border (item 2).** A compositing layer and a blur pass over a field that measures 1.05:1, inside a shell that carries a border *and* wants to be a panel. Law 2: a card by a shadow, a panel by shadow + radius, never a border and a shadow.

---

## 5. Killed in judging — on the record

- **Hold `DAY_ARC.theStart` at full strength as a captioned figure in the aside** — the frame is already `/trek-buddy`'s own hero (`TrekLanding.tsx:121`) and the proposed figcaption was near-verbatim its figcaption (`:135–138`). Continuity is not copy-paste, and this is the kind of thing a client who has rejected three proposals spots in five seconds. The instinct — one honest plate rather than a washed one — survives as item 1b's *deletion*.
- **Replace the photograph with a `--forest` radial + `ContourLines`** — a single 120%×85% radial of `rgba(39,72,31,0.55)` across a full-bleed dark band stair-steps on 8-bit panels and 0.06 contours is thin cover; and it keeps the band dark, which is the actual defect. Superseded by item 1.
- **Delete the entire 320px aside and set the three rules as three columns** — fixes the measure by deleting the section's only object, on a band whose whole job is "this board is real and live". Its `sm:grid-cols-3` also means three ~190px columns of 13px body between 640 and 768px, roughly 28ch, five or six ragged lines each.
- **A visible ledger of three live figures across the opening rule** — right register, wrong today: it renders a 24–28px `0` as the first thing in the section, directly above a note explaining the zero. The species-3 opening survives as item 3b with the stop and the altitude on the rule and the numbers in the instrument, where item 5 can govern them.
- **Shrink the whole band to a short strip when the board is empty** — a band that shrinks when it has nothing to say is a genuinely rare idea, but it duplicates the `<Image>` and both scrims across two branches in one file, and it deliberately drops the three rules from the empty branch. On an empty board the safety model is the *only* thing the section has to sell; a visitor arriving today would leave never having learned the one thing that distinguishes this board.
- **`bg-ink/50` → `bg-ink/72` on the panel** — the sharpest single observation in the council (the panel's smallest type sits on the least-scrimmed third of the frame, so its contrast varies with the crop) and moot the instant the scrims go. Superseded by item 2's solid fill.
- **Un-pill the ten kinds into one dotted run-in line** — quieter, and it would print a count this plan has proved false; "a sentence makes the wrong count less prominent, not more correct" is not an answer when item 7a shows the fix is three `INSERT`s.
- **Delete the chip block entirely** — it removes the admin's only lever on the section (`home_config` has no Trek Buddy keys), after which the copy needs a deploy to edit. That is a product decision wearing a design proposal's clothes, and its own fallback ships the wrong count in mono.
- **Append live per-kind counts inside each chip** (`pulse.byActivity`) — legal mono on a body label and it would make the list read as a board, but it pushes a ten-item row in a 340px column toward five rows, and "at fifty spread across ten it reads busy, which is the good problem" is not a plan. Revisit once the board has walks; the data is already in hand after item 6.
- **Replace the primary label with "Join the board — free"** — asks for commitment from somebody who has not yet seen a walk, and "What the board enforces" is a colder label for `/trek-buddy/safety` than item 4's. Same idea as item 4 with less of the craft.
- **Delete the secondary link outright and replace it with a plain-text "Join free" at 13px** — the hierarchy argument is right and item 4 takes it a different way; shipping the word "free" twice on the homepage also needs Q3 answered first.
- **Move the member count out of the panel and into prose so the two pages cannot print different integers** — prose still prints an integer, it just prints it less prominently. The real fix is the shared predicate, which is item 6.
- **Turn "+ name your own" into a link to `/trek-buddy/new`** — auth-gated, so it reintroduces the exact login wall item 4 exists to close. It becomes plain text instead (item 11).

---

## 6. Open questions for the client

1. **`TrekBuddy` or `Trek Buddy`?** The repo is split — 31 closed, 49 open — and the open form is mostly comments while the two places a visitor reads the name (`TrekLanding.tsx:99`, the `/trek-buddy/safety` title) are closed. Item 3d writes it closed. One word, one decision, then it is enforced everywhere.
2. **The band stops printing its stop as an eyebrow and prints it on a rule instead, with the altitude beside it.** That is Law 5's third species and it is the fix for three consecutive identical openings — but it is also the first time any section has printed `stop.alt`. Does the altitude belong in the page or only in the HUD?
3. **"Free", on the homepage.** Item 3d ships the word once. Confirm no paid tier is planned for TrekBuddy before it goes into server HTML on the front page.
4. **Texture on the new noon band.** Item 1b leaves it deliberately flat, because `DesignYourOwn` runs `ContourLines` at `opacity-[0.13]` directly above and two contour bands in a row is drift. If flat reads cheap on a large display, the options are `ContourLines` at a *different* opacity, a very low `--forest` radial, or nothing. This needs eyes at 1440 and 2560.
5. **The fourth rule (item 8).** Does "whether a DEWDROPZ parcel has been delivered to you" read as the honest reason an apparel brand runs a walking board, or as pay-to-be-trusted? The wording is built to resist the second reading and must not be softened into an incentive.
6. **The ink instrument.** `--ink` on `--paper-deep` is 13.75:1 — a strong object. Is that the "instrument set down on a table" we want, or does it out-shout the three rules beside it? One-line step-down to `bg-forest-deep` (11.09:1) if the latter.
7. **`/trek-buddy/people` for signed-out visitors.** Item 4 routes around the login wall. The better fix is a public, anonymised state for that page — a product decision about anonymous read policy. Worth scheduling?
8. **Scope.** This plan touches `app/page.tsx` (the `stop` prop), `actions/trekBuddy.ts` (`getBoardPulse`, which moves `/trek-buddy`'s own header numbers with it), `actions/trekAdmin.ts` (`revalidatePath`), `lib/constants.ts` (docblocks only) and adds `supabase/migrations/103_*.sql`. Approved?

**What I could not specify exactly:** the `h2`'s `max-w-[16ch]` is a starting value — the shape wanted is three or four balanced lines at desktop with no widow, and Fraunces advance widths at wght 300 across the `opsz` axis cannot be trusted from the subset file (the hero plan's own measured `6.274em` turned out to be `~4.74em` in the browser, recorded at `HOMEPAGE-COUNCIL.md:99–101`). Set it with eyes at 1440 and 390 and change the *type size* if the wrap is wrong, never add a second body measure. Likewise the exact `lg` aside width (340px here, 320px today) should be confirmed against the four-row instrument from item 6 — `leaving this weekend` and `walks already happened` are the two long labels and neither should wrap.

---

## 7. How we will know it worked

**Widths, every time.** 320, 360, 390, 640 (the `sm:flex` on the rules), 768, **1023 and 1024** (the grid flip), 1280 (the container cap), 1440, 2560. At every one: the page body never scrolls horizontally; the `dd` measure is a constant **368px** from `sm` up; the `h2` never sets one line or five; the two long panel labels never wrap; the CTA row wraps rather than overflowing at 320.

**The seams, at 1440, in one screenshot each.**
- 04 → 05: `--paper` to `--paper-deep`, **1.28:1**, one full ladder step, no rule needed (Law 1).
- 05 → 06: `--paper-deep` to `--forest-deep` under a photograph, **11.09:1**. Today's 05 → 06 measures **1.24:1**; if the new seam does not read as a cut, nothing else in this plan matters.
- Opening species down the page must read **1 · 3 · 1** across `DesignYourOwn` → this → `HomeTrails` (Law 5). Screenshot the three eyebrows together; tracking must be `0.2em` in all three.

**Empty and degraded data, every time.**
- `walks = 0, people = 0` — **no numeral anywhere in the section.** This is the state the board is in today and it is the pass/fail on item 5.
- `walks = 0, people > 0` — one 40px figure, the member count, under two sentences.
- `walks = 1, people = 1` — every singular label: `walk on the board`, `member`.
- `weekend = 0` and `completed = 0` — those two rows must not render at all.
- `kinds` empty, and `kinds` non-empty but **every kind open-ended** — the chip block must vanish in both, and the section must never print `0 kinds of outing` (item 7c).
- JavaScript off, and `prefers-reduced-motion: reduce` — the section is unchanged in both; it has no JS and no entrance. Confirm it stays that way.

**Measurements, before and after.**
- Ground under the headline: **1.01:1 against flat ink today** → the band is `--paper-deep`, flat, with no composited image at all.
- Network: one fewer image request per homepage render, and a 2400px `sizes="100vw"` plate no longer downloaded on a 390px phone.
- Every ratio in item 1d's table, sampled from the live render, not from the plan: forest 7.41, text 13.15, mid 5.78, CTA 9.48 / hover 5.84.
- Panel interior: **1.05:1 against ink today** (a blur over nothing) → solid ink, figures at `--sage-lit` **10.82:1**, labels **8.84:1**.
- Word count: 186 → ~150 with the fourth rule, and the first 30 words must contain the product's name, the word "free", three kinds and "Dehradun".
- Mono audit: **exactly four** `font-mono` strings remain — the stop time, the altitude, the panel numerals, and the chip count — and every one carries a figure.
- Phone stack at 390px: **~1,470px today with the live numbers at the bottom** → re-measure after items 9 and 10, with the instrument above the CTA row.

**Interaction and integrity passes.**
- Sign out completely, then click **both** links. Neither may reach `/auth/login`. This is the pass/fail on item 4 and the single most important check in this document.
- Tab through the section: ring is `--forest` on the paper ground at every stop, visible at 7.41:1; if anything inside the instrument ever becomes focusable, its ring is `--sage`.
- Screen reader: the `<aside>` announces via `aria-labelledby="tb-now"`, and both `<h3>`s are real headings under the single `<h2>`.
- **Load `/` and `/trek-buddy` side by side and compare the integers.** After item 6 the member counts must be identical and the labels must be the same words. They cannot be today.
- Apply migration 103 to a database built from migrations alone and count the chips: **ten**, matching the number printed above them. Then change a kind in `/admin/trek-buddy` and confirm `/` reflects it without waiting out the 60s window (item 7b).

**Housekeeping.** Two notes from experience so nobody loses an afternoon: **a mobile check needs a full relaunch** — a stale bundle looks identical to "my change didn't work" — and **the browser pane must be visible** or screenshots come back blank and `innerWidth` reads 0, which makes a correct responsive layout look broken.
