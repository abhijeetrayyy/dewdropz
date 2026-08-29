# Trek Buddy — the time audit

**Date:** 29 August 2026
**Question asked:** what happens to a post, an ask, an invite and a message once the day passes — and what happens to a trek that runs over several days while it is still running.
**Method:** read of the eight `actions/trek*.ts` modules, the twenty-odd `05x–09x` migrations, and every component that renders a plan. Every claim below cites the line that makes it true.

---

## The finding, in one sentence

**The database models a trek as an interval. The product reads it as an instant.**

`trek_plans` carries both `starts_at` and `ends_at`, both `NOT NULL`, both maintained by `trek_plans_set_times()`. Migration 055 states the rule outright — *"A trip post expires the day the trek **ends**"* — and its comment even explains why the fallback hours are 06:00 and 18:00 rather than midnight, because *"midnight would make a trip vanish from the feed a day early at one end and accept joins for a trek already walking at the other."*

That reasoning is correct and it is not what the code does. Of the twelve date boundaries in `actions/trekBuddy.ts`, **eleven filter on `starts_at`** and one filters on `ends_at`:

| Line | Function | Boundary | Right? |
| --- | --- | --- | --- |
| 126 | `getLeavingSoon` | `starts_at >` | ok (it means "leaving") |
| 293 | `getTrekBoard` | `starts_at >` | **no** — drops a running trek off the board |
| 342 | `getMyTreks` (hosting) | `starts_at >` | **no** |
| 350 | `getMyTreks` (going) | `starts_at >` | **no** |
| 380 | `getTrekMemberCard` | `starts_at <` | **no** — counts it done on day one |
| 407 | `getOpenPlanCount` | `starts_at >` | **no** |
| 433 | `getBoardPulse` (upcoming) | `starts_at >` | ok |
| 449 | `getBoardPulse` (finished) | `ends_at <` | **yes — the only one** |
| 836 | `getPersonPlans` | `starts_at >` | **no** |
| 1152 | `getVouchable` | `starts_at <` | **no** |

For a day walk the two instants are hours apart and nothing shows. For the six-day expedition the schema was widened to support in 055, they are **six days** apart, and everything below is what happens in that gap.

---

## 1. A multi-day trek vanishes from its own party's dashboard on the first morning

**The most serious one.** `getMyTreks` ([actions/trekBuddy.ts:342](actions/trekBuddy.ts#L342), [:350](actions/trekBuddy.ts#L350)) filters both lists — the treks you host and the treks you are going on — to `starts_at > now()`.

It feeds `/trek-buddy` and `/trek-buddy/basecamp`, and `/trek-buddy/yours` redirects to basecamp, so **it is the member's only dashboard**.

A six-day trek starting Monday at 06:00: at 06:01 on Monday it disappears from the host's list and from every confirmed joiner's list, and stays gone until it is deleted. For the remaining five days — the days they are actually on the mountain — the party cannot reach their own trek from the one page built to hold it. That is where the meeting point, the roster, the announcements and the group chat live.

The chat is still open (correctly — see §7). There is just no longer a link to it.

## 2. An unanswered ask is never resolved, and nobody is ever told

This is the scenario in the question. Someone asks to come; the host never decides; the day passes.

- The row stays `status = 'requested'` **forever**. There is no cron, no lapse function, no sweep — `app/api/cron/` holds three jobs and none of them touch Trek Buddy.
- The plan drops out of the requester's dashboard at `starts_at` (§1), so it silently disappears from view.
- **No notification is ever sent.** The `kind` CHECK at [060_trek_notifications.sql:36](supabase/migrations/060_trek_notifications.sql#L36) permits seven kinds — `request_received`, `request_confirmed`, `request_declined`, `request_withdrawn`, `plan_cancelled`, `point_released`, `vouched`. Every one is caused by a person doing something. **There is no kind for time passing.** No `request_lapsed`, no `plan_starting`, no `plan_finished`.

So the person who asked gets silence, then absence. They are never declined, never expired, never told. And because the row is still `'requested'`, the host's pending count keeps counting it.

## 3. The host is offered a Confirm button that cannot work

[ConsoleClient.tsx:360](app/trek-buddy/[id]/console/ConsoleClient.tsx#L360) and [:371](app/trek-buddy/[id]/console/ConsoleClient.tsx#L371) render **Confirm** and **Decline** with no time check anywhere in the file.

But the row trigger `trek_requests_guard` ([052:560](supabase/migrations/052_trek_buddy.sql#L560), restated at [071:52](supabase/migrations/071_trek_waitlist_join.sql#L52)) refuses any transition into `requested`/`waitlisted`/`confirmed` once `starts_at <= NOW()`:

```sql
IF v_plan.starts_at <= NOW() THEN
  RAISE EXCEPTION 'this trek has already started' ...
```

`trek_decide_request` itself has no time guard, so the block arrives from underneath it. And because `declined` is *not* in the guarded set, **Decline still works while Confirm does not** — an asymmetry with no visible cause. The host presses Confirm on a walk that finished last week and gets an error toast for an action the interface offered them.

The message that surfaces is at least readable — `callTrek` passes RPC messages straight through ([:544](actions/trekBuddy.ts#L544)), deliberately. But the right fix is not to explain the refusal; it is not to offer the button.

## 4. The join CTA is live on a finished trek

[app/trek-buddy/[id]/PlanActions.tsx](app/trek-buddy/[id]/PlanActions.tsx) is 394 lines and contains **no reference to `starts_at`, `ends_at`, or the current time**. The 872-line plan page reads `starts_at` twice, both times to print a date.

So a trek from three months ago renders with its seat count, its spots-left, and a working "ask to come" button. The trigger is what stops it, at the point of press.

## 5. `Countdown` says "under way" forever

[components/trek/Countdown.tsx:43](components/trek/Countdown.tsx#L43):

```tsx
if (diff <= 0) return <span className={className}>under way</span>
```

Any past instant renders "under way". Not "finished", not the date — under way, permanently. A walk from March still reads as in progress today, on the plan page and in the host console's readout.

## 6. The recap is offered mid-trek and then refused

`getVouchable` ([:1152](actions/trekBuddy.ts#L1152)) selects plans with `starts_at < now()`. The recap RPC guards the other way ([078:60](supabase/migrations/078_trek_recaps_streaks.sql#L60)):

```sql
IF v_plan.ends_at > NOW() THEN
  RAISE EXCEPTION 'you can write this after the walk, not before'
```

On day two of six you are invited to write the recap, and told you cannot write it yet. The DB is right; the query that produced the prompt is wrong. Same shape as §3.

## 7. Invite links die on the first morning, and 404 with no explanation

[080_trek_invite_cards.sql:116](supabase/migrations/080_trek_invite_cards.sql#L116) ends the card query with `AND p.starts_at > NOW()`, and [app/e/[token]/page.tsx:60](app/e/[token]/page.tsx#L60) turns an empty result into a bare `notFound()`.

Two consequences. A six-day trek's invite link stops working on day one, while the trek has five days to run. And anyone who opens an invite a day late — the exact person the question is about — gets an unstyled 404 rather than "this one has set off" and a route back to the board.

## 8. Profile statistics count a trek as completed on its first morning

[054_trek_people.sql:207](supabase/migrations/054_trek_people.sql#L207) and [059_trek_person_card.sql:61](supabase/migrations/059_trek_person_card.sql#L61) both count treks done with `t.starts_at < NOW()`. Someone currently on day one of a Himalayan crossing already has it in their completed count, on a public profile card other members use to decide whether to walk with them.

---

## What is already right — do not "fix" these

Worth stating, because a sweep that changed every `starts_at` to `ends_at` would break all four.

- **Blocking joins at `starts_at` is correct.** You should not be able to join a trek that is already walking. The guard is in a trigger rather than a policy or a validator, with a comment explaining that server actions run as the service role and bypass RLS entirely. That reasoning is sound.
- **Chat closes on `ends_at`.** [076_trek_messages.sql:80](supabase/migrations/076_trek_messages.sql#L80): `IF v_plan.ends_at < NOW() - INTERVAL '7 days'`. Right boundary, and a grace week after it.
- **The recap guard uses `ends_at`.** Correct; it is the caller that is wrong.
- **Timezone handling is careful and correct.** `trek_ist_instant()` converts explicitly in `Asia/Kolkata`, and `trek_ist_today()` exists with a comment noting that `CURRENT_DATE` is yesterday for five and a half hours of every Indian evening. No bug here.

---

## The fix

One derived lifecycle, computed in one place, used everywhere. Everything above is the same bug wearing nine hats: *"has this trek happened yet"* is answered independently at each call site, and most of them answer it with the wrong column.

```
cancelled   status = 'cancelled'
hidden      hidden_at IS NOT NULL
upcoming    now <  starts_at
under_way   starts_at <= now <= ends_at      ← the state that does not exist today
finished    now >  ends_at
```

Then, by surface:

| Surface | Should show | Today |
| --- | --- | --- |
| Board, invite links | `upcoming` (+ `under_way` marked) | drops at `starts_at` |
| Your treks / basecamp | `upcoming` **and** `under_way` | drops at `starts_at` |
| Join / ask CTA | `upcoming` only, else explain | always live |
| Host confirm | `upcoming` only; decline stays open | always live, then errors |
| Recap prompt, "treks done" | `finished` only | `starts_at` |
| Chat | until `ends_at + 7d` | already correct |

Two things need more than a column swap:

1. **A lapse path for stranded asks.** When a plan reaches `starts_at` with rows still `requested`, they should become a terminal state (`lapsed`) with a notification — a new `kind`, since none of the seven fits. Derivable on read, but a notification needs a write, so this is the one place a scheduled job earns its keep. `app/api/cron/` already has the pattern.
2. **`Countdown` needs a third state** — before, during, after — instead of two.

**Scope:** ~9 call sites in `actions/trekBuddy.ts`, one component, one migration for the lifecycle helper and the `lapsed` status, one cron route. The DB already holds everything needed; almost nothing here is a schema gap.

---

## Appendix — reproducing

```bash
# every date boundary in the trek actions, with its function
grep -n "starts_at\|ends_at" actions/trek*.ts | grep -E "gt\(|lt\(|lte\(|> new Date|< new Date"

# the guards that refuse what the UI offers
grep -rn "starts_at <= NOW()" supabase/migrations/*.sql

# notification kinds — note that none is time-driven
sed -n '36,44p' supabase/migrations/060_trek_notifications.sql
```
