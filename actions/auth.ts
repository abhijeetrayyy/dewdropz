'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import { ensureAdmin } from '@/lib/adminAuth'
import { loginSchema, signupSchema, passwordResetSchema, updatePasswordSchema, profileUpdateSchema } from '@/lib/validations'
import type { LoginInput, SignupInput, PasswordResetInput, UpdatePasswordInput, ProfileUpdateInput } from '@/lib/validations'

export async function signup(input: SignupInput) {
  const parsed = signupSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })

  if (error) return { error: error.message }
  return { success: true, message: 'Check your email to confirm your account' }
}

export async function login(input: LoginInput) {
  const parsed = loginSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  // The id comes back so the caller can hand the guest cart to the account it
  // now belongs to — see `adoptLocalCart`. Without it the sign-in form has no
  // way to name the user it just signed in.
  return { success: true, userId: data.user?.id ?? null }
}

export async function logout() {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function resetPassword(input: PasswordResetInput) {
  const parsed = passwordResetSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/update-password`,
  })

  if (error) return { error: error.message }
  return { success: true, message: 'Check your email for a reset link' }
}

export async function updatePassword(input: UpdatePasswordInput) {
  const parsed = updatePasswordSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })

  if (error) return { error: error.message }
  return { success: true, message: 'Password updated successfully' }
}

export async function signInWithProvider(provider: 'google' | 'github') {
  const supabase = await createServerSupabaseClient()
  const headersList = await headers()
  const origin = headersList.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL!

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${origin}/auth/callback` },
  })

  if (error) return { error: error.message }
  redirect(data.url)
}

// Thin wrapper around signInWithProvider('google') with a `(formData) => void`
// signature — the shape a <form action={...}> requires — so the Google button
// can be a plain form post (works with JS disabled, and is the pattern Next.js
// expects for actions that call redirect()) instead of a client onClick handler.
export async function signInWithGoogle() {
  await signInWithProvider('google')
}

export async function updateProfile(input: ProfileUpdateInput) {
  const parsed = profileUpdateSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('profiles')
    .update(parsed.data)
    .eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/account')
  return { success: true }
}

export async function getProfile() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return data
}

export async function getSession() {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function getUser() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function requireAuth(redirectTo?: string) {
  const user = await getUser()
  if (!user) {
    // Carry where they were going. Without this the gate sent everybody to
    // `/auth/login?redirected=true` with no return path, so `safeNext` fell
    // back to /account and a person who was three items into a cart signed in
    // and landed on their profile — having to find their own way back to
    // checkout. LoginForm has read `redirectTo` since launch; nothing was
    // sending it.
    const next = redirectTo ? `&redirectTo=${encodeURIComponent(redirectTo)}` : ''
    redirect(`/auth/login?redirected=true${next}`)
  }
  return user
}

// Delegates to the request-memoised check in lib/adminAuth.ts so that a page
// running several admin actions pays for the auth round-trips once, not once
// per action. Kept as an export here because it is what every action already
// calls, and because callers want it as a server action.
export async function requireAdmin() {
  return ensureAdmin()
}
