'use server'

import { revalidatePath } from 'next/cache'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { getUser } from '@/actions/auth'

/**
 * The host's controls for one walk.
 *
 * Every one of these is a SECURITY DEFINER function that checks the caller is
 * the host, so the checks below are not the gate — they decide what to draw and
 * what error to show. The gate is in Postgres, where a mistake in this file
 * cannot reach around it.
 */

export type ConsoleResult = { ok: true } | { ok: false; error: string }

async function call(fn: string, args: Record<string, unknown>, planId: string): Promise<ConsoleResult> {
  const user = await getUser()
  if (!user) return { ok: false, error: 'Sign in first.' }

  const { error } = await createAdminSupabaseClient().rpc(fn, { ...args, p_actor: user.id })
  // The refusals are written to be read by a shopkeeper — "only the host checks
  // people in", "you can check people in on the day, not before" — so they are
  // passed through rather than flattened.
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/trek-buddy/${planId}/console`)
  revalidatePath(`/trek-buddy/${planId}`)
  return { ok: true }
}

/** Mark somebody as having actually turned up. Reversible — people get miscounted. */
export async function checkIn(planId: string, userId: string, present: boolean): Promise<ConsoleResult> {
  return call('trek_check_in', { p_plan: planId, p_user: userId, p_in: present }, planId)
}

/**
 * Correct the meeting point after posting.
 *
 * Until this existed there was no way to change anything about a posted walk,
 * so a mistyped meeting point could only be fixed by cancelling and reposting —
 * which loses the party, and makes sending the correction off the board the
 * easier path. That is the one thing the board exists to prevent.
 */
export async function updateMeetingPoint(
  planId: string,
  point: string,
  logistics: string
): Promise<ConsoleResult> {
  if (!point.trim()) return { ok: false, error: 'The meeting point cannot be blank.' }
  return call('trek_update_meeting_point',
    { p_plan: planId, p_point: point.trim(), p_logistics: logistics.trim() || null }, planId)
}

/** A message to the party that also reaches them when they are not looking. */
export async function announce(planId: string, body: string): Promise<ConsoleResult> {
  const text = body.trim()
  if (text.length < 3) return { ok: false, error: 'Say a little more than that.' }
  return call('trek_announce', { p_plan: planId, p_body: text }, planId)
}

/** Bring somebody forward out of turn. Still lands on the host's desk, not the walk. */
export async function promoteWaitlisted(planId: string, userId: string): Promise<ConsoleResult> {
  return call('trek_promote_waitlisted', { p_plan: planId, p_user: userId }, planId)
}

/** Appointing is the host's alone — a co-host appointing co-hosts is how one
 *  person's decision quietly becomes everybody's. */
export async function addCoHost(planId: string, userId: string): Promise<ConsoleResult> {
  return call('trek_add_co_host', { p_plan: planId, p_user: userId }, planId)
}

export async function removeCoHost(planId: string, userId: string): Promise<ConsoleResult> {
  return call('trek_remove_co_host', { p_plan: planId, p_user: userId }, planId)
}

/**
 * The host's note on who has squared up the cost share.
 *
 * Not a payment record — no amount is stored per person, nothing is
 * transacted, and no money moves through this site. It is a memory aid for
 * somebody standing at a bus stand with eight people and one shared cab.
 * Co-hosts included, because collecting for the cab is exactly what a co-host
 * does while the host is parking.
 */
export async function setCostState(
  planId: string,
  userId: string,
  state: 'owed' | 'settled' | 'on_the_day'
): Promise<ConsoleResult> {
  return call('trek_set_cost_state', { p_plan: planId, p_user: userId, p_state: state }, planId)
}

export type ConsoleRoster = {
  user_id: string
  display_name: string
  status: string
  message: string | null
  checked_in_at: string | null
  created_at: string
  decided_by: string | null
  checked_in_by: string | null
  cost_state: 'owed' | 'settled' | 'on_the_day'
  /** Filled in from the co-host table, so the roster can show the badge. */
  is_co_host?: boolean
}

/** Everything the console needs, refused unless the caller hosts this walk. */
export async function getConsole(planId: string) {
  const user = await getUser()
  if (!user) return null

  const admin = createAdminSupabaseClient()
  const { data: plan } = await admin.from('trek_plans').select('*').eq('id', planId).maybeSingle()
  if (!plan || (plan as { host_id: string }).host_id !== user.id) return null

  const [{ data: roster }, { data: details }] = await Promise.all([
    admin.from('trek_plan_requests')
      .select('user_id, display_name, status, message, checked_in_at, created_at, decided_by, checked_in_by, cost_state')
      .eq('plan_id', planId)
      .order('created_at'),
    admin.from('trek_plan_details').select('meeting_point, logistics').eq('plan_id', planId).maybeSingle(),
  ])

  // Who may run this walk besides the host, and who each decision belongs to.
  // The console is the "way to see it" half of the co-host model — a permission
  // with no visible trail is the thing that makes it unsafe.
  const [{ data: coHosts }, { data: names }] = await Promise.all([
    admin.from('trek_plan_co_hosts').select('user_id').eq('plan_id', planId),
    admin.from('profiles').select('id, trek_display_name'),
  ])
  const coIds = new Set((coHosts ?? []).map((r) => r.user_id as string))
  const nameOf = new Map((names ?? []).map((r) => [r.id as string, r.trek_display_name as string | null]))

  return {
    plan,
    coHostIds: [...coIds],
    /** user id -> display name, for rendering "confirmed by" without a join per row. */
    nameOf: Object.fromEntries(nameOf),
    // Twelve hours, matching trek_check_in exactly. Computed here because
    // reading the clock during a render is impure — and the database is the
    // authority anyway; this only decides whether the buttons look pressable.
    canCheckIn:
      new Date((plan as { starts_at: string }).starts_at).getTime() - Date.now() < 12 * 3600 * 1000,
    roster: ((roster ?? []) as ConsoleRoster[]).map((r) => ({ ...r, is_co_host: coIds.has(r.user_id) })),
    meetingPoint: (details?.meeting_point as string | null) ?? '',
    logistics: (details?.logistics as string | null) ?? '',
  }
}
