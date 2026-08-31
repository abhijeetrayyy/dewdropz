# TrekBuddy Council — the running record

The homepage council judges a band of pixels. This one judges a product: a
stranger-facing board where somebody decides whether to get into a car at four
in the morning with people they have never met. The unit of work is therefore
not a section, it is a **domain** — a slice of the platform that has its own
data, its own states, its own failure mode and its own way of hurting a person
if it is wrong.

Fourteen domains, listed in §5. One council per domain. This file is the memory
between sessions: what was decided, what was rejected and why, and what is next.

**Read §3 (constraints) and §4 (rejected) before proposing anything.** Both
exist because this product has already spent rounds re-proposing things the
owner turned down, and because three of its constraints were learned from
faults that reached the database.

---

## 1. How a council runs

Same five phases as `HOMEPAGE-COUNCIL.md`, with one addition — a platform
domain has consequences a homepage band does not, so nothing leaves Judge
without a safety reading.

| Phase | What happens |
|---|---|
| **Recon** | Read the actual code, migrations and RLS. Write down what is really there — every column, every state, every policy, every current value. No opinions. Contradicting an existing document is a finding, not an error. |
| **Lenses** | Independent specialists critique and propose. Eight seats, §2. |
| **Judge** | Adversarial panel scores every proposal on: does it break a hard constraint, does it widen a read, does it fabricate, what does it cost to operate, and would the owner say yes. Anything breaking §3 is dead on arrival. |
| **Synthesis** | One buildable plan — add / remove / update, in priority order, each item specific enough to implement without inventing anything. Every item names its migration, or says "no migration". |
| **Build & verify** | Implemented, then proved. `tsc`, `eslint`, `next build`, every route rendered at 360 / 375 / 1440, overflow measured not estimated, and — for anything touching a read — the payload inspected for fields that should not be in it. |

### 1.1 Every council feeds the three ledgers

This is the part that is specific to a platform. A domain council is not done
when the screens are decided. It is done when it has added its rows to the
three cross-cutting ledgers in `design/tb-00-ledgers.md`:

| Ledger | The question it answers |
|---|---|
| **Saved** | What is written down, on which table, for how long, and what happens to it when the person leaves. |
| **Shared** | For every field: who can see it — the public, a signed-out visitor, any member, a member on the same trip, the host, an admin. A field with no row here is a field nobody has decided about. |
| **Logged** | What is recorded about an action after the fact, who can read that record, and whether it survives the actor deleting their account. |

A proposal that adds a field and does not add its three rows is incomplete and
Judge sends it back.

---

## 2. The eight seats

Every domain council convenes the same eight. They are independent — they do
not read each other's output before writing their own, because agreement
reached by reading someone else's argument is not corroboration.

| Seat | What it is responsible for |
|---|---|
| **Flow** | The path a person actually walks: arrival → decision → action → outcome. Dead ends, doors with no handle, the state you can reach and not leave. |
| **Interface** | Layout, hierarchy, type, colour, the hour system, empty and loading and failed states. Bound by §2 of `TREKBUDDY-OVERHAUL.md` — that design system is settled. |
| **Copy** | What the words say and what they promise. Sentence case, second person, mechanics not promises, no slogan. |
| **Data** | Schema, constraints, triggers, RPCs, indexes. Every mutation through a `SECURITY DEFINER` RPC. Derived over swept. |
| **Privacy** | Who can see each field. This seat has a veto: it can kill a proposal on its own, without a majority, because widening a read to make a screen nicer is how this product fails. |
| **Safety** | Women, older walkers, complete beginners, experienced expedition walkers. Four audiences, four different fears. What is enforced, and — said out loud — where enforcement stops. |
| **Operations** | Who does the work this proposal creates. A queue with nobody behind it is worse than no queue. Includes moderation load, host support, and what an admin can see at 11pm on a Saturday. |
| **Adversary** | Argues the proposal is wrong. Then argues someone will abuse it. Spam, impersonation, harvesting contact details, gaming the trust ladder, using the board to find a person rather than a walk. |

---

## 3. The hard constraints

These are drawn from `TREKBUDDY-REMEDIATION.md` §1 and from faults that already
reached this database. A proposal that breaks one is dead on arrival.

1. **Nothing may be fabricated.** No invented count, no placeholder person, no
   sample review, no rating that is not computed from something that happened.
2. **The privacy model is load-bearing. Never widen a read to improve a screen.**
   There is no anonymous read policy on any trek table and the signed-out page
   does not go looking for one. Party lists return first names and no ids.
3. **Every mutation goes through a `SECURITY DEFINER` RPC**, with
   `SET search_path = public`. Three separate production faults — a broken
   signup, an undeletable account, a guard that blocked its own cascade — were
   all the same missing `search_path`. `087` pinned it on 24 functions and
   carries the query that finds the next one.
4. **The platform holds no money.** Cost is a number a host states, settled
   between people. There is no escrow, no payout, no refund.
5. **Counted, never claimed.** Experience is derived from what happened on this
   board. There is no self-declared "experienced trekker", no stars, no score,
   and no aggregate that folds four kinds of evidence into one figure.
6. **No photograph on a profile, and no free-text contact anywhere.** A face is
   the most effective impersonation tool available and the most common basis for
   deciding who gets invited. The intro field has a CHECK that refuses phone
   numbers, emails, `@handles` and the words whatsapp / telegram / insta /
   snapchat / dm me. Every other free-text field should have it and does not
   yet — that is domain 8's first item.
7. **Derived, not swept.** No cron. *"A boolean a cron has to maintain is a
   boolean that is wrong whenever the cron is late."* Lifecycle, lapsed asks and
   day-number are all computed at read time in `lib/trek-lifecycle.ts`.
8. **A trek is an interval, not an instant.** `starts_at` → `ends_at`. Eleven of
   twelve date filters once compared `starts_at`, and a six-day expedition
   vanished from its own party's dashboard on the first morning. Any new filter
   states which end it means and why.
9. **The storefront and TrekBuddy keep separate palettes on purpose.** The shop
   sells; the board must be believed. Everything is scoped to `.trek-scope`.
10. **It must survive an empty database.** Zero walks today is a designed state,
    not a blank page.
11. **Amber is urgency only.** A countdown, leaving soon, an unread count, a
    request waiting on a host. Not a button, not a brand colour, not a focus ring.
12. **Mono is a figure only.** A count, a time, a distance, a price, a queue
    position. Never a heading, button, label, status, tab or sentence.

---

## 4. Rejected — do not re-propose

| # | Proposal | Why it is dead |
|---|---|---|
| R1 | The `TrackBuddy.dc.html` prototype aesthetic — amber gradients, glowing sun mark, hairline serif at 100px, drifting marquees, mono on every label | The owner's verdict: funky, not serious. Wrong colours, wrong fonts. **The prototype is not a source for anything.** |
| R2 | A "verified" badge | Nobody here verifies anybody. A badge that means nothing launders a stranger into a vetted person. |
| R3 | A rating, a score, or any single trust number | Folds four kinds of evidence into one figure nobody can interpret, and is how reputation systems start being gamed. |
| R4 | Profile photographs | Impersonation surface, and the main basis on which people get excluded from walks. |
| R5 | Permanent ambient motion — ken-burns, marquees, a standing pulse | Rejected twice on the homepage. Motion performs and resolves. |
| R6 | Animating opacity on content entry | A stalled animation takes the words away. A stalled transform leaves them legible. |
| R7 | Renaming the tables from `trek_*` to a trip vocabulary | Buys nothing, risks everything. The **words** change in the interface; the schema does not. |
| R8 | Any cron job, at this stage | Owner constraint, 29 Aug 2026. Derive it or do it at write time. |

---

## 5. The domains

Scroll order is not meaningful here; this is dependency order. Each gets its own
file in this directory.

| # | Domain | Owns | File | Council | Built |
|---|---|---|---|---|---|
| 1 | **The threshold** — signed out → signed in → onboarded | `/trek-buddy` signed-out, `TrekLanding`, `/setup`, the gate, `/safety` | `tb-01-threshold.md` | — | — |
| 2 | **Identity & profile** | `profiles.trek_*` (23 columns), `/profile`, `/people`, `/people/[id]`, the trust ladder | `tb-02-identity.md` | — | — |
| 3 | **Posting an event** | `/new`, `trek_plans`, `trek_plan_details`, `trek_activity_kinds`, the composer preview | `tb-03-posting.md` | — | — |
| 4 | **Discovery & watching** | The board, `BoardFilters`, `DayArc`, `SoonRail`, `trek_follows`, the missing Past view | `tb-04-discovery.md` | — | — |
| 5 | **Joining** — ask → confirm → point released → walked → vouched | `trek_plan_requests`, waitlist, `JourneyRail`, `min_trust` | `tb-05-joining.md` | — | — |
| 6 | **Lifecycle & time** | `lib/trek-lifecycle.ts`, `starts_at`/`ends_at`, cancelled, hidden, lapsed, the absent `completed` | `tb-06-lifecycle.md` | — | — |
| 7 | **Messages & comms** | `trek_messages`, `trek_message_reads`, threads, announcements, unread, `/messages` | `tb-07-messages.md` | — | — |
| 8 | **Trust, safety & moderation** | `trek_reports`, `trek_blocks`, suspension, warnings, women-only, the withheld meeting point, `TellSomeone` | `tb-08-safety.md` | — | — |
| 9 | **What is saved** | The Saved ledger — every column, its retention, its fate on account deletion | `tb-00-ledgers.md` | **seeded** | — |
| 10 | **What is shared** | The Shared ledger — the per-viewer visibility matrix | `tb-00-ledgers.md` | **seeded** | — |
| 11 | **Logs, audit & observability** | The Logged ledger, `admin_audit_log`, Slack alerts, board-health readouts | `tb-00-ledgers.md` + `tb-11-logs.md` | **seeded** | — |
| 12 | **Admin & operations** | `/admin/trek-buddy`, `trek_host_requests`, the report queue, takedown | `tb-12-admin.md` | — | — |
| 13 | **Notifications & the outside world** | `trek_notifications` (7 kinds), email, invite `/e/[token]`, share `/w/[token]`, recap cards | `tb-13-notifications.md` | — | — |
| 14 | **Cross-surface parity** | The Expo app, which has **no TrekBuddy at all** | `tb-14-mobile.md` | — | — |

### Recommended order

**2 → 1 → 5 → 6 → 8** first. Identity decides what a profile is, which decides
what the threshold can promise, which decides what joining can show, which
decides what lifecycle has to keep, which decides what safety has to enforce.
Domain 8 carries the only item on this platform with legal weight (§7 Q1), so it
should start in parallel on the non-code half from day one.

Then **3 → 4 → 7 → 13**, then **11 → 12**, then **14** last — mobile parity is
the largest single piece of new surface area and it should copy decisions, not
make them.

---

## 6. Recon already established

Done 31 Aug 2026 against the working tree on branch `mobile-remediation`.
Counted, not estimated. **No council needs to re-derive these.**

### 6.1 Size

| | Count |
|---|---|
| Routes under `/trek-buddy` + `/admin/trek-buddy` | 15 pages, plus `/e/[token]` and `/w/[token]` |
| Components under `components/trek/` | 45 |
| Server-action modules | 8 (`trekBuddy`, `trekAdmin`, `trekChat`, `trekConsole`, `trekRecap`, `trekShare`, `trekSocial`, `trekTrust`) |
| Exported server actions | 82 |
| Migrations touching TrekBuddy | 34, from `052` to `091` |
| Tables | 16 |
| `trek_*` columns on `profiles` | 23 |
| Automated tests on the whole surface | **1 file** — `lib/trek-lifecycle.test.ts`, 18 cases |

That last row is the one to look at. 82 server actions, 16 tables and 34
migrations of stateful, safety-bearing logic rest on eighteen assertions about
one pure function.

### 6.2 The sixteen tables

`trek_plans` · `trek_plan_details` · `trek_plan_requests` · `trek_plan_co_hosts`
· `trek_messages` · `trek_message_reads` · `trek_notifications` · `trek_recaps`
· `trek_vouches` · `trek_follows` · `trek_blocks` · `trek_reports` ·
`trek_host_requests` · `trek_activity_kinds` · `trek_guidance` ·
`trek_word_rules`

### 6.3 Three claims in the existing documents are stale

Found while reading the migrations. Each is recorded here so a council does not
plan work that is already done, or skip work it thinks is done.

- **`TREKBUDDY-PHASE-1.md` §4 says "No account-level suspension." It exists.**
  `056_trek_moderation.sql:260` adds `trek_suspended_at` /
  `trek_suspended_reason`, and `trek_require_active()` (`056:269`) raises
  `insufficient_privilege` on any write by a suspended member. There is a
  lighter rung too — `trek_warned_at` / `trek_warn_note`. `059` also hides
  suspended members from the person card and the directory. It is wired into
  `actions/trekAdmin.ts` and `/admin/trek-buddy`. The gap is not that it does
  not exist; it is that nothing has verified it end to end.
- **"No rate limiting anywhere" is wrong as stated.** The primitive exists —
  `029_rate_limiting.sql` and `lib/rateLimit.ts`, a fixed-window counter in
  Postgres chosen precisely because an in-process Map enforces nothing on
  serverless. Six modules use it: `contact`, `reviews`, `designs`, `media`,
  `rentals`, `rentalPayments`, `rentalExtensions`. **Zero trek modules use it.**
  So this is wiring, not building — a much smaller job than the document implies.
- **"No audit trail for moderation" is half wrong.** `trek_admin_resolve_report`
  writes the outcome onto the report row itself in the same transaction as the
  effect, so "why is this walk hidden?" has an answer. What is genuinely absent
  is any `auditLog()` call from the trek surface — confirmed, `grep` returns
  nothing across all eight action modules — so a moderation action taken outside
  the report queue leaves no trace at all.

### 6.4 TrekBuddy does not exist on mobile

The Expo app has 34 screens across 36 route files — shop, cart, checkout, rentals, designs, orders,
trails, journal, notifications, settings. It has **no trek surface of any kind**.
A member who joined the board on the web cannot see the walk they are on from
the app that has their orders in it. Domain 14.

### 6.5 The seven notification kinds, and what they cannot say

`060_trek_notifications.sql:36` permits: `request_received`,
`request_confirmed`, `request_declined`, `request_withdrawn`, `plan_cancelled`,
`point_released`, `vouched`.

Every one is caused by a person doing something. **There is no kind for time
passing** — no `request_lapsed`, no `plan_starting`, no `plan_finished`. That is
the direct consequence of constraint §3.7, and it is why an unanswered ask ends
in silence and then absence. Domain 13 has to decide whether "derive it at read
time" is a sufficient answer for something whose whole purpose is to arrive.

### 6.6 The signed-out door works, and that is unusual here

`app/trek-buddy/page.tsx` runs `generateMetadata` per request so the signed-out
half is `index: follow` with a real description and the signed-in half is
`noindex`. `robots.txt` disallows `/trek-buddy/` with the trailing slash, which
blocks every member surface and leaves the pitch crawlable. The landing renders
four counts from `getBoardPulse()` and names no walk and no member. Domain 1
starts from a good position and its job is mostly to check that the argument the
page makes is still the argument the owner wants to make.

---

## 7. Open questions for the owner

These block specific councils. Everything else can proceed without them.

1. **Who is on report duty, and what is the response time?** Blocks domain 8.
   `052` is explicit that nobody is, and that *"a queue with nobody behind it is
   worse than no queue, because the button implies supervision."* `056` built
   the queue anyway. This is the one item on the platform that carries legal
   weight and it is a decision, not code.
2. **Is TrekBuddy meant to reach the phone?** Blocks domain 14 entirely. The
   answer changes whether domains 3–7 design for one surface or two, so it is
   worth answering early even though the work is last.
3. **What is the noun?** The lockup reads *TrekBuddy*, the storefront navigation
   says *Trek Buddy*, and the design directory says *TrackBuddy*. Phase 1 also
   proposed moving from "walk" to "trip" across ~40 strings. Blocks the copy
   seat everywhere.
4. **Does a finished trip become a public record?** Blocks domains 4 and 6. The
   Past view does not exist, and whether a completed walk is visible to
   non-participants is a privacy decision with no current answer.
5. **Is hosting staying invite-only?** `trek_can_host` defaults false and `090`
   built a request queue. Blocks domain 12's sizing.

---

## 8. Decision log

Newest first. Every entry says what changed and why, so a later session does not
undo it by accident.

### 2026-08-31 · P0 built — and the finding that reordered the plan
**`trek_word_rules` has never been seeded.** 056 builds a complete content
scanner and 058 / 068 / 076 / 077 / 078 hang it off fifteen fields, deliberately
at the table rather than the RPC so that *"there is no way to get text into this
board without passing it."* No migration and no script ever inserted a rule, so
`trek_scan` has returned zero rows for every input the board has ever taken. The
engine is complete, wired, and switched off.

That is a fourth stale claim to add to §6.3: `TREKBUDDY-PHASE-1.md` §4 costed
content scanning as "large — build it". It is one migration that inserts rows.

Built: rate limits on nine write paths, an audit trail on nine admin actions,
and the cancellation email that 052 called the one message that must never be
missed. Written and awaiting apply: `103` (the rules, self-verifying) and `104`
(the last two unscanned fields). Full record in `design/TB-ACTION-PLAN.md`.

One Judge reversal worth carrying forward: **`trek_reports.detail` is not
scanned, on purpose.** Scanning the report form refuses the report that quotes
the number the harasser sent. Admin-read, so there is no channel to close.

### 2026-08-31 · The council is convened
Fourteen domains, eight seats, three ledgers. Recon complete (§6): 15 routes,
45 components, 82 actions, 16 tables, 34 migrations, 1 test file. Three stale
claims in the existing documents corrected. Five questions raised in §7, of
which Q1 has legal weight and should start immediately and in parallel.
No design decision taken yet — nothing here changes any code.
