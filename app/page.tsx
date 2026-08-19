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
import HomeTrails from '@/components/sections/HomeTrails'
import TrekBuddyBand from '@/components/sections/TrekBuddyBand'
import Community from '@/components/sections/Community'
import BrandPulse from '@/components/sections/BrandPulse'
import NewsletterBar from '@/components/sections/NewsletterBar'
import { getProducts, getCollections } from '@/actions/products'
import { getCategories } from '@/actions/categories'
import { getStoreSettings } from '@/actions/settings'
import { getFeaturedReviews } from '@/actions/reviews'
import { getShowcaseRails } from '@/actions/showcase'
// The day arc, declared once. Sections receive their stop instead of printing
// their own — four of them used to contradict the wrapper directly above them.
import { TRAIL_STOPS } from '@/lib/trail'

// The homepage sells from the same catalogue, so it takes the same window.
export const revalidate = 60

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
    // NOT { parentId: null }. That returns only the two departments, Apparel
    // and Drinkware, and products are linked to the leaves — T-Shirts, Hoodies,
    // Sweatshirts. So every tile had zero products, `hasStockedCategory` was
    // always false, and Shop by Category has been silently absent from the
    // homepage: the section the client document places second, under the hero.
    // Same mistake the shop's own filter rail had.
    getCategories(),
    getStoreSettings(),
    getFeaturedReviews(),
    getShowcaseRails(),
  ])
  const { season_kit, climb, featured_collection_slugs, featured_category_slugs, stats } = settings.home_config

  // Whether the pack-check section has anything real to send people to. A tile
  // that lands on an empty shop is worse than no tile.
  const stockedCategories = categories.filter((c) =>
    products.some((p) => p.categories?.some((pc) => pc.category_id === c.id))
  )
  const hasStockedCategory = stockedCategories.length > 0

  return (
    <>
      <NavBar />
      <TrailSpine />
      <main id="main">
        <SummitHero products={products} collections={collections} />

        {/* ORDER PER THE CLIENT DOCUMENT, "Homepage Structure":
              Hero → Shop by Collection → Shop by Category
            Both of those sat fifth and sixth, behind the trust strip, the
            season kit and the climb — so the two things the brief puts
            immediately under the hero were roughly two thousand pixels down.
            The trail HUD reads its chapters from these data-trail-* wrappers
            in DOM order, so the hours were re-cut to keep ascending down the
            page rather than jumping back to dawn halfway. */}
        <div data-trail-time={TRAIL_STOPS.collections.time} data-trail-alt={TRAIL_STOPS.collections.alt} data-trail-label={TRAIL_STOPS.collections.label}>
          <CollectionsRow collections={collections} featuredSlugs={featured_collection_slugs} stop={TRAIL_STOPS.collections} />
        </div>
        {/* ShopByCategory suppresses itself when no category has stock, and a
            section that stands down has to take its trail chapter with it or
            the HUD announces a stop that is not there. */}
        {hasStockedCategory && (
          <div data-trail-time={TRAIL_STOPS.categories.time} data-trail-alt={TRAIL_STOPS.categories.alt} data-trail-label={TRAIL_STOPS.categories.label}>
            <ShopByCategory categories={categories} products={products} featuredSlugs={featured_category_slugs} stop={TRAIL_STOPS.categories} />
          </div>
        )}
        <div data-trail-time={TRAIL_STOPS.trust.time} data-trail-alt={TRAIL_STOPS.trust.alt} data-trail-label={TRAIL_STOPS.trust.label}>
          <TrustBand />
        </div>
        <div data-trail-time={TRAIL_STOPS.kit.time} data-trail-alt={TRAIL_STOPS.kit.alt} data-trail-label={TRAIL_STOPS.kit.label}>
          <SeasonKit config={season_kit} allProducts={products} collections={collections} />
        </div>
        <div data-trail-time={TRAIL_STOPS.climb.time} data-trail-alt={TRAIL_STOPS.climb.alt} data-trail-label={TRAIL_STOPS.climb.label}>
          <TheClimb config={climb} products={products} stop={TRAIL_STOPS.climb} />
        </div>
        {/* ShowcaseRails is unplugged from the homepage, not deleted — the
            component and its admin config stay. With three products in the
            catalogue its "Just added" rail listed the same three garments that
            SeasonKit and TheClimb had already shown, a third time, for another
            720px of scroll. It earns its place back when there is a catalogue
            big enough for "just added" to mean something. */}
        {false && <ShowcaseRails rails={rails} />}
        <div data-trail-time={TRAIL_STOPS.workbench.time} data-trail-alt={TRAIL_STOPS.workbench.alt} data-trail-label={TRAIL_STOPS.workbench.label}>
          <DesignYourOwn products={products} stop={TRAIL_STOPS.workbench} />
        </div>
        <div data-trail-time={TRAIL_STOPS.trails.time} data-trail-alt={TRAIL_STOPS.trails.alt} data-trail-label={TRAIL_STOPS.trails.label}>
          <HomeTrails stop={TRAIL_STOPS.trails} />
        </div>
        {/* Trek Buddy had no place on the homepage at all — only the hero's
            third act, which a visitor sees for a few hundred pixels of scroll
            and cannot read properly. Placed at last light because that is when
            you work out who you are going with tomorrow. */}
        <div data-trail-time={TRAIL_STOPS.trekBuddy.time} data-trail-alt={TRAIL_STOPS.trekBuddy.alt} data-trail-label={TRAIL_STOPS.trekBuddy.label}>
          <TrekBuddyBand />
        </div>
        {/* Community renders null until real approved reviews exist. The trail
            wrapper has to disappear with it — TrailSpine builds its chapter HUD
            from these data-trail-* attributes, so leaving it in advertised a
            "The way down" stop on the journey that had nothing behind it. */}
        {reviews.length > 0 && (
          <div data-trail-time={TRAIL_STOPS.community.time} data-trail-alt={TRAIL_STOPS.community.alt} data-trail-label={TRAIL_STOPS.community.label}>
            <Community reviews={reviews} stop={TRAIL_STOPS.community} />
          </div>
        )}
        <div data-trail-time={TRAIL_STOPS.basecamp.time} data-trail-alt={TRAIL_STOPS.basecamp.alt} data-trail-label={TRAIL_STOPS.basecamp.label}>
          <BrandPulse stats={stats} stop={TRAIL_STOPS.basecamp} />
        </div>
        <div data-trail-time={TRAIL_STOPS.dispatch.time} data-trail-alt={TRAIL_STOPS.dispatch.alt} data-trail-label={TRAIL_STOPS.dispatch.label}>
          <NewsletterBar stop={TRAIL_STOPS.dispatch} />
        </div>
      </main>
      <FooterSection />
    </>
  )
}
