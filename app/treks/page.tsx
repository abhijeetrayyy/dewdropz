import type { Metadata } from 'next'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import PageHeader from '@/components/PageHeader'
import TrailGuide from '@/components/sections/TrailGuide'
import NewsletterBar from '@/components/sections/NewsletterBar'

export const metadata: Metadata = {
  title: 'Trail Guide — DEWDROPZ',
  description:
    'A field guide to the Uttarakhand trails our gear is built on — altitude, difficulty, the right season, and what you pass along the way.',
}

// Reference, not a booking funnel. This page used to sell guided departures
// with dates, prices and live spot counts for a business line that doesn't
// run; it's now a straight informational guide to real trails, which is both
// honest and the thing people actually search for.
export default function TreksPage() {
  return (
    <>
      <NavBar />
      <main>
        <PageHeader
          eyebrow="The Trail Guide"
          title="Knowledge for the road ahead."
          subtitle="A growing library of routes, stories and field notes for those who carry the mountains with them."
          variant="altitude"
        />
        <TrailGuide />
        <NewsletterBar />
      </main>
      <FooterSection />
    </>
  )
}
