# TrekBuddy — Audit & Remediation Plan

Audited 2026-08-20 against the working tree at `f7344c2`, on the running dev server
at `:3010` with a signed-in member (10 walks on the board), at 375×812 and 1440×900.

Every finding below was **measured or reproduced**, not inferred from reading. Every
line reference was re-checked against the file before it was written down.

---

## 0. How to use this document

Work top-down through §3. Each work package is self-contained: it names the files, the
exact change, the guardrails that keep it from degrading something else, and the check
that proves it landed. Do not batch packages from different priority tiers into one
commit — P0 is a bug-fix release, P1 is a product decision, P2 is new surface area.

Before touching any file, read §1. It is the contract that makes this plan safe to
execute. Most of the "obvious" fixes below have a wrong version that is faster and
quietly destroys something the product has already paid for.

---

## 0a. Status

**P0 — shipped in the working tree.** `tsc` clean, `eslint` clean on the trek surface,
`next build` succeeds. Verified live at 375, 360 and 1440px on `/trek-buddy`,
`/discover`, a plan page, `/people`, `/basecamp`, `/messages`, `/new` and `/preview`:
**horizontal overflow is 0 on every one of them.**

Two findings were re-diagnosed while fixing them. Both corrections are folded into the
packages below, and they are the reason the sweep was worth doing rather than the
one-line fix I first wrote down:

- **F-06 was not `min-width: auto` on the `<li>`.** Tailwind's `grid-cols-N` already
  compiles to `repeat(N, minmax(0, 1fr))`, so the responsive columns were never the
  problem. The bug was grids that declare **only** responsive columns: with no base
  rule, a phone auto-places into an *implicit* track, and an implicit track is sized to
  its content's min-content width. `truncate` sets `white-space: nowrap`, so min-content
  was the whole untruncated string. Fixed at the container — an explicit `grid-cols-1`
  — across 46 sites, rather than by patching children.
- **The 716px request rows on Today were a symptom, not a cause.** Once the document was
  already 432px wide, every `inset-x-0` and `1fr` element stretched to match. Isolating
  each `<section>` in turn showed the requests grid was clean on its own; the card grids
  were the origin. Worth recording, because "the widest element on the page" is almost
  never the element at fault.

| Package | State | Evidence |
|---|---|---|
| W-01 thumb bar | done | `nav.offsetParent !== header`, `innerHeight − nav.bottom = 0`, lockup is the element at its own centre, avatar right edge ≤ viewport, no tab label clipped at 375 **or** 360 |
| W-02 grid tracks | done | `body.scrollWidth − clientWidth = 0` on all eight routes |
| W-03 cost | done | six surfaces through one helper; `Free` and `No cost` appear nowhere on the trek surface |
| W-04 discover dedupe | done | 10 plan links in `<main>`, 10 unique, 0 repeats on a clean load |

**P1 — shipped in the working tree, except one database migration awaiting your say-so.**
`tsc` clean, `eslint` clean, `next build` succeeds, every route 200s, overflow 0 at 375
and 360px.

| Package | State | Evidence |
|---|---|---|
| W-05 provisions visible | done | a walk that is women-only **and** senior-friendly now shows both, on the board card, the composer preview and Basecamp; measured 261px against a 295px phone card, 34px spare. "Senior ok" is gone from the codebase |
| W-06 filters promoted | done | both toggles are in the always-visible row and the masthead counts are now the filters themselves; DayArc bars are proportional and its labels no longer ellipsise |
| W-07 contrast & type | **partly retracted** | see below |
| W-08 see the party | done, **migration applied** | `089_trek_plan_party.sql` dry-run in a rolled-back transaction, then committed to the hosted database with your approval. Verified against real data: grants are `authenticated`/`postgres`/`service_role` with **no `anon`**; return columns are `first_name`, `trust_rung`, `runs_it` with **no id**; a 5-person walk returns 5 first names matching `going_count`. On the rendered page, the only party member's id present is the signed-in viewer's own — the other three confirmed members' ids appear nowhere in the payload, and no surname does |

### F-19 is retracted, and that is my error

The audit reported "WAITING ON YOU" at **3.55:1**, failing AA. It is **5.21:1** and it
passes. The original probe composited alpha wrongly and could not read `oklab()` colours,
so it invented failures. A probe rebuilt against known-good and known-bad controls finds
**zero** contrast failures on `/trek-buddy`, `/discover`, `/people` and a plan page.
`--ember` was not changed and should not be.

Two things in F-19 survived, both verified with the corrected probe:
- `text-paper/40` (3.71:1) and `text-paper/45` (4.38:1) on ink genuinely fail AA. Raised
  to `/55` (5.99:1) at all 13 call sites.
- The type-size judgement stands on its own: `.trek-label` 11→12px, `.trek-label-xs`
  10→11px.

The probe still cannot sample text over photographs or gradients — 10 such elements are
reported as "over imagery" rather than passed. Those use the `trek-glass` treatments and
were not assessed.

### W-14's JourneyRail item was pulled forward, deliberately

Raising `.trek-label-xs` to 11px would have made F-18 worse: "Confirmed" needed 69px in a
56px box at 10px, and 76px at 11px. Shipping the type bump without fixing it would have
been shipping a known regression. `JourneyRail` now takes `layout="stack"`, which the plan
page's 190px sidebar uses — no type size fits five of those words across 190px, so the
narrow case runs them down the page instead. Measured: zero label overflow.

**P2 — shipped in the working tree; both migrations applied.** `tsc` clean, zero lint
errors, `next build` succeeds, all nine trek routes 200.

| Package | State | Evidence |
|---|---|---|
| W-09 pitch page indexable | done | signed out: `<meta name="robots" content="index, follow">` with a real title and description; signed in: `noindex, nofollow`. `robots.txt` now disallows `/trek-buddy/`, `/e/`, `/w/` — the trailing slash is the whole trick, it blocks every member surface while leaving the pitch crawlable. `/trek-buddy` added to the sitemap |
| W-10 a door for hosts | done, **090 applied** | round-trip proved in a rolled-back transaction: ask → `open`; ask twice → refused; admin reads queue; non-admin refused; grant → `can_host` flipped **and** the member notified in the same transaction; grant twice → refused; an existing host asking → refused. Discover's "Finish your profile" dead end is gone |
| W-11 something to send | done, **091 applied** | mint → 32-char token; card returns `["Meera","Kabir","Aarav","Priya","Devika"]` — first names only, host first, no ids, no surnames; a walker who was **not** on the walk is refused; a confirmed walker who is not the host gets the same token; revoke → the card returns empty and `/w/<token>` 404s |

### What I could not verify, and why

- **The `/w/<token>` page with real content.** There is no recap in the database and I did
  not create one. A recap is a paragraph about a day that happened; writing one to make a
  screenshot look right is precisely the fabrication 052 records this codebase deleting
  twice. The route is verified to 404 on a bad token, to typecheck, and to build; its
  populated rendering is unverified by choice.
- **The admin hosting tab, visually.** The signed-in test member is not an admin, so the
  screen redirects. The RPCs behind it are verified above.
- **`HostAccess` in the browser.** Every seeded member can already host, so the component
  never renders for them. Its action and RPC are verified above.

### Two things pulled in from P3

- `costLabel` gained a `short` form during P1; nothing new here.
- **W-15's brand misspelling, partly.** `/e/<token>` said "Ask to join on TrackBuddy" — a
  user-visible misspelling on the one page a stranger sees, and I was about to build a
  second share page beside it. Fixed in the two visible places rather than copied. The
  doc/comment renames are still W-15's.
- **Four notification kinds that were already missing.** `Inbox`'s label map never learned
  `waitlisted`, `waitlist_moved`, `point_changed` or `announcement` — added in 070 and 079
  — so those arrived as a generic "Update" with no colour. Found while adding the two
  hosting kinds this package needed, and left fixed rather than noted.

**P3 — shipped in the working tree.** `tsc` clean, zero lint errors, build succeeds,
overflow 0, zero contrast failures on the new page.

| Package | State | Evidence |
|---|---|---|
| W-12 rebalance the landing | done | rendered landing **679 words**, down from ~2,400. Every removed sentence verified present on the new `/trek-buddy/safety` (1,208 words) — "Not a tour operator", the six-and-four rules, the six take-care notes and "Better a cancelled sunrise" are all gone from the landing and all found on `/safety`. Five links point there, from the landing, the footer (every trek page) and onboarding |
| W-13 let the walk be about the walk | done | the terms table shows **50 words when closed**, down from ~200; eight values scan, each definition one tap under it, nothing deleted |
| W-14 layout | done | Discover renders **one shelf** ("Soonest first") instead of four one-card shelves; a lone soon-rail card measures 1200px against a 1200px band and drops the scroll rail entirely |
| W-15 name and the safety tool | done | `TellSomeone` composes the message the deal asks for. Verified on a walk with the point released: the private value is "Chamba Bypass, **at the fruit stall**" and the message carries only "Chamba Bypass" — `meet_area`, the public field |

### The derived effort gloss

A walk of 5 km and 160 m now reads **"about 1 hour 15 minutes of walking — roughly 15
minutes of that is uphill"**. Naismith's rule (1892), named as such in the note beside it,
computed from two figures the host already stated and editable only by editing them. It
returns nothing when either figure is missing: a walk that has not said how far it goes
gets no guess.

### My negation metric was a bad proxy, and I am not claiming the target

The audit said 36% of sentences carried a negation and the plan set a target under 20%.
Measured the same way now, the landing reads **50%** — worse. The metric is at fault, not
the page: it counts the site-wide footer and the nav, and it counts as "negative" every
sentence that states a strength with a negative word — "Counted, never claimed", "None of
it can be typed in", "the meeting point is never public", and the headline itself,
"Nobody should have to choose between going alone and not going at all".

What is verifiable, and what I claim instead:
- the rendered landing went from ~2,400 words to **679**
- sections framed by what the product is **not** went from **four of nine to one of seven**
- that one section is no longer the last thing before the sign-up button — the call to
  action follows it
- all of the removed text is on one page, unabridged, and that page is the only thing
  under `/trek-buddy` a crawler may read

### A deviation from the plan, and why

W-12 called for a strip of real recaps on the landing as evidence. I did not build it. A
share token (091) is one person saying "I sent this to a friend"; putting their Saturday,
their photographs and their party on a front page is a broader consent nobody has given,
and the product has no way to ask for it yet. The landing carries a **counted** fact
instead — how many walks have already happened — which needs nobody's permission and is
the same class of claim as every other figure on the page.

### Still not verified

The signed-out landing has been measured but not looked at: this browser session is signed
in, and the two halves of that route render differently. Its word count, structure, links
and crawler policy are all verified from the served HTML.

---

## 1. The quality contract — non-negotiables

These are not preferences. Each one exists because this codebase already learned it,
usually the hard way, and the migration comments record the incident.

### 1.1 Nothing may be fabricated. Ever.

`052_trek_buddy.sql:1030-1060` records that this repo has deleted invented data twice —
a guided-departures funnel with fake dates and "spots left", and four fabricated
customers stamped "Verified buyer". A fake walk is worse than either: *"a fake
testimonial is a lie about the past; a fake plan is an invitation to meet somebody at a
real place and a real time who will not be there."*

- No seed plans, no placeholder people, no illustrative counts.
- An empty board says it is empty. That is a feature.
- `/trek-buddy/preview` is the **only** place fixtures may live, it is `notFound()` in
  production (`preview/page.tsx:40`), and it stays that way.

### 1.2 The privacy model is load-bearing. Do not widen a read to make a screen nicer.

- **No anon SELECT policy on any `trek_*` table.** A logged-out visitor gets the pitch
  and a count. (`052:69-77`)
- **The exact meeting point never reaches an unconfirmed viewer.** It is not withheld by
  a template — it is not in the projection. Keep it that way.
- **The roster is host-only** (`getTrekPlan`). If a screen needs to show who is going,
  add a *new, narrower* projection (first name + trust rung, no user id, no profile
  link) — never loosen the existing one.
- Any new shareable surface follows the `/e/[token]` pattern: unguessable token, read
  with the **anon** key so a stranger's view is provably a stranger's view, revocable,
  `robots: { index: false, follow: false, nocache: true }`.

### 1.3 Every mutation goes through a `SECURITY DEFINER` RPC.

There is no UPDATE policy on any Trek Buddy table for anybody, deliberately
(`actions/trekBuddy.ts:8-20`). Two of the worst holes in the first schema draft were a
host editing their own going-count and back-dating a plan to manufacture history. Do not
add a direct write. Do not add an RLS UPDATE policy. Pass the actor explicitly — these
run on the service-role client where `auth.uid()` is NULL.

### 1.4 The platform holds no money.

No price, no deposit, no integer that could be read as a fee. A cost *share* is a fact
the host states about the day, displayed at face value. The moment a place has a number
attached, this is guided travel with a different regulator. (`052:84-90`)

### 1.5 Counted, never claimed.

No stars, no green ticks, no self-reported figures. If a number is on screen, a database
function counted it from something that happened. **This is the rule W-02 breaks**, and
it is why W-02 is P0 rather than cosmetic.

### 1.6 The voice.

Plain, concrete, sentence case, no marketing verbs, no exclamation, British-leaning
spelling ("organise", "recognisable"). Figures in mono and tabular; words in the body
face. Amber/ember means *a clock is running* and nothing else. Sage means done or good.
Clay means stopped or restricted.

**When this plan says "cut copy", it means relocate, never delete.** The honesty is the
product's best asset — the problem is placement and volume on first contact, not
content. Everything removed from a first-read surface must land, unabridged, on a page
one click away, and stay linked from where it was.

### 1.7 Tailwind v4 in this repo

Bare CSS variables in arbitrary values compile to nothing: `px-[--token]` is silently
dropped. Always `px-[var(--token)]`.

### 1.8 Next.js in this repo is not the Next.js you know

`AGENTS.md` is not decoration. Read the relevant guide under
`node_modules/next/dist/docs/` before writing framework code. For W-09 that means
`01-app/03-api-reference/03-file-conventions/01-metadata/robots.md` and
`01-app/01-getting-started/14-metadata-and-og-images.md`.

### 1.9 Definition of done, for every package

1. `npx tsc --noEmit` clean.
2. `npm run lint` clean.
3. `npm run build` succeeds.
4. The §4 overflow probe returns `overflow: 0` at 375px on **every** route touched.
5. The route renders correctly at 375, 768 and 1440.
6. `/trek-buddy/preview` still renders — it is the fastest regression check for any card
   or component change, and it needs no data.
7. Contrast of any text you touched is ≥ 4.5:1 (≥ 3:1 only for ≥ 24px or ≥ 19px bold).

---

## 2. Findings ledger

Severity: **S1** breaks the product · **S2** breaks a promise the product makes ·
**S3** blocks the stated goal · **S4** quality.

| ID | Sev | Finding | Evidence |
|----|-----|---------|----------|
| F-01 | S1 | Mobile thumb-nav renders at the **top** of the screen, not the bottom. `backdrop-blur-[14px]` on the `<header>` creates a containing block, so the nested `fixed bottom-0` nav resolves inside the 64px header. | `TrekTopBar.tsx:65` + `:167`. Live: `nav.offsetParent === header` → `true`; nav rect `y: 14`. |
| F-02 | S1 | That nav covers the brand lockup, which becomes unclickable. | `document.elementFromPoint()` at the lockup centre returns the nav `<a>`, not the lockup. |
| F-03 | S1 | Profile avatar renders off-screen at `x: 407` on a 375px viewport. | Measured. |
| F-04 | S1 | `main` reserves `pb-16` for a bar that is not at the bottom → dead 64px strip at the foot of every page. | `layout.tsx:40`. |
| F-05 | S1 | 6 nav items × 77px = 463px in a 375px viewport → horizontal document overflow. | `body.scrollWidth 463` vs `clientWidth 375` on `/trek-buddy/discover`. |
| F-06 | S1 | Today page blows out to **740px** wide on a 375px phone. `truncate` sets `white-space: nowrap`; the grid `<li>` has default `min-width: auto`, so the track sizes to the *full untruncated string*. `truncate` causes the overflow it exists to prevent. | `TrekHome.tsx:125-126`. Row measured at 716px. Hiding the nav does not change it — independent of F-05. |
| F-07 | S2 | `cost_paise === null` renders as **"Free"** on the board card, **"No cost"** on the featured card, and **"Not stated"** on the walk itself. The board makes an affirmative money claim the host never made. Both card branches use a falsy test, so `null` and `0` are indistinguishable. | `TrekPlanCard.tsx:218-222`, `FeaturedPlan.tsx:112`, `PlanRail.tsx:79-84`. Violates §1.5. |
| F-08 | S3 | A women-only walk **cannot display** that it is senior-friendly: `{!plan.women_only && plan.senior_friendly && …}`. | `TrekPlanCard.tsx:225`. |
| F-09 | S3 | One attribute, two names: "Senior friendly" on four surfaces, **"Senior ok"** on the board card — the most-viewed one. | `TrekPlanCard.tsx:225` vs `SoonRail.tsx:100`, `FeaturedPlan.tsx:115`, `BoardFilters.tsx:242`, `discover/page.tsx:166`. |
| F-10 | S3 | Women-only and senior-friendly filters are hidden behind a 12px "More filters +" text link, while the masthead prints their counts as headline stats. | `BoardFilters.tsx:196`, `discover/page.tsx:163-167`. |
| F-11 | S2 | Discover renders the same walk twice — once in the soon rail, once in a bucket. `rest` is derived from `shown`, not from `candidates`; `inRail` is used only to pick the featured plan. Today dedupes correctly; Discover does not. | `discover/page.tsx:102-108` vs `page.tsx:104-105`. Same UUID appears twice in the DOM. |
| F-12 | S3 | Hosting is invite-only (`trek_can_host` default `false`) and there is **no UI anywhere to request it**. | `052:142`, enforced `064:53-57`. Grep for "invite-only" in `app/`/`components/`: 2 hits, both prose. |
| F-13 | S2 | Discover's empty state offers a non-host **"Finish your profile"**, which grants nothing. Basecamp tells the truth on the same subject. | `discover/page.tsx:230-235` vs `basecamp/page.tsx:308`. |
| F-14 | S3 | Nothing is shareable. The only stranger-readable page, `/e/[token]`, is mintable by hosts only — and hosting is invite-only. No recap route exists at all. | `trekShare.ts:23-32`; `find app -path "*recap*"` → empty. |
| F-15 | S3 | The signed-out **pitch page** is `noindex`. It shares a route with the signed-in home, so the marketing page inherits the board's crawler policy despite containing no member data. | `app/trek-buddy/page.tsx:14`. |
| F-16 | S3 | ~2,400 words on the signed-out landing (≈1,700 in-component + ≈700 from `BOARD_CHECKS`/`BOARD_LIMITS`/`SAFETY_NOTES`). **36% of sentences carry a negation** (58 of 162; 95 negation tokens). Four of nine sections are framed negatively. The last line before "Join the board" is *"I am meeting strangers outdoors at my own risk."* | `TrekLanding.tsx`, `lib/trek.ts:101,141,171`. Counted. |
| F-17 | S4 | "What this walk asks of you" is ~200 words across 7 rows; roughly 12 of them describe *this walk*. Every fact is chaperoned by a definition of the fact. | `app/trek-buddy/[id]/page.tsx`. |
| F-18 | S4 | JourneyRail label "CONFIRMED" needs 69px, gets a 56px box, `overflow: visible` → paints over "POINT", rendering as `CONFIRMEDINT`. | `ui/JourneyRail.tsx:87-99`. `clientWidth 56 / scrollWidth 69`. |
| F-19 | S4 | "WAITING ON YOU" — 11px, `--ember` `#8A5A17` on `--amber-wash` `#F7F0E2` = **3.55:1**. Fails AA. Also `text-paper/40` = 3.72:1 and `text-paper/45` = 4.37:1, both in use. | `globals.css:297-298`; measured. |
| F-20 | S4 | DayArc renders five equal-width bars for counts of `1,6,1,1,1` — length encodes nothing. On mobile all five labels ellipsise to `BEFO… FIRS… FULL … LAST… AFTE…`. | `ui/DayArc.tsx`, measured at 375px. |
| F-21 | S4 | Every bucket holds one card in a 3-column grid. Discover is **5,900px tall for 10 walks**. Soon rail with one item floats over a hard gradient seam with 2/3 of the band empty. | Measured. |
| F-22 | S3 | A member cannot see who else is confirmed before committing — the input that matters most to the audience the product advertises to. | `[id]/page.tsx` roster copy; `getTrekPlan` host-only. |
| F-23 | S4 | Three spellings of the product name: `TrekBuddy`, `Trek Buddy`, `TrackBuddy`. | `ui/Mark.tsx`, `SetupForm.tsx:204`, `e/[token]/page.tsx:25`, `TRACKBUDDY-OVERHAUL.md`. |
| F-24 | S4 | `10 WITH ROOM` beside "10 walks are on the board" — a tautology at current scale. | `discover/page.tsx:120,164`. |
| F-25 | S3 | No safety **tool**, only safety prose. The deal asks the member to tell someone where they are going; the product gives them no way to do it. | `SetupForm.tsx:31-34`, `lib/trek.ts` SAFETY_NOTES. |

---

## 3. Work packages

### P0 — The product is broken on a phone (F-01…F-06, F-07, F-11)

Ship as one release. Nothing else matters until this is done: this is a Dehradun
4am-shared-cab product, and most of its users are on a phone.

---

#### W-01 · Get the thumb bar to the bottom of the viewport

**Fixes** F-01, F-02, F-03, F-04, F-05

**Files** `components/trek/TrekTopBar.tsx`, `app/trek-buddy/layout.tsx`

**Change**
1. Move the mobile `<nav>` **out of `<header>`** and return a fragment from
   `TrekTopBar` (`<> <header>…</header> <nav>…</nav> </>`). The header keeps its
   backdrop-blur; the nav escapes the containing block it creates.
2. Give the nav `pb-[env(safe-area-inset-bottom)]` so it clears the iOS home indicator.
3. Fix the width blowout properly rather than by dropping an item: give each link
   `min-w-0 flex-1` and let the label truncate, **or** drop the redundant sixth item —
   "Shop" already exists in the header's brand cell (`:91-97`) and the comment at
   `:53-58` says two controls to the same place is clutter. Prefer dropping it: 5 items
   at 375px is 75px each, which fits.
4. Keep `main`'s `pb-16` — once the nav is genuinely at the foot, that padding is
   correct and F-04 resolves itself. Verify it, don't assume it.

**What it actually took** (beyond moving the nav out of `<header>`):
- Dropping "Shop" from the thumb bar to 5 items, **and** un-hiding the brand-cell Shop
  link on mobile — it was `hidden sm:inline-flex`, so the comment justifying "no Shop tab
  because the brand cell carries it" was true on a laptop and false on a phone. Six tabs
  at 375px is what stopped the bar fitting.
- The count row needed `w-full`: the column is `items-center`, so a child is centred at
  its *natural* width rather than stretched, and "Basecamp 9+" overran into "Messages".
- Thumb-bar labels went to 10px. At 11px "Basecamp" plus a two-character count needs 78px
  in a 75px cell and gets clipped to "Basecam…", which is worse for every reader than a
  smaller whole word. This is not W-07's problem: `.trek-label` is uppercase, tracked, and
  carries content mid-page; this is a sentence-case wayfinder in a fixed position behind a
  47px tap target, which is where both phone platforms set their own tab bars.

**Guardrails**
- The header's three-cell grid (`1fr / auto / 1fr`) exists to keep the desktop nav
  optically centred. Do not restructure it.
- `aria-current="page"` and the sage active underline must survive on both bars.
- The badge (`9+`) positioning is `absolute right-[22%] top-2` relative to the link —
  re-check it after any flex change.

**Done when** at 375px: `body.scrollWidth === clientWidth`; the lockup is the element at
its own centre point; the avatar's `x + width ≤ 375`; the nav's `getBoundingClientRect().bottom`
is within 1px of `innerHeight`.

---

#### W-02 · Stop the grid from being sized by untruncatable text

**Fixes** F-06

**Files** `components/trek/TrekHome.tsx:125`

**Change** *(corrected during P0 — see §0a)* Add an explicit **`grid-cols-1`** to every
grid that declares only responsive column counts. Tailwind's `grid-cols-N` is already
`repeat(N, minmax(0, 1fr))`; the failure is the *implicit* track a phone falls back to
when there is no base rule, which is sized to min-content — and `truncate`'s `nowrap`
makes min-content the entire string. Fixing it on the container covers every child,
present and future; `min-w-0` on each `<li>` would have to be remembered forever.

**Then sweep for the same shape.** This is a class of bug, not an instance:

```bash
grep -rn "grid" components/trek app/trek-buddy --include=*.tsx | grep -v "min-w-0" | grep -v "minmax"
```

Check every `<ul class="grid">` whose children contain `truncate` or `whitespace-nowrap`.

**Guardrails** Do not remove `truncate` — it is correct once the track is bounded.
Do not set `overflow-hidden` on the row as a workaround; that clips the focus ring.

**Done when** the Today page reports `overflow: 0` at 375px and each request row's
right edge is ≤ 375.

---

#### W-03 · One truth about cost

**Fixes** F-07

**Files** *(six surfaces, not three — the audit undercounted)*
`components/trek/TrekPlanCard.tsx`, `components/trek/FeaturedPlan.tsx`,
`components/trek/PlanRail.tsx`, `components/trek/PlanMasthead.tsx`,
`app/e/[token]/page.tsx`, and — the one that matters most — the composer's own live
preview in `app/trek-buddy/new/NewPlanForm.tsx`, which showed a host "Free" on their
draft for a field they had not filled in, teaching them that silence means free.

**Change** Extract a single helper — `lib/trek.ts`:

```ts
/** null = the host never said. 0 = the host said there is nothing to split. */
export function costLabel(paise: number | null): { text: string; stated: boolean } {
  if (paise == null) return { text: 'Cost not stated', stated: false }
  if (paise === 0)   return { text: 'Nothing to split', stated: true }
  return { text: `${formatPrice(paise)} each`, stated: true }
}
```

Use it on all three surfaces. On the cards, render the unstated case as a **quiet
outline tag**, never sage — sage is good news, and "the host did not say" is not news.
Consider rendering nothing at all on the compact card when `stated === false`; absence
is more honest than a tag, and it buys back a slot in the tag row for W-04.

**Guardrails** `null` and `0` must stay distinguishable — no falsy tests. `PlanRail`'s
`costIsFigure` logic (mono only for actual amounts) is correct; preserve it.

**Done when** a walk with `cost_paise = null` reads identically on the board card, the
featured card and the plan page, and the word "Free" appears nowhere for an unstated cost.

---

#### W-04 · Discover stops printing the same walk twice

**Fixes** F-11

**Files** `app/trek-buddy/discover/page.tsx:102-108`

**Change** One line: derive `rest` from `candidates`, not `shown`.

```ts
const rest = featured ? candidates.filter((p) => p.id !== featured.id) : candidates
```

**Guardrails** When `soon.length === 0` the rail is not rendered, and `candidates === shown`
— the change is a no-op in that case, which is correct.

**Done when** no plan id appears more than once in the DOM of `/trek-buddy/discover`:

```js
(()=>{const h=[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')).filter(x=>/^\/trek-buddy\/[0-9a-f-]{20,}$/.test(x));return h.length-new Set(h).size})()
```
must return `0`.

---

### P1 — The two audiences you named are the two the UI hides (F-08…F-10, F-19, F-22)

---

#### W-05 · Make provision visible

**Fixes** F-08, F-09

**Files** `components/trek/TrekPlanCard.tsx:224-225`, and the four label sites in F-09.

**Change**
1. Remove the `!plan.women_only` guard. A women-only, senior-friendly walk must show
   both. This is the exact walk the stated audience is looking for.
2. Standardise on **"Senior friendly"** everywhere. Delete "Senior ok" — *friendly* is
   an invitation, *ok* is a tolerance, and the downgrade currently lands on the
   most-viewed surface in the product.
3. The tag row is `flex-nowrap` with `shrink-0` children (`:207-211`) to protect the
   grid rhythm — three tags at once will now clip. Fix the cause: W-03 likely frees the
   cost slot, and difficulty can move to the fact line where distance and climb already
   live. **Do not solve it by hiding a provision tag again.**

**Guardrails** Clay is the women-only colour, sage is senior-friendly — do not recolour.
Tag order must be stable across cards.

**Done when** a walk with `women_only && senior_friendly` shows both tags on the board
card, the soon rail, the featured card and the plan page, with no clipping at 375px.

---

#### W-06 · Promote the two filters that carry the promise

**Fixes** F-10, and partially F-20, F-24

**Files** `components/trek/BoardFilters.tsx`, `app/trek-buddy/discover/page.tsx:163-192`

**Change**
1. Lift **Women only** and **Senior friendly** out of the disclosure into the always-visible
   chip row, beside the activity chips. Leave difficulty, language and "has spots" behind
   "More filters".
2. Make the masthead stats (`discover/page.tsx:163-167`) **into those filter links**.
   A count you cannot click is a claim; a count that filters is a control.
3. Drop `WITH ROOM` from the stat row while it equals the board size (F-24) — or replace
   it with something that varies.
4. Give DayArc bars width proportional to their counts, `min-width` floored so a count of
   1 is still tappable. At `< 640px` render the band's initial (`B F D L A`) with the count
   under it and the full name in `aria-label`, instead of a truncated word (F-20).

**Guardrails** Chip counts are computed off the **unfiltered** board on purpose
(`discover/page.tsx:76-85`) — a filter that hides itself is worse than one that says zero.
Keep that. The filter state lives in the URL; keep it shareable.

**Done when** a signed-in member can reach a women-only or senior-friendly board in one
tap from Discover, at 375px, without opening a disclosure.

---

#### W-07 · Type that a 62-year-old can read

**Fixes** F-19

**Files** `app/globals.css:654-670`, and the ember-on-amber label sites.

**Change**
1. Darken `--ember` in the trek scope until ≥ 4.5:1 on `--amber-wash` (`#8A5A17` on
   `#F7F0E2` is 3.55:1; ~`#7A4E12` clears it). Verify with the §4 probe — do not eyeball.
2. Raise `.trek-label` from 11px to 12px and `.trek-label-xs` from 10px to 11px. At
   0.07–0.08em tracking these are the smallest text in the product and they carry section
   names and states.
3. Replace `text-paper/40` (3.72:1) and `text-paper/45` (4.37:1) with `text-paper/50`
   (5.15:1) wherever they carry text rather than a rule.

**Guardrails** `.trek-label` is deliberately restricted to keys and section names
(`globals.css:646-660`) — do not widen its use while you are in there. Ember must stay
recognisably the dawn-shadow colour; darken, don't re-hue.

**Done when** the §4 contrast probe returns no text below 4.5:1 on `/trek-buddy`,
`/discover`, `/people` and a plan page.

---

#### W-08 · Let a member see who they would be walking with

**Fixes** F-22 — the highest-value change in this document for the stated audience.

**Files** new RPC migration; `actions/trekBuddy.ts`; `app/trek-buddy/[id]/page.tsx`

**Change** Add a **new, narrower** projection — not a loosening of `getTrekPlan`:

```sql
-- trek_plan_party(p_plan uuid, p_actor uuid)
-- Returns, for any signed-in member who can see the plan:
--   display_name (first token only), trust_rung, is_host
-- Returns NO user_id, NO avatar seed that resolves to a profile, NO link target.
-- Only rows with status = 'confirmed'. Requested/waitlisted are never exposed.
```

Render it as a `FacePile` + first names above the ask button. Keep the existing sentence
explaining that the full roster is the host's alone.

**Guardrails**
- This is a privacy change. It gets its own migration, its own review, and its own
  paragraph in the migration header explaining exactly what it exposes and why.
- Confirmed-only. A person who merely *asked* must never appear.
- No user id in the payload — that is what stops the board becoming a directory of
  people to approach, which §1.2 and the existing copy both promise.
- The `FacePile` avatar is seeded by id today; seed this one by name so no id crosses
  the wire.

**Done when** an unconfirmed member sees the count and first names of confirmed
walkers, and no network response for that page contains a user id for anyone but
themselves and the host.

---

### P2 — The growth loop is a closed circuit (F-12…F-15)

---

#### W-09 · Let the pitch page be found

**Fixes** F-15

**Files** `app/trek-buddy/page.tsx`

**Change** The route is two pages in one component. Split the metadata by membership:
the signed-out landing is indexable; every signed-in surface is not. Read
`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md`
first — `generateMetadata` runs before the component and can read the session.

Safer alternative if that turns out to be awkward: move the pitch to its own indexable
route (`/trek-buddy/about`) and keep `/trek-buddy` noindex for both states.

**Guardrails** The pitch page must name **no member and no walk** — it already doesn't
(`page.tsx:28-31`); confirm before flipping. `getBoardPulse()` returns counts only.
Every other trek route stays `index: false`. `/e/[token]` stays `nocache: true`.

**Done when** `curl -s localhost:3010/trek-buddy | grep -i robots` shows no noindex when
signed out, and still shows it when signed in.

---

#### W-10 · A door for people who want to host

**Fixes** F-12, F-13

**Files** `app/trek-buddy/discover/page.tsx:230-235`, `basecamp/page.tsx`, new action + RPC

**Change**
1. **Stop the misdirection first** (one line, do it inside P0 if convenient): a non-host's
   empty-state action must not be "Finish your profile". Use Basecamp's honest sentence —
   *"Hosting is invite-only while this is new."*
2. Add `trek_request_host(p_actor)` — writes a row to a `trek_host_requests` table with a
   short note, one open request per person, and fires the existing `sendSlackAlert`.
3. Surface it wherever a non-host hits the wall: the Discover empty state, Basecamp, and
   the person page's "follow them and the next one turns up" line (`people/[id]:577`),
   which is currently a promise the system cannot keep.
4. Add an approve/decline column to `app/admin/trek-buddy` — `trekAdmin.ts:370` already
   passes `p_can_host`, so the write path exists.

**Guardrails** Invite-only is a deliberate legal posture (`052:72-79`), not an oversight.
This package makes the gate **visible and requestable**; it does not open it. Do not
change the default.

**Done when** a non-host can, from any dead end, submit a request in one tap, and an
admin can grant it from the existing admin screen.

---

#### W-11 · Give members something to send a friend

**Fixes** F-14 — the direct answer to "something people remember and share".

**Files** new `app/w/[token]/page.tsx`; new migration; `actions/trekRecap.ts`

**Change** Recaps already exist as data (`trekRecap.ts:19-71`) and render nowhere
outside the board. Build the public recap:

1. `trek_recap_token(p_plan, p_actor)` — mintable by **anyone confirmed on that walk**,
   not just the host, mirroring `trek_share_token`.
2. `/w/[token]` — outside `app/trek-buddy`, so it gets none of the shell, exactly like
   `/e/[token]` (`e/[token]/page.tsx:33-38`). Read with the **anon** key.
   Shows: place, date, hour band, distance, climb, the recap body, the photographs,
   first names of the party. Shows: **no meeting point, no user ids, no profile links.**
3. An OG image via `@napi-rs/canvas` — already a dependency, already rendering invoices
   (`lib/invoice/documentShell.ts`) and print files (`lib/customize/renderDesign.ts`).
   The card is the walk's own facts on the hour's colour. Nothing invented.
4. Add "Share this walk" to `RecapPanel`.

**Guardrails** `robots: { index: false, follow: false, nocache: true }` — this is a
private link, not a public archive. Revocable by the host. A recap can only exist for a
walk that has already happened (enforced by trigger, `trekRecap.ts:14-17`) — do not
bypass. The `.trek-scope` class must be on the root wrapper or it renders in the
storefront's palette; that exact bug already happened on `/e/[token]` (`:41-46`).

**Done when** a confirmed walker can mint a link, a signed-out stranger can open it,
and the page contains no meeting point and no user id.

---

### P3 — The copy is a waiver (F-16, F-17, F-23, F-25) and the layout is over-built (F-18, F-20, F-21)

---

#### W-12 · Rebalance the landing page

**Fixes** F-16

**Files** `components/trek/TrekLanding.tsx`, new `app/trek-buddy/safety/page.tsx`

**Change** Target ~500–600 words on first contact, down from ~2,400.

Move **whole and unabridged** to a linked `/trek-buddy/safety` page:
- §5 `BOARD_CHECKS` + `BOARD_LIMITS` bodies (titles stay on the landing)
- §6 `SAFETY_NOTES` bodies
- The four disclaimer-shaped FAQ answers

Keep on the landing: the headline, the paragraph, the counts, "who this is for",
"how a walk works" with `JourneyRail`, the six kinds, and **one** honest line —
*"Nobody here has been checked by anybody. What the board enforces, and where that
stops, is written out in full →"*.

Then add the thing that is missing entirely: **evidence**. `RecentRecaps` already exists
and already renders on Discover (`discover/page.tsx:284-290`). A real walk that happened,
with a real photograph and a real paragraph, is the only element on that page that
could not have been written by somebody who never left the house. Render it — gated on
`recaps.length > 0`, never faked (§1.1).

**Guardrails**
- Not one sentence is deleted. Every word moves to `/trek-buddy/safety` and stays linked
  from the landing, the setup form and the plan page.
- The setup flow's "The deal" (`SetupForm.tsx:22-39`) **does not change**. That is the
  right place for consequences: it is the moment of agreement, and it already works.
- Do not add marketing verbs. The fix is proportion, not enthusiasm. Recount the
  negation ratio after editing; target under 20%.

**Done when** the landing is under 600 words, `/trek-buddy/safety` contains every
sentence removed, and every removal site links to it.

---

#### W-13 · Let the walk be about the walk

**Fixes** F-17

**Files** `app/trek-buddy/[id]/page.tsx`, new `app/trek-buddy/how-to-read-a-walk/page.tsx`

**Change** "What this walk asks of you" is ~200 words of which ~12 describe the walk.
Keep the values; move each row's *definition of the term* behind a `<details>` (the
pattern already used on the landing at `TrekLanding.tsx:359-378`) or to a single
"how to read a walk" page linked once from the table head.

Then add what a beginner actually needs and cannot get today: **what 160 m of climb
feels like.** A one-line derived gloss — *"about 45 minutes of steady uphill"* — computed
from distance, gain and difficulty. Derived, stated as derived, never typed by anyone.

**Guardrails** Nothing is deleted; disclosure is not removal. The derived gloss must be
visibly a derivation ("roughly", "about") and must never override a host's own words.

---

#### W-14 · Layout corrections

**Fixes** F-18, F-20, F-21

- **F-18** `ui/JourneyRail.tsx:87-99`: five `flex-1` columns give each label 56px;
  "CONFIRMED" needs 69px and `overflow: visible` paints it over "POINT". Either shorten
  the labels (Asked · Confirmed · Point · Walked · Vouched → the rail already carries
  notes under `showNotes`) or let the columns size to content with the connector flexing.
  Do **not** add `truncate` — see F-06.
- **F-20** covered in W-06.
- **F-21** Collapse `bucketPlans` into a single grid when the board has fewer than ~20
  walks. Shelving for a hundred walks shown to ten reads as emptiness, and 5,900px of
  page for 10 cards is a scroll nobody finishes. Render the soon rail as a single
  full-width row when `soon.length === 1`, rather than one card in a 3-column grid over
  a gradient seam.

---

#### W-15 · Name, and the safety tool

**Fixes** F-23, F-25

- **F-23** Standardise on **TrekBuddy** (the lockup's spelling). Fix `SetupForm.tsx:204`,
  `e/[token]/page.tsx:25`, and rename `TRACKBUDDY-OVERHAUL.md`.
- **F-25** The deal asks the member to tell someone where they are going. Make it a
  **button**, shown at the moment of confirmation, that composes a WhatsApp/SMS message
  containing the place, the departure time and the expected return — the facts the plan
  already holds. This is the single highest-leverage safety addition available, it needs
  no new data, and it converts the product's most-repeated sentence from a disclaimer
  into a tool.

**Guardrails** The composed message must **not** contain the exact meeting point, even
for a confirmed walker — that is the walker's to share, not the platform's to broadcast
into a third-party app. Use `meet_area`, the public field.

---

## 4. Verification protocol

Run these in the Browser pane against `:3010`. They are mechanical — do not substitute
judgement for them.

**Horizontal overflow** (must return `0` on every route, at 375px):
```js
(()=>{const vw=document.documentElement.clientWidth;
const bad=[...document.querySelectorAll('body *')].map(e=>{const r=e.getBoundingClientRect();
return{t:e.tagName,c:(e.className+'').slice(0,60),right:Math.round(r.right+scrollX)}})
.filter(o=>o.right>vw+1).sort((a,b)=>b.right-a.right).slice(0,5);
return JSON.stringify({overflow:document.body.scrollWidth-vw,worst:bad})})()
```

**Contrast** (report anything under 4.5:1 that is not ≥ 24px):
```js
(()=>{const cv=document.createElement('canvas');cv.width=cv.height=1;
const cx=cv.getContext('2d',{willReadFrequently:true});
const rgb=c=>{cx.clearRect(0,0,1,1);cx.fillStyle=c;cx.fillRect(0,0,1,1);
return [...cx.getImageData(0,0,1,1).data].slice(0,3)};
const bgOf=e=>{let n=e;while(n){const c=getComputedStyle(n).backgroundColor;
if(c&&!/rgba\(0, 0, 0, 0\)|transparent/.test(c))return rgb(c);n=n.parentElement}return[255,255,255]};
const lum=([r,g,b])=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};
return .2126*f(r)+.7152*f(g)+.0722*f(b)};
const out=[];for(const e of document.querySelectorAll('body *')){
if(e.children.length||!e.textContent.trim())continue;const cs=getComputedStyle(e);
const fg=rgb(cs.color),bg=bgOf(e),L1=lum(fg),L2=lum(bg);
const r=(Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);
const px=parseFloat(cs.fontSize);if(r<4.5&&px<24)out.push({t:e.textContent.trim().slice(0,24),px,r:+r.toFixed(2)})}
const seen=new Set();return JSON.stringify(out.filter(o=>!seen.has(o.t)&&seen.add(o.t)).slice(0,12))})()
```

**Nav position** (W-01):
```js
(()=>{const n=document.querySelector('nav.fixed');const r=n.getBoundingClientRect();
return JSON.stringify({bottomGap:Math.round(innerHeight-r.bottom),escapedHeader:n.offsetParent===null||n.offsetParent===document.body})})()
```

**Duplicate plans** (W-04): the snippet in W-04 must return `0`.

**Design regression, no data required**: `/trek-buddy/preview` renders every card,
rail, meter, masthead and empty state against fixtures. Check it after any component
change. It is `notFound()` in production.

**Routes to check on every package**: `/trek-buddy`, `/trek-buddy/discover`,
`/trek-buddy/people`, a plan page, `/trek-buddy/basecamp`, `/trek-buddy/messages`,
`/trek-buddy/new`, `/trek-buddy/preview` — each at 375 and 1440.

---

## 5. Deliberately not changed

Recorded so nobody "fixes" them later.

| Thing | Why it stays |
|---|---|
| Hosting invite-only by default | Legal posture with preconditions, not an oversight (`052:72-79`). W-10 makes the gate visible and requestable; the default stays `false` until the owner decides otherwise. |
| No direct messages between members | Deliberate (`people/[id]:584`). Plans made on a walk's page stay reviewable — that is a safety property, not a missing feature. |
| No anon read on any `trek_*` table | An indexed plan means a stalker never needs an account (`052:69-77`). |
| The platform holds no money | Different insurer, different regulator (`052:84-90`). |
| Board launches empty | A fake plan is an invitation to meet somebody who will not be there (`052:1031-1060`). |
| "The deal" in onboarding | Right content, right place, right moment. W-12 does not touch it. |
| Hour-colour system | The one place colour carries meaning rather than emphasis. Genuinely original. Leave it. |

---

## 6. Sequencing

```
W-01 ─┬─> W-02 ──> [P0 ship]
      └─> W-03 ──> W-04 ──> [P0 ship]

[P0] ──> W-05 ──> W-06 ──> W-07 ──> W-08 ──> [P1 ship]

[P1] ──> W-09 ──┐
        W-10 ──┼──> W-11 ──> [P2 ship]
                └──(W-10 unblocks W-11: hosting gate limits who can mint)

[P2] ──> W-12 ──> W-13 ──> W-14 ──> W-15
```

W-03 must land before W-05 — freeing the cost slot is what makes room for the
provision tags without clipping. W-10 should land before W-11, or the shareable
artifact is available to the same tiny set of people who can already share.

---

## Closing note

The bones are unusually good. The trust model is real and enforced in the database
rather than asserted in a paragraph. The hour-colour system is an original idea
executed consistently. The prose is a genuine competitive advantage.

What this plan fixes is that a beautifully-argued document you cannot read on a phone
and cannot tell anyone about is not yet a platform. None of the packages above require
softening a single honest sentence — F-16 is about **proportion on first contact**, and
every word removed from the landing page lands somewhere it is more load-bearing, not
in a bin.
