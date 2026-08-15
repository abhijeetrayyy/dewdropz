import { headers } from 'next/headers'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

// Throttling for unauthenticated writes. See migration 029 for why the counter
// lives in Postgres rather than in process memory: on serverless every instance
// has its own memory and its own cold start, so an in-process Map enforces
// nothing once there is more than one instance.

/** Best-effort caller identity. Behind a proxy the left-most x-forwarded-for
 *  entry is the real client; everything after it is infrastructure. Falls back
 *  to a shared bucket so a caller we cannot identify is still limited — as a
 *  group rather than individually, which is the safe direction to fail. */
async function callerKey(): Promise<string> {
  const h = await headers()
  const fwd = h.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return h.get('x-real-ip') ?? 'unknown'
}

/**
 * Claim one slot in the caller's window.
 *
 * Fails OPEN: if the limiter itself errors (migration not applied, database
 * unreachable), the request is allowed through. A spam control that takes the
 * contact form down with it when it breaks is worse than the spam — this is
 * protection, not authorization, and nothing behind it is a security boundary.
 */
export async function rateLimit(
  action: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number }
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const key = await callerKey()
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase.rpc('consume_rate_limit', {
      p_bucket: `${action}:${key}`,
      p_limit: limit,
      p_window: `${windowSeconds} seconds`,
    })

    if (error) return { ok: true }
    if (data === false) {
      return { ok: false, error: 'Too many requests. Please wait a moment and try again.' }
    }
    return { ok: true }
  } catch {
    return { ok: true }
  }
}
