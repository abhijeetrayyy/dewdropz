'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { login, signup, resetPassword } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Mode = 'login' | 'signup' | 'reset'

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (mode === 'login') {
        const result = await login({ email, password })
        if (result.error) { setError(typeof result.error === 'string' ? result.error : 'Invalid credentials'); return }
        router.push(redirectTo)
        router.refresh()
      } else if (mode === 'signup') {
        const result = await signup({ email, password, full_name: fullName })
        if (result.error) { setError(typeof result.error === 'string' ? result.error : 'Signup failed'); return }
        setMessage(result.message ?? 'Check your email')
      } else if (mode === 'reset') {
        const result = await resetPassword({ email })
        if (result.error) { setError(typeof result.error === 'string' ? result.error : 'Reset failed'); return }
        setMessage(result.message ?? 'Check your email for a reset link')
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const titles = { login: 'Sign In', signup: 'Create Account', reset: 'Reset Password' }
  const buttonLabels = { login: 'Sign In', signup: 'Create Account', reset: 'Send Reset Link' }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-2">DEWDROPZ</p>
          <CardTitle className="text-xl font-bold text-black">{titles[mode]}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <Label htmlFor="name">Full Name *</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" required />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            {mode !== 'reset' && (
              <div>
                <Label htmlFor="password">Password *</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={8} />
              </div>
            )}

            {error && <p className="text-red-600 text-sm">{error}</p>}
            {message && <p className="text-green-700 text-sm bg-green-50 p-3 rounded-md border border-green-200">{message}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Please wait...' : buttonLabels[mode]}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500 space-y-1">
            {mode === 'login' && (
              <>
                <p><Link href="/auth/signup" className="text-black underline">Create an account</Link></p>
                <p><Link href="/auth/reset-password" className="text-gray-400 underline">Forgot password?</Link></p>
              </>
            )}
            {mode === 'signup' && (
              <p><Link href="/auth/login" className="text-black underline">Already have an account? Sign in</Link></p>
            )}
            {mode === 'reset' && (
              <p><Link href="/auth/login" className="text-black underline">Back to sign in</Link></p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
