import type { Metadata } from 'next'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import PageHeader from '@/components/PageHeader'
import AboutStory from '@/components/sections/AboutStory'
import FounderQuote from '@/components/sections/FounderQuote'
import AboutValues from '@/components/sections/AboutValues'
import AboutTimeline from '@/components/sections/AboutTimeline'
import NewsletterBar from '@/components/sections/NewsletterBar'

export const metadata: Metadata = {
  title: 'Our Story — DEWDROPZ',
  description: 'Founded by trekking guides in Dehradun, DEWDROPZ builds gear tested above 4,000 metres before it reaches a cart.',
}

export default function AboutPage() {
  return (
    <>
      <NavBar />
      <main>
        <PageHeader
          eyebrow="Our Story"
          title="Built on a foggy ridgeline."
          subtitle="DEWDROPZ started as three trekking guides fixing the gear that kept failing their clients. Seven years later, the philosophy hasn't moved an inch."
          variant="altitude"
        />
        <AboutStory />
        <FounderQuote />
        <AboutValues />
        <AboutTimeline />
        <NewsletterBar />
      </main>
      <FooterSection />
    </>
  )
}
