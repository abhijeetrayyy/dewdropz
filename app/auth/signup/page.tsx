'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import { signup } from '@/actions/auth'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'

export default function SignupPage() {
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
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay bg-[radial-gradient(ellipse_at_center,_var(--ink)_1px,_transparent_1px)] bg-[size:12px_12px]" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md relative z-10"
        >
          <div className="text-center mb-10">
            <h1 className="font-display text-[clamp(32px,5vw,48px)] text-ink">Create Account</h1>
            <p className="font-body text-sm text-mid mt-3 tracking-wide">
              Join the journey. Fast checkout and order history.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center p-8 border border-forest/20 rounded-sm bg-forest/5"
              >
                <h3 className="font-display text-2xl text-forest mb-2">Check your email</h3>
                <p className="font-body text-sm text-mid mb-6">
                  We've sent a confirmation link to {email}. Please verify your account to continue.
                </p>
                <Link href="/" className="font-body text-xs tracking-widest uppercase text-forest hover:underline">
                  Return Home
                </Link>
              </motion.div>
            ) : (
              <motion.form 
                key="form"
                onSubmit={handleSubmit} 
                className="space-y-6"
                exit={{ opacity: 0 }}
              >
                <div>
                  <label className="block font-body text-xs tracking-[0.1em] text-forest uppercase mb-2">Full Name</label>
                  <input 
                    type="text" 
                    required 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-transparent border-b border-rule py-3 font-body text-sm text-ink focus:outline-none focus:border-forest transition-colors"
                    placeholder="Rohan Thapliyal"
                  />
                </div>

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
                  <div className="font-body text-[10px] text-mid mt-2">Must be at least 6 characters.</div>
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
                  className="w-full bg-forest text-paper font-body text-xs tracking-[0.15em] uppercase py-4 rounded-sm hover:bg-forest-mid transition-colors disabled:opacity-50 mt-4"
                >
                  {loading ? 'Creating...' : 'Create Account'}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {!success && (
            <div className="mt-10 text-center font-body text-xs text-mid">
              Already geared up?{' '}
              <Link href="/auth/login" className="text-forest hover:underline">
                Sign in
              </Link>
            </div>
          )}
        </motion.div>
      </main>
      <FooterSection />
    </>
  )
}
