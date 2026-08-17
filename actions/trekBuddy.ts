'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth, getUser } from '@/actions/auth'
import { createAdminSupabaseClient, createServerSupabaseClient } from '@/lib/supabase'
import { sendSlackAlert } from '@/lib/slack'

// Trek Buddy.
//
// Every mutation goes through a SECURITY DEFINER RPC in migration 052. There is
// no UPDATE policy on any Trek Buddy table for anybody, so these actions cannot
// write directly even if someone tried — which is deliberate: two of the worst
// holes found in the first draft of the schema were a host editing their own
// going-count to defeat the capacity limit, and back-dating a plan to
// manufacture a history of walks they never led. Both are impossible when the
// only door is a function that decides for itself what may change.
//
// The actor is passed explicitly rather than read from auth.uid(). These run on
// the service-role client, where auth.uid() is NULL — the same trap that made
// every admin control in the first draft a silent no-op.

export type TrekActivity = 'trekking' | 'bird_watching'
export type TrekEffort = 'easy' | 'moderate' | 'hard'

export type TrekPlanRow = {
  id: string
  host_id: string
  host_name: string
  activity: TrekActivity
  place: string
  meet_area: string
  starts_on: string
  start_time: string
  back_by: string
  starts_at: string
  capacity: number
  going_count: number
  spots_left: number
  effort: TrekEffort
  note: string | null
  status: 'open' | 'cancelled'
  cancelled_at: string | null
  cancel_reason: string | null
  hidden_at: string | null
}

/** What the signed-in member still has to supply before they can use any of this. */
export async function getTrekMembership() {
  const user = await getUser()
  if (!user) return { signedIn: false as const }

  const { data } = await createAdminSupabaseClient()
    .from('profiles')
    .select('trek_display_name, trek_dob, trek_terms_at, trek_can_host')
    .eq('id', user.id)
    .maybeSingle()

  const onboarded = Boolean(data?.trek_display_name && data?.trek_dob && data?.trek_terms_at)
  return {
    signedIn: true as const,
    userId: user.id,
    onboarded,
    displayName: (data?.trek_display_name as string) ?? null,
    canHost: Boolean(data?.trek_can_host),
  }
}

/**
 * Join the board: a display name, a date of birth and an acknowledgement.
 *
 * The date of birth is a claim, not a check — there is no identity provider
 * here and pretending otherwise would be worse than asking. What it buys is a
 * specific recorded misrepresentation rather than a tick-box, which is worth
 * something if it ever has to be argued about. Under-18s are refused by the
 * database, not here, so this cannot be bypassed by calling the RPC directly.
 */
export async function saveTrekProfile(input: {
  displayName: string
  dob: string
  acceptTerms: boolean
}) {
  const user = await requireAuth()

  const name = input.displayName.trim()
  if (name.length < 2 || name.length > 40) {
    return { error: 'Pick a name between 2 and 40 characters. It is what other walkers will see.' }
  }
  if (!input.acceptTerms) {
    return { error: 'You need to accept how Trek Buddy works before you can use it.' }
  }

  const dob = new Date(input.dob)
  if (Number.isNaN(dob.getTime())) return { error: 'That date does not look right.' }
  // Checked here for a readable message and again in the database, which is the
  // one that counts.
  const eighteen = new Date()
  eighteen.setFullYear(eighteen.getFullYear() - 18)
  if (dob > eighteen) {
    return { error: 'Trek Buddy is for adults only. You need to be 18 or over to use it.' }
  }

  const { error } = await createAdminSupabaseClient()
    .from('profiles')
    .update({
      trek_display_name: name,
      trek_dob: input.dob,
      trek_terms_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/trek-buddy')
  return { success: true as const }
}

/** The board. Members only — there is no anonymous read policy on any of this. */
export async function getTrekBoard() {
  const user = await getUser()
  if (!user) return []

  const { data } = await createAdminSupabaseClient()
    .from('trek_plans')
    .select('*')
    .eq('status', 'open')
    .is('hidden_at', null)
    .gt('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(60)

  return (data ?? []) as TrekPlanRow[]
}

/**
 * How many walks are on the board, for the logged-out pitch.
 *
 * One integer and nothing else. The page a crawler or a stranger sees is
 * marketing; who is going where, and when, is not something to publish to
 * anyone who has not signed in.
 */
export async function getOpenPlanCount() {
  const { count } = await createAdminSupabaseClient()
    .from('trek_plans')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open')
    .is('hidden_at', null)
    .gt('starts_at', new Date().toISOString())
  return count ?? 0
}

/**
 * One plan, plus whatever this viewer is entitled to see of it.
 *
 * The meeting point is read through the CALLER'S session, not the service-role
 * client, precisely so the RLS floor applies: `trek_plan_details` is readable
 * only by the host, or by a confirmed walker once three people are going. Doing
 * this read with the admin client would hand the exact spot to anyone who asked.
 */
export async function getTrekPlan(planId: string) {
  const user = await getUser()
  if (!user) return null

  const admin = createAdminSupabaseClient()
  const session = await createServerSupabaseClient()

  const [{ data: plan }, { data: mine }, { data: details }] = await Promise.all([
    admin.from('trek_plans').select('*').eq('id', planId).maybeSingle(),
    admin.from('trek_plan_requests').select('status, message, decided_at')
      .eq('plan_id', planId).eq('user_id', user.id).maybeSingle(),
    session.from('trek_plan_details').select('meeting_point, logistics').eq('plan_id', planId).maybeSingle(),
  ])

  if (!plan) return null
  const p = plan as TrekPlanRow
  const isHost = p.host_id === user.id

  // The host needs the roster to decide. Nobody else gets a list of who else
  // asked — that would turn the board into a directory of people to approach.
  const { data: roster } = isHost
    ? await admin.from('trek_plan_requests')
        .select('user_id, display_name, status, message, created_at')
        .eq('plan_id', planId)
        .in('status', ['requested', 'confirmed'])
        .order('created_at')
    : { data: null }

  return {
    plan: p,
    isHost,
    myStatus: (mine?.status as string) ?? null,
    meetingPoint: (details?.meeting_point as string) ?? null,
    logistics: (details?.logistics as string) ?? null,
    roster: roster ?? [],
    viewerId: user.id,
  }
}

type RpcResult = { error: string } | { success: true }

async function callTrek(fn: string, args: Record<string, unknown>, paths: string[]): Promise<RpcResult> {
  const { error } = await createAdminSupabaseClient().rpc(fn, args)
  if (error) {
    // The RPCs raise messages written to be read by a person — "this plan is not
    // taking anyone", "this is your own plan" — so they are passed through
    // rather than flattened into "something went wrong".
    return { error: error.message }
  }
  for (const p of paths) revalidatePath(p)
  return { success: true }
}

export async function createTrekPlan(input: {
  activity: TrekActivity
  place: string
  meetArea: string
  startsOn: string
  startTime: string
  backBy: string
  capacity: number
  meetingPoint: string
  effort: TrekEffort
  note?: string
  logistics?: string
}) {
  const user = await requireAuth()
  const result = await callTrek('trek_create_plan', {
    p_activity: input.activity,
    p_place: input.place,
    p_meet_area: input.meetArea,
    p_starts_on: input.startsOn,
    p_start_time: input.startTime,
    p_back_by: input.backBy,
    p_capacity: input.capacity,
    p_meeting_point: input.meetingPoint,
    p_effort: input.effort,
    p_note: input.note || null,
    p_logistics: input.logistics || null,
    p_actor: user.id,
  }, ['/trek-buddy'])

  if ('success' in result) {
    // The owner's moderation presence, at zero build cost. Nobody is on report
    // duty, so the least this can do is tell them a walk was posted.
    await sendSlackAlert(
      `:mountain: Trek Buddy plan posted — ${input.activity} at ${input.place}, ` +
      `${input.startsOn} ${input.startTime}, capacity ${input.capacity}`
    ).catch(() => {})
  }
  return result
}

export async function requestToJoin(planId: string, message?: string) {
  const user = await requireAuth()
  const result = await callTrek('trek_request_join', {
    p_plan_id: planId, p_message: message || null, p_actor: user.id,
  }, ['/trek-buddy', `/trek-buddy/${planId}`])
  if ('success' in result) {
    await sendSlackAlert(`:raising_hand: Trek Buddy: someone asked to join plan ${planId}`).catch(() => {})
  }
  return result
}

export async function decideRequest(planId: string, userId: string, decision: 'confirmed' | 'declined') {
  const user = await requireAuth()
  return callTrek('trek_decide_request', {
    p_plan_id: planId, p_user_id: userId, p_decision: decision, p_actor: user.id,
  }, ['/trek-buddy', `/trek-buddy/${planId}`])
}

export async function withdrawRequest(planId: string) {
  const user = await requireAuth()
  return callTrek('trek_withdraw_request', {
    p_plan_id: planId, p_actor: user.id,
  }, ['/trek-buddy', `/trek-buddy/${planId}`])
}

export async function cancelPlan(planId: string, reason?: string) {
  const user = await requireAuth()
  const result = await callTrek('trek_cancel_plan', {
    p_plan_id: planId, p_reason: reason || null, p_actor: user.id,
  }, ['/trek-buddy', `/trek-buddy/${planId}`])
  if ('success' in result) {
    await sendSlackAlert(`:x: Trek Buddy plan cancelled: ${planId}${reason ? ` — ${reason}` : ''}`).catch(() => {})
  }
  return result
}
