'use server'

import { revalidatePath } from 'next/cache'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/actions/auth'
import { auditLog } from '@/lib/audit'

// The moderation desk.
//
// Everything here is admin-only and every one of these functions says so
// twice: once here, so an unauthorised call fails before it reaches the
// database, and once in the RPC itself, because an action is only as private
// as the weakest thing that can call it. The database is the one that decides.

export type TrekReportRow = {
  id: string
  reason: string
  detail: string | null
  source: 'member' | 'auto'
  field: string | null
  excerpt: string | null
  matched_rules: string[]
  status: string
  created_at: string
  resolved_at: string | null
  resolution: string | null
  admin_note: string | null
  plan_id: string | null
  subject_id: string | null
  reporter_id: string | null
  /** Joined for the queue, so a row is readable without opening it. */
  plan_place: string | null
  plan_activity: string | null
  plan_hidden: boolean
  subject_name: string | null
  subject_suspended: boolean
  reporter_name: string | null
  rules: { id: string; pattern: string; category: string; action: string }[]
}

/**
 * The queue.
 *
 * Open first and oldest first, because a moderation queue worked newest-first
 * is a queue where the worst thing on the board is the last thing anyone sees.
 */
export async function getTrekReports(opts?: { resolved?: boolean; limit?: number }) {
  await requireAdmin()
  const db = createAdminSupabaseClient()

  let q = db
    .from('trek_reports')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(opts?.limit ?? 100)

  q = opts?.resolved ? q.not('resolved_at', 'is', null) : q.is('resolved_at', null)

  const { data: reports, error } = await q
  if (error || !reports?.length) return [] as TrekReportRow[]

  // Three lookups rather than a nested select: PostgREST cannot join profiles
  // twice from one table (subject and reporter are both profiles) without
  // naming the constraint, and naming it makes this break the day somebody
  // renames a foreign key.
  const planIds = [...new Set(reports.map((r) => r.plan_id).filter(Boolean))] as string[]
  const personIds = [
    ...new Set(
      reports.flatMap((r) => [r.subject_id, r.reporter_id]).filter(Boolean) as string[]
    ),
  ]
  const ruleIds = [...new Set(reports.flatMap((r) => r.matched_rules ?? []))] as string[]

  const [{ data: plans }, { data: people }, { data: rules }] = await Promise.all([
    planIds.length
      ? db.from('trek_plans').select('id, place, activity, hidden_at').in('id', planIds)
      : Promise.resolve({ data: [] as never[] }),
    personIds.length
      ? db
          .from('profiles')
          .select('id, trek_display_name, trek_suspended_at')
          .in('id', personIds)
      : Promise.resolve({ data: [] as never[] }),
    ruleIds.length
      ? db.from('trek_word_rules').select('id, pattern, category, action').in('id', ruleIds)
      : Promise.resolve({ data: [] as never[] }),
  ])

  const planById = new Map((plans ?? []).map((p) => [p.id, p]))
  const personById = new Map((people ?? []).map((p) => [p.id, p]))
  const ruleById = new Map((rules ?? []).map((r) => [r.id, r]))

  return reports.map((r): TrekReportRow => {
    const plan = r.plan_id ? planById.get(r.plan_id) : undefined
    const subject = r.subject_id ? personById.get(r.subject_id) : undefined
    const reporter = r.reporter_id ? personById.get(r.reporter_id) : undefined
    return {
      ...r,
      plan_place: plan?.place ?? null,
      plan_activity: plan?.activity ?? null,
      plan_hidden: Boolean(plan?.hidden_at),
      subject_name: subject?.trek_display_name ?? null,
      subject_suspended: Boolean(subject?.trek_suspended_at),
      reporter_name: reporter?.trek_display_name ?? null,
      rules: (r.matched_rules ?? [])
        .map((id: string) => ruleById.get(id))
        .filter(Boolean) as TrekReportRow['rules'],
    }
  })
}

/** How much is waiting, for the badge on the admin nav. */
export async function getTrekQueueCount() {
  await requireAdmin()
  const { count } = await createAdminSupabaseClient()
    .from('trek_reports')
    .select('id', { count: 'exact', head: true })
    .is('resolved_at', null)
  return count ?? 0
}

export async function resolveTrekReport(
  reportId: string,
  resolution: 'dismissed' | 'warned' | 'plan_hidden' | 'member_suspended' | 'member_banned',
  note?: string
) {
  const admin = await requireAdmin()
  const { error } = await createAdminSupabaseClient().rpc('trek_admin_resolve_report', {
    p_report_id: reportId,
    p_resolution: resolution,
    p_note: note?.trim() || null,
    p_actor: admin.id,
  })
  if (error) return { error: error.message }
  revalidatePath('/admin/trek-buddy')
  revalidatePath('/trek-buddy')

  // The moderation desk leaves a trail. `auditLog` is append-only at the table
  // level — admins can SELECT it and there is no INSERT, UPDATE or DELETE policy
  // — and it never throws, so a failed log line cannot roll back the suspension
  // it was describing.
  await auditLog({
    actorId: admin.id, actorEmail: admin.email, action: 'trek.report_resolved',
    entityType: 'trek_report', entityId: reportId,
    after: { resolution, note: note?.trim() || null },
  })
  return { success: true as const }
}

// ── The rules ────────────────────────────────────────────────────────────────

export type WordRule = {
  id: string
  pattern: string
  kind: 'word' | 'regex'
  action: 'block' | 'flag'
  category: string
  note: string | null
  hint: string | null
  active: boolean
  created_at: string
}

export async function getWordRules() {
  await requireAdmin()
  const { data } = await createAdminSupabaseClient()
    .from('trek_word_rules')
    .select('*')
    .order('category')
    .order('action')
    .order('pattern')
  return (data ?? []) as WordRule[]
}

export async function saveWordRule(input: {
  id?: string
  pattern: string
  kind: 'word' | 'regex'
  action: 'block' | 'flag'
  category: string
  note?: string
  hint?: string
  active?: boolean
}) {
  const admin = await requireAdmin()
  const db = createAdminSupabaseClient()
  const row = {
    pattern: input.pattern.trim(),
    kind: input.kind,
    action: input.action,
    category: input.category,
    note: input.note?.trim() || null,
    hint: input.hint?.trim() || null,
    active: input.active ?? true,
  }
  // The database validates the regex on the way in (056), so a pattern that
  // would break every write path on the board is refused here rather than
  // discovered by the next person who tries to post a walk.
  const { error } = input.id
    ? await db.from('trek_word_rules').update(row).eq('id', input.id)
    : await db.from('trek_word_rules').insert(row)
  if (error) return { error: error.message }
  revalidatePath('/admin/trek-buddy')

  await auditLog({
    actorId: admin.id, actorEmail: admin.email,
    action: input.id ? 'trek.word_rule_updated' : 'trek.word_rule_created',
    entityType: 'trek_word_rule', entityId: input.id ?? null,
    after: row,
    note: 'Word rules gate every free-text field on the board.',
  })
  return { success: true as const }
}

export async function deleteWordRule(id: string) {
  const admin = await requireAdmin()
  const { error } = await createAdminSupabaseClient()
    .from('trek_word_rules')
    .delete()
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/trek-buddy')

  await auditLog({
    actorId: admin.id, actorEmail: admin.email, action: 'trek.word_rule_deleted',
    entityType: 'trek_word_rule', entityId: id,
    note: 'Word rules gate every free-text field on the board.',
  })
  return { success: true as const }
}

/**
 * Try a rule set against a piece of text without saving anything.
 *
 * The single most useful thing on a moderation screen: "would this have caught
 * it?" answered before a rule goes live, instead of after it has turned away a
 * week of real posts.
 */
export async function testModeration(text: string) {
  await requireAdmin()
  const { data, error } = await createAdminSupabaseClient().rpc('trek_scan', { p_text: text })
  if (error) return { error: error.message }
  return {
    matches: (data ?? []) as {
      rule_id: string
      pattern: string
      action: string
      category: string
      hint: string | null
    }[],
  }
}

// ── Kinds of outing ──────────────────────────────────────────────────────────

export type ActivityKind = {
  key: string
  label: string
  blurb: string
  day_part: 'day' | 'evening' | 'overnight'
  start_min: string
  start_max: string
  default_start: string
  default_back_by: string
  ends_next_day: boolean
  min_party: number
  needs_night_note: boolean
  is_open_ended: boolean
  sort: number
  active: boolean
}

export async function getActivityKindsAdmin() {
  await requireAdmin()
  const { data } = await createAdminSupabaseClient()
    .from('trek_activity_kinds')
    .select('*')
    .order('sort')
  return (data ?? []) as ActivityKind[]
}

export async function saveActivityKind(input: Partial<ActivityKind> & { key: string }) {
  const admin = await requireAdmin()
  const db = createAdminSupabaseClient()
  const { key, ...rest } = input
  const { data: existing } = await db
    .from('trek_activity_kinds')
    .select('key')
    .eq('key', key)
    .maybeSingle()

  const { error } = existing
    ? await db.from('trek_activity_kinds').update(rest).eq('key', key)
    : await db.from('trek_activity_kinds').insert({ key, ...rest })
  if (error) return { error: error.message }
  revalidatePath('/admin/trek-buddy')
  revalidatePath('/trek-buddy/new')

  await auditLog({
    actorId: admin.id, actorEmail: admin.email,
    action: existing ? 'trek.activity_kind_updated' : 'trek.activity_kind_created',
    entityType: 'trek_activity_kind', entityId: key, after: rest,
  })
  return { success: true as const }
}

// ── Guidance ─────────────────────────────────────────────────────────────────

export type GuidanceNote = {
  id: string
  activity: string
  audience: 'all' | 'women' | 'first_time' | 'host'
  title: string
  body: string
  sort: number
  active: boolean
}

export async function getGuidanceAdmin() {
  await requireAdmin()
  const { data } = await createAdminSupabaseClient()
    .from('trek_guidance')
    .select('*')
    .order('activity')
    .order('audience')
    .order('sort')
  return (data ?? []) as GuidanceNote[]
}

export async function saveGuidance(input: Partial<GuidanceNote> & { title: string; body: string }) {
  const admin = await requireAdmin()
  const db = createAdminSupabaseClient()
  const row = {
    activity: input.activity ?? 'general',
    audience: input.audience ?? 'all',
    title: input.title.trim(),
    body: input.body.trim(),
    sort: input.sort ?? 100,
    active: input.active ?? true,
  }
  const { error } = input.id
    ? await db.from('trek_guidance').update(row).eq('id', input.id)
    : await db.from('trek_guidance').insert(row)
  if (error) return { error: error.message }
  revalidatePath('/admin/trek-buddy')
  revalidatePath('/trek-buddy')

  await auditLog({
    actorId: admin.id, actorEmail: admin.email,
    action: input.id ? 'trek.guidance_updated' : 'trek.guidance_created',
    entityType: 'trek_guidance', entityId: input.id ?? null, after: row,
  })
  return { success: true as const }
}

export async function deleteGuidance(id: string) {
  const admin = await requireAdmin()
  const { error } = await createAdminSupabaseClient().from('trek_guidance').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/trek-buddy')

  await auditLog({
    actorId: admin.id, actorEmail: admin.email, action: 'trek.guidance_deleted',
    entityType: 'trek_guidance', entityId: id,
  })
  return { success: true as const }
}

// ── Members ──────────────────────────────────────────────────────────────────

export type TrekMemberRow = {
  id: string
  trek_display_name: string | null
  trek_home_base: string | null
  trek_can_host: boolean
  trek_mentor: boolean
  trek_suspended_at: string | null
  trek_suspended_reason: string | null
  trek_warned_at: string | null
  trek_terms_at: string | null
  trek_gender: string | null
}

export async function getTrekMembers(q?: string) {
  await requireAdmin()
  let query = createAdminSupabaseClient()
    .from('profiles')
    .select(
      'id, trek_display_name, trek_home_base, trek_can_host, trek_mentor, trek_suspended_at, trek_suspended_reason, trek_warned_at, trek_terms_at, trek_gender'
    )
    .not('trek_display_name', 'is', null)
    .order('trek_terms_at', { ascending: false })
    .limit(200)

  if (q?.trim()) {
    const clean = q.replace(/[%_,()]/g, '').trim()
    if (clean) query = query.ilike('trek_display_name', `%${clean}%`)
  }
  const { data } = await query
  return (data ?? []) as TrekMemberRow[]
}

export async function setTrekMember(input: {
  userId: string
  canHost?: boolean
  suspended?: boolean
  reason?: string
}) {
  const admin = await requireAdmin()
  const db = createAdminSupabaseClient()

  // Read the state we are about to change, before we change it. This is the
  // only one of the nine admin actions where the previous value is not
  // recoverable from the row afterwards — suspending someone who was already
  // suspended, and suspending someone for the first time, leave the same row —
  // and it is the action most likely to be argued about later.
  const { data: was } = await db
    .from('profiles')
    .select('trek_can_host, trek_suspended_at, trek_suspended_reason')
    .eq('id', input.userId)
    .maybeSingle()

  const { error } = await db.rpc('trek_admin_set_member', {
    p_user: input.userId,
    p_can_host: input.canHost ?? null,
    p_suspended: input.suspended ?? null,
    p_reason: input.reason?.trim() || null,
    p_actor: admin.id,
  })
  if (error) return { error: error.message }
  revalidatePath('/admin/trek-buddy')
  revalidatePath('/trek-buddy')

  await auditLog({
    actorId: admin.id, actorEmail: admin.email, action: 'trek.member_updated',
    entityType: 'trek_member', entityId: input.userId,
    before: was ?? null,
    after: {
      can_host: input.canHost ?? null,
      suspended: input.suspended ?? null,
      reason: input.reason?.trim() || null,
    },
  })
  return { success: true as const }
}

export async function setTrekMentor(userId: string, mentor: boolean, bio?: string) {
  const admin = await requireAdmin()
  const { error } = await createAdminSupabaseClient().rpc('trek_admin_set_mentor', {
    p_user: userId,
    p_mentor: mentor,
    p_bio: bio?.trim() || null,
    p_actor: admin.id,
  })
  if (error) return { error: error.message }
  revalidatePath('/admin/trek-buddy')
  revalidatePath(`/trek-buddy/people/${userId}`)

  await auditLog({
    actorId: admin.id, actorEmail: admin.email, action: 'trek.mentor_set',
    entityType: 'trek_member', entityId: userId,
    after: { mentor, bio: bio?.trim() || null },
  })
  return { success: true as const }
}

/**
 * Hosting requests, and the two-button decision on each.
 *
 * The grant path deliberately goes through `trek_decide_host_request` rather
 * than `setTrekMember({ canHost: true })`, even though the second already
 * exists and works. Closing the request and flipping the bit are one
 * transaction there — a granted request whose member still cannot post, or a
 * member granted with the request left open for somebody to grant twice, are
 * both states worth designing out rather than remembering not to cause.
 */
export type HostRequestRow = {
  id: string
  user_id: string
  display_name: string | null
  home_base: string | null
  note: string | null
  walks: number
  trust_rung: number
  member_since: string
  created_at: string
}

export async function getHostRequests(): Promise<HostRequestRow[]> {
  const admin = await requireAdmin()
  const { data, error } = await createAdminSupabaseClient()
    .rpc('trek_host_request_queue', { p_actor: admin.id })
  // Until 090 is applied the RPC does not exist; an empty queue is the honest
  // rendering of "there is nothing to work" on a screen that has no other way
  // to show an error.
  if (error) return []
  return (data ?? []) as HostRequestRow[]
}

export async function decideHostRequest(requestId: string, grant: boolean) {
  const admin = await requireAdmin()
  const { error } = await createAdminSupabaseClient().rpc('trek_decide_host_request', {
    p_request: requestId,
    p_grant: grant,
    p_actor: admin.id,
  })
  if (error) return { error: error.message }
  revalidatePath('/admin/trek-buddy')
  revalidatePath('/trek-buddy')
  revalidatePath('/trek-buddy/discover')

  await auditLog({
    actorId: admin.id, actorEmail: admin.email, action: 'trek.host_request_decided',
    entityType: 'trek_host_request', entityId: requestId,
    after: { granted: grant },
  })
  return { success: true as const }
}
