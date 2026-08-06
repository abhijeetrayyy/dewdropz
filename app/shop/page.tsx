import { Suspense } from 'react'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import ShopContent from '@/components/sections/ShopContent'
import { getProducts, getCollections } from '@/actions/products'
import { getCategories } from '@/actions/categories'

export default async function ShopPage() {
  const [products, collections, categories] = await Promise.all([
    getProducts(),
    getCollections(),
    getCategories({ parentId: null }),
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
