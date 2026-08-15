'use server'

import { revalidatePath } from 'next/cache'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { requireAdmin } from './auth'
import { auditLog } from '@/lib/audit'

export type JobRow = {
  id: string
  type: string
  status: string
  payload: Record<string, unknown>
  attempts: number
  max_attempts: number
  last_error: string | null
  run_at: string
  created_at: string
}

export async function getJobs(opts?: { status?: string; limit?: number; offset?: number }) {
  await requireAdmin()
  const limit = opts?.limit ?? 25
  const offset = opts?.offset ?? 0
  let q = createAdminSupabaseClient()
    .from('jobs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (opts?.status) q = q.eq('status', opts.status)
  const { data, count } = await q
  return { jobs: (data ?? []) as JobRow[], total: count ?? 0 }
}

export async function getJobCounts(): Promise<Record<string, number>> {
  await requireAdmin()
  const admin = createAdminSupabaseClient()
  const statuses = ['pending', 'running', 'done', 'failed']
  const results = await Promise.all(
    statuses.map((s) => admin.from('jobs').select('id', { count: 'exact', head: true }).eq('status', s))
  )
  return Object.fromEntries(statuses.map((s, i) => [s, results[i].count ?? 0]))
}

/**
 * Put a permanently failed job back in the queue.
 *
 * The point of the whole table: a confirmation email that failed five times
 * because of an expired API key should be sendable once the key is fixed,
 * without anyone reconstructing it by hand.
 */
export async function retryJob(id: string) {
  const actor = await requireAdmin()
  const { error } = await createAdminSupabaseClient()
    .from('jobs')
    .update({ status: 'pending', attempts: 0, run_at: new Date().toISOString(), locked_at: null, completed_at: null })
    .eq('id', id)
    .eq('status', 'failed') // only a dead job; never yank one mid-flight
  if (error) throw new Error(error.message)
  await auditLog({ actorId: actor.id, actorEmail: actor.email, action: 'job.retried', entityType: 'job', entityId: id })
  revalidatePath('/admin/jobs')
}
