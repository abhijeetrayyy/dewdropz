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
          eyebrow="Trail Guide"
          title="The trails this gear was built on."
          subtitle="Where they are, how high they go, when they're worth walking, and what you pass on the way. No departures to book — just what we'd tell a friend before their first one."
          variant="altitude"
        />
        <TrailGuide />
        <NewsletterBar />
      </main>
      <FooterSection />
    </>
  )
}
