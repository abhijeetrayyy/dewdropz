import type { Metadata } from 'next'
import Image from 'next/image'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import PageHeader from '@/components/PageHeader'
import ValuesGrid from '@/components/ValuesGrid'
import NewsletterBar from '@/components/sections/NewsletterBar'
import { ADVENTURE_IMAGE_2, BLUR_DATA_URL, SUSTAINABILITY_COMMITMENTS, SUSTAINABILITY_INTRO } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Sustainability — DEWDROPZ',
  description: 'How DEWDROPZ sources materials, manufactures in small batches, and ships responsibly.',
}

export default function SustainabilityPage() {
  return (
    <>
      <NavBar />
      <main>
        <PageHeader
          eyebrow="Doing Right By The Trail"
          title="Honest, not perfect."
          subtitle={SUSTAINABILITY_INTRO}
        />

        <section className="bg-paper px-6 md:px-10 pb-24">
          <div className="max-w-5xl mx-auto relative h-[40vh] min-h-[280px] rounded-lg overflow-hidden">
            <Image
              src={ADVENTURE_IMAGE_2}
              alt="Snowy Himalayan peak"
              fill
              sizes="(max-width: 768px) 100vw, 80vw"
              placeholder="blur"
              blurDataURL={BLUR_DATA_URL}
              className="object-cover"
            />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to top, rgba(12,16,13,0.5), transparent 60%)' }}
            />
          </div>
        </section>

        <ValuesGrid eyebrow="Our Commitments" title="What we actually do about it." values={SUSTAINABILITY_COMMITMENTS} />

        <NewsletterBar />
      </main>
      <FooterSection />
    </>
  )
}
