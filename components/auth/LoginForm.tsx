'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { adoptLocalCart } from '@/actions/cartAdoption'
import { claimGuestRentalBookings } from '@/actions/rentals'
import { login } from '@/actions/auth'
import { GoogleSignInButton } from './GoogleSignInButton'
import AuthShell from './AuthShell'
import { AuthError, Field, OrRule, SubmitButton } from './fields'

/**
 * Where to go once you are in.
 *
 * Every gated route in the app hands login a destination and it was throwing
 * all of them away: the middleware sends `?redirectTo=` for account, checkout
 * and admin, Trek Buddy's pages send `?redirect=`, and this form navigated to
 * a hardcoded /account regardless. So a customer with a full cart who hit
 * /checkout signed in and landed on their account page, and an admin opening
 * an order link signed in and landed there too.
 *
 * Both names are read because both are in use. Only same-site paths are
 * accepted — a bare `/` prefix but not `//`, which the browser reads as
 * protocol-relative and would turn this into an open redirect anybody could
 * point at their own host from a link.
 */
function safeNext(params: URLSearchParams): string {
  const raw = params.get('redirectTo') ?? params.get('redirect') ?? ''
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/account'
  return raw
}

export default function LoginForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await login({ email, password })
      if (result.error) {
        if (typeof result.error === 'string') {
          setError(result.error)
        } else {
          setError('Invalid credentials.')
        }
      } else {
        // The cart the person built as a guest becomes the account's cart —
        // joined with anything already saved there, not replacing it. Done
        // BEFORE navigating, because the next page reads localStorage on mount
        // and would otherwise show the pre-merge cart for a beat.
        //
        // A failure here must never block a successful sign-in: the local cart
        // is untouched and checkout still syncs it, so the worst case is the
        // status quo we had before this existed.
        try {
          const raw = window.localStorage.getItem('dewdropz_cart')
          const lines = raw ? JSON.parse(raw) : []
          if (Array.isArray(lines) && lines.length > 0 && result.userId) {
            const { items } = await adoptLocalCart(lines, result.userId)
            window.localStorage.setItem('dewdropz_cart', JSON.stringify(items))
          }
          // Any rental booked as a guest under this address becomes theirs, so
          // it appears on "your rentals" instead of being reachable only
          // through the lookup form.
          await claimGuestRentalBookings()
        } catch {
          // Keep the guest cart as-is and carry on.
        }
        window.location.href = safeNext(searchParams)
      }
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in"
      lede="Your orders, saved designs, wishlist and trek plans are where you left them."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field
          id="email"
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />

        <div>
          <Field
            id="password"
            label="Password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          {/* /auth/reset-password has existed for this route's whole life and
              nothing on the sign-in screen linked to it, so the only way to
              recover an account was to already know the URL. */}
          <div className="mt-2 text-right">
            <Link
              href="/auth/reset-password"
              className="font-body text-[12px] text-mid underline-offset-4 transition-colors hover:text-forest hover:underline"
            >
              Forgot your password?
            </Link>
          </div>
        </div>

        {error && <AuthError>{error}</AuthError>}

        <SubmitButton loading={loading} loadingLabel="Signing in…">
          Sign in
        </SubmitButton>
      </form>

      <OrRule />

      <GoogleSignInButton label="Continue with Google" />

      <p className="mt-8 font-body text-[13px] text-mid">
        New here?{' '}
        <Link href="/auth/signup" className="text-forest underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  )
}
