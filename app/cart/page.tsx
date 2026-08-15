import type { Metadata } from 'next'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import CartView from '@/components/sections/CartView'
import { getStoreSettings } from '@/actions/settings'
import { getProducts, getCollections } from '@/actions/products'

export const metadata: Metadata = {
  title: 'Your Cart — DEWDROPZ',
}

export default async function CartPage() {
  const [allProducts, collections, settings] = await Promise.all([getProducts(), getCollections(), getStoreSettings()])
  return (
    <>
      <NavBar />
      <main>
        <CartView allProducts={allProducts} collections={collections} freeShippingThreshold={settings.free_shipping_threshold} />
      </main>
      <FooterSection />
    </>
  )
}
