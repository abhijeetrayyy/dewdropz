'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase'
import { getUser } from '@/actions/auth'

/**
 * What happened, written afterwards by the host.
 *
 * The board's hardest problem is proving anybody turns up. Everything else on
 * it is a promise about the future; a recap is the only thing that cannot be
 * written in advance, which is exactly what makes it worth showing.
 *
 * Writes go through the session client so RLS decides who may write one — the
 * policy allows the host of that walk and nobody else. The trigger adds the
 * part a policy cannot express: not before the walk has finished.
 */

export type TrekRecap = {
  plan_id: string
  author_id: string
  body: string
  photo_urls: string[]
  created_at: string
}

export type RecapResult = { ok: true } | { ok: false; error: string }

export async function getRecap(planId: string): Promise<TrekRecap | null> {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('trek_recaps')
    .select('plan_id, author_id, body, photo_urls, created_at')
    .eq('plan_id', planId)
    .maybeSingle()
  return (data as TrekRecap | null) ?? null
}

export async function saveRecap(
  planId: string,
  body: string,
  photoUrls: string[]
): Promise<RecapResult> {
  const user = await getUser()
  if (!user) return { ok: false, error: 'Sign in first.' }

  const text = body.trim()
  if (text.length < 10) return { ok: false, error: 'A few more words than that.' }
  if (text.length > 1200) return { ok: false, error: 'That is longer than a recap wants to be.' }
  if (photoUrls.length > 6) return { ok: false, error: 'Six photographs is plenty.' }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('trek_recaps')
    .upsert(
      { plan_id: planId, author_id: user.id, body: text, photo_urls: photoUrls },
      { onConflict: 'plan_id' }
    )

  if (error) {
    if (error.message.includes('row-level security')) {
      return { ok: false, error: 'Only the host writes the recap for a walk.' }
    }
    return { ok: false, error: error.message }
  }

  revalidatePath(`/trek-buddy/${planId}`)
  revalidatePath('/trek-buddy')
  return { ok: true }
}

export type RecapCard = {
  plan_id: string
  place: string
  activity: string
  starts_at: string
  host_name: string
  host_id: string
  body: string
  photo_urls: string[]
  going: number
}

/** The most recent walks that happened, for the board's "it works" strip. */
export async function getRecentRecaps(limit = 4): Promise<RecapCard[]> {
  const user = await getUser()
  if (!user) return []
  const { data } = await createAdminSupabaseClient()
    .rpc('trek_recent_recaps', { p_limit: limit })
  return (data ?? []) as RecapCard[]
}

/** Weeks in a row somebody has been out. Derived; see migration 078. */
export async function getStreak(userId: string): Promise<number> {
  const { data } = await createAdminSupabaseClient()
    .rpc('trek_streak_weeks', { p_user: userId })
  return (data as number | null) ?? 0
}
