import type { Metadata } from 'next'
import { requireAuth } from '@/actions/auth'
import { getAddresses } from '@/actions/addresses'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import CheckoutClient from '@/components/checkout/CheckoutClient'

export const metadata: Metadata = {
  title: 'Checkout — DEWDROPZ',
}

export default async function CheckoutPage() {
  // Addresses need a real user_id (no guest-checkout support at the schema
  // level), so checkout requires login — same gate as /account.
  const user = await requireAuth()
  const addresses = await getAddresses('shipping')

  return (
    <>
      <NavBar />
      <main>
        <CheckoutClient
          userId={user.id}
          email={user.email ?? ''}
          initialAddresses={addresses}
        />
      </main>
      <FooterSection />
    </>
  )
}
