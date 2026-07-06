'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { login } from '@/actions/auth'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'

export default function LoginPage() {
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
        window.location.href = '/account'
      }
    } catch (err) {
      setError('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-paper flex items-center justify-center pt-32 pb-24 px-6 relative overflow-hidden">
        {/* Grain / Noise background overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay bg-[radial-gradient(ellipse_at_center,_var(--ink)_1px,_transparent_1px)] bg-[size:12px_12px]" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md relative z-10"
        >
          <div className="text-center mb-10">
            <h1 className="font-display text-[clamp(32px,5vw,48px)] text-ink">Sign In</h1>
            <p className="font-body text-sm text-mid mt-3 tracking-wide">
              Access your gear, orders, and wishlist.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block font-body text-xs tracking-[0.1em] text-forest uppercase mb-2">Email</label>
              <input 
                type="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent border-b border-rule py-3 font-body text-sm text-ink focus:outline-none focus:border-forest transition-colors"
                placeholder="trail@example.com"
              />
            </div>

            <div>
              <label className="block font-body text-xs tracking-[0.1em] text-forest uppercase mb-2">Password</label>
              <input 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent border-b border-rule py-3 font-body text-sm text-ink focus:outline-none focus:border-forest transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="font-body text-xs text-red-700 bg-red-100 p-3 rounded-sm border border-red-200">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              data-cursor="view"
              className="w-full bg-forest text-paper font-body text-xs tracking-[0.15em] uppercase py-4 rounded-sm hover:bg-forest-mid transition-colors disabled:opacity-50"
            >
              {loading ? 'Entering...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-10 text-center font-body text-xs text-mid">
            Don't have an account?{' '}
            <Link href="/auth/signup" className="text-forest hover:underline">
              Create one
            </Link>
          </div>
        </motion.div>
      </main>
      <FooterSection />
    </>
  )
}
