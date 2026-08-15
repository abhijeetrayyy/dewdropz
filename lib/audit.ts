import 'server-only'
import { createAdminSupabaseClient } from '@/lib/supabase'

/**
 * Record a mutating admin action.
 *
 * Append-only by design: the table has a SELECT policy for admins and no INSERT,
 * UPDATE or DELETE policy at all, so writes only happen here through the service
 * role and nobody can rewrite their own trail.
 *
 * Never throws. An audit write failing must not roll back the refund it is
 * describing — a missing log line is bad, a refund that half-happened because
 * logging failed is worse. Failures are swallowed deliberately.
 */
export async function auditLog(entry: {
  actorId?: string | null
  actorEmail?: string | null
  action: string
  entityType: string
  entityId?: string | null
  before?: unknown
  after?: unknown
  note?: string
}) {
  try {
    await createAdminSupabaseClient()
      .from('admin_audit_log')
      .insert({
        actor_id: entry.actorId ?? null,
        actor_email: entry.actorEmail ?? null,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId ?? null,
        before: entry.before ?? null,
        after: entry.after ?? null,
        note: entry.note ?? null,
      })
  } catch {
    // Intentionally silent — see above.
  }
}
