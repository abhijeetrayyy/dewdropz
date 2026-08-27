'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signup } from '@/actions/auth'
import { GoogleSignInButton } from './GoogleSignInButton'
import AuthShell from './AuthShell'
import { AuthError, Field, OrRule, PASSWORD_MIN, SubmitButton } from './fields'

export default function SignupForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await signup({ email, password, full_name: name })
      if (result.error) {
        if (typeof result.error === 'string') {
          setError(result.error)
        } else {
          // Flatten field errors
          const msgs = Object.values(result.error).flat().join(', ')
          setError(msgs || 'Invalid input.')
        }
      } else {
        setSuccess(true)
      }
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  // The confirmation state replaces the form rather than sitting under it —
  // there is nothing left to fill in, so leaving the fields on screen only
  // invites a second submit.
  if (success) {
    return (
      <AuthShell
        eyebrow="One step left"
        title="Check your email"
        lede={`A confirmation link is on its way to ${email}. Open it and your account is live.`}
      >
        <div className="rounded-[var(--r-panel)] border border-rule bg-surface p-6">
          <p className="font-body text-[13px] leading-relaxed text-mid">
            Nothing arrived? It can take a minute, and it sometimes lands in spam. You can
            also{' '}
            <Link href="/auth/login" className="text-forest underline-offset-4 hover:underline">
              sign in
            </Link>{' '}
            once the link is confirmed.
          </p>
        </div>

        <Link
          href="/shop"
          className="mt-6 inline-flex min-h-[46px] w-full items-center justify-center rounded-full border border-forest/30 px-6 font-body text-[11px] font-medium uppercase tracking-[0.16em] text-forest transition-colors duration-300 hover:border-forest hover:bg-forest/5"
        >
          Look around the shop
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      eyebrow="Create your account"
      title="Join the range"
      lede="Faster checkout, saved designs, order history, and a seat at Trek Buddy."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field
          id="name"
          label="Full name"
          type="text"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Rohan Thapliyal"
        />

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

        {/* The hint and minLength both read PASSWORD_MIN, which is the number
            lib/validations.ts actually enforces. This used to say 6. */}
        <Field
          id="password"
          label="Password"
          type="password"
          required
          minLength={PASSWORD_MIN}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          hint={`At least ${PASSWORD_MIN} characters.`}
        />

        {error && <AuthError>{error}</AuthError>}

        <SubmitButton loading={loading} loadingLabel="Creating your account…">
          Create account
        </SubmitButton>
      </form>

      <OrRule />

      <GoogleSignInButton label="Continue with Google" />

      <p className="mt-8 font-body text-[13px] text-mid">
        Already have an account?{' '}
        <Link href="/auth/login" className="text-forest underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
