import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import AdminLayoutClient from './AdminLayoutClient'

export const metadata = {
  title: 'Admin — DEWDROPZ',
  robots: 'noindex, nofollow',
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login?redirectTo=/admin')

  // Use admin client to bypass RLS on profiles
  const adminClient = createAdminSupabaseClient()
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'admin') redirect('/')

  return (
    <AdminLayoutClient adminEmail={user.email ?? ''} adminName={profile.full_name}>
      {children}
    </AdminLayoutClient>
  )
}
