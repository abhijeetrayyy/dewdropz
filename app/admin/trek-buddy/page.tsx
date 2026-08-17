import type { Metadata } from 'next'
import TrekAdminClient from './TrekAdminClient'

export const metadata: Metadata = { title: 'Trek Buddy — DEWDROPZ Admin' }

export default function TrekBuddyAdminPage() {
  return <TrekAdminClient />
}
