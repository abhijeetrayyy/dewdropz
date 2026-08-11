import Image from 'next/image'
import Link from 'next/link'
import { requireAuth } from '@/actions/auth'
import { getUserDesigns } from '@/actions/designs'

export default async function DesignsPage() {
  await requireAuth()
  const designs = await getUserDesigns()

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl text-text">My Designs</h2>
        <p className="font-body text-sm text-mid mt-1">Every design you&apos;ve saved, whether or not it made it into an order.</p>
      </div>

      {designs.length === 0 ? (
        <div className="p-8 border border-dashed border-rule rounded-sm text-center">
          <p className="font-body text-sm text-mid">You haven&apos;t designed anything yet.</p>
          <Link href="/shop" className="mt-4 inline-block font-body text-xs tracking-widest uppercase text-forest hover:underline">
            Find Something to Customize
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
          {designs.map((design) => {
            const previews = [design.front_preview_url, design.back_preview_url].filter(Boolean) as string[]
            return (
              <div key={design.id} className="border border-rule rounded-sm overflow-hidden bg-paper">
                <div className={`grid ${previews.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {previews.length > 0 ? (
                    previews.map((url, i) => (
                      <div key={i} className="relative aspect-[3/4] bg-rule/40">
                        <Image src={url} alt="" fill sizes="200px" className="object-cover" />
                      </div>
                    ))
                  ) : (
                    <div className="aspect-[3/4] bg-rule/40 flex items-center justify-center">
                      <span className="font-body text-xs text-mid">No preview</span>
                    </div>
                  )}
                </div>
                <div className="p-4 space-y-1">
                  <div className="font-body text-sm font-medium text-text">{design.product?.name ?? 'Product removed'}</div>
                  {design.variant?.name && (
                    <div className="font-body text-xs text-mid">Size: {design.variant.name}</div>
                  )}
                  <div className="font-body text-xs text-mid">
                    {new Date(design.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </div>
                  {design.product?.slug && (
                    <Link
                      href={`/products/${design.product.slug}/customize`}
                      className="inline-block mt-2 font-body text-xs text-forest hover:underline"
                    >
                      Customize Again →
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
