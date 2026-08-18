'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase'
import { getUser } from '@/actions/auth'

/**
 * The group chat on a walk.
 *
 * Reads and writes go through the SESSION client, not the admin one. That is
 * the whole security design: RLS decides who is in a conversation, so a mistake
 * in this file cannot widen it. The admin client would bypass the policy and
 * make correctness here the only thing standing between a stranger and a
 * party's plans.
 */

export type TrekMessage = {
  id: string
  user_id: string
  display_name: string
  body: string
  created_at: string
}

export type ChatResult = { ok: true } | { ok: false; error: string }

export async function getMessages(planId: string): Promise<TrekMessage[]> {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('trek_messages')
    .select('id, user_id, display_name, body, created_at')
    .eq('plan_id', planId)
    .order('created_at', { ascending: true })
    .limit(200)

  // No membership check here on purpose. A caller who is not on the walk gets
  // an empty list from the policy, which is the correct answer and the same one
  // they would get for a walk with no messages — it does not confirm anything.
  return (data ?? []) as TrekMessage[]
}

export async function postMessage(planId: string, body: string): Promise<ChatResult> {
  const user = await getUser()
  if (!user) return { ok: false, error: 'Sign in first.' }

  const text = body.trim()
  if (!text) return { ok: false, error: 'Say something first.' }
  if (text.length > 1000) return { ok: false, error: 'That is longer than a message wants to be.' }

  // The display name is frozen onto the message, so it has to be read now.
  const { data: profile } = await createAdminSupabaseClient()
    .from('profiles')
    .select('trek_display_name')
    .eq('id', user.id)
    .maybeSingle()

  const name = (profile?.trek_display_name as string | null) ?? null
  if (!name) return { ok: false, error: 'Set up your Trek Buddy profile first.' }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('trek_messages')
    .insert({ plan_id: planId, user_id: user.id, display_name: name, body: text })

  if (error) {
    // The moderation refusals are written to be read by a person and say what
    // to change, so they pass through. An RLS refusal is not explained, because
    // "you are not on this walk" told to somebody probing is a fact they did
    // not have a moment ago.
    if (error.message.includes('row-level security')) {
      return { ok: false, error: 'You are not on this walk.' }
    }
    return { ok: false, error: error.message }
  }

  revalidatePath(`/trek-buddy/${planId}`)
  return { ok: true }
}

/** Moves your high-water mark for this walk to now. */
export async function markChatRead(planId: string): Promise<ChatResult> {
  const user = await getUser()
  if (!user) return { ok: false, error: 'Sign in first.' }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('trek_message_reads')
    .upsert(
      { plan_id: planId, user_id: user.id, last_read_at: new Date().toISOString() },
      { onConflict: 'plan_id,user_id' }
    )

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Unread messages across every walk you are on. */
export async function getUnreadMessages(): Promise<number> {
  const user = await getUser()
  if (!user) return 0
  const { data } = await createAdminSupabaseClient()
    .rpc('trek_unread_messages', { p_user: user.id })
  return (data as number | null) ?? 0
}
