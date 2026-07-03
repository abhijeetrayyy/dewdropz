import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import PageHeader from '@/components/PageHeader'
import NewsletterBar from '@/components/sections/NewsletterBar'
import { BLUR_DATA_URL, COLLECTIONS, PRODUCTS } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Collections — DEWDROPZ',
  description: 'Three collections, built for three different kinds of trail.',
}

export default function CollectionsPage() {
  return (
    <>
      <NavBar />
      <main>
        <PageHeader
          eyebrow="Shop"
          title="Three collections. One philosophy."
          subtitle="Every DEWDROPZ collection is built around a specific kind of trail — the fog, the altitude, the long haul. Find the one that matches yours."
        />

        <section className="bg-paper px-6 md:px-10 pb-16">
          <div className="max-w-5xl mx-auto">
            <div className="font-body text-xs tracking-[0.18em] text-forest uppercase text-center mb-2">
              How to Choose
            </div>
            <p className="font-body text-sm text-mid text-center max-w-lg mx-auto mb-10">
              Match the collection to the conditions you actually trek in — not the other way around.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-rule border-t border-b border-rule">
              {COLLECTIONS.map((c) => {
                const count = PRODUCTS.filter((p) => p.collectionId === c.id).length
                const temp = c.conditions.find((cond) => cond.label === 'Temperature Range')?.value
                const season = c.conditions.find((cond) => cond.label === 'Best Season')?.value
                return (
                  <div key={c.id} className="py-6 md:px-8 first:md:pl-0 last:md:pr-0">
                    <h3 className="font-display text-lg text-text">{c.name}</h3>
                    <dl className="mt-3 flex flex-col gap-1.5">
                      <div className="flex justify-between gap-2">
                        <dt className="font-body text-[11px] text-mid uppercase tracking-[0.05em]">Temp</dt>
                        <dd className="font-body text-[11px] text-text">{temp}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="font-body text-[11px] text-mid uppercase tracking-[0.05em]">Season</dt>
                        <dd className="font-body text-[11px] text-text">{season}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="font-body text-[11px] text-mid uppercase tracking-[0.05em]">Pieces</dt>
                        <dd className="font-body text-[11px] text-text">{count}</dd>
                      </div>
                    </dl>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="bg-paper px-6 md:px-10 pb-24">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            {COLLECTIONS.map((c) => (
              <Link
                key={c.id}
                href={`/collections/${c.id}`}
                data-cursor="view"
                data-cursor-text="Explore"
                className="group relative h-[70vh] min-h-[440px] rounded-lg overflow-hidden"
              >
                <Image
                  src={c.image}
                  alt={c.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  placeholder="blur"
                  blurDataURL={BLUR_DATA_URL}
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.1) 55%, rgba(0,0,0,0.25))' }}
                />
                <div className="absolute inset-0 flex flex-col justify-end p-8">
                  <span className="font-body text-[11px] tracking-[0.15em] text-sage uppercase">
                    Best for {c.bestFor}
                  </span>
                  <h3 className="mt-2 font-display text-3xl text-white leading-snug transition-transform duration-300 group-hover:-translate-y-1">
                    {c.name}
                  </h3>
                  <p className="mt-2 font-display italic text-white/70 text-base">{c.tagline}</p>
                  <span className="mt-5 font-body text-xs tracking-[0.1em] text-white uppercase border-b border-white/40 w-fit pb-1 group-hover:border-white transition-colors duration-300">
                    Explore Collection →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <NewsletterBar />
      </main>
      <FooterSection />
    </>
  )
}
