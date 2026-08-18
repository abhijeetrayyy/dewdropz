import { Suspense } from 'react'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import LoginForm from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <>
      <NavBar />
      {/* LoginForm reads ?redirectTo= / ?redirect= so it can return you to the
          page that sent you here. useSearchParams opts a component out of
          prerendering, so it needs a boundary or the whole route fails to
          export — which is exactly what the build reported. */}
      <Suspense fallback={<div className="min-h-screen bg-paper" />}>
        <LoginForm />
      </Suspense>
      <FooterSection />
    </>
  )
}
