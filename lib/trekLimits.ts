import { rateLimit } from '@/lib/rateLimit'

/**
 * Write throttles for Trek Buddy.
 *
 * The primitive already existed — `rate_limits` (029) and `lib/rateLimit.ts`,
 * a fixed window counted in Postgres because an in-process Map enforces nothing
 * across serverless instances. Six storefront modules used it. No Trek Buddy
 * module did, so one account could fire unlimited join requests, reports,
 * messages and follows, and the only cap anywhere on the board was the three
 * open plans a host may hold.
 *
 * WHY THE KEY IS THE MEMBER AND NOT THE ADDRESS
 *
 * `rateLimit()` derives its bucket from x-forwarded-for, which is right for the
 * contact form: an unauthenticated caller has no other identity. Here every
 * caller is signed in, and an address is both too broad and too narrow — a
 * college or an office behind one NAT shares it, so throttling one member
 * throttles all of them, while a phone moving between cells gets a fresh
 * allowance for free. The account is the thing we actually mean to limit, and
 * it is the thing we already have.
 *
 * The bucket string is `trek:<action>:<user id>`, built by putting the id into
 * the action name rather than by widening `rateLimit`'s signature — the helper
 * concatenates action and key, so this composes without touching a function six
 * other modules depend on.
 *
 * FAILS OPEN, DELIBERATELY
 *
 * `rateLimit` allows the write through if the limiter itself errors, and that
 * is kept. This is protection, not authorization: the real boundaries are the
 * RLS policies and the SECURITY DEFINER guards, and every one of them still
 * runs. A limiter outage should not be able to close the board.
 */

/** Every throttled write, with the reasoning for its number. */
export const TREK_LIMITS = {
  /** Asking to come is the harvesting vector — one account, every open plan. */
  join:        { limit: 10, windowSeconds: 3600 },
  /** Conversation, not a flood. Generous: a lively group chat is the point. */
  message:     { limit: 30, windowSeconds: 300 },
  /** A report queue nobody can drown. Low on purpose — five real reports in an
   *  hour from one member is already a conversation to have with them. */
  report:      { limit: 5, windowSeconds: 3600 },
  /** The open-plan cap is 3; this bounds the churn of posting and cancelling. */
  createPlan:  { limit: 5, windowSeconds: 86400 },
  /** Follow-spam is a notification vector. */
  follow:      { limit: 60, windowSeconds: 3600 },
  /** Bio-cycling is how you probe a content filter without being blocked. */
  profile:     { limit: 20, windowSeconds: 3600 },
  hostRequest: { limit: 3,  windowSeconds: 86400 },
  /** Reputation is the thing actually worth gaming here. */
  vouch:       { limit: 20, windowSeconds: 3600 },
} as const

export type TrekLimitName = keyof typeof TREK_LIMITS

/**
 * Claim one slot for this member.
 *
 * Returns the same shape the trek actions already return, so a caller can
 * `if ('error' in gate) return gate` and the message reaches the existing
 * toast with no new branch in the component.
 */
export async function trekLimit(
  name: TrekLimitName,
  userId: string
): Promise<{ success: true } | { error: string }> {
  const gate = await rateLimit(`trek:${name}:${userId}`, TREK_LIMITS[name])
  if (!gate.ok) return { error: gate.error }
  return { success: true }
}
