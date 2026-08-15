import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import ProductDetail from '@/components/sections/ProductDetail'
import { getProductBySlug, getProducts, getCollections } from '@/actions/products'
import { getRelatedProducts } from '@/lib/recommendations'
import { getStoreSettings } from '@/actions/settings'
import { getOffersForProduct } from '@/actions/promotions'

export async function generateStaticParams() {
  const products = await getProducts()
  return products.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) return {}
  return {
    title: `${product.name} — DEWDROPZ`,
    description: product.description ?? product.short_description ?? undefined,
  }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) notFound()

  const [allProducts, collections, settings, offers] = await Promise.all([
    getProducts(),
    getCollections(),
    getStoreSettings(),
    // Automatic offers that would fire on this product. Shown here because an
    // offer nobody learns about until checkout is an offer that did not do its
    // job — the point of running one is that it affects what people buy.
    getOffersForProduct(product.slug, product.collection?.slug ?? null),
  ])
  const related = getRelatedProducts(allProducts, product.slug, 6)

  return (
    <>
      <NavBar />
      <main>
        <ProductDetail
          product={product}
          collection={product.collection}
          related={related}
          collections={collections}
          freeShippingThreshold={settings.free_shipping_threshold}
          offers={offers}
        />
      </main>
      <FooterSection />
    </>
  )
}
