'use client'

import { useState } from 'react'
import Link from 'next/link'
import { resetPassword } from '@/actions/auth'
import AuthShell from './AuthShell'
import { AuthError, Field, SubmitButton } from './fields'

/**
 * Replaces this route's use of components/auth/AuthForm — a shadcn <Card> on
 * `bg-gray-50` with `text-black`, rendered with no NavBar and no footer. It was
 * the only storefront page with no brand token in it at all, and the only one
 * a visitor could reach that did not look like this shop.
 */
export default function ResetForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await resetPassword({ email })
      if (result.error) {
        setError(typeof result.error === 'string' ? result.error : 'That email did not work.')
      } else {
        setSent(true)
      }
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <AuthShell
        eyebrow="Reset link sent"
        title="Check your email"
        lede={`If an account exists for ${email}, a reset link is on its way.`}
      >
        <Link
          href="/auth/login"
          className="inline-flex min-h-[46px] w-full items-center justify-center rounded-full bg-forest px-6 font-body text-[11px] font-medium uppercase tracking-[0.16em] text-paper transition-colors duration-300 hover:bg-forest-mid"
        >
          Back to sign in
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Reset your password"
      lede="Give us the email on the account and we'll send a link to set a new password."
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

        {error && <AuthError>{error}</AuthError>}

        <SubmitButton loading={loading} loadingLabel="Sending the link…">
          Send reset link
        </SubmitButton>
      </form>

      <p className="mt-8 font-body text-[13px] text-mid">
        Remembered it?{' '}
        <Link href="/auth/login" className="text-forest underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
