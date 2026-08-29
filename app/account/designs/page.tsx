import Image from 'next/image'
import Link from 'next/link'
import { Palette, Wand2 } from 'lucide-react'
import { requireAuth } from '@/actions/auth'
import { getUserDesigns } from '@/actions/designs'
import { Surface } from '@/components/ui/surface'
import EmptyState from '@/components/ui/empty-state'
import { BLUR_DATA_URL } from '@/lib/constants'

// The page holds the customer's own artwork and used to render it as a bordered
// box with the picture squashed into the top third and four lines of grey
// metadata under it. Artwork is the product here — it gets the frame, and the
// metadata gets out of its way until you point at it.

export default async function DesignsPage() {
  await requireAuth('/account/designs')
  const designs = await getUserDesigns()

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl text-text">Your designs</h2>
        <p className="mt-1 font-body text-sm text-mid">
          Everything you have saved, whether or not it made it into an order.
        </p>
      </div>

      {designs.length === 0 ? (
        <EmptyState
          icon={<Palette className="h-5 w-5" strokeWidth={1.5} />}
          title="Nothing designed yet."
          body="Put your own artwork — or just your own words — on a piece, and it gets saved here."
          action={{ label: 'Open the studio', href: '/customize' }}
          secondary={{ label: 'See what is customisable', href: '/shop' }}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3">
          {designs.map((design) => {
            const previews = [design.front_preview_url, design.back_preview_url].filter(Boolean) as string[]
            const href = design.product?.slug ? `/products/${design.product.slug}/customize` : null
            const saved = new Date(design.created_at).toLocaleDateString('en-IN', {
              year: 'numeric', month: 'short', day: 'numeric',
            })

            const card = (
              <Surface
                interactive={!!href}
                className="group flex h-full flex-col overflow-hidden p-0"
              >
                <div className={`grid bg-paper-deep/40 ${previews.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {previews.length > 0 ? (
                    previews.map((url, i) => (
                      <div key={i} className="relative aspect-[3/4]">
                        <Image
                          src={url}
                          alt=""
                          fill
                          sizes="(min-width:1024px) 240px, 45vw"
                          placeholder="blur"
                          blurDataURL={BLUR_DATA_URL}
                          className="object-cover transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-[1.03]"
                        />
                      </div>
                    ))
                  ) : (
                    <div className="flex aspect-[3/4] items-center justify-center">
                      <Palette className="h-6 w-6 text-light" strokeWidth={1.5} aria-hidden="true" />
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <div className="font-body text-sm font-medium leading-snug text-text">
                    {design.product?.name ?? 'Product removed'}
                  </div>
                  <div className="mt-1 font-body text-xs text-mid">
                    {design.variant?.name && (
                      <>
                        {design.variant.name}
                        <span className="mx-1.5 text-rule-warm">·</span>
                      </>
                    )}
                    {saved}
                  </div>

                  {href && (
                    <span className="mt-3 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-forest">
                      <Wand2 className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                      Open in the studio
                    </span>
                  )}
                </div>
              </Surface>
            )

            // A design whose blank has since been withdrawn still shows — it is
            // the customer's work — but it cannot pretend to be re-openable.
            return href ? (
              <Link key={design.id} href={href} className="block">
                {card}
              </Link>
            ) : (
              <div key={design.id}>{card}</div>
            )
          })}
        </div>
      )}
    </div>
  )
}
