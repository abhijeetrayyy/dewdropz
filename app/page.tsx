import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import SummitHero from '@/components/sections/SummitHero'
import TrustBand from '@/components/sections/TrustBand'
import SeasonKit from '@/components/sections/SeasonKit'
import ShopByCategory from '@/components/sections/ShopByCategory'
import FeaturedGear from '@/components/sections/FeaturedGear'
import CollectionsRow from '@/components/sections/CollectionsRow'
import GearSpotlight from '@/components/sections/GearSpotlight'
import BrandPulse from '@/components/sections/BrandPulse'
import Community from '@/components/sections/Community'
import NewsletterBar from '@/components/sections/NewsletterBar'

// One mountain, one descent, one store. SummitHero fuses what used to be two
// separate pinned set-pieces (the 400vh video hero + the mid-page terrain
// flythrough) into a single continuous journey: land on the summit at dawn,
// scroll to descend past collection and trek waypoints, and arrive in the store
// — where SeasonKit greets you with the trek window that's open right now and
// the exact kit to pack for it. The old video HeroSection and TerrainFlythrough
// files remain in the repo, just unplugged.
export default function Home() {
  return (
    <>
      <NavBar />
      <main>
        <SummitHero />
        <TrustBand />
        <SeasonKit />
        <ShopByCategory />
        <FeaturedGear />
        <CollectionsRow />
        <GearSpotlight />
        <BrandPulse />
        <Community />
        <NewsletterBar />
      </main>
      <FooterSection />
    </>
  )
}
