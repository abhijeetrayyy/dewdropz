import { requireAuth, getProfile } from '@/actions/auth'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import Link from 'next/link'
import LogoutButton from './LogoutButton'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireAuth()
  const profile = await getProfile()

  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-paper pt-32 pb-24 px-6 md:px-10">
        <div className="max-w-6xl mx-auto">
          <div className="mb-14 border-b border-rule pb-10">
            <h1 className="font-display text-[clamp(40px,6vw,72px)] text-text leading-none uppercase mb-4">
              Your Gear
            </h1>
            <p className="font-body text-mid max-w-lg">
              Welcome back, {profile?.full_name?.split(' ')[0] || 'Trekker'}. 
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-12">
            <aside className="space-y-6">
              <nav className="flex flex-col space-y-3 font-body text-sm">
                <Link href="/account" className="text-text hover:text-forest transition-colors">Profile & Orders</Link>
                <Link href="/wishlist" className="text-text hover:text-forest transition-colors">Wishlist</Link>
                {profile?.role === 'admin' && (
                  <Link href="/admin" className="text-amber-600 hover:underline transition-colors mt-4 block">Admin Dashboard</Link>
                )}
                <div className="pt-6 border-t border-rule mt-6">
                  <LogoutButton />
                </div>
              </nav>
            </aside>

            <div className="min-h-[40vh]">
              {children}
            </div>
          </div>
        </div>
      </main>
      <FooterSection />
    </>
  )
}
