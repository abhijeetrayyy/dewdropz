import type { Metadata } from 'next'
import { Suspense } from 'react'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import CartView from '@/components/sections/CartView'
import { getStoreSettings } from '@/actions/settings'
import { getProducts, getCollections } from '@/actions/products'

// Also renders catalogue data; same window as the rest.
export const revalidate = 60

export const metadata: Metadata = {
  title: 'Your Cart — DEWDROPZ',
}

export default async function CartPage() {
  const [allProducts, collections, settings] = await Promise.all([getProducts(), getCollections(), getStoreSettings()])
  return (
    <>
      <NavBar />
      <main>
        {/* CartView reads ?recovered=1 to acknowledge an abandoned-cart return.
            Now that this page no longer reads cookies it can be prerendered,
            and useSearchParams needs a boundary to suspend at during that —
            without one the build refuses to prerender the page at all. The
            fallback is never really seen: the cart itself is client state. */}
        <Suspense fallback={null}>
          <CartView allProducts={allProducts} collections={collections} freeShippingThreshold={settings.free_shipping_threshold} />
        </Suspense>
      </main>
      <FooterSection />
    </>
  )
}
