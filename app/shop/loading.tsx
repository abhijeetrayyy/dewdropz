import NavBar from '@/components/layout/NavBar'
import ShopGridSkeleton from '@/components/shop/ShopGridSkeleton'

// The route-level loading state. The storefront had none anywhere; Trek Buddy
// has eleven. The nav renders so the page never appears to have lost its
// chrome, and the skeleton is the same component the Suspense fallback uses, so
// the two loading states of this page cannot drift apart.
export default function ShopLoading() {
  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-paper pt-32">
        <ShopGridSkeleton />
      </main>
    </>
  )
}
