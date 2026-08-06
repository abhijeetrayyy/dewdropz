import type { Metadata } from 'next'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import WishlistView from '@/components/sections/WishlistView'
import { getProducts, getCollections } from '@/actions/products'

export const metadata: Metadata = {
  title: 'Your Wishlist — DEWDROPZ',
}

export default async function WishlistPage() {
  const [allProducts, collections] = await Promise.all([getProducts(), getCollections()])
  return (
    <>
      <NavBar />
      <main>
        <WishlistView allProducts={allProducts} collections={collections} />
      </main>
      <FooterSection />
    </>
  )
}
