import Image from 'next/image'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'
import { BLUR_DATA_URL } from '@/lib/constants'
import type { ProductWithCollection } from '@/types/database'

// One customizable blank, as shown on the homepage showcase and the
// /customize index. Shared so the two entry points can't drift apart.
export default function BlankCard({ product }: { product: ProductWithCollection }) {
  const colors = product.customization_config?.colors ?? []
  const availableCount = colors.filter((c) => c.available).length

  return (
    <Link
      href={`/products/${product.slug}/customize`}
      data-cursor="view"
      data-cursor-text="Design"
      className="group bg-paper rounded-sm overflow-hidden border border-rule hover:border-forest/40 transition-colors duration-300"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-rule/30">
        {product.images?.[0] && (
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            className="object-cover transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-105"
          />
        )}
        <span className="absolute left-3 top-3 rounded-sm bg-ink/70 px-2.5 py-1 font-body text-[9px] tracking-[0.15em] uppercase text-paper">
          Front &amp; back
        </span>
      </div>

      <div className="p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-lg text-text">{product.name}</h3>
          <span className="font-body text-sm text-forest flex-shrink-0">{formatPrice(product.price)}</span>
        </div>
        {product.short_description && (
          <p className="font-body text-xs text-mid mt-1.5 leading-relaxed">{product.short_description}</p>
        )}

        {colors.length > 0 && (
          <div className="mt-4 flex items-center gap-1.5">
            {colors.map((c) => (
              <span
                key={c.name}
                title={c.available ? c.name : `${c.name} — coming soon`}
                className={`h-3.5 w-3.5 rounded-full border ${c.available ? 'border-rule' : 'border-rule opacity-40'}`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
            <span className="font-body text-[10px] text-light ml-1">
              {availableCount} available
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}
