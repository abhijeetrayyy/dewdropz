import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import TrailSpine from '@/components/TrailSpine'
import SummitHero from '@/components/sections/SummitHero'
import TrustBand from '@/components/sections/TrustBand'
import SeasonKit from '@/components/sections/SeasonKit'
import TheClimb from '@/components/sections/TheClimb'
import CollectionsRow from '@/components/sections/CollectionsRow'
import ShopByCategory from '@/components/sections/ShopByCategory'
import Community from '@/components/sections/Community'
import BrandPulse from '@/components/sections/BrandPulse'
import NewsletterBar from '@/components/sections/NewsletterBar'

// The homepage is one day on the mountain, lived by scrolling: pre-dawn start on
// the summit, first light, the climb, the ridge at midday, pack check, stories on
// the way down, basecamp at night, and the last radio check before lights out.
// TrailSpine reads the data-trail-* wrappers below and keeps a small fixed HUD
// ticking time and altitude — the thread that makes eleven sections one journey.
// The light follows the clock: dawn dark → blue hour → bright paper at midday →
// warm afternoon paper → night ink. FeaturedGear and GearSpotlight were merged
// into TheClimb (each product now appears exactly once, at its altitude); their
// files remain in the repo, unplugged.
export default function Home() {
  return (
    <>
      <NavBar />
      <TrailSpine />
      <main>
        <SummitHero />
        <div data-trail-time="05:50" data-trail-alt="5,200M" data-trail-label="The brief">
          <TrustBand />
        </div>
        <div data-trail-time="06:10" data-trail-alt="4,980M" data-trail-label="First light">
          <SeasonKit />
        </div>
        <div data-trail-time="08:30" data-trail-alt="4,200M" data-trail-label="The climb">
          <TheClimb />
        </div>
        <div data-trail-time="11:00" data-trail-alt="4,500M" data-trail-label="The ridge">
          <CollectionsRow />
        </div>
        <div data-trail-time="13:00" data-trail-alt="4,100M" data-trail-label="Pack check">
          <ShopByCategory />
        </div>
        <div data-trail-time="16:30" data-trail-alt="3,400M" data-trail-label="The way down">
          <Community />
        </div>
        <div data-trail-time="19:30" data-trail-alt="2,900M" data-trail-label="Basecamp">
          <BrandPulse />
        </div>
        <div data-trail-time="21:00" data-trail-alt="2,900M" data-trail-label="Radio check">
          <NewsletterBar />
        </div>
      </main>
      <FooterSection />
    </>
  )
}
