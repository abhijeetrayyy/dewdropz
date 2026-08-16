import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'

// The admin check, memoised for the life of one request.
//
// It costs two round-trips — `getUser()` validates the token against the auth
// server, then the role is read from the database rather than trusted from a
// claim — and that is the right price to pay once. It was being paid per
// action: the product editor fires nine, so the same two calls ran nine times
// to answer the same question about the same person in the same request.
//
// `cache()` is request-scoped, so concurrent callers inside one request share a
// single in-flight promise. Nothing is cached across requests, and nothing is
// cached across users — a second request re-checks from scratch.
//
// This is deliberately NOT in actions/auth.ts: a 'use server' file may only
// export async functions, and `cache()` returns a plain function.
const loadAdmin = cache(async () => {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?redirected=true')

  // Own row, so RLS ("Users can view own profile") allows it — no service-role
  // client needed to answer a question about yourself.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/')
  return { user, fullName: (profile?.full_name as string | null) ?? null }
})

export const ensureAdmin = async () => (await loadAdmin()).user

/** Same check, plus the display name the admin shell puts in its header. */
export const ensureAdminProfile = async () => loadAdmin()
