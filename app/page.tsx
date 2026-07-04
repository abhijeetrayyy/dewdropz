import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import HeroSection from '@/components/sections/HeroSection'
import BrandStatement from '@/components/sections/BrandStatement'
import FeaturedGear from '@/components/sections/FeaturedGear'
import CollectionScroll from '@/components/sections/CollectionScroll'
import TrekManifesto from '@/components/sections/TrekManifesto'
import WhoGoes from '@/components/sections/WhoGoes'
import GearSpotlight from '@/components/sections/GearSpotlight'
import MarqueeBand from '@/components/sections/MarqueeBand'
import StatsBand from '@/components/sections/StatsBand'
import TerrainFlythrough from '@/components/sections/TerrainFlythrough'
import TrailMap from '@/components/sections/TrailMap'
import JournalStrip from '@/components/sections/JournalStrip'
import BrandStory from '@/components/sections/BrandStory'
import Community from '@/components/sections/Community'
import NewsletterBar from '@/components/sections/NewsletterBar'

export default function Home() {
  return (
    <>
      <NavBar />
      <main>
        <HeroSection />
        <BrandStatement />
        <FeaturedGear />
        <CollectionScroll />
        <TrekManifesto />
        <WhoGoes />
        <GearSpotlight />
        <MarqueeBand />
        <StatsBand />
        <TerrainFlythrough />
        <TrailMap />
        <JournalStrip />
        <BrandStory />
        <Community />
        <NewsletterBar />
      </main>
      <FooterSection />
    </>
  )
}
