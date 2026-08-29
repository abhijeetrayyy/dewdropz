# Trek Buddy — Phase 1

**Date:** 29 August 2026
**Constraint set by the client:** no cron jobs at this stage. Resources are limited but not desperate — where a thing can be derived rather than swept, derive it.

That constraint is not a compromise here. Migration 055 already made the argument, in the codebase's own words:

> *"Derived rather than swept by a job: a boolean a cron has to maintain is a boolean that is wrong whenever the cron is late."*

Everything in item 1 below follows that rule, and item 3 keeps to it.

---

## Item 1 — Time and lifecycle · **DONE**

The whole of `TREKBUDDY-TIME-AUDIT.md`, fixed without a job.

**The root cause was one sentence:** the database models a trek as an interval (`starts_at` → `ends_at`) and the product read it as an instant. Eleven of twelve date filters compared `starts_at`. On a day walk the two are hours apart; on the six-day expedition the schema was widened to allow, they are six days apart.

**What shipped:**

- `lib/trek-lifecycle.ts` — one derived lifecycle (`upcoming` / `under_way` / `finished` / `cancelled` / `hidden`), plus `askStateOf()`, `durationDays()` and `dayNumber()`. Nothing stored, nothing swept. **18 tests.**
- **A trek stays with its party while they are on it.** `getMyTreks` filtered both lists to `starts_at > now()`, so a six-day trip left the host's and every joiner's only dashboard on its first morning — losing them the meeting point, the roster and the link to their group chat for the five days they were actually out.
- **The board carries trips that are out now**, marked `Day 3 of 6` rather than silently dropped.
- **"Never answered" is a state you can see.** An undecided ask used to stay `requested` for ever — the trigger blocks a late confirm, no job settles it, and all seven notification kinds fire on human action, none on time. The requester got silence, then absence. It is now derived and shown on basecamp, quietly, with the honest note that hosts are not obliged to answer.
- **Buttons that could not work are gone.** The host console offered Confirm on a finished trek and got an exception back from the row trigger; `PlanActions.tsx` had 394 lines and no reference to the clock at all.
- **Invite links no longer 404 in silence.** `/e/<token>` said nothing to the person who opened a real invitation a day late. It now distinguishes a wrong token from one that has set off — without revealing the walk.
- **`Countdown` has three states.** It rendered "under way" for any past instant, for ever; a walk from March still read as in progress.
- **Profile counts and the vouch list count finished treks**, not started ones.

**Correction to the audit:** §6 claimed the recap prompt fires mid-trek. It does not — `walkIsOver` already used `ends_at` correctly. It was the *vouch* list that counted from the first morning. Fixed; the audit overstated it.

---

## Item 2 — From "a walk" to any adventure

**The client's brief:** *"update post of walk to a poster event or something like that, because it is just not a walk. People can post for long rides like Bangalore to Ladakh, Delhi to Ladakh, and whatever it is, routes."*

### What is already true

More than expected. `trek_activity_kinds` (057) is a **data table**, not an enum: an admin adds a kind without a deploy, and it carries `day_part`, `start_min`/`start_max`, `default_start`, `min_party`, `needs_night_note` and `is_open_ended`. Eight kinds are seeded — trekking, bird watching, cycling, running, stargazing, camping, expedition, and `other` (host-named). Multi-day already works: `ends_on` up to 31 days, with `start_time`/`back_by` nullable because *"on a six-day trek nobody should have to invent a return time for day six."*

So the platform can already hold a Delhi→Ladakh ride. What stops it is **vocabulary and shape**, not schema.

### What is missing

| Gap | Why it matters for a Ladakh ride |
| --- | --- |
| **The word "walk" is hardcoded ~everywhere** | Buttons say "Post a walk", copy says "the walk you were on", empty states say "nothing on your calendar". A 12-day motorcycle ride is not a walk. |
| **A trip has one `place`, not a route** | `place` is a single 80-char string. Bangalore→Ladakh is an origin, a destination and a line between them. There is nowhere to put it. |
| **No distance or stage model** | `distance_km` and `gain_m` exist as single figures for the whole trip. A ride has daily stages, and "day 4: Sarchu → Leh" is the useful unit. |
| **`meet_area` assumes one rendezvous** | Right for a day walk. A point-to-point trip has a start point and an end point, and they are different towns. |
| **Capacity 3–8 and `min_party` 3** | Correct for anonymous strangers meeting on a hill. A convoy of two motorcycles is a normal, safe thing and is currently unpostable. |
| **The daylight instinct** | Long-distance riding legitimately starts at 04:00 and ends after dark. `trek_activity_kinds` can express this per kind; the seeded kinds mostly do not. |
| **No vehicle / self-support field** | "Own bike", "shared cab", "self-supported" changes who can join and what they need to bring. |

### The shape proposed

1. **Rename the noun in the interface, not the tables.** `trek_plans` stays; the *words* become "trip" (the thing posted) and "adventure" (the category). Renaming tables buys nothing and risks everything.
2. **Kind gains a `route_shape`**: `loop` (returns to start) or `point_to_point`. Only point-to-point trips ask for a destination.
3. **`ends_place` + `route_note`**, nullable, alongside `place`. Bangalore → Leh becomes expressible without inventing a stages table in phase 1.
4. **Seed the missing kinds** with honest windows: `road_trip`, `motorcycle_tour`, `backpacking`, `climbing`, `water` (kayak/raft). Each with its own `min_party` and start window.
5. **Loosen `min_party` to 2** for kinds where a pair is normal, keeping 3 for anonymous day walks. `min_party` is already per-kind — it just needs using.
6. **Copy sweep**: "walk" → "trip" across ~40 strings.

**Migration needed:** yes, one — `ends_place`, `route_note`, `route_shape` on the kind, plus seeds. Everything else is TypeScript.

---

## Item 3 — Post state: active, inactive, actionable

**The client's point:** *"if they passed the event date, then it means it has been inactive or some kind of not actionable."*

Item 1 delivered the derivation. What remains is making it visible and enforced everywhere, still with no job:

- [x] Lifecycle derived and used across board, dashboard, plan page, console, invites
- [x] Under-way trips marked, not dropped
- [x] Lapsed asks surfaced
- [ ] **The board needs an explicit "Past" view.** Today a finished trip is simply absent. A host and a joiner should both be able to find what they did — the roster is the answer to "who was supposed to be there", which 052 says is exactly why plans are hidden and never deleted.
- [ ] **The `status` column should gain `completed`** — *not* as a swept boolean, but written once by the host when they close a trip out (which they already do by writing a recap). That gives an intentional end state distinct from "the clock passed", which matters for disputes.
- [ ] **The open-plan cap counts `starts_at`** (052:800, and re-declared in 7 later migrations). A host on day 1 of a six-day trip frees a slot while still on the mountain. One-line fix, needs a migration.

---

## Item 4 — Moderation, spam, limits, regulation

Surveyed honestly; this area is **thinner than the rest**.

**What exists:** a report queue (`trek_reports`, 056) with `open`/`actioned`/`dismissed`; blocks; a takedown path via `hidden_at`; hosting gated behind `trek_can_host`; a trust gate on joining (062); a women-only gate enforced in a trigger; and a cap of 3 open plans per host.

**What does not:**

| Missing | Risk |
| --- | --- |
| **No rate limiting anywhere.** A `grep` for `rate_limit`, `throttle`, `cooldown` across every trek migration returns nothing. | One account can fire unlimited join requests, reports and messages. The only cap is on *open plans*. |
| **No report SLA or owner.** 052 is explicit that nobody is on report duty and that *"a queue with nobody behind it is worse than no queue, because the button implies supervision."* 056 built the queue anyway and recorded that the person is still unnamed. | This is a **legal and safety** exposure, not a feature gap. It is the single most important open item on the platform. |
| **No account-level suspension.** Takedown hides a plan; there is no way to stop a person posting. | A bad actor takes one plan down and posts another. |
| **No content scanning on free text.** `note`, `intro`, `message` are bounded in length only — except the contact-details check on intros. | Phone numbers and handles are precisely what this product is designed not to pass between people. That check exists for `intro` and should exist for every free-text field. |
| **No audit trail for moderation.** The storefront has `auditLog()`; Trek Buddy does not use it. | "Who hid this plan and why" is unanswerable. |

**Recommended order:** name the moderation owner (a decision, not code) → contact-detail scanning on all free text → rate limits on requests/reports/messages → account suspension → moderation audit trail.

Rate limits without a cron: a bounded count over a time window at write time, in the same trigger that already guards each write. No job required.

---

## Item 5 — Monitoring

**What exists:** `sendSlackAlert()` fires on plan cancellation, and on reports via 058.

**What does not:** nothing observes the health of the board. Worth adding, cheaply and without a job — each is a read on an existing admin page rather than a scheduled task:

- Asks that lapsed unanswered, per host (a host who never answers is a board problem)
- Trips that never reached `min_party` and therefore never released a meeting point
- Reports open longer than N days
- Hosts at their cap

`/admin/trek-buddy` already exists and is the natural home.

---

## Item 6 — UI and interaction consistency

Trek Buddy is the best-built part of this codebase visually (65 on-ladder radii to 1 off, per `WEB-POLISH.md`), so this is short:

- [x] Eight invisible form fields fixed (`bg-paper` on a `bg-paper` ground)
- [ ] Empty and lapsed states now exist in three places and should share one component
- [ ] The plan page is 872 lines and does too much; splitting it is a prerequisite for item 2's route fields
- [ ] `PlanActions` now has a lifecycle branch — the same branch belongs in `PlanChat` and `SafetyActions`

---

## Sequence

| # | Item | Needs a migration | Size |
| --- | --- | --- | --- |
| 1 | Time and lifecycle | no | **done** |
| 2 | Walk → adventure: copy sweep + route fields + kind seeds | yes (1) | large |
| 3 | Past view, `completed` status, open-plan cap fix | yes (1) | medium |
| 4 | Contact scanning, rate limits, suspension, audit | yes (1–2) | large |
| 5 | Monitoring readouts on `/admin/trek-buddy` | no | small |
| 6 | Component consolidation, plan-page split | no | medium |

**Note on migrations:** there is no migration runner in `package.json` — files in `supabase/migrations/` are applied by hand. Everything marked "no" above is live the moment it is deployed; everything marked "yes" waits on you running it.

**Recommended next:** item 2, as instructed. Item 4's first line — naming a moderation owner — is not code and is the one thing on this list that carries legal weight; it should start in parallel.
