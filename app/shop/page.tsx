import type { Metadata } from 'next'
import { Suspense } from 'react'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import SectionHeader from '@/components/SectionHeader'
import ShopContent from '@/components/sections/ShopContent'
import ShopGridSkeleton from '@/components/shop/ShopGridSkeleton'
import { getProducts, getCollections } from '@/actions/products'
import { getCategories } from '@/actions/categories'

// Prices and stock are on this page; see the note in products/[slug].
export const revalidate = 60

// The catalogue was the only major commerce page on the site with no title of
// its own — /collections, /customize and every product page have one — so it
// inherited the root default and told Google it was the homepage.
export const metadata: Metadata = {
  title: 'Shop',
  description:
    'The full DEWDROPZ range — apparel, drinkware and trail kit, made to order in Dehradun. Cash on delivery across India.',
}

export default async function ShopPage() {
  const [products, collections, categories] = await Promise.all([
    getProducts(),
    getCollections(),
    // Every category, not just the top level. The filter rail needs the
    // children — T-Shirts, Hoodies, Sweatshirts — because those are what a
    // product is actually tagged with; the departments above them (Apparel,
    // Drinkware) hold no products of their own and only supply the headings.
    // Asking for `parentId: null` returned exactly the two departments, so the
    // rail found nothing stocked and rendered no filters at all.
    getCategories(),
  ])

  const rupees = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`
  const prices = products.map((p) => p.price)

  return (
    <>
      <NavBar />
      {/* `id="main"` is the target of the skip link that `app/layout.tsx`
          renders as the FIRST tab stop of every page. It was missing here, so
          on the shop the link took focus, slid down, and did nothing — with
          eleven nav stops between a keyboard shopper and the catalogue. */}
      <main id="main" className="min-h-screen bg-paper">
        {/* ── Masthead ─────────────────────────────────────────────────────
            THIS BLOCK IS SERVER-RENDERED ON PURPOSE, and it is why it lives in
            this file rather than in ShopContent.

            `ShopContent` is a client component that calls `useSearchParams()`.
            On a prerendered route that bails the nearest Suspense boundary to
            the client — so whatever is INSIDE the boundary is replaced in the
            built HTML by the fallback. The boundary used to wrap the whole
            page, and `.next/server/app/shop.html` was, in full:

              <template data-dgst="BAILOUT_TO_CLIENT_SIDE_RENDERING"></template>
              <main class="pt-32 pb-24 px-6 md:px-10 bg-paper min-h-screen"></main>

            No h1, no product, no price, no sentence of copy. Hard constraint 1
            — "copy lives in the server HTML" — failing at 100%, and invisible
            from the dev server, which renders dynamically. Only the build
            artefact showed it.

            The masthead reads nothing but `products`, which this server
            component already has. Above the boundary, it survives. The grid is
            still inside it; putting that in the HTML too means making the route
            dynamic, which costs the CDN-cached document and is the client's
            call. See design/15-shop.md. */}
        <div className="bg-paper pt-32">
          <div className="mx-auto max-w-measure-catalogue px-6 pb-12 md:px-10">
            <SectionHeader
              species="masthead"
              as="h1"
              eyebrow="Made to order · Printed in Dehradun"
              title="The DEWDROPZ Collection."
              lede="Apparel and everyday essentials inspired by mountains, trails and slow travel."
              figures={
                products.length > 0 && (
                  <>
                    <span>
                      {products.length} {products.length === 1 ? 'piece' : 'pieces'}
                    </span>
                    {/* An EN dash. A range takes an en dash; the em dash that
                        was here is a parenthetical mark. */}
                    <span>
                      {rupees(Math.min(...prices))} – {rupees(Math.max(...prices))}
                    </span>
                    {/* Set in the body face, deliberately, while the two spans
                        above stay mono. Law 03: mono carries a number, a time,
                        a count or a coordinate — never a sentence. This is a
                        delivery promise, and in mono it was borrowing the
                        credibility of the two real figures beside it. The words
                        are the client's to keep or cut (it is also, verbatim,
                        the footer of this same page); the typeface is ours. */}
                    <span className="font-body normal-case tracking-normal">
                      Fast dispatch across India
                    </span>
                  </>
                )
              }
            />
          </div>
          {/* A hairline of first light where the ground steps down to the
              catalogue. The same gesture, and the same reasoning, as
              components/ui/empty-state.tsx: this page had exactly one --dawn
              pixel on it, a 10px eyebrow three screens down, and none at all on
              the light half where the goods are. 1px, server-rendered, no
              motion — identical under a reduced-motion request. */}
          <span
            aria-hidden="true"
            className="block h-px bg-gradient-to-r from-transparent via-dawn/50 to-transparent"
          />
        </div>

        {/* useSearchParams requires a Suspense boundary for prerendering. The
            fallback is now the shape of the thing it is standing in for, at the
            real card dimensions, so nothing jumps when the grid arrives. */}
        <Suspense fallback={<ShopGridSkeleton />}>
          <ShopContent products={products} collections={collections} categories={categories} />
        </Suspense>
      </main>
      <FooterSection />
    </>
  )
}
