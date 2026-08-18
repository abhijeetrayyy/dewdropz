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

export type ConsoleRoster = {
  user_id: string
  display_name: string
  status: string
  message: string | null
  checked_in_at: string | null
  created_at: string
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
      .select('user_id, display_name, status, message, checked_in_at, created_at')
      .eq('plan_id', planId)
      .order('created_at'),
    admin.from('trek_plan_details').select('meeting_point, logistics').eq('plan_id', planId).maybeSingle(),
  ])

  return {
    plan,
    // Twelve hours, matching trek_check_in exactly. Computed here because
    // reading the clock during a render is impure — and the database is the
    // authority anyway; this only decides whether the buttons look pressable.
    canCheckIn:
      new Date((plan as { starts_at: string }).starts_at).getTime() - Date.now() < 12 * 3600 * 1000,
    roster: (roster ?? []) as ConsoleRoster[],
    meetingPoint: (details?.meeting_point as string | null) ?? '',
    logistics: (details?.logistics as string | null) ?? '',
  }
}
