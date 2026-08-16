import { ensureAdminProfile } from '@/lib/adminAuth'
import AdminLayoutClient from './AdminLayoutClient'

export const metadata = {
  title: 'Admin — DEWDROPZ',
  robots: 'noindex, nofollow',
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Was a second, hand-rolled copy of the admin check: its own getUser() plus
  // its own profiles read through the service-role client. Since every admin
  // page also runs ensureAdmin inside its actions, each page load was paying
  // for the same question twice — four round-trips to establish one identity.
  //
  // Sharing the memoised check makes it two, and removes the only reason this
  // layout needed the service-role client at all: a signed-in user reading
  // their own profile row is something RLS already permits.
  const { user, fullName } = await ensureAdminProfile()

  return (
    <AdminLayoutClient adminEmail={user.email ?? ''} adminName={fullName}>
      {children}
    </AdminLayoutClient>
  )
}
