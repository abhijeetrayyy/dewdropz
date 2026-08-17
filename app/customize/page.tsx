import type { Metadata } from 'next'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import BlankCard from '@/components/customize/BlankCard'
import { ContourLines } from '@/components/ui/ContourLines'
import { getProducts } from '@/actions/products'

export const metadata: Metadata = {
  title: 'Design Your Own — DEWDROPZ',
  description:
    'Print your own artwork on heavyweight DEWDROPZ blanks — tee, sweatshirt and hoodie in an oversized unisex fit. Design front and back in the studio.',
}

const STEPS = [
  ['01', 'Pick your blank', 'Tee, sweatshirt or hoodie. All oversized unisex fits, sizes S to XL.'],
  ['02', 'Make the design', 'Upload an image or set type. Position it on the front, the back, or both.'],
  ['03', 'It goes to print', 'Your preview goes into the cart exactly as it’ll be printed.'],
] as const

// Landing page for the customization studio: the destination for the
// "Customize" nav link and the homepage showcase CTA. Lists every blank
// actually flagged customizable, so it stays in step with the catalogue.
export default async function CustomizeIndexPage() {
  const products = await getProducts()
  const blanks = products.filter((p) => p.is_customizable && (p.customization_config?.colors?.length ?? 0) > 0)

  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-[linear-gradient(170deg,#F6F0E2_0%,#F2E8D2_45%,#EFE2C6_100%)]">
        {/* Same warm-daylight-plus-contours surface the homepage teaser uses —
            this page is the other door into the same room, not a different one. */}
        <div className="relative overflow-hidden px-6 pb-16 pt-28 md:px-10 md:pb-20 md:pt-36">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-1/4 top-0 h-[70%] w-[70%] rounded-full bg-[radial-gradient(circle,rgba(215,169,106,0.20)_0%,transparent_70%)]"
          />
          <ContourLines className="opacity-[0.13]" />

          <div className="relative mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-forest">Custom Studio</div>
              <h1 className="mt-3 font-display text-[clamp(36px,5.5vw,58px)] leading-[1.03] text-text">
                Go on — make it yours
              </h1>
              <p className="mt-5 max-w-xl font-body text-sm leading-relaxed text-mid md:text-base">
                Start with a blank canvas. Upload your artwork, choose your colour and size, and{' '}
                <span className="text-text">preview it before it goes to print.</span>
              </p>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-6 pb-24 md:px-10">
          {blanks.length === 0 ? (
            <p className="mt-4 font-body text-sm text-mid">
              Nothing is set up for customization right now. Check back shortly.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-3">
              {blanks.map((p) => (
                <BlankCard key={p.id} product={p} />
              ))}
            </div>
          )}

          <div className="mt-16 grid grid-cols-1 gap-8 border-t border-forest/15 pt-10 sm:grid-cols-3">
            {STEPS.map(([n, title, body]) => (
              <div key={n}>
                <div className="font-body text-[11px] uppercase tracking-[0.16em] text-forest">
                  <span className="text-clay">{n}</span> — {title}
                </div>
                <p className="mt-2 font-body text-[13px] leading-relaxed text-mid">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
      <FooterSection />
    </>
  )
}
