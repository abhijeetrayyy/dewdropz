'use server'

import { revalidatePath } from 'next/cache'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { getUser } from '@/actions/auth'

/**
 * Following, and the feed it fills.
 *
 * A follow is the lightest tie the board has: one-directional, needing no
 * consent, granting nothing. It does not reveal a walk you could not already
 * see — every walk in a feed is on the public board — it does not notify the
 * person followed, and it has no bearing on who gets onto a walk. The host
 * still decides, and being followed by them counts for nothing.
 *
 * The person followed is never told, deliberately. A board where strangers are
 * informed that somebody is watching them is a worse place to be a woman than
 * one where they are not, and there is nothing useful anybody could do with the
 * knowledge.
 */

export type SocialResult = { ok: true } | { ok: false; error: string }

export async function followPerson(personId: string): Promise<SocialResult> {
  const user = await getUser()
  if (!user) return { ok: false, error: 'Sign in first.' }
  if (user.id === personId) return { ok: false, error: 'You cannot follow yourself.' }

  const { error } = await createAdminSupabaseClient()
    .from('trek_follows')
    .insert({ follower_id: user.id, followed_id: personId })

  // The blocked and suspended cases raise from trek_follows_guard, and their
  // messages are written to be read by a person, so they pass straight through.
  if (error && !error.message.includes('duplicate key')) {
    return { ok: false, error: error.message }
  }

  revalidatePath(`/trek-buddy/people/${personId}`)
  revalidatePath('/trek-buddy/basecamp')
  return { ok: true }
}

export async function unfollowPerson(personId: string): Promise<SocialResult> {
  const user = await getUser()
  if (!user) return { ok: false, error: 'Sign in first.' }

  const { error } = await createAdminSupabaseClient()
    .from('trek_follows')
    .delete()
    .eq('follower_id', user.id)
    .eq('followed_id', personId)

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/trek-buddy/people/${personId}`)
  revalidatePath('/trek-buddy/basecamp')
  return { ok: true }
}

/** Whether the viewer follows this person, and how many people do in total. */
export async function getFollowState(personId: string) {
  const user = await getUser()
  const admin = createAdminSupabaseClient()

  const [{ data: mine }, { data: count }] = await Promise.all([
    user
      ? admin.from('trek_follows').select('followed_id')
          .eq('follower_id', user.id).eq('followed_id', personId).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.rpc('trek_follower_count', { p_user: personId }),
  ])

  return { following: Boolean(mine), followers: (count as number | null) ?? 0 }
}

/** How many people the viewer follows — used to tell an empty feed from a new one. */
export async function getFollowingCount(): Promise<number> {
  const user = await getUser()
  if (!user) return 0
  const { count } = await createAdminSupabaseClient()
    .from('trek_follows')
    .select('followed_id', { count: 'exact', head: true })
    .eq('follower_id', user.id)
  return count ?? 0
}
