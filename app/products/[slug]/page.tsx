import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCustomRangeContext } from '@/actions/customRange'
import CustomRangeBanner from '@/components/sections/CustomRangeBanner'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import ProductDetail from '@/components/sections/ProductDetail'
import { getProductBySlug, getProducts, getCollections } from '@/actions/products'
import { getRentalForProduct } from '@/actions/rentals'
import { getRelatedProducts } from '@/lib/recommendations'
import { getStoreSettings } from '@/actions/settings'
import { getOffersForProduct } from '@/actions/promotions'

// These pages are prerendered now, so they need a refresh window as well as
// the on-demand revalidation the admin already triggers. Two different kinds of
// change reach a product: an edit, which calls revalidatePath and lands
// immediately, and a SALE, which decrements stock through a database trigger
// that no application code observes. Without a window, a sold-out size could
// read as available until someone happened to edit the product.
//
// A minute is short enough that stock is never far wrong and long enough that
// the page is served from cache to essentially everyone. Nothing can be
// oversold in the meantime regardless: stock is enforced by a CHECK constraint
// at the table, so the worst a stale page causes is a clear error at checkout
// rather than an order that cannot be fulfilled.
export const revalidate = 60

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

  const [allProducts, collections, settings, offers, customRange, rentable] = await Promise.all([
    getProducts(),
    getCollections(),
    getStoreSettings(),
    // Automatic offers that would fire on this product. Shown here because an
    // offer nobody learns about until checkout is an offer that did not do its
    // job — the point of running one is that it affects what people buy.
    getOffersForProduct(product.slug, product.collection?.slug ?? null),
    // Null for an ordinary product, which is the common case — the banner then
    // renders nothing rather than claiming studio provenance it does not have.
    getCustomRangeContext(product),
    // Six pieces of equipment can be bought OR rented (migration 098). Null for
    // everything else, which is the common case.
    getRentalForProduct(product.id),
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
          rentable={rentable}
          freeShippingThreshold={settings.free_shipping_threshold}
          offers={offers}
          customRangeSlot={
            customRange ? (
              <CustomRangeBanner
                blank={customRange.blank}
                siblings={customRange.siblings}
                alternatives={customRange.alternatives}
              />
            ) : null
          }
        />
      </main>
      <FooterSection />
    </>
  )
}
