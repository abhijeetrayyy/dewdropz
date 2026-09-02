# TrekBuddy — the action plan

Output of the councils in `TREKBUDDY-COUNCIL.md`. Recon 31 Aug 2026 against the
working tree on `mobile-remediation`.

Work top-down. Each package names the files, the exact change, the guardrail
that stops it degrading something else, and the check that proves it landed.
**Do not batch packages from different tiers into one commit.**

## The finding that reorders everything — CORRECTED 31 Aug

**First reading (wrong about production):** the moderation engine is complete,
wired to fifteen fields, and switched off, because no migration or script ever
seeds `trek_word_rules`.

**Checked against the live database:** the table holds **125 active rules**,
hand-entered on 17 August 2026, and they are better than the ones drafted to
replace them. The engine is on. See the council's correction entry for the full
account.

**What survives, and it is still serious:** those 125 rules are **not in version
control**. They exist in one database and nowhere else. No migration, no script,
no seed. A restore from an older backup, a rebuilt environment, a fresh staging
copy or a new developer's local database comes up with an empty table — and an
empty `trek_word_rules` is not a degraded filter, it is no filter at all:
`trek_scan` returns zero rows for every input and all fifteen scanned fields
accept anything, with the board looking exactly as it does now.

So P0-1 changed shape entirely. It is no longer "seed the rules". It is
**version the rules that exist**, plus one narrow addition for the leetspeak
hole the live set genuinely has (`wh4tsapp` matches nothing, because 056's fold
applies only to `word` rules and the live set is almost all `regex`).

---

## The report system — 31 Aug 2026

Owner's direction: reports are the priority, the queue is worked **in
TrekBuddy's own admin area**, **no Slack**, and Resend carries **important
messages only** and must work the moment the API key is supplied.

### What was actually wrong

Every report this board has ever taken has told nobody. `reportTrek` fired
`sendSlackAlert`, and `SLACK_WEBHOOK_URL` has never been set — `sendSlackAlert`
returns immediately without a webhook, so the call did nothing at all. The
comment beside it read *"until somebody is named to own the queue, Slack IS the
queue."* That was never true for one second.

It was also aimed at the wrong half. It covered the Report button and missed
`trek_open_auto_report` entirely — the scanner's own reports, which are the ones
that catch a grooming pattern, an acid threat or a refusal by caste, and the
ones that most need a person quickly.

**There are 3 unresolved reports in production right now, all auto-flagged, all
12 days old.** Nobody has ever been told they exist.

### What was built

| | |
|---|---|
| **`108_trek_report_alerts.sql`** — **applied** | An AFTER INSERT trigger on `trek_reports` enqueues a `trek.report_opened` job. On the table, not in the action, for exactly 058's reason: reports arrive by two unrelated routes and only the table sees both. The enqueue is wrapped in its own exception block — a mail queue problem must never roll back the report it is about |
| **`sendTrekReportAlert`** in `lib/trekEmails.ts` | Emails every `profiles.role = 'admin'` — read from the role, not the unused `ADMIN_EMAILS` env var, because an env var goes stale the day somebody is made an admin. Idempotent on the report id. Skips silently if the report was resolved before the job ran |
| **The sidebar badge** | `getTrekQueueCount` had existed since 056 and was called from **nowhere**. It is now read in the admin layout, so the count sits beside "Trek Buddy" on *every* admin screen. The only badge in that nav, and the only one that earns it |
| **Slack, removed from the trek surface** | All five calls gone. Two were pretending to be the queue; three were noise — a message on every trip posted, every join request and every cancellation. A channel that fires on ordinary events is a channel people stop reading, and it was the same channel that had to carry a harassment report |

### What the alert deliberately does not contain

Not the reported text, not the reporter, not the subject. Category, source, open
count, and a link. Two reasons, the second being the one that matters: a
moderation decision should be made on the screen that records it; and email is
the least controlled surface this product touches — forwarded, synced, sitting
on a shared laptop — and the excerpt of a harassment report is exactly the
content this board works hardest to contain.

### Without the API key

`RESEND_API_KEY` is not set in this environment. The handler checks for it and
returns with a console line instead of throwing — the same shape
`rental.invoice` already uses for a missing GSTIN. A missing key is a
configuration fact, not a transient failure, and retrying it five times with
backoff would fill `/admin/jobs` with identical errors until whoever reads that
screen stopped reading it.

**Nothing is lost while the key is absent.** The queue is the system of record
and the badge is always accurate; the email is a nudge toward it. The moment the
key is set, every new report emails with no further change.

⚠️ **The same key gates the cancellation email** (`trek.plan_cancelled`), which
052 calls the one message that must never be missed. Until `RESEND_API_KEY`
exists, a cancelled trip still reaches its party only as an in-app notification.

### Proved end to end

Against the live database in a rolled-back transaction: inserting an
auto-sourced report enqueued exactly one `trek.report_opened` job carrying its
id, the open count moved, and one admin account has an address to send to. The
test report was rolled back and verified gone.

---

## Applied to the hosted database — 31 Aug 2026

All five outstanding migrations are **committed to production**. Each was
dry-run first inside a rolled-back transaction, then applied in its own
transaction that committed only after its assertions passed.

| # | What | Committed | Proof |
|---|---|---|---|
| **106** | `deposit_order_id`, `deposit_taken` | ✅ | both columns present; the 4 existing bookings intact |
| **105** | `rental_bookings.email` lowercased + CHECK | ✅ | constraint present; 0 un-normalised rows |
| **103** | the 125 live rules versioned, + 2 word rules | ✅ | its own fixture ran in-transaction — *"127 rules active. 11 pass, 7 block and 4 flag assertions held"*; `wh4tsapp` now caught, phone still blocked, squeezed itinerary and "per head" still pass |
| **104** | `cancel_reason` + host-request notes scanned | ✅ | all five original checks kept; new trigger live; **087's guard returns 0 unpinned functions** |
| **107** | open-plan cap counts `ends_at` | ✅ | clause replaced; `trek_create_plan` intact at 3075 chars and 26 parameters, with `p_meeting_point`, `p_min_trust`, `p_itinerary`, `p_bring`, `p_cost_paise` and `trek_require_active` all still present |

**The order was deliberate: 106 first, alone.** It closes a deposit-signature
replay where money leaves, and it has nothing to do with TrekBuddy.

**Nothing outstanding.** `supabase/migrations/` and the database now agree.

### One defect left in place on purpose

The live `chudai` rule is a `block`, and its own note claims *"no ordinary word
runs those six letters together."* One does: **`chudail`** (चुड़ैल, a witch) —
ordinary Hindi, and the shape of a real Uttarakhand trail reference. So "chudail
ka pahad" is refused, with a message about sexual content.

The POSIX fix is `chudai([^l]|$)` as a `regex`, which costs the leetspeak fold
that only `word` rules get. That is a moderation-policy trade rather than a
typo, so it is annotated in `103` and **not changed** — it belongs to whoever
owns the queue (council §7 Q1).

---

## Built after the migrations — 31 Aug 2026

`tsc` clean, `next build` green, **160 tests pass** (was 140).

| Package | State | Notes |
|---|---|---|
| **P1-3 · the Past view** | **done** | `getMyPastTreks` + `/trek-buddy/past`. A finished trip had no door at all: the board carries only what is current, Basecamp ends at `ends_at`, and a profile counted your outings without letting you open one — so the day after a trip, its roster, chat, announcements and meeting point were all still in the database and unreachable by everybody who was there. Scoped to trips you hosted or were confirmed on, which is the boundary `trek_plans`' own policy draws. Linked from Basecamp's "Your events" heading and the footer — **not** the top bar, which is a five-tab thumb bar measured at 360px with nothing spare (W-01) |
| **P6 · tests** | **started** | `lib/trek.test.ts`, 20 cases on the cost helper, Naismith gloss and the hour system. Needed one source change: `lib/trek.ts` imported `formatPrice` through the `@/lib/utils` alias, and `node --test` knows nothing about tsconfig `paths`, so a single aliased *value* import made the whole module untestable. Now relative |
| **P2 · vocabulary** | **object labels done, prose pass outstanding** | Every "Post a walk" is "Post a trip" — 28 replacements across 11 files, covering the CTAs, empty states, board counts and the composer's own labels. See the note below |

### Second round

| Package | State | Notes |
|---|---|---|
| **P5 · observability** | **done** | A Health tab on `/admin/trek-buddy`, placed first because it is the only tab that tells you something needed doing that nobody noticed. Four reads, no job: open reports with their age (3-day and 7-day bands, oldest), hosts who never answered an ask before the trip left, trips that finished without reaching `min_party` so the meeting point was never released, and hosts holding all 3 open slots — counted on `ends_at` since 107 |
| **P1-4 · the lapsed ask** | **done, derived** | `request_lapsed` now appears in the inbox. Synthesised at read time from rows the member already owns, not written: writing from inside a read is how a feed gets duplicates when two tabs load at once, and 055's rule against maintained booleans applies equally to a row a read path must remember to write. Needs no migration, so it is live on deploy. Honest cost, stated in the code: a derived entry cannot be marked read, so it is not in the unread badge — this makes it **visible**, not **delivered** |
| **P1-2 · `completed` status** | **killed, not built** | See below |
| **P2 · vocabulary** | **substantially done** | A further 45 replacements across the signed-out landing, the safety page, messages, the plan page, the join actions, onboarding, the profile and the error and metadata strings |

### P1-2 was killed on inspection

The plan called for `status` to gain `completed`, written once by the host to
mark an intentional end distinct from the clock passing — the distinction that
matters in a dispute.

**`trek_recaps` already is that.** 078 makes it one row per trip, host-only,
writable only after the trip has finished, with an author and a timestamp. It is
precisely "the host closed this out", already recorded, already attributable.

Adding a status value would have duplicated it while touching the one column
that dozens of queries and two RLS policies filter on — a wide blast radius for
no new information. What was actually missing was that nothing *surfaced* the
distinction, and the Past view now does: every finished trip shows whether it
has a recap, and prompts the host when it does not.

### A bug the tests found

`lightForTime('')` returned **predawn**, not the documented dawn fallback.
`?? '06:00'` catches null and undefined but not the empty string, and the `NaN`
guard behind it does not catch it either, because `Number('')` is `0` rather
than `NaN`. So a trip whose host never said when it leaves rendered in the
deepest, most urgent-looking band on the board. Postgres returns NULL for an
unset `time`, but a form field returns `''` — and `start_time` is nullable
precisely because 055 said *"on a six-day trek nobody should have to invent a
return time for day six."* Fixed in the source, not the fixture.

### Why the vocabulary pass stopped where it did

There are 431 occurrences of "walk" and 135 of "walks" across 69 files on this
surface, tangled with identifiers (`walksHosted`, `walkIsOver`) and with prose
where the word is still correct. A regex over all of it would have damaged the
best thing in this codebase.

So this pass changed only the strings that **name the thing you post** — the
client's actual complaint, that *"it is just not a walk. People can post for
long rides like Bangalore to Ladakh."* Sentences about walking as an activity
— *"somebody who has never walked a hill"*, *"until you have walked
together"* — are untouched, because they describe the act and are still true.

What remains is an editorial pass over the surrounding prose (the safety page,
the messages empty states, the landing argument), and it wants a person reading
sentences, not a script. It is the larger half by word count and the smaller
half by user impact.

---

## Status

**P0 — shipped in the working tree, except the two migrations awaiting your
say-so.** `npx tsc --noEmit` clean, `eslint` clean on every file touched,
`next build` succeeds, 132 tests pass.

| Package | State | Evidence |
|---|---|---|
| **P0-1** version the word rules | **rewritten, not applied** — `103_trek_word_rules_seed.sql` | Faithful export of the 125 live rules, `NOT EXISTS`-guarded so it is a no-op on production and the whole filter everywhere else, plus `whatsapp` and `instagram` as `word` rules to close the leetspeak hole. Fixture rewritten against the real rule set: 11 pass, 7 block, 4 flag. **The first draft would have failed on this database** — it asserted telegram/instagram were blocked when live they are flagged |
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
