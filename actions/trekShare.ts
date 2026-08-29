'use server'

import { revalidatePath } from 'next/cache'
import { createAdminSupabaseClient, createPublicSupabaseClient } from '@/lib/supabase'
import { getUser } from '@/actions/auth'

/**
 * Invite cards.
 *
 * A host mints a token when they want to invite somebody who is not a member;
 * while it exists, /e/<token> is readable by anybody holding the link. Revoking
 * makes that URL a 404 straight away, which matters because a link sent to one
 * person ends up in a group.
 *
 * The card is read with the ANON key, deliberately. The page is for people
 * without an account, and reading it as a stranger would is the only way to be
 * sure a stranger sees no more than intended — the meeting point cannot arrive
 * by accident if the query has no more power than the visitor.
 */

export type ShareResult = { ok: true; token: string } | { ok: false; error: string }

export async function mintShareToken(planId: string): Promise<ShareResult> {
  const user = await getUser()
  if (!user) return { ok: false, error: 'Sign in first.' }

  const { data, error } = await createAdminSupabaseClient()
    .rpc('trek_share_token', { p_plan: planId, p_actor: user.id })

  if (error) return { ok: false, error: error.message }
  revalidatePath(`/trek-buddy/${planId}/console`)
  return { ok: true, token: data as string }
}

export async function revokeShareToken(planId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getUser()
  if (!user) return { ok: false, error: 'Sign in first.' }

  const { error } = await createAdminSupabaseClient()
    .rpc('trek_revoke_share', { p_plan: planId, p_actor: user.id })

  if (error) return { ok: false, error: error.message }
  revalidatePath(`/trek-buddy/${planId}/console`)
  return { ok: true }
}

export type InviteCard = {
  place: string
  activity: string
  host_name: string
  starts_at: string
  start_time: string | null
  note: string | null
  difficulty: 'easy' | 'moderate' | 'difficult'
  spots_left: number
  capacity: number
  cost_paise: number | null
  distance_km: number | null
  gain_m: number | null
  cover_urls: string[]
  women_only: boolean
  meet_area: string
}

export async function getInviteCard(token: string): Promise<InviteCard | null> {
  const { data } = await createPublicSupabaseClient().rpc('trek_invite_card', { p_token: token })
  const rows = (data ?? []) as InviteCard[]
  return rows[0] ?? null
}

/**
 * Why a card came back empty.
 *
 * `trek_invite_card` ends with `AND p.starts_at > NOW()`, which is right — an
 * invitation to something that has already left is not an invitation. But the
 * page turned every empty result into a bare `notFound()`, so the person who
 * opened the link a day late got an unstyled 404 and no idea whether they had
 * the wrong link or simply missed it. That is the exact person this feature
 * exists for.
 *
 * This distinguishes the two without widening what the anon RPC returns: it
 * looks the token up on the service role purely to classify, and returns a
 * state — never the walk's place, time or host. A holder of the link learns
 * only that it was once real, which they already knew, having been sent it.
 */
export type InviteMiss = 'unknown' | 'gone' | 'cancelled'

export async function classifyInviteMiss(token: string): Promise<InviteMiss> {
  const { data } = await createAdminSupabaseClient()
    .from('trek_plans')
    .select('status, hidden_at, ends_at')
    .eq('share_token', token)
    .maybeSingle()

  if (!data) return 'unknown'
  if (data.hidden_at) return 'unknown'
  if (data.status === 'cancelled') return 'cancelled'
  return 'gone'
}
