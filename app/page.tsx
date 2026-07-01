import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import HeroSection from '@/components/sections/HeroSection'
import BrandStatement from '@/components/sections/BrandStatement'
import MoodStrip from '@/components/sections/MoodStrip'
import CollectionScroll from '@/components/sections/CollectionScroll'
import FeaturedGear from '@/components/sections/FeaturedGear'
import BrandStory from '@/components/sections/BrandStory'
import NewsletterBar from '@/components/sections/NewsletterBar'

export default function Home() {
  return (
    <>
      <NavBar />
      <main>
        <HeroSection />
        <BrandStatement />
        <MoodStrip />
        <CollectionScroll />
        <FeaturedGear />
        <BrandStory />
        <NewsletterBar />
      </main>
      <FooterSection />
    </>
  )
}
