import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import PageHeader from '@/components/PageHeader'
import NewsletterBar from '@/components/sections/NewsletterBar'
import { BLUR_DATA_URL } from '@/lib/constants'
import { getCollections } from '@/actions/products'
import type { Collection, Product } from '@/types/database'

/** What getCollections actually returns: the row plus the id-only embed it
 *  fetches so this page can print a piece count. */
type CollectionWithCount = Collection & { products?: Pick<Product, 'id'>[] }

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
          variant="ink"
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
        {/* ── The index ─────────────────────────────────────────────────────
            What was here: three `h-[70vh] min-h-[440px]` plates in a rigid
            three-column grid. At 1280px that is a card roughly 400px wide and
            1440px tall — a 1:3.6 skyscraper. Every photograph was cropped to a
            vertical sliver of sky, and because the content is anchored to the
            bottom, the whole card was 85% dead image with the name, the tagline
            and the link crushed into the last 15%. Three of them side by side,
            with no rhythm between them and nothing to distinguish one from the
            next.

            This is an index, so it is laid out like one. The first collection
            leads at a readable landscape ratio with its copy beside it rather
            than stacked under a gradient; the rest follow at 4:5, which is a
            proportion a photograph of a mountain can actually survive. The
            ground steps under the lead so the two registers separate. */}
        {COLLECTIONS.length > 0 && (
          <section className="bg-paper px-6 py-16 md:px-10 md:py-20">
            <div className="mx-auto max-w-7xl">
              <FeaturedCollection collection={COLLECTIONS[0]} />
            </div>
          </section>
        )}

        {COLLECTIONS.length > 1 && (
          <section className="bg-paper-warm px-6 py-16 md:px-10 md:py-20">
            <div className="mx-auto max-w-7xl">
              <div className="mb-8 flex items-baseline justify-between gap-4 border-b border-rule-warm pb-4">
                <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-mid">
                  More collections
                </h2>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-light">
                  {COLLECTIONS.length - 1} more
                </span>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {COLLECTIONS.slice(1).map((c) => (
                  <CollectionCard key={c.id} collection={c} />
                ))}
              </div>
            </div>
          </section>
        )}

        <NewsletterBar />
      </main>
      <FooterSection />
    </>
  )
}

/** The lead. Landscape image beside its copy, so the photograph is a
 *  photograph and the words are on a surface where they can be read. */
function FeaturedCollection({ collection: c }: { collection: CollectionWithCount }) {
  const count = c.products?.length ?? 0
  return (
    <div className="grid grid-cols-1 items-stretch gap-0 overflow-hidden rounded-[var(--r-panel)] border border-rule/70 bg-surface shadow-[var(--shadow-card)] lg:grid-cols-[1.35fr_1fr]">
      <Link
        href={`/collections/${c.slug}`}
        className="group relative aspect-[16/10] overflow-hidden bg-ink lg:aspect-auto lg:min-h-[420px]"
      >
        {c.image_url && (
          <Image
            src={c.image_url}
            alt={c.name}
            fill
            sizes="(max-width: 1024px) 100vw, 60vw"
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            className="object-cover transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-[1.04]"
          />
        )}
      </Link>

      <div className="flex flex-col justify-center p-7 md:p-10">
        <span className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-forest">
          Featured
          <span className="h-px w-6 bg-sage/50" />
          <span className="text-light">{count} {count === 1 ? 'piece' : 'pieces'}</span>
        </span>

        <h2 className="mt-4 font-display text-[clamp(30px,3.6vw,46px)] leading-[1.05] text-text">
          {c.name}
        </h2>
        {c.tagline && (
          <p className="mt-3 font-display text-lg italic leading-snug text-mid">{c.tagline}</p>
        )}
        {c.description && (
          <p className="mt-5 max-w-md font-body text-sm leading-relaxed text-mid">{c.description}</p>
        )}

        <Link
          href={`/collections/${c.slug}`}
          className="mt-8 inline-flex min-h-[46px] w-fit items-center gap-2 rounded-full bg-forest px-7 font-body text-[11px] font-medium uppercase tracking-[0.14em] text-paper transition-colors duration-300 hover:bg-forest-mid"
        >
          Explore {c.name}
        </Link>
      </div>
    </div>
  )
}

/** The rest. 4:5 — tall enough to feel like a plate, short enough that the
 *  picture is still a picture. */
function CollectionCard({ collection: c }: { collection: CollectionWithCount }) {
  const count = c.products?.length ?? 0
  return (
    <Link
      href={`/collections/${c.slug}`}
      className="group relative block aspect-[4/5] overflow-hidden rounded-[var(--r-panel)] bg-ink shadow-[var(--shadow-card)] transition-shadow duration-500 hover:shadow-[var(--shadow-lift)]"
    >
      {c.image_url && (
        <Image
          src={c.image_url}
          alt={c.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          className="object-cover transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-[1.05]"
        />
      )}
      <span
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to top, rgba(12,16,13,0.90), rgba(12,16,13,0.08) 58%, rgba(12,16,13,0.24))',
        }}
      />
      <span className="absolute inset-x-0 bottom-0 p-6">
        <span className="flex items-center gap-2.5 font-mono text-[9px] uppercase tracking-[0.18em] text-sage">
          Collection
          <span className="h-px w-4 bg-sage/40" />
          <span className="text-paper/60">{count} {count === 1 ? 'piece' : 'pieces'}</span>
        </span>
        <span className="mt-2.5 block font-display text-2xl leading-tight text-paper">{c.name}</span>
        {c.tagline && (
          <span className="mt-1 block font-display text-sm italic text-paper/65">{c.tagline}</span>
        )}
        <span className="mt-4 inline-block w-fit border-b border-paper/40 pb-1 font-body text-[11px] uppercase tracking-[0.1em] text-paper transition-colors duration-300 group-hover:border-paper">
          Explore →
        </span>
      </span>
    </Link>
  )
}
