import type { Metadata } from 'next'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import BlankCard from '@/components/customize/BlankCard'
import { getProducts } from '@/actions/products'

export const metadata: Metadata = {
  title: 'Design Your Own — DEWDROPZ',
  description:
    'Print your own artwork on heavyweight DEWDROPZ blanks — tee, sweatshirt and hoodie in an oversized unisex fit. Design front and back in the studio.',
}

// Landing page for the customization studio: the destination for the "Customize"
// nav link and the homepage showcase CTA. Lists every blank actually flagged
// customizable, so it stays in step with the catalogue.
export default async function CustomizeIndexPage() {
  const products = await getProducts()
  const blanks = products.filter((p) => p.is_customizable && (p.customization_config?.colors?.length ?? 0) > 0)

  return (
    <>
      <NavBar />
      <main className="bg-paper min-h-screen pt-28 md:pt-32 pb-24">
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <div className="max-w-2xl">
            <div className="font-mono text-[10px] tracking-[0.2em] text-forest uppercase">The Workbench</div>
            <h1 className="font-display text-[clamp(34px,5vw,54px)] text-text mt-3 leading-[1.05]">
              Design your own.
            </h1>
            <p className="font-body text-sm md:text-base text-mid mt-5 leading-relaxed">
              Pick a blank, choose a colour and size, then add your artwork or type in the studio. You get a live preview
              on the garment — front and back — before anything goes to print.
            </p>
          </div>

          {blanks.length === 0 ? (
            <p className="font-body text-sm text-mid mt-14">
              Nothing is set up for customization right now. Check back shortly.
            </p>
          ) : (
            <div className="mt-12 md:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {blanks.map((p) => (
                <BlankCard key={p.id} product={p} />
              ))}
            </div>
          )}

          <div className="mt-16 border-t border-rule pt-10 grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div>
              <div className="font-body text-[10px] tracking-[0.18em] text-forest uppercase">01 · Pick your blank</div>
              <p className="font-body text-sm text-mid mt-2.5 leading-relaxed">
                Tee, sweatshirt or hoodie. All oversized unisex fits, sizes S to XL.
              </p>
            </div>
            <div>
              <div className="font-body text-[10px] tracking-[0.18em] text-forest uppercase">02 · Make the design</div>
              <p className="font-body text-sm text-mid mt-2.5 leading-relaxed">
                Upload an image or set type. Position it inside the print area on the front, the back, or both.
              </p>
            </div>
            <div>
              <div className="font-body text-[10px] tracking-[0.18em] text-forest uppercase">03 · Order it</div>
              <p className="font-body text-sm text-mid mt-2.5 leading-relaxed">
                Your preview goes into the cart exactly as it&apos;ll be printed. COD available across India.
              </p>
            </div>
          </div>
        </div>
      </main>
      <FooterSection />
    </>
  )
}
