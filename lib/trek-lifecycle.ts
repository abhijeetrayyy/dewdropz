// ── Where a trek is in its own life ──────────────────────────────────────────
//
// `trek_plans` has carried both `starts_at` and `ends_at` since 053, and 055
// stated the rule plainly: "A trip post expires the day the trek ENDS." It also
// argued the method — "Derived rather than swept by a job: a boolean a cron has
// to maintain is a boolean that is wrong whenever the cron is late."
//
// Both were right, and neither was applied. Eleven of the twelve date filters in
// `actions/trekBuddy.ts` compared against `starts_at`, so the product treated a
// trek as an instant while the schema modelled it as an interval. On a day walk
// the two are hours apart and nothing shows; on the six-day expedition 055 was
// written to allow, they are six days apart, and in that gap the trek fell off
// its own party's dashboard, counted as completed on its first morning, and
// stopped accepting the invite link the host had already sent out.
//
// So: one function, five states, derived. Nothing stored, nothing swept,
// nothing to be stale. The same argument 055 made, finally used.

export type TrekLifecycle =
  | 'cancelled'   // the host called it off
  | 'hidden'      // owner takedown
  | 'upcoming'    // hasn't left yet — the only state that accepts joins
  | 'under_way'   // between the first morning and the last evening
  | 'finished'    // over

/** The columns any lifecycle decision needs. Deliberately narrow so a caller
 *  can pass a partial select without inventing the rest of the row. */
export type LifecycleInput = {
  starts_at: string | Date
  ends_at?: string | Date | null
  status?: string | null
  hidden_at?: string | null
}

const ms = (v: string | Date) => (v instanceof Date ? v.getTime() : new Date(v).getTime())

export function lifecycleOf(plan: LifecycleInput, now: Date = new Date()): TrekLifecycle {
  if (plan.status === 'cancelled') return 'cancelled'
  if (plan.hidden_at) return 'hidden'

  const t = now.getTime()
  const start = ms(plan.starts_at)

  // A row written before 053 backfilled `ends_at`, or a partial select that did
  // not ask for it, falls back to the start. That makes a day walk behave
  // exactly as it does today rather than becoming permanently under way.
  const end = plan.ends_at ? ms(plan.ends_at) : start

  if (t < start) return 'upcoming'
  if (t <= end) return 'under_way'
  return 'finished'
}

/** Still on the board, still joinable. The one state that accepts a new ask —
 *  matching the trigger in 052/071, which refuses any transition into
 *  `requested`/`waitlisted`/`confirmed` once `starts_at` has passed. */
export const isJoinable = (p: LifecycleInput, now?: Date) => lifecycleOf(p, now) === 'upcoming'

/** Belongs on the member's own dashboard: their trek has not finished, so they
 *  still need the meeting point, the roster and the chat. This is the predicate
 *  `getMyTreks` was missing — it filtered on `starts_at`, so a six-day trek
 *  disappeared from the party's only dashboard on its first morning and stayed
 *  gone for the five days they were actually out. */
export const isCurrent = (p: LifecycleInput, now?: Date) => {
  const l = lifecycleOf(p, now)
  return l === 'upcoming' || l === 'under_way'
}

/** Actually over. What "treks done", the recap prompt and the vouch list mean
 *  — all three of which were counting from `starts_at`. */
export const isFinished = (p: LifecycleInput, now?: Date) => lifecycleOf(p, now) === 'finished'

/** Live on the public board. A trek that is under way still shows, marked, so
 *  the feed does not silently drop a trip that is happening right now. */
export const isOnBoard = (p: LifecycleInput, now?: Date) => isCurrent(p, now)

// ── What an ask turned into ──────────────────────────────────────────────────
//
// `trek_plan_requests.status` has five values and none of them means "nobody
// ever answered". A row asked for on Tuesday for a Saturday walk, never
// decided, is still `requested` on the following Christmas — the trigger blocks
// it from becoming `confirmed`, no job settles it, and the seven notification
// kinds in 060 are all caused by a person doing something, so nothing is ever
// sent about it either. The person who asked got silence, then absence.
//
// This is the sixth value, derived rather than stored, for the same reason the
// lifecycle is: the fact is already implied by two columns we have.

export type AskState =
  | 'pending'    // asked, still answerable
  | 'lapsed'     // asked, never answered, and the trek has set off
  | 'confirmed'
  | 'declined'
  | 'withdrawn'
  | 'removed'
  | 'waitlisted'

export function askStateOf(
  requestStatus: string,
  plan: LifecycleInput,
  now?: Date
): AskState {
  if (requestStatus === 'requested' || requestStatus === 'waitlisted') {
    // The trigger stops a host confirming once the trek has started, so the
    // moment it sets off an unanswered ask can never become anything else.
    // Calling it "pending" after that is the interface lying to the person.
    return isJoinable(plan, now)
      ? (requestStatus === 'waitlisted' ? 'waitlisted' : 'pending')
      : 'lapsed'
  }
  return requestStatus as AskState
}

/** Can the host still act on this ask? Confirm is refused by the trigger once
 *  the trek starts; decline is not, but offering only "decline" on a walk that
 *  already happened is noise. */
export const isAnswerable = (requestStatus: string, plan: LifecycleInput, now?: Date) =>
  askStateOf(requestStatus, plan, now) === 'pending' ||
  askStateOf(requestStatus, plan, now) === 'waitlisted'

// ── Words ────────────────────────────────────────────────────────────────────
// One vocabulary, so the board, the dashboard and the plan page cannot describe
// the same trek differently.

export const LIFECYCLE_LABEL: Record<TrekLifecycle, string> = {
  cancelled: 'Called off',
  hidden:    'Withdrawn',
  upcoming:  'Upcoming',
  under_way: 'Under way',
  finished:  'Finished',
}

export const ASK_LABEL: Record<AskState, string> = {
  pending:    'Waiting on the host',
  waitlisted: 'On the waitlist',
  lapsed:     'Never answered',
  confirmed:  'You are going',
  declined:   'Not this time',
  withdrawn:  'You pulled out',
  removed:    'Removed by the host',
}

/** How many days a trek runs, inclusive. 1 for a day walk. */
export function durationDays(plan: LifecycleInput): number {
  if (!plan.ends_at) return 1
  const day = 86_400_000
  const s = new Date(ms(plan.starts_at)).setHours(0, 0, 0, 0)
  const e = new Date(ms(plan.ends_at)).setHours(0, 0, 0, 0)
  return Math.max(1, Math.round((e - s) / day) + 1)
}

/** Which day of a multi-day trek is being walked right now, 1-based; null when
 *  it is not under way. The thing a party on day three of six wants to see. */
export function dayNumber(plan: LifecycleInput, now: Date = new Date()): number | null {
  if (lifecycleOf(plan, now) !== 'under_way') return null
  const day = 86_400_000
  const s = new Date(ms(plan.starts_at)).setHours(0, 0, 0, 0)
  const t = new Date(now.getTime()).setHours(0, 0, 0, 0)
  return Math.min(durationDays(plan), Math.max(1, Math.round((t - s) / day) + 1))
}
