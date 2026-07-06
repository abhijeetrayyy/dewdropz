import { Suspense } from 'react'
import { AuthForm } from '@/components/auth/AuthForm'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>}>
      <AuthForm mode="reset" />
    </Suspense>
  )
}
