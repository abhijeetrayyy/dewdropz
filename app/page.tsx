import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import HeroSection from '@/components/sections/HeroSection'
import BrandStatement from '@/components/sections/BrandStatement'
import TrekManifesto from '@/components/sections/TrekManifesto'
import WhoGoes from '@/components/sections/WhoGoes'
import MarqueeBand from '@/components/sections/MarqueeBand'
import CollectionScroll from '@/components/sections/CollectionScroll'
import FeaturedGear from '@/components/sections/FeaturedGear'
import JournalStrip from '@/components/sections/JournalStrip'
import BrandStory from '@/components/sections/BrandStory'
import StatsBand from '@/components/sections/StatsBand'
import TrailMap from '@/components/sections/TrailMap'
import Community from '@/components/sections/Community'
import NewsletterBar from '@/components/sections/NewsletterBar'

export default function Home() {
  return (
    <>
      <NavBar />
      <main>
        <HeroSection />
        <BrandStatement />
        <TrekManifesto />
        <WhoGoes />
        <MarqueeBand />
        <CollectionScroll />
        <FeaturedGear />
        <JournalStrip />
        <BrandStory />
        <StatsBand />
        <TrailMap />
        <Community />
        <NewsletterBar />
      </main>
      <FooterSection />
    </>
  )
}
