import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import TrailSpine from '@/components/TrailSpine'
// DawnHero / FirstLight: unplugged per request — parked, not deleted. Both
// still typecheck and lint clean; re-add the two <div data-trail-*> blocks
// below (and drop SummitHero's h1 back to the h2 descent copy) to bring them
// back.
import SummitHero from '@/components/sections/SummitHero'
import TrustBand from '@/components/sections/TrustBand'
import SeasonKit from '@/components/sections/SeasonKit'
import TheClimb from '@/components/sections/TheClimb'
import CollectionsRow from '@/components/sections/CollectionsRow'
import ShopByCategory from '@/components/sections/ShopByCategory'
import ShowcaseRails from '@/components/sections/ShowcaseRails'
import DesignYourOwn from '@/components/sections/DesignYourOwn'
import Community from '@/components/sections/Community'
import BrandPulse from '@/components/sections/BrandPulse'
import NewsletterBar from '@/components/sections/NewsletterBar'
import { getProducts, getCollections } from '@/actions/products'
import { getCategories } from '@/actions/categories'
import { getStoreSettings } from '@/actions/settings'
import { getFeaturedReviews } from '@/actions/reviews'
import { getShowcaseRails } from '@/actions/showcase'

// The homepage is one day on the mountain, lived by scrolling: pre-dawn start on
// the summit, first light, the climb, the ridge at midday, pack check, stories on
// the way down, basecamp at night, and the last radio check before lights out.
// TrailSpine reads the data-trail-* wrappers below and keeps a small fixed HUD
// ticking time and altitude — the thread that makes eleven sections one journey.
// The light follows the clock: dawn dark → blue hour → bright paper at midday →
// warm afternoon paper → night ink.
export default async function Home() {
  const [products, collections, categories, settings, reviews, rails] = await Promise.all([
    getProducts(),
    getCollections(),
    getCategories({ parentId: null }),
    getStoreSettings(),
    getFeaturedReviews(),
    getShowcaseRails(),
  ])
  const { season_kit, climb, featured_collection_slugs, featured_category_slugs, stats } = settings.home_config

  return (
    <>
      <NavBar />
      <TrailSpine />
      <main>
        <SummitHero collections={collections} />
        <div data-trail-time="05:50" data-trail-alt="5,200M" data-trail-label="The brief">
          <TrustBand />
        </div>
        <div data-trail-time="06:10" data-trail-alt="4,980M" data-trail-label="First light">
          <SeasonKit config={season_kit} allProducts={products} collections={collections} />
        </div>
        <div data-trail-time="08:30" data-trail-alt="4,200M" data-trail-label="The climb">
          <TheClimb config={climb} products={products} />
        </div>
        <div data-trail-time="11:00" data-trail-alt="4,500M" data-trail-label="The ridge">
          <CollectionsRow collections={collections} featuredSlugs={featured_collection_slugs} />
        </div>
        <div data-trail-time="13:00" data-trail-alt="4,100M" data-trail-label="Pack check">
          <ShopByCategory categories={categories} products={products} featuredSlugs={featured_category_slugs} />
        </div>
        <ShowcaseRails rails={rails} />
        <div data-trail-time="14:30" data-trail-alt="3,800M" data-trail-label="The workbench">
          <DesignYourOwn products={products} />
        </div>
        <div data-trail-time="16:30" data-trail-alt="3,400M" data-trail-label="The way down">
          <Community reviews={reviews} />
        </div>
        <div data-trail-time="19:30" data-trail-alt="2,900M" data-trail-label="Basecamp">
          <BrandPulse stats={stats} />
        </div>
        <div data-trail-time="21:00" data-trail-alt="2,900M" data-trail-label="Radio check">
          <NewsletterBar />
        </div>
      </main>
      <FooterSection />
    </>
  )
}
