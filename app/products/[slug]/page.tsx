import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import ProductDetail from '@/components/sections/ProductDetail'
import { COLLECTIONS, PRODUCTS } from '@/lib/constants'
import { getRelatedProducts } from '@/lib/recommendations'

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const product = PRODUCTS.find((p) => p.slug === slug)
  if (!product) return {}
  return {
    title: `${product.name} — DEWDROPZ`,
    description: product.longDescription,
  }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const product = PRODUCTS.find((p) => p.slug === slug)
  if (!product) notFound()

  const collection = COLLECTIONS.find((c) => c.id === product.collectionId)
  const related = getRelatedProducts(product.slug, 3)

  return (
    <>
      <NavBar />
      <main>
        <ProductDetail product={product} collection={collection} related={related} />
      </main>
      <FooterSection />
    </>
  )
}
