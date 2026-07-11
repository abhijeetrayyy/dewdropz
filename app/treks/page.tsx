import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import PageHeader from '@/components/PageHeader'
import TreksList from '@/components/sections/TreksList'
import NewsletterBar from '@/components/sections/NewsletterBar'

export const metadata: Metadata = {
  title: 'Guided Treks — DEWDROPZ',
  description: 'Join a DEWDROPZ-guided group trek across the Himalaya — led by the same guides who design the gear.',
}

// Treks paused as a business line. The whole page is kept intact below —
// restore it by removing this redirect (and the other "Treks paused" blocks:
// NavBar, footer, SummitHero, SeasonKit, TerrainScene WAYPOINTS).
const TREKS_PAUSED = true

export default function TreksPage() {
  if (TREKS_PAUSED) redirect('/collections')

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
