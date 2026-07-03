import type { Metadata } from 'next'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import PageHeader from '@/components/PageHeader'
import TreksList from '@/components/sections/TreksList'
import NewsletterBar from '@/components/sections/NewsletterBar'

export const metadata: Metadata = {
  title: 'Guided Treks — DEWDROPZ',
  description: 'Join a DEWDROPZ-guided group trek across the Himalaya — led by the same guides who design the gear.',
}

export default function TreksPage() {
  return (
    <>
      <NavBar />
      <main>
        <PageHeader
          eyebrow="Guided Treks"
          title="Come trek with the people who make your gear."
          subtitle="Our founders still guide. A few times a year, we open a handful of spots on the routes we know best."
          variant="altitude"
        />
        <TreksList />
        <NewsletterBar />
      </main>
      <FooterSection />
    </>
  )
}
