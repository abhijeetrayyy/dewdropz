import type { Metadata } from 'next'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import CartView from '@/components/sections/CartView'

export const metadata: Metadata = {
  title: 'Your Cart — DEWDROPZ',
}

export default function CartPage() {
  return (
    <>
      <NavBar />
      <main>
        <CartView />
      </main>
      <FooterSection />
    </>
  )
}
