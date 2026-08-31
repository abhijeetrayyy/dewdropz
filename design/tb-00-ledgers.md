# TrekBuddy — the three ledgers

Domains 9, 10 and 11 of `TREKBUDDY-COUNCIL.md`. These are not a council's
opinion; they are the register every council writes into. Three questions, asked
of every field the platform touches:

1. **Saved** — is it written down, where, for how long, and what happens to it
   when the person leaves.
2. **Shared** — who can see it. Six viewer classes, and a field with no answer
   for one of them is a field nobody has decided about.
3. **Logged** — what is recorded about the *action*, who can read that record,
   and whether it survives the actor deleting their account.

**Seeded 31 Aug 2026** from the migrations, not from memory. Every "who can see
it" row below is the actual RLS policy or the actual RPC return, cited. Rows
marked ⚠️ are gaps found while seeding — they are the ledger's output, and they
belong to the domain named beside them.

---

## The six viewer classes

| Class | Who |
|---|---|
| **anon** | Not signed in. A crawler, or somebody who followed a link. |
| **member** | Signed in and onboarded. Not on this trip. |
| **requester** | Has asked to come and has not been decided on. |
| **party** | Confirmed on this trip, or the host. |
| **host** | Posted the trip, or a co-host. |
| **admin** | `profiles.role = 'admin'`. |

The single most important fact in this document: **`anon` appears in exactly one
row of the Shared ledger, and it is a count.** There is no anonymous read policy
on any of the sixteen trek tables. The signed-out landing page renders four
aggregate figures from `getBoardPulse()` and nothing else.

---

## 1. The Saved ledger

### 1.1 What the platform stores — sixteen tables

| Table | What it holds | Rows per | Deleted with the person? |
|---|---|---|---|
| `trek_plans` | The trip post — 41 columns | one per trip | **CASCADE** — a host leaving takes their trips |
| `trek_plan_details` | `meeting_point`, `logistics` — the private half | one per trip | with the trip |
| `trek_plan_requests` | ask → decision → check-in | one per person per trip | `user_id` CASCADE; `decided_by` / `checked_in_by` **SET NULL** (`086`) |
| `trek_plan_co_hosts` | delegated authority | n per trip | CASCADE |
| `trek_messages` | trip chat + announcements | n per trip | CASCADE |
| `trek_message_reads` | `last_read_at` per person per trip | one per pair | CASCADE |
| `trek_notifications` | the seven kinds | n per person | CASCADE |
| `trek_recaps` | `body`, `photo_urls` after the fact | one per trip | with the trip |
| `trek_vouches` | *n* people who walked with them said so | one per pair per trip | CASCADE |
| `trek_follows` | follower → followed | one per pair | CASCADE |
| `trek_blocks` | blocker → blocked | one per pair | CASCADE |
| `trek_reports` | reporter, subject, reason, resolution | one per report | ⚠️ see 1.3 |
| `trek_host_requests` | asking for permission to host (`090`) | one per person | CASCADE |
| `trek_activity_kinds` | the eight+ kinds, admin-editable without a deploy | reference data | n/a |
| `trek_guidance` | editorial safety content | reference data | n/a |
| `trek_word_rules` | moderation word list | reference data | n/a |

### 1.2 What a person is — 23 columns on `profiles`

Columns rather than a `trek_profiles` table, deliberately (`052:133`).

| Group | Columns |
|---|---|
| **Identity** | `trek_display_name`, `trek_dob`, `trek_gender`, `trek_home_base`, `trek_intro` |
| **How they walk** | `trek_pace`, `trek_activities[]`, `trek_languages[]`, `trek_usual_days`, `trek_carries` |
| **Claimed experience** | `trek_experience`, `trek_years_out`, `trek_highest_m` |
| **Permission** | `trek_can_host`, `trek_terms_at`, `trek_phone_verified_at` |
| **Mentor** | `trek_mentor`, `trek_mentor_bio`, `trek_mentor_since` |
| **Moderation** | `trek_suspended_at`, `trek_suspended_reason`, `trek_warned_at`, `trek_warn_note` |

**Not stored, on purpose:** no photograph, no address (home base is a town from
a list), no phone number in a readable field, no free-text contact of any kind.
`trek_intro` carries a CHECK that refuses phone numbers, emails, `@handles` and
the words whatsapp / telegram / insta / snapchat / dm me (`054`).

⚠️ **`trek_experience` / `trek_years_out` / `trek_highest_m` are claimed, not
counted** — which sits awkwardly beside constraint §3.5 and R2/R3. Domain 2 has
to decide whether they are labelled as self-declared everywhere they render, or
removed. This is the one place the platform lets somebody assert a qualification.

### 1.3 Retention — the honest answer is "forever, and nobody decided that"

⚠️ There is no retention policy on anything. Nothing is ever deleted by age.
`052` makes the deliberate case for one of these — a plan is hidden, never
deleted, because the roster is the answer to *"who was supposed to be there"* —
but that argument was never extended to the other fifteen tables, so:

| Held forever, undecided | Domain |
|---|---|
| Trip chat, including a cancelled trip's chat | 7 |
| Declined and withdrawn requests — a record of who was turned down | 5 |
| Reports, including dismissed ones, and their free-text `detail` | 8 |
| Blocks, after either party has left | 8 |
| Notifications, read years ago | 13 |
| Recap photographs in storage | 6 |

⚠️ **Reports name a `subject_id` that CASCADEs.** If the reported person deletes
their account the report loses its subject, which is right for privacy and wrong
for the one case where the record matters. Domain 8, with domain 11.

---

## 2. The Shared ledger

### 2.1 The trip

| Field | anon | member | requester | party | host | Citation |
|---|:--:|:--:|:--:|:--:|:--:|---|
| Everything on `trek_plans` while `status='open'`, not hidden, and `starts_at > now() − 12h` | ✗ | ✓ | ✓ | ✓ | ✓ | `052:619` |
| A trip in **any** state — cancelled, hidden, past | ✗ | ✗ | ✓ | ✓ | ✓ | `052:632` |
| `meet_area` — the public rendezvous ("Chamba Bypass") | ✗ | ✓ | ✓ | ✓ | ✓ | on `trek_plans` |
| `meeting_point` — the exact one ("…at the fruit stall") | ✗ | ✗ | ✗ | **✓ only once `going_count ≥ 3`** | ✓ | `052:647`, `052:653` |
| `logistics` | ✗ | ✗ | ✗ | same rule | ✓ | `052:653` |

The three-person floor is the sharpest decision in the product and it is written
as a boundary, not a filter: **a stranger has no SELECT path to those columns at
all.** *"Nobody meets one-to-one. Until then the plan is a proposal, not a
rendezvous, and the address stays with the host."* A pending requester who could
read the meeting point would not need approving.

### 2.2 The party

| Field | anon | member | requester | party | host | Citation |
|---|:--:|:--:|:--:|:--:|:--:|---|
| `going_count`, `spots_left`, `capacity` | ✗ | ✓ | ✓ | ✓ | ✓ | generated columns, `052:189` |
| Party **first names** + `trust_rung` + `runs_it` — **no ids, no surnames** | ✗ | ✓ | ✓ | ✓ | ✓ | `089`, verified |
| A confirmed person's request row | ✗ | ✗ | ✗ | ✓ | ✓ | `052:671` |
| A **pending** request | ✗ | ✗ | own only | ✗ | ✓ | `052:671` |

*"Pending requests stay between the requester and the host: a queue everybody
can read is a queue that can be used to work out who was turned down."*

### 2.3 The person

| Field | anon | member | Notes |
|---|:--:|:--:|---|
| `trek_display_name`, `trek_home_base`, `trek_intro`, activities, languages, pace | ✗ | ✓ | Directory + person page |
| `trust_rung` — email / customer / walked / vouched | ✗ | ✓ | Four separate facts, never one score (`062`, `065`) |
| Counted outings, vouches, streak | ✗ | ✓ | Derived from finished trips (`078`) |
| `trek_dob` | ✗ | ✗ | Collected at setup; ⚠️ domain 2 must say what it is *for* |
| `trek_gender` | ✗ | ✗ | Used only to enforce a women-only trip, in a trigger |
| Suspended members | ✗ | ✗ | Hidden from card and directory (`059:73`, `059:120`) |
| Anything at all about anyone | ✗ | — | No anon read policy exists |

### 2.4 What leaves the platform

| Surface | What it carries | Citation |
|---|---|---|
| `/w/[token]` — the share card | **First names only, host first. No ids, no surnames.** Revocable; revoked → 404 | `091`, verified |
| `/e/[token]` — the invite link | Distinguishes a wrong token from an expired one **without revealing the trip** | Phase 1 |
| `TellSomeone` — tell a friend where you'll be | Composes the message using `meet_area`, the **public** field — verified that "at the fruit stall" does not appear | W-15 |
| Search engines | The signed-out landing only. `robots.txt` disallows `/trek-buddy/`, `/e/`, `/w/` — the trailing slash is the whole trick | W-09 |
| Slack | An alert on plan cancellation and on a new report | `lib/slack.ts`, `058` |
| Email | ⚠️ Nothing. See §3.3 |

---

## 3. The Logged ledger

### 3.1 What is recorded

| Action | Recorded where | Readable by | Survives actor deletion? |
|---|---|---|---|
| Resolving a report — hide, suspend, dismiss | On `trek_reports` itself: `resolution`, `resolved_at`, in the same transaction as the effect | admin | ✓ |
| Deciding a request | `trek_plan_requests.decided_by` / `decided_at` | party, host | ✓ — `SET NULL` on the actor, `decided_at` preserved (`086`) |
| Checking somebody in | `checked_in_by` | host | ✓ same |
| Granting host permission | `trek_host_requests.decided_by` / `decided_at` | admin | ✓ |
| Cancelling a trip | `cancelled_at`, `cancel_reason` on the trip; Slack alert | party | ✓ |
| Hiding a trip | `hidden_at`, `hidden_reason` (CHECK: hidden must have a reason) | admin | ✓ |
| Suspending a member | `trek_suspended_at`, `trek_suspended_reason` | admin | ✓ |

`086` is worth reading for its reasoning. `decided_by` is `SET NULL`, **not
`CASCADE`** — *"these columns record who pressed Confirm, they do not own the
row, so cascading would mean a departing host erased the roster record of
everyone they ever confirmed."*

### 3.2 What is not recorded — ⚠️ the gaps

| Gap | Consequence | Domain |
|---|---|---|
| **`auditLog()` is called from zero trek modules.** Confirmed by grep across all eight | A moderation action taken outside the report queue leaves no trace. "Who hid this and why" is answerable only when a report caused it | 11 |
| **No `lib/rateLimit.ts` call from any trek module** — six storefront/rental modules use it, no trek one does | One account can fire unlimited join requests, reports and messages. The primitive exists; this is wiring, not building | 8 |
| **No contact-detail CHECK outside `trek_intro`** | `note`, `itinerary`, `message`, `body`, recap text and the report `detail` are length-bounded only. Routing around the no-contact rule is a two-second job | 8 |
| **No record of a read** | Nothing knows whether a host ever *saw* the ask they never answered — so "hosts who don't answer" cannot distinguish rude from absent | 5, 11 |
| **No board-health readout** | Lapsed asks per host, trips that never reached `min_party`, reports open longer than *n* days, hosts at their cap. All are reads on an existing admin page, none exist | 12 |
| **Nothing on the log surface is tested** | One test file on the whole platform | 11 |

### 3.3 Notifications are in-app only

The seven kinds write to `trek_notifications` and render in the shell's unread
count. ⚠️ Nothing sends email, and there is no push. `resend` is a dependency
and `lib/orderEmails.ts` / `lib/rentalEmails.ts` exist for the shop, so the
capability is present and unused here.

That matters most for the one message `052` says must never be missed — *the
trip you were confirmed on has been cancelled* — which today reaches a person
only if they open the site. Domain 13.

---

## 4. So, how many things?

The question that started this, answered plainly.

| | Count |
|---|---|
| Tables the platform saves into | **16**, plus 23 columns on `profiles` |
| Of those, holding personal data | **13** (three are reference data) |
| Fields with a decided retention policy | **0** |
| Distinct viewer classes a field can be shared with | **6** |
| Tables readable by a signed-out visitor | **0** |
| Values a signed-out visitor can see | **4** — open trips, this weekend, members, completed |
| Fields gated behind the three-person floor | **2** — `meeting_point`, `logistics` |
| Fields that leave the platform in a share card | **1** — first name |
| Actions that write a durable record | **7** |
| Actions that should and do not | **6** (§3.2) |
| Notification kinds | **7**, none of which can fire on time passing |
| Delivery channels | **1** — in-app |
