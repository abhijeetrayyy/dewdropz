# TrekBuddy — the overhaul

**Status:** in progress · this document is the contract the code follows.

---

## 0. The reset — read this first

The first pass rebuilt the whole feature against `TrackBuddy Platform Design/TrackBuddy.dc.html`. **That prototype is rejected and is no longer a source for anything.** It produced a competent lifestyle brand — amber gradients, a glowing sun mark, hairline serif at 100px, drifting marquees, a monospace label on every element — and the owner's verdict was that it read as funky rather than as serious, with the wrong colours and the wrong fonts.

The brief that replaces it:

> A serious platform where people can put their guard down and trust it. It has to understand its own sensitivity — women, older walkers, the complete beginner, the experienced expedition walker — and be credible to all four. Mature, modern, visually excellent, and the first page has to say plainly what this is and what it stands for.

That is a different design problem from the one the prototype solved, and it changes the answer everywhere.

### What the reset changed

| | Before (rejected) | Now |
|---|---|---|
| **Typefaces** | Fraunces 300 at 104px, Archivo, Space Mono on every label | **Newsreader** (a reading serif, set at 400/500), **Inter** (interface), **IBM Plex Mono** — and mono is rationed to *figures only* |
| **Primary action** | Saturated amber `#E39B3F` on every button | **Deep forest `#1F4A2E`.** Amber is demoted to the one thing it is good at: a clock is running |
| **Ground** | Cream `#F8F5ED` — a printed, editorial paper stock | Near-neutral off-white `#FAFAF8`, yellow removed, so photographs and greens sit on it honestly |
| **Saturation** | Full-chroma hour colours as large fills | Every hue pulled back ~20%, and the hour expressed *small* — a dot, a 4px rail, a thin meter |
| **Hero** | 92vh ken-burns photograph under a scrim, "Chase the light. Together." | Type-led, with a **contained** photograph at full clarity and an honest caption |
| **Motion** | ken-burns, two marquees, a pulse | A pulse next to genuinely live things. Nothing else moves |
| **Case** | Uppercase at 0.12–0.28em on buttons, tabs, statuses | Sentence case on anything pressable or stateful |
| **First page** | A pitch about how being outdoors feels | An argument: what this is, what it is not, who it is for, how a walk works, what is enforced and where enforcement stops, how a record is built, what gets posted, what to do before you go, and the questions people actually ask |

Everything is scoped: the tokens and typefaces live on `.trek-scope`, applied by `app/trek-buddy/layout.tsx`. **The storefront is untouched.** That is deliberate — the shop sells garments and its warm, characterful voice is right for that; this is where somebody decides whether to get into a car at four in the morning with strangers, and it needs a different one.

---

## 1. How it was judged

Three things were read end to end: the whole current feature (17 routes, 27 components, 8 action modules), the running app, and — for the first pass only — the prototype. The two were diffed under three lenses (visual language, information architecture, data surfacing), producing 84 gaps. The five root causes, all still true and all now addressed:

| # | Root cause | Consequence |
|---|---|---|
| R1 | The hour-colour idea was ported at half strength | A board could not "read as a day passing" — a sunrise walk looked identical to a midday one |
| R2 | **No shell** — no fixed bar, no layout, no persistent identity or unread counts | Every page re-introduced the product. Nothing felt like an app |
| R3 | **Prose was the first read** — ~40% of pixels on the board and walk pages were 12px grey body copy | Mechanisms, ledgers and state machines rendered as terms-and-conditions |
| R4 | **No people** — four inconsistent monograms, no face piles, one stock landscape per member | A platform about finding buddies showed no buddies |
| R5 | **Counts were strings** — `"3/8"`; trust rung SELECTed in Postgres and dropped in the action layer; the waitlist filtered out of every read | The numbers that would make it feel alive never became visual |

### Definition of done

- **D1 — It reads as a day.** Every surface carrying a departure hour takes that hour's colour, *small*.
- **D2 — Nothing is text that could be a picture.** Blocks of more than two title+body pairs become tiles, a ledger, a meter, a timeline or a state diagram, with the sentence kept. *No information is deleted.*
- **D3 — People are visible.** One avatar primitive, faces on every card, row and thread.
- **D4 — Every count has a visual form**, and the numeral becomes its caption.
- **D5 — Every state is designed**: empty, loading, full, cancelled, waitlisted, locked.
- **D6 — It survives an empty database.** The board has zero walks today.
- **D7 — A cautious person can say yes.** Women-only, senior-friendly, difficulty, pace, languages, minimum party and the withheld meeting point are legible and unmissable wherever they apply. This is the point of the product, not a feature of it.
- **D8 — It reads as serious.** No slogan, no decorative monospace, no saturated fill that is not carrying meaning, one accent per screen.

---

## 2. The design system

### 2.1 Type — three faces, three jobs, scoped to `.trek-scope`

- **Newsreader** (`font-display`) — headlines and names. `trek-h1` (clamp 30→46, weight 400) · `trek-h2` (23→31) · `trek-h3` (19, weight 500) · `trek-lede` (a pull-quote, and only that). **`font-light` is banned.**
- **Inter** (`font-body`) — every sentence, every button, every input label.
- **IBM Plex Mono** (`font-mono`) — **a figure only**: a count, a time, a distance, a price, a queue position, a date in a fixed column. Never a heading, a button, a label, an eyebrow, a status, a tab or a sentence.

Labels: `trek-label` (11px, medium, uppercase, 0.08em — a key or a section stamp) · `trek-label-xs` · `trek-eyebrow` (0.14em, one per screen). Figures: `trek-figure`, `trek-figure-lg`, `trek-datum-key`. `tabular-nums` on every numeral run.

### 2.2 Colour — fixed jobs that never swap

- **Forest `#1F4A2E`** — the primary act, and confirmation. **Sage `#6E9B79`** — trust, vouches, completion, and the accent on ink bands.
- **Amber `#A76F1E` / ember `#8A5A17` — urgency only.** A countdown, "leaving soon", an unread count, a request waiting on a host. It is not a button colour, an eyebrow, a selection, a focus ring or a brand colour.
- **Clay `#99694F`** — a limit, a full walk, a waitlist, a cancellation. **Never red.**
- **Slate `#47597A`** — night and before-light.
- Ground `--paper #FAFAF8` · `--paper-warm` · `--paper-deep` · cards `--surface` · ink `#0F1210` · `--ink-raised`.
- Rules: `--rule` between things · `--rule-soft` inside a card · `--rule-warm` on warm grounds and every dashed edge.

### 2.3 The hour system

`lightForTime()` → `{ key, label, color, ink, tint, bg, fg, bar, onDark, wash }`. Buckets `<05` predawn · `<08` dawn · `<17` day · `<20` dusk · else night. Always `dotColor(light, ground)` for a solid fill and `hourInk(light, ground)` for type — night is the one band dark enough to vanish on an ink surface. The hour is expressed **small**: a dot, a 4px rail, a thin meter fill, a neutral chip with a coloured dot.

### 2.4 Shape, elevation, motion

Radius `--r-bar 2 · --r-stamp 3 · --r-tag 4 · --r-input 6 · --r-card 8 · --r-panel 10 · --r-shell 12`, monotonic with surface size, plus `999px` for every pill, avatar, dot and meter segment.
Elevation is shallow: `--shadow-card / lift / panel / float`. Cards lift **2px**; rows never lift. Rings are `box-shadow: 0 0 0 Npx`, never a border.
Border width encodes state: 1px solid normal · 2px solid selected-or-critical · 1px dashed `--rule-warm` provisional or locked.
Motion: `.tb-pulse` beside something genuinely live, and transitions at .2s / .25s / .26s. **Ken-burns and marquee are retired.** All of it inside `prefers-reduced-motion` guards.

### 2.5 Layout

One measure: `<section className="trek-band bg-…"><div className="trek-measure">` — full-bleed band, 1200px inner, 40px gutter (24px under `sm`). Two-column bodies `lg:grid-cols-[minmax(0,1fr)_360px]`. Sticky rails at `top-[88px]` (64px bar + 24). First band clears the bar with `pt-28`+.

### 2.6 Voice

Sentence case, second person, real em-dashes, no exclamation marks, no slogans. State mechanics, not promises. **The product's existing copy is kept** — it is the best thing about it. What changed is that it stopped being the first read.

---

## 2. Component inventory

New primitives under `components/trek/ui/`:

| Component | Replaces | Job |
|---|---|---|
| `Avatar` | 4 ad-hoc monograms | Circle, sizes 16/24/32/40/56/96, two derived initials, tint from a 4-entry rotation hashed on user id, role ring as stacked box-shadows (dawn = you, clay = mentor, forest = host) |
| `FacePile` | nothing | Overlap −6px, 2px cut-out ring in the ground colour, cap 5 + `+N` disc |
| `SeatMeter` | the string `"3/8"` | One segment per seat, filled in the hour colour, empty `#EFEADB` / `rgba(248,245,237,0.15)`. **Never a percentage bar.** Caption counts the same denominator as the segments |
| `QuorumMeter` | `PlanRail` pips | `min_party` progress — a different meter with its own caption, because it counts a different thing |
| `HourPill` | nothing | `HH:MM · First light` in the hour's `bg`/`fg` |
| `PhotoScrim` | 6 hand-written gradients | The only place a scrim is written |
| `Figure` / `Datum` / `StatStrip` | grey mono runs | A number set large with its key above it |
| `Chip` | 5 forks of pill markup | `chip(on)` on dark, `chipLight(on)` on cream, as colour triples |
| `SectionLabel` | 30 inline spans | The single 10px/0.22em mono stamp |
| `EmptyState` | 10 identical dashed boxes | Hour-gradient figure, ghost card outline, one line of the existing copy, one pill |
| `Skeleton*` | white screens | A ghost per new component, in the same geometry |
| `JourneyRail` | nothing | Asked → Confirmed → Point released → Walked → Vouched. **The whole product in five nodes, currently drawn nowhere** |
| `DayArc` | nothing | 04:00→23:00 ribbon in the five hour colours with per-band counts — the board's temporal index |
| `LiveTicker` | nothing | Pulsing dot + clock + count-up figures |
| `Marquee` | nothing | The 40s word strip and the 60s photo contact sheet |
| `RouteSketch` | grey holes | Deterministic contour/elevation SVG from `distance_km` + `gain_m` + `difficulty`, tinted by hour — the coverless-card field, so a board with no photographs still looks composed |

Rewritten: `TrekPlanCard`, `PlanMasthead`, `PlanRail`, `TrekShelf`, `BoardFilters`, `Inbox`, `PlanChat`, `RecapPanel`, `Evidence`, `TrustCard`, `PersonCardTile`, `YouCard`, `WhatTheBoardDoes`, `SafetyNotes`, `Guidance`, `QuickStart`, `Countdown`, `TrekGate`.

New shell: `TrekTopBar`, `app/trek-buddy/layout.tsx`, `loading.tsx` / `error.tsx` / `not-found.tsx`.

---

## 3. Screen targets

| Screen | Route | Target |
|---|---|---|
| **First page** (signed out) | `/trek-buddy` | Type-led hero with a contained photograph and the real counts → what this is / what it is not → **who it is for** (four people, four fears, and the specific provision each one gets) → how a walk works end to end, with the five-stage rail → **what is enforced and where enforcement stops**, side by side in the same weight → how a record is built → the six kinds of outing with their real windows and rules → the six things to do before you go → the questions people actually ask → one quiet act. |
| **Board** | `/trek-buddy` (signed in); `/discover` folds into it | Ink control band (what the screen is, the counts, search, the day arc, the filters) → leaving-soon rail on the ink→paper seam, the one place amber is correct → one walk given the width → buckets in a 3-col grid. One door per object: the duplicate browse route is retired. |
| **Event** | `/trek-buddy/[id]` | 440px photographic masthead with a facts `<dl>` → two columns. Left: the plan as a 22px Fraunces lede, the day as a coloured timeline, bring as chips, *going* as a face-pile card, chat preview, host card with follow. Right: sticky ink action rail — hour, countdown, seat meter, cost, the act. Eleven identical `<Block>`s become three shells. |
| **Create** | `/trek-buddy/new` | 4 steps with a **live card preview** in the rail that recolours as the hour changes. Activity tiles, not a select. |
| **People** | `/trek-buddy/people` | Mentors as 2-up photographic cards; everyone else as 3-up person cards with avatar, tagline, activity chips, and an events/vouches/streak footer. |
| **Person** | `/trek-buddy/people/[id]` | Photographic header, 96px avatar with role ring, 5-stat strip → trail log (counted from what happened), reviews, badges rail, hosting-next rail. |
| **Basecamp** | `/trek-buddy/basecamp` | The account home. `/yours` merges in. Greeting + streak + 4 stat tiles on ink → requests queue **with evidence in the row** → your events as meter rows → activity feed → rail with you-card and following. |
| **Messages** | `/trek-buddy/messages` | A real two-pane shell: 340px thread list with unread pills and hour bars, thread with face pile, system pills, bubbles. |
| **Console** | `/trek-buddy/[id]/console` | Ink header with identity and countdown, 3 tabs (roster / comms / money), asking-to-come cards, confirmed rows with check-in, waitlist with promote, rail with the meeting point in a 2px amber card. |
| **Recap** | `/trek-buddy/[id]` (and a browsable archive) | Photo wall in a masonry grid, vouch prompts on ink, reviews, who-was-there, and the amber "do it again" re-host card. |
| **Invite / share** | `/trek-buddy/[id]` panel | The prototype's two-up invite card on a radial dawn ground, with copy state. |
| **Onboarding** | `/trek-buddy/setup` | 3 steps on a dimmed photograph, progress dots, activity tiles, the deal as 4 numbered rows. |

---

## 4. Build order

Strictly ordered — each phase compiles and renders before the next starts.

- **P0 · Foundation** — hour tokens + `dotColor`, radius/shadow/surface tokens, figure & datum classes, keyframes, `components/trek/ui/*` primitives. *Nothing visible yet; everything depends on it.*
- **P1 · Shell** — `TrekTopBar`, `app/trek-buddy/layout.tsx`, loading/error/not-found. *Every page instantly stops re-introducing the product.*
- **P2 · Board + card** — `TrekPlanCard` rebuilt, board rebuilt, discover folded in, first page built.
- **P3 · Event + rail** — masthead, timeline, roster face pile, sticky action rail, the eleven blocks collapsed.
- **P4 · People + person.**
- **P5 · Basecamp** (absorbing `/yours`) **+ Messages.**
- **P6 · Create + onboarding + console + recap + invite.**
- **P7 · Prose demolition** — `WhatTheBoardDoes`, `SafetyNotes`, `Evidence`, `Guidance` re-cast as tiles/ledgers/diagrams, sentences preserved behind disclosures.
- **P8 · Verify** — every route rendered in the browser at desktop and mobile, console clean, `next build` green.

### Data-layer fixes that ride along (small, required for the visuals)

- `getPerson` / `getPeople` map `trust_rung` (already SELECTed in migration 065, dropped in the action).
- `min_trust` added to `TrekPlanRow` so the bar to ask is visible to the people it excludes.
- `getMyTreks` / `getTrekPlan` stop filtering `waitlisted` out of the roster, so the waitlist UI is reachable.
- `getMessages` selects `is_announcement` so announcements can be styled apart from chatter.

### Explicitly out of scope

See §5.

---

## 5. Progress

- [x] **P0 · Foundation** — hour tokens + `dotColor`, radius / shadow / surface tokens, figure and heading classes, the `.trek-scope` design language, `components/trek/ui/*` primitives.
- [x] **P1 · Shell** — `TrekTopBar` (fixed, contour mark, sentence-case nav, a thumb bar on phones), `app/trek-buddy/layout.tsx`, `TrekFooter`, loading / error / not-found boundaries, and the `<Toaster />` that had never been mounted on this half of the app.
- [x] **P2 · Board + card + first page** — `TrekPlanCard` rebuilt, the board rebuilt, `/discover` folded into it, and the signed-out first page written as a full argument.
- [x] **P3 · Walk page** — masthead, coloured itinerary timeline, roster, sticky action rail, quorum meter, the eleven identical blocks collapsed.
- [x] **P4 · People and person** — directory, profile, trust rung surfaced, `getPersonPlans` added so a profile is no longer a dead end.
- [x] **P5 · Basecamp and messages** — `/yours` folded into Basecamp; a real two-pane messaging surface; announcements distinguishable from chatter.
- [x] **P6 · Compose, onboarding, console, recap, invite** — a live card preview that recolours with the hour, a three-step door, an operations console, a recap wall, a real share card.
- [x] **P7 · Prose demolition** — the safety and trust components re-cast as fenced grids, ledgers, audience-railed accordions and figure rows. No sentence deleted.
- [x] **P8 · The reset** — the prototype's aesthetic dropped; new typefaces, restrained palette, forest primary, amber confined to urgency, motion cut to one pulse, and the first page rewritten as what-this-is / who-it-is-for / what-is-enforced.
- [x] **P9 · Verify** — `npx tsc --noEmit` clean, `npx eslint` clean on every trek surface, every route returns without a build error, dead components removed and orphaned ones mounted.

- [x] **P10 · A board with something on it** — `scripts/seed-trek-demo.mjs`, and the two database faults it uncovered.

### The demo board

`node scripts/seed-trek-demo.mjs` fills the development database with a board that can actually be judged: 7 members (a mentor, a woman-only host, a 67-year-old who posts walks for knees like hers, somebody a year in), 11 walks spread across all five hour bands and three weeks, 3 completed walks behind them, 34 vouches counted from those, a full walk, a women-only walk, three senior-friendly walks, and 3 people waiting on a decision from *you*.

It refuses to run unless `NEXT_PUBLIC_APP_URL` is localhost. Every member is `demo-…@dewdropz.test`, and `--undo` removes all of it — verified by running it and confirming the database returned to 0 plans, 0 requests, 0 vouches, 0 follows and its original 2 auth users.

Everything goes through the application's own rules, with one exception, commented in the script: the completed walks are back-dated on a direct connection with `session_replication_role = replica`, because `trek_plans_20_immutable()` correctly refuses to let a posted walk's date move and there is otherwise no route to a walk that has already happened.

### Faults it uncovered

1. **Signup was broken for everybody** — every account creation returned `500 Database error saving new user`. `public.profiles_trek_moderate()` (058) carries no `SET search_path` and calls `trek_moderate_field` unqualified; GoTrue connects with `search_path = auth`, so it resolved to nothing and the whole `auth.users` INSERT aborted. Every other writer of `profiles` has `public` on the path, which is why it never showed up. Fixed in `085_restore_auth_trigger_grants.sql`, which also restores the two `supabase_auth_admin` grants that 066's blanket revoke took with it.
2. **An account could not be deleted.** `trek_plan_requests.decided_by` and `.checked_in_by` referenced `profiles` with no delete action, so any member who had ever confirmed somebody was permanently undeletable — and the more they hosted, the more certain it was. Fixed in `086`: both become `ON DELETE SET NULL`, matching what the other 38 references to `profiles` already do. **Not `CASCADE`** — these columns record who pressed Confirm, they do not own the row (`user_id` does, and it already cascades), so cascading would mean a departing host erased the roster record of everyone they ever confirmed.

   Unblocking it exposed two more faults behind it, each only reachable once the one in front was fixed:

   - **`trek_requests_require_active()` had the same missing `search_path` as the signup bug** — and so did 23 other trigger functions. `087` pins `search_path = public` on all of them, and carries the query that finds the next one. This was the third instance of one fault; closing it as a class was cheaper than finding the fourth in production.
   - **`trek_requests_guard()` blocked its own cascade.** Deleting a host fires two referential actions at once — the walks CASCADE away, and `decided_by` SET NULLs — and some of those updates land on rows whose walk has already gone, so the guard's opening lookup raised `no such trek`. `088` returns early on `UPDATE` when the walk is missing, which can only mean the row is on its way out; the raise stays on `INSERT`, where it is a real caller error. Every gate in the function is otherwise byte-for-byte unchanged.

   Verified end to end against the seeded board: deleting the most heavily referenced member (3 walks hosted, 8 rows decided, 4 check-ins, 12 vouches) succeeds under GoTrue's own `search_path`, takes her walks and her own requests with her, and — in a constructed co-host case — leaves another member's roster row intact with `decided_by` nulled and `decided_at` preserved. The seed's `--undo` no longer needs its hand-clearing workaround: a plain delete now works, which is the real proof.

### Left deliberately undone

- **`/trek-buddy/preview`** stays — a development-only route (404 in production) rendering every surface against typed fixtures in `lib/trekPreviewData.ts`. It reads and writes nothing, and it is how a component is judged without waiting on data.
- **Renaming.** The lockup reads *TrekBuddy*; the storefront's own navigation still says *Trek Buddy*. Reconciling the two across the shop is a brand call, not a UI one.
