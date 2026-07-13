import type { Metadata } from 'next'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import WishlistView from '@/components/sections/WishlistView'

export const metadata: Metadata = {
  title: 'Your Wishlist — DEWDROPZ',
}

export default function WishlistPage() {
  return (
    <>
      <NavBar />
      <main>
        <WishlistView />
      </main>
      <FooterSection />
    </>
  )
}
