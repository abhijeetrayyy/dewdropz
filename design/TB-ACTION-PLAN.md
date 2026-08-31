# TrekBuddy — the action plan

Output of the councils in `TREKBUDDY-COUNCIL.md`. Recon 31 Aug 2026 against the
working tree on `mobile-remediation`.

Work top-down. Each package names the files, the exact change, the guardrail
that stops it degrading something else, and the check that proves it landed.
**Do not batch packages from different tiers into one commit.**

## The finding that reorders everything

**The moderation engine is complete, wired to fifteen fields, and switched off.**

`056` builds a genuinely good scanner: literal / squeezed / leetspeak-folded
matching, `block` and `flag` actions, per-rule hints that never name the matched
pattern *("naming the matched word teaches evasion")*, and auto-reports for
flags. `058`, `068`, `076`, `077` and `078` hang it off the tables rather than
the RPCs, deliberately — *"there is no way to get text into this board without
passing it."*

It scans: `place`, `meet_area`, `note`, `night_note`, `activity_other`,
`meeting_point`, `logistics`, request `message`, `trek_intro`,
`trek_display_name`, `trek_mentor_bio`, `itinerary`, `bring`, recap `body`,
chat `body`.

`trek_word_rules` has **no seed**. Not in any of the 34 migrations, not in any
script. `trek_scan` therefore returns zero rows for every input,
`trek_guard_text` returns `{}` every time, no `block` has ever fired and no
auto-report has ever opened. The carefully-worded *"Phone numbers, emails and
handles cannot go in the …"* message is unreachable code.

The only content rule that actually bites today is the CHECK on `trek_intro`
(`054`), because it is a regex in the schema rather than a row in a table.

This changes the cost of the safety work by an order of magnitude. The prior
documents costed it as "large — build content scanning". It is **one migration
that inserts rows**. P0-1 below.

---

## Status

**P0 — shipped in the working tree, except the two migrations awaiting your
say-so.** `npx tsc --noEmit` clean, `eslint` clean on every file touched,
`next build` succeeds, 132 tests pass.

| Package | State | Evidence |
|---|---|---|
| **P0-1** seed the word rules | **written, not applied** — `103_trek_word_rules_seed.sql` | 18 rules (10 block, 8 flag). The migration verifies itself: 22 assertions inside the transaction, and it raises and rolls back if a legitimate string is blocked or a phone number gets through. Re-runnable without a database via `npm run check:moderation`, which parses the rules out of the .sql so the two cannot drift — **22/22 pass** |
| **P0-2** rate limits | **done** | 9 throttles across `trekBuddy`, `trekChat`, `trekSocial`, keyed on the member and not the address (`lib/trekLimits.ts`). The two profile gates sit *after* validation so a new member fumbling their date of birth cannot spend their allowance on submissions that were never written |
| **P0-3** scan the last fields | **written, not applied** — `104_trek_scan_the_last_fields.sql` | `cancel_reason` and `trek_host_requests.note` scanned. `trek_reports.detail` deliberately left open, reasoning in the file. Carries its own `SET search_path = public` and repeats 087's verification query |
| **P0-4** audit trail | **done** | 9 `auditLog` calls in `actions/trekAdmin.ts`. `setTrekMember` reads the before-state first — it is the only one of the nine whose previous value is not recoverable from the row afterwards, and the one most likely to be argued about |
| **P0-5** cancellation email | **done** | `lib/trekEmails.ts` + `trek.plan_cancelled` on the existing job queue, enqueued from `cancelPlan`. Reaches the waitlist as well as the confirmed party, escapes all member-supplied text, and ignores `notification_preferences` on purpose |

**P1 — started.**

| Package | State | Evidence |
|---|---|---|
| **P1-1** open-plan cap | **written, not applied** — `107_trek_open_cap_counts_the_end.sql` | Does not restate the function. `trek_create_plan` is redefined by six migrations and which one is live depends on what was applied by hand, so `107` reads the live definition from `pg_get_functiondef`, replaces one exact clause, asserts it matched exactly once, and executes the result. It cannot drop a parameter it does not know about, because it never retypes them |

### What was corrected while building

- **P0-3 reversed itself on `trek_reports.detail`.** The first draft of this plan
  said to scan it. Judge killed that: the report form is the only field where a
  member writes about another member, and the most valuable report the board will
  ever get is *"he sent me his number and asked me to move off the platform."*
  Scanning refuses exactly that report. `trek_reports` is admin-read, so nothing
  typed into it reaches another member — there is no channel to close.
- **The phone regex had to be bounded at both ends.** The obvious ten-digit rule
  finds a phone number inside a squeezed itinerary — `05:30 06:45 07:15 08:00`
  becomes an unbroken digit run containing one. Both fixtures carry that string.
- **`insta` and `signal` are not rules,** and the fixture proves it: `insta`
  matches "instant noodles" on a bring list, and "phone signal is poor above the
  ridge" is a sentence this board's members write correctly and often.

### Not verified

- **Neither migration has been run.** There is no migration runner in
  `package.json`; they are applied by hand. `103` proves itself on apply; `104`
  needs 087's query run afterwards, and it must return zero rows.
- **The cancellation email has not been sent end to end.** It depends on
  `app/api/cron/run-jobs` being called on a schedule. That route exists, but
  there is no `vercel.json` in the repo, so the schedule is configured somewhere
  I cannot see. **Worth confirming before trusting it** — if nothing drains the
  queue, the cancellation is queued and never delivered, which is the same
  outcome as before with more machinery.

---

## P0 — The board is unprotected right now

Nothing here is a feature. Each is a control that was designed, built and left
inert, or never wired.

### P0-1 · Seed `trek_word_rules` · migration `103`

The engine exists; give it rules. Categories are already constrained to
`contact` / `abuse` / `sexual` / `spam` / `commercial` / `unsafe` / `other`.

Minimum viable set, all `kind='regex'` unless noted:

| Category | Action | What it catches |
|---|---|---|
| `contact` | `block` | 10-digit Indian mobile, `+91` forms, and the squeezed form so separators cannot hide it |
| `contact` | `block` | email addresses |
| `contact` | `block` | `@handle` of 3+ characters |
| `contact` | `block` | whatsapp / telegram / signal / insta / snapchat / "dm me" / "ping me on" — as `word` rules, so the fold catches `wh4tsapp` |
| `commercial` | `flag` | "book now", "packages start", "per head", "limited seats", a rupee figure with "only" |
| `spam` | `flag` | a URL |
| `unsafe` | `flag` | "no permit needed", "we'll manage the permit", "avoid the checkpost" |

**Guardrail.** `trek_word_rules_guard()` already refuses a regex that does not
compile — but it validates one rule at a time and a bad rule takes down *every
write path on the board*. So: insert inside a transaction, then run
`testModeration` (it already exists, `actions/trekAdmin.ts`) against a fixture
of ten strings that must pass and ten that must not, **before committing**.

**Guardrail two.** `trek_squeeze` strips separators, so a `word` rule of `"pin"`
would match "the pin is at the top". Every literal rule must be ≥ 5 characters
or a phrase. Recorded here because the fold makes short literals dangerous.

**Check.** `SELECT * FROM trek_scan('call me on 98765 43210')` returns a
`block` row. A plan created with that in its note is refused with the contact
hint. A plan with "book now, ₹2000 per head" is created **and** opens an auto
report. Ten legitimate strings — "meet at the fruit stall", "bring 2l water" —
all pass.

### P0-2 · Rate limits on every trek write · code only, no migration

`rate_limits` and `lib/rateLimit.ts` exist and six storefront modules use them.
Zero trek modules do. One account can fire unlimited join requests, reports,
messages and follows.

`rateLimit()` keys on **IP**, which is wrong for an authenticated board —
members share CGNAT addresses and a phone changes IP between cells. Key on the
user id instead by passing it in the action name: `rateLimit(\`trek_join:${user.id}\`, …)`.

| Action | Limit | Window | Why |
|---|---|---|---|
| `requestToJoin` | 10 | 1 h | Asking to come is the harvesting vector |
| `postMessage` | 30 | 5 min | Chat, but not a flood |
| `reportTrek` | 5 | 1 h | A report queue nobody can drown |
| `createTrekPlan` | 5 | 24 h | The open-plan cap is 3; this bounds the churn |
| `followPerson` | 60 | 1 h | Follow-spam as a notification vector |
| `saveTrekProfile` / `saveTrekPerson` | 20 | 1 h | Bio-cycling to evade the scanner |
| `requestHostAccess` | 3 | 24 h | — |
| `vouchFor` | 20 | 1 h | Reputation is the thing worth gaming |

**Guardrail.** `rateLimit` fails **open** by design. That is correct for a
contact form and it is correct here too — this is protection, not
authorization, and the real boundaries are the RLS policies and the RPC guards.
Do not "improve" it to fail closed; a limiter outage would lock the board.

**Check.** The 11th `requestToJoin` inside an hour returns the throttle message
and writes no row. The 10th still works.

### P0-3 · Scan two of the three unscanned free-text fields · migration `104`

`trek_plans.cancel_reason`, `trek_host_requests.note` and `trek_reports.detail`
are length-bounded only.

**`cancel_reason` is the one that matters.** Every other field on `trek_plans`
is scanned; this one is not, and it is the only unscanned field on the board
that is *broadcast* — it renders on the plan page and it is the body of the
cancellation that reaches every confirmed member. A host cancelling with
"whatsapp me on 98765 43210 and we'll sort something out" does, to the whole
party at once, the exact thing the other fourteen scans exist to prevent, at the
moment those people are most likely to act on it.

**`trek_reports.detail` is deliberately left unscanned.** This reverses the
first draft of this package. The report form is the only field where a member
writes freely *about* another member, and the most valuable report the board
will ever receive is "he sent me his number and asked me to move off the
platform." Scanning it refuses that report, at that moment, telling the person
their evidence is not allowed. The usual argument does not apply either:
`trek_reports` is admin-read, so nothing typed into it reaches another member.
There is no channel to close. The reasoning is written into `104` itself so the
next audit finds an argument rather than a gap.

**Guardrail — and this is the sharpest one in the plan.** `104` must
`CREATE OR REPLACE trek_plans_moderate()`, and a replace does not merge with the
`ALTER FUNCTION … SET search_path = public` that `087:51` applied to it. It
replaces every property, so a replacement written without its own `SET` clause
silently un-pins it — which is the fault behind `085` (every signup returned
*500 Database error saving new user*), `087` (23 more functions with the same
hole) and `088`. The `SET` clause is in the new body, and 087's verification
query is repeated at the foot of `104`. **Run it after applying.**

**Check.** Cancelling with a phone number in the reason is refused. Cancelling
with a real reason works. 087's query returns zero rows.

### P0-4 · `auditLog()` on every trek admin action · code only

Confirmed by grep: zero calls across all eight trek modules. `resolveTrekReport`
records its outcome on the report row, which is good and covers the queue — but
`setTrekMember` (suspend / warn / grant host), `setTrekMentor`,
`decideHostRequest`, `saveWordRule`, `deleteWordRule` and `saveActivityKind` all
change the board and leave nothing behind.

`lib/audit.ts` already exists, is append-only at the table level, and never
throws. Add the call; that is the whole package.

**Check.** Suspending a member writes one `admin_audit_log` row with
`entity_type='trek_member'`, the actor, and before/after.

### P0-5 · The cancellation email · code only

`052` says outright that the cancellation notice is *"the one message that must
never be missed."* Today it writes a `trek_notifications` row and nothing else,
so it reaches a person only if they open the site — which is exactly what
somebody does not do at 5am on the morning of a walk that is no longer
happening.

`resend` is a dependency; `lib/orderEmails.ts` and `lib/rentalEmails.ts` are the
pattern. Add `lib/trekEmails.ts` with one template, called from `cancelPlan`.

**Guardrail.** Respect `notification_preferences.trek_buddy` the way
`lib/notifications.ts` does — except for this one message. A cancellation is
safety information, not marketing, and the preference should not be able to
suppress it. Say so in a comment, because it looks like a bug otherwise.

**Check.** Cancelling a plan with two confirmed members sends two emails and
writes two notification rows.

---

## P1 — States the product can reach and not describe

### P1-1 · The open-plan cap counts the wrong end · migration `107`

`052:800`, re-declared in seven later migrations: the cap of 3 open plans per
host counts `starts_at > NOW()`. A host on day 1 of a six-day trip frees a slot
while still on the mountain. One line, and it is the last surviving instance of
the interval-read-as-an-instant fault that `TREKBUDDY-TIME-AUDIT.md` closed
everywhere else.

### P1-2 · `status` gains `completed` · migration `108`

Not swept — **written once by the host** when they close a trip out, which they
already do by writing a recap. That gives an intentional end state distinct from
"the clock passed", which is what matters in a dispute. Constraint §3.7 holds:
nothing derives it, a person does.

### P1-3 · The Past view · code only

A finished trip is simply absent. `052` says plans are hidden and never deleted
precisely because the roster answers *"who was supposed to be there"* — and then
gives nobody a route to it. Both the host and every joiner should be able to
find what they did.

**Blocked on §7 Q4** — whether a completed trip is visible to non-participants.
Build the participant view now; the public view waits on the answer.

### P1-4 · A notification kind for time passing · migration `109` + code

The seven kinds all fire on human action. `request_lapsed` cannot exist, so an
undecided ask ends in silence and then absence.

The council's answer, within the no-cron constraint: **derive the state, write
the notification on next contact.** `askStateOf()` already computes `lapsed` at
read time. When any of the requester's surfaces load and the derivation says
lapsed, write the row once, idempotently, keyed on `(user_id, kind, plan_id)`.
It is late rather than punctual, and it is honest — which beats a boolean a cron
maintains badly.

---

## P2 — The vocabulary, and the shape of a trip

`TREKBUDDY-PHASE-1.md` item 2, unchanged and still right. Copy sweep "walk" →
"trip" across ~40 strings; `ends_place`, `route_note`, `route_shape`; seed
`road_trip`, `motorcycle_tour`, `backpacking`, `climbing`, `water`; loosen
`min_party` to 2 for kinds where a pair is normal.

**Blocked on §7 Q3** — the noun. TrekBuddy / Trek Buddy / TrackBuddy, and
walk / trip. One decision unblocks the whole package.

---

## P3 — Identity, and the one place a claim outranks a count

`trek_experience`, `trek_years_out`, `trek_highest_m` are self-declared, on a
platform whose stated rule is **counted, never claimed** (§3.5, R3).

`059` is aware of it and handles it well — *"the counted facts at the bottom are
things the board can prove, and everything added here is a claim the member
typed"* — but the interface has to keep that separation visible everywhere the
two appear together, and it is not audited. Domain 2 audits it, then either
labels every claim at every render site, or removes the three columns.

---

## P4 — Retention

Nothing is deleted by age, anywhere, and nobody decided that. Six categories in
`tb-00-ledgers.md` §1.3. The sharpest is `trek_reports.subject_id`, which
CASCADEs — the reported person deleting their account erases the subject of the
report about them.

---

## P5 — Observability

Four readouts on `/admin/trek-buddy`, each a read on a page that already exists,
none of them a job: asks that lapsed unanswered per host; trips that never
reached `min_party`; reports open longer than *n* days; hosts at their cap.

---

## P6 — Tests

82 server actions, 16 tables and 34 migrations rest on **one test file**.
`lib/trek-lifecycle.test.ts`, 18 cases, all about one pure function.

The reachable target with `node --test` and no new dependency is the pure layer:
`lib/trekBuckets.ts`, `lib/trekPhone.ts`, `lib/trek.ts`, the moderation fixture
from P0-1, and the rate-limit key derivation from P0-2.

---

## P7 — Mobile

TrekBuddy does not exist in the Expo app — 34 screens, no trek surface. Largest
single piece of new work on the platform and it should copy decisions, not make
them. **Blocked on §7 Q2.**

---

## Sequence

| Tier | Packages | Migration | Blocked on |
|---|---|---|---|
| **P0** | 1–5 | `103`, `104` | — |
| **P1** | 1–4 | `107`, `108`, `109` | P1-3 on Q4 |
| **P2** | vocabulary + route | one | Q3 |
| **P3** | identity audit | none | — |
| **P4** | retention | one | a decision |
| **P5** | observability | none | — |
| **P6** | tests | none | — |
| **P7** | mobile | none | Q2 |

**There is no migration runner in `package.json`** — files in
`supabase/migrations/` are applied by hand. Everything marked "code only" is
live on deploy; every migration waits on you running it.

**Numbering is contended.** `105_rental_email_normalised.sql` and
`106_rental_deposit_binding.sql` appeared in this working tree while this plan
was being written, so the trek migrations took `103`, `104` and `107`. If rental
work is still in flight, check the directory before adding `108` or `109`.
