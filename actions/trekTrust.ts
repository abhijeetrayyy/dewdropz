'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase'
import { getUser } from '@/actions/auth'
import { toE164 } from '@/lib/trekPhone'

/**
 * Phone verification, rung 1 of the trust ladder (migration 062).
 *
 * The OTP is Supabase's, not ours. It generates the code, sends it, expires it
 * and rate-limits it, and on success sets auth.users.phone_confirmed_at — which
 * a trigger mirrors onto profiles.trek_phone_verified_at. Nothing in this file
 * writes that column, and the database will not let it: the column is protected
 * both by a REVOKE and by protect_profile_trust_columns(). A verification badge
 * a user can award themselves certifies nothing.
 *
 * These run on the SESSION client, deliberately. The admin client would let the
 * server change anybody's phone number, and this is an operation that must be
 * performed by the person holding the account.
 */

export type TrustResult =
  | { ok: true; phone: string }
  | { ok: false; error: string; needsProvider?: boolean }

/** Supabase says several different things when phone auth is not set up. */
function looksLikeMissingProvider(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('provider') ||
    m.includes('sms') ||
    m.includes('not enabled') ||
    m.includes('unsupported')
  )
}

export async function startPhoneVerification(rawPhone: string): Promise<TrustResult> {
  const user = await getUser()
  if (!user) return { ok: false, error: 'Sign in first.' }

  const parsed = toE164(rawPhone)
  if (!parsed.ok) return { ok: false, error: parsed.error }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.updateUser({ phone: parsed.phone })

  if (error) {
    // Told apart from an ordinary failure because the fix is completely
    // different: this one is not the member's problem and no amount of retyping
    // their number will help.
    if (looksLikeMissingProvider(error.message)) {
      return {
        ok: false,
        needsProvider: true,
        error: 'Phone verification is not switched on for this site yet.',
      }
    }
    if (error.message.toLowerCase().includes('already')) {
      return {
        ok: false,
        error: 'That number is already verified on another account. A number can only vouch for one person.',
      }
    }
    return { ok: false, error: error.message }
  }

  return { ok: true, phone: parsed.phone }
}

export async function confirmPhoneVerification(
  phone: string,
  token: string
): Promise<TrustResult> {
  const user = await getUser()
  if (!user) return { ok: false, error: 'Sign in first.' }

  const code = token.replace(/\D/g, '')
  if (!code) return { ok: false, error: 'Enter the code from the message.' }

  const supabase = await createServerSupabaseClient()
  // 'phone_change' rather than 'sms': this account already exists and signed in
  // with an email. 'sms' is the type for signing IN with a phone, and using it
  // here fails with a confusing "token expired".
  const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'phone_change' })

  if (error) {
    const m = error.message.toLowerCase()
    if (m.includes('expired')) return { ok: false, error: 'That code has expired. Ask for a new one.' }
    if (m.includes('invalid')) return { ok: false, error: 'That code is not right. Check the message and try again.' }
    return { ok: false, error: error.message }
  }

  revalidatePath('/trek-buddy/profile')
  revalidatePath('/trek-buddy')
  return { ok: true, phone }
}

export type MyTrust = { rung: 0 | 1 | 2; phoneVerified: boolean; vouches: number }

/** What rung the signed-in member is on, and what is between them and the next. */
export async function getMyTrust(): Promise<MyTrust | null> {
  const user = await getUser()
  if (!user) return null

  const admin = createAdminSupabaseClient()
  const [{ data: profile }, { count }] = await Promise.all([
    admin.from('profiles').select('trek_phone_verified_at').eq('id', user.id).maybeSingle(),
    admin.from('trek_vouches').select('voucher_id', { count: 'exact', head: true }).eq('vouchee_id', user.id),
  ])

  const phoneVerified = Boolean(profile?.trek_phone_verified_at)
  const vouches = count ?? 0
  const rung: 0 | 1 | 2 = phoneVerified ? (vouches >= 2 ? 2 : 1) : 0
  return { rung, phoneVerified, vouches }
}
