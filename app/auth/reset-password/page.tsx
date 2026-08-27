import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import ResetForm from '@/components/auth/ResetForm'

export const metadata = { title: 'Reset your password' }

export default function ResetPasswordPage() {
  return (
    <>
      <NavBar />
      <ResetForm />
      <FooterSection />
    </>
  )
}
