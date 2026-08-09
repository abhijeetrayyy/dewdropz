import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import TrailSpine from '@/components/TrailSpine'
import DawnHero from '@/components/sections/DawnHero'
import FirstLight from '@/components/sections/FirstLight'
import SummitHero from '@/components/sections/SummitHero'
import TrustBand from '@/components/sections/TrustBand'
import SeasonKit from '@/components/sections/SeasonKit'
import TheClimb from '@/components/sections/TheClimb'
import CollectionsRow from '@/components/sections/CollectionsRow'
import ShopByCategory from '@/components/sections/ShopByCategory'
import DesignYourOwn from '@/components/sections/DesignYourOwn'
import Community from '@/components/sections/Community'
import BrandPulse from '@/components/sections/BrandPulse'
import NewsletterBar from '@/components/sections/NewsletterBar'
import { getProducts, getCollections } from '@/actions/products'
import { getCategories } from '@/actions/categories'

// The homepage is one day on the mountain, lived by scrolling: pre-dawn start on
// the summit, first light, the climb, the ridge at midday, pack check, stories on
// the way down, basecamp at night, and the last radio check before lights out.
// TrailSpine reads the data-trail-* wrappers below and keeps a small fixed HUD
// ticking time and altitude — the thread that makes eleven sections one journey.
// The light follows the clock: dawn dark → blue hour → bright paper at midday →
// warm afternoon paper → night ink. FeaturedGear and GearSpotlight were merged
// into TheClimb (each product now appears exactly once, at its altitude); their
// files remain in the repo, unplugged.
export default async function Home() {
  const [products, collections, categories] = await Promise.all([
    getProducts(),
    getCollections(),
    getCategories({ parentId: null }),
  ])

  return (
    <>
      <NavBar />
      <TrailSpine />
      <main>
        {/* 04:40 — one photograph, two people, the moment before a walk. */}
        <DawnHero />
        {/* 05:55 — the pivot. Everything above this is night; everything below
            it is day. The page used to go dark → dark → dark → dark → paper,
            four screen-heights of it, before any light arrived. */}
        <div data-trail-time="05:55" data-trail-alt="4,200M" data-trail-label="First light">
          <FirstLight />
        </div>
        <div data-trail-time="06:20" data-trail-alt="4,980M" data-trail-label="The brief">
          <TrustBand />
        </div>
        <div data-trail-time="07:10" data-trail-alt="4,600M" data-trail-label="Season window">
          <SeasonKit allProducts={products} collections={collections} />
        </div>
        {/* The 3D range lives here now, not at the front door. Scroll actually
            drives the camera through the terrain in this section, which is the
            only place the descent has ever looked like anything — at progress 0
            the range sits beyond the fog plane and renders as a flat rectangle. */}
        <div data-trail-time="08:30" data-trail-alt="4,200M" data-trail-label="The descent">
          <SummitHero />
        </div>
        <div data-trail-time="09:40" data-trail-alt="4,000M" data-trail-label="The climb">
          <TheClimb products={products} />
        </div>
        <div data-trail-time="11:00" data-trail-alt="4,500M" data-trail-label="The ridge">
          <CollectionsRow collections={collections} />
        </div>
        <div data-trail-time="13:00" data-trail-alt="4,100M" data-trail-label="Pack check">
          <ShopByCategory categories={categories} products={products} />
        </div>
        <div data-trail-time="14:30" data-trail-alt="3,800M" data-trail-label="The workbench">
          <DesignYourOwn products={products} />
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
