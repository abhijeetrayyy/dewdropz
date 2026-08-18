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
