import { Suspense } from 'react'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import ShopContent from '@/components/sections/ShopContent'
import { getProducts, getCollections } from '@/actions/products'
import { getCategories } from '@/actions/categories'

// Prices and stock are on this page; see the note in products/[slug].
export const revalidate = 60

export default async function ShopPage() {
  const [products, collections, categories] = await Promise.all([
    getProducts(),
    getCollections(),
    // Every category, not just the top level. The filter rail needs the
    // children — T-Shirts, Hoodies, Sweatshirts — because those are what a
    // product is actually tagged with; the departments above them (Apparel,
    // Drinkware) hold no products of their own and only supply the headings.
    // Asking for `parentId: null` returned exactly the two departments, so the
    // rail found nothing stocked and rendered no filters at all.
    getCategories(),
  ])

  return (
    <>
      <NavBar />
      {/* useSearchParams requires a Suspense boundary for prerendering */}
      <Suspense fallback={<main className="pt-32 pb-24 px-6 md:px-10 bg-paper min-h-screen" />}>
        <ShopContent products={products} collections={collections} categories={categories} />
      </Suspense>
      <FooterSection />
    </>
  )
}
