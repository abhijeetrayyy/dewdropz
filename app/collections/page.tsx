import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import PageHeader from '@/components/PageHeader'
import NewsletterBar from '@/components/sections/NewsletterBar'
import { BLUR_DATA_URL } from '@/lib/constants'
import { getCollections } from '@/actions/products'

// Also renders catalogue data; same window as the rest.
export const revalidate = 60

export const metadata: Metadata = {
  title: 'Collections — DEWDROPZ',
  description: 'Three collections, built for three different kinds of trail.',
}

export default async function CollectionsPage() {
  const COLLECTIONS = await getCollections()
  return (
    <>
      <NavBar />
      <main>
        <PageHeader
          eyebrow="Shop"
          title="Three Collections. One Spirit of Exploration."
          subtitle="Each DEWDROPZ collection tells a different story — from quiet mountain mornings to mist-covered trails and moments of stillness along the way. Discover the one that speaks to you."
        />

        {/* "How to Choose" removed at the client's request. It framed the range
            as technical kit selected against trekking conditions — the outdoor
            outfitter positioning the brief is explicitly moving away from. The
            collections are stories now, not condition-matched kits.

            The three-column index that replaced it is gone too, and for a
            plainer reason: it printed each collection's name and tagline, and
            then the plates immediately below printed the same name and the same
            tagline again, larger and over the photograph. Two identical lists
            stacked, about 150px apart, and the top one had no picture — so the
            page spent its first screen and a half saying the same three things
            twice before showing anything. The only fact the index carried that
            the plates did not is the piece count, which now sits on the plate
            it describes. */}
        <section className="bg-paper px-6 md:px-10 pb-24">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            {COLLECTIONS.map((c) => (
              <Link
                key={c.id}
                href={`/collections/${c.slug}`}
                className="group relative h-[70vh] min-h-[440px] rounded-lg overflow-hidden bg-ink"
              >
                {c.image_url && (
                  <Image
                    src={c.image_url}
                    alt={c.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    placeholder="blur"
                    blurDataURL={BLUR_DATA_URL}
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                )}
                <div
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(to top, rgba(12,16,13,0.88), rgba(12,16,13,0.10) 55%, rgba(12,16,13,0.28))' }}
                />
                <div className="absolute inset-0 flex flex-col justify-end p-8">
                  <span className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-sage">
                    Collection
                    <span className="h-px w-6 bg-sage/40" />
                    <span className="text-paper/60">
                      {c.products?.length ?? 0} {(c.products?.length ?? 0) === 1 ? 'piece' : 'pieces'}
                    </span>
                  </span>
                  <h3 className="mt-3 font-display text-3xl leading-snug text-paper transition-transform duration-300 group-hover:-translate-y-1">
                    {c.name}
                  </h3>
                  {c.tagline && <p className="mt-2 font-display text-base italic text-paper/70">{c.tagline}</p>}
                  <span className="mt-5 w-fit border-b border-paper/40 pb-1 font-body text-xs uppercase tracking-[0.1em] text-paper transition-colors duration-300 group-hover:border-paper">
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
