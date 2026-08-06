import type { Metadata } from 'next'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import CartView from '@/components/sections/CartView'
import { getProducts, getCollections } from '@/actions/products'

export const metadata: Metadata = {
  title: 'Your Cart — DEWDROPZ',
}

export default async function CartPage() {
  const [allProducts, collections] = await Promise.all([getProducts(), getCollections()])
  return (
    <>
      <NavBar />
      <main>
        <CartView allProducts={allProducts} collections={collections} />
      </main>
      <FooterSection />
    </>
  )
}
