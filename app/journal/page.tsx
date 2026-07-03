import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import PageHeader from '@/components/PageHeader'
import NewsletterBar from '@/components/sections/NewsletterBar'
import { BLUR_DATA_URL, JOURNAL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Journal — DEWDROPZ',
  description: 'Field notes, field guides, and voices from the DEWDROPZ trail community.',
}

export default function JournalPage() {
  return (
    <>
      <NavBar />
      <main>
        <PageHeader
          eyebrow="The Journal"
          title="Stories from the trail."
          subtitle="Field notes, packing guides, and the people who keep coming back to altitude."
        />

        <section className="bg-paper px-6 md:px-10 pb-24">
          <div className="max-w-6xl mx-auto">
            {/* Featured article */}
            <Link
              href={`/journal/${JOURNAL[0].id}`}
              data-cursor="view"
              data-cursor-text="Read"
              className="group grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center mb-20 pb-20 border-b border-rule"
            >
              <div className="relative h-[60vw] max-h-[420px] md:h-[52vh] rounded-lg overflow-hidden order-1 md:order-none">
                <Image
                  src={JOURNAL[0].image}
                  alt={JOURNAL[0].title}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  placeholder="blur"
                  blurDataURL={BLUR_DATA_URL}
                  priority
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent 55%)' }}
                />
                <span className="absolute top-4 left-4 font-body text-[11px] tracking-[0.15em] text-white uppercase bg-ink/40 px-3 py-1 rounded-full backdrop-blur-sm">
                  {JOURNAL[0].tag}
                </span>
              </div>
              <div>
                <span className="font-body text-[10px] tracking-[0.2em] text-forest uppercase">Latest Story</span>
                <div className="font-body text-[11px] text-mid tracking-[0.05em] uppercase mt-3">
                  {JOURNAL[0].author} · {JOURNAL[0].readTime}
                </div>
                <h2 className="mt-3 font-display font-light text-[clamp(28px,4vw,44px)] text-text leading-[1.1] group-hover:text-forest transition-colors duration-300">
                  {JOURNAL[0].title}
                </h2>
                <p className="mt-4 font-body text-sm text-mid leading-relaxed max-w-md">{JOURNAL[0].excerpt}</p>
                <span className="mt-6 inline-block font-body text-xs text-forest tracking-[0.1em] uppercase border-b border-forest/30 pb-1 group-hover:border-forest transition-colors duration-300">
                  Read the full story →
                </span>
              </div>
            </Link>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {JOURNAL.slice(1).map((entry) => (
                <Link
                  key={entry.id}
                  href={`/journal/${entry.id}`}
                  data-cursor="view"
                  data-cursor-text="Read"
                  className="group"
                >
                  <div className="relative h-[50vw] max-h-[320px] md:h-[38vh] rounded-lg overflow-hidden">
                    <Image
                      src={entry.image}
                      alt={entry.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      placeholder="blur"
                      blurDataURL={BLUR_DATA_URL}
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div
                      className="absolute inset-0"
                      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent 55%)' }}
                    />
                    <span className="absolute top-4 left-4 font-body text-[11px] tracking-[0.15em] text-white uppercase">
                      {entry.tag}
                    </span>
                  </div>
                  <div className="mt-4">
                    <div className="font-body text-[11px] text-mid tracking-[0.05em] uppercase">
                      {entry.author} · {entry.readTime}
                    </div>
                    <h3 className="mt-2 font-display text-xl text-text leading-snug group-hover:text-forest transition-colors duration-300">
                      {entry.title}
                    </h3>
                    <p className="mt-2 font-body text-sm text-mid leading-relaxed">{entry.excerpt}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <NewsletterBar />
      </main>
      <FooterSection />
    </>
  )
}
