import type { Metadata } from 'next'
import TrekAdminClient from './TrekAdminClient'

export const metadata: Metadata = { title: 'TrekBuddy — DEWDROPZ Admin' }

export default function TrekBuddyAdminPage() {
  return <TrekAdminClient />
}
