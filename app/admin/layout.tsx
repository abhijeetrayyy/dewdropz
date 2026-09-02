import { ensureAdminProfile } from '@/lib/adminAuth'
import { getTrekQueueCount } from '@/actions/trekAdmin'
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

  // The one number an admin must not be able to miss.
  //
  // `getTrekQueueCount` has existed since 056 and was called from nowhere, so a
  // report only became visible if somebody happened to open TrekBuddy and click
  // Queue. Reading it in the layout puts it beside the nav item on EVERY admin
  // screen — the orders page, the products page, anywhere — which is the whole
  // point: you should not have to go looking to find out that somebody reported
  // a member two days ago.
  //
  // One `head: true` count against a partial index (`trek_reports_open_idx`),
  // and the layout is already dynamic because it reads the session.
  const trekQueueCount = await getTrekQueueCount().catch(() => 0)

  return (
    <AdminLayoutClient
      adminEmail={user.email ?? ''}
      adminName={fullName}
      trekQueueCount={trekQueueCount}
    >
      {children}
    </AdminLayoutClient>
  )
}
