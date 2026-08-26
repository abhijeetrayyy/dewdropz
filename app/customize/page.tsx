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
export default async function CustomizeIndexPage({
  searchParams,
}: {
  // Which door the visitor came through, carried from the homepage's Custom
  // Studio section. It is passed on to each blank's link so the choice
  // survives the one step between here and the studio itself — see
  // app/products/[slug]/customize/page.tsx.
  searchParams: Promise<{ start?: string }>
}) {
  const { start } = await searchParams
  const fromLibrary = start === 'library'
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
              {/* "CUSTOM STUDIO (Make the Font a bit bigger)" — 10px → 13px,
                  the same +30% given to the homepage section's eyebrow and to
                  the hero's THE STUDIO, so all three studio doors are set at
                  one size. */}
              <div className="font-mono text-[13px] uppercase tracking-[0.2em] text-forest">Custom Studio</div>
              <h1 className="mt-3 font-display text-[clamp(36px,5.5vw,58px)] leading-[1.03] text-text">
                Go on — make it yours
              </h1>
              <p className="mt-5 max-w-xl font-body text-sm leading-relaxed text-mid md:text-base">
                Build every detail before it goes to print.
              </p>

              {/* THE TWO WAYS IN, said out loud.
                  This page has only ever offered one — "start with a blank
                  canvas, upload your artwork" — which quietly tells everybody
                  who does not already have a design that the studio is not for
                  them. The brief asks for both doors, and the library is the
                  one that was missing. */}
              <dl className="mt-8 grid gap-6 sm:grid-cols-2">
                <div>
                  <dt className="font-body text-[11px] uppercase tracking-[0.14em] text-forest">
                    Browse the library
                  </dt>
                  <dd className="mt-2 font-body text-[13px] leading-relaxed text-mid">
                    Choose from our DEWDROPZ design collections.{' '}
                    {fromLibrary
                      ? 'Pick a blank below and the library opens with it.'
                      : 'Pick a blank below, then open the library from the studio.'}
                  </dd>
                </div>
                <div>
                  <dt className="font-body text-[11px] uppercase tracking-[0.14em] text-forest">
                    Create your own
                  </dt>
                  <dd className="mt-2 font-body text-[13px] leading-relaxed text-mid">
                    Start with a blank canvas or upload your own artwork.
                  </dd>
                </div>
              </dl>
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
                <BlankCard key={p.id} product={p} start={fromLibrary ? 'library' : undefined} />
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
