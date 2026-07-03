import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import NewsletterBar from '@/components/sections/NewsletterBar'
import ProductCard from '@/components/ProductCard'
import CollectionHero from '@/components/sections/CollectionHero'
import CollectionNarrative from '@/components/sections/CollectionNarrative'
import CollectionCrossSell from '@/components/sections/CollectionCrossSell'
import { COLLECTIONS, PRODUCTS } from '@/lib/constants'

export function generateStaticParams() {
  return COLLECTIONS.map((c) => ({ slug: c.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const collection = COLLECTIONS.find((c) => c.id === slug)
  if (!collection) return {}
  return {
    title: `${collection.name} — DEWDROPZ`,
    description: collection.description,
  }
}

export default async function CollectionDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const collection = COLLECTIONS.find((c) => c.id === slug)
  if (!collection) notFound()

  const products = PRODUCTS.filter((p) => p.collectionId === collection.id)
  const others = COLLECTIONS.filter((c) => c.id !== collection.id)

  return (
    <>
      <NavBar />
      <main>
        <CollectionHero collection={collection} />
        <CollectionNarrative collection={collection} />

        <section className="bg-paper px-6 md:px-10 pb-24">
          <div className="max-w-7xl mx-auto">
            <div className="mb-14 flex items-end justify-between border-t border-rule pt-14">
              <div>
                <div className="font-body text-xs tracking-[0.18em] text-forest uppercase">Signature</div>
                <h2 className="font-display text-[clamp(28px,4vw,40px)] text-text mt-2">{collection.signature}</h2>
              </div>
              <span className="font-body text-xs text-mid">
                {products.length} {products.length === 1 ? 'piece' : 'pieces'}
              </span>
            </div>

            {products.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
                {products.map((p) => (
                  <ProductCard key={p.slug} product={p} />
                ))}
              </div>
            ) : (
              <p className="font-body text-sm text-mid">More pieces from this collection are on the way.</p>
            )}
          </div>
        </section>

        <CollectionCrossSell others={others} />
        <NewsletterBar />
      </main>
      <FooterSection />
    </>
  )
}
