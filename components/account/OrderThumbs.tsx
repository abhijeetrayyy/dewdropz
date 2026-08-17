import Image from 'next/image'
import { BLUR_DATA_URL } from '@/lib/constants'

type Line = {
  id: string
  product_name: string
  quantity: number
  product?: { images?: unknown } | null
  design?: { front_preview_url?: string | null } | null
}

/** The customer's own artwork if there is any, otherwise the catalogue photo. */
function thumbFor(line: Line): string | null {
  if (line.design?.front_preview_url) return line.design.front_preview_url
  const images = line.product?.images
  if (Array.isArray(images) && images.length) {
    const first = images[0]
    if (typeof first === 'string') return first
    if (first && typeof first === 'object' && 'url' in first) return String((first as { url: unknown }).url)
  }
  return null
}

// A row of thumbnails for an order, so the list is scannable by sight.
//
// Overlapped rather than laid out in a line: an order of four pieces should
// still read as one order at a glance, and a row of separate squares starts
// competing with the order number for attention. Caps at three plus a count —
// past that it is decoration.
export default function OrderThumbs({ items, size = 44 }: { items: Line[]; size?: number }) {
  if (!items?.length) return null
  const shown = items.slice(0, 3)
  const more = items.length - shown.length

  return (
    <div className="flex items-center">
      {shown.map((line, i) => {
        const src = thumbFor(line)
        return (
          <div
            key={line.id}
            style={{ width: size, height: size, marginLeft: i === 0 ? 0 : -size * 0.28, zIndex: shown.length - i }}
            className="relative shrink-0 overflow-hidden rounded-sm border border-rule bg-paper-warm"
          >
            {src ? (
              <Image
                src={src}
                alt={line.product_name}
                fill
                sizes={`${size}px`}
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                className="object-cover"
              />
            ) : (
              // No artwork and no catalogue photo — an initial beats a broken
              // frame, and it still gives the row something to anchor on.
              <span className="flex h-full w-full items-center justify-center font-display text-sm text-mid">
                {line.product_name.charAt(0)}
              </span>
            )}
          </div>
        )
      })}
      {more > 0 && (
        <span
          style={{ width: size, height: size, marginLeft: -size * 0.28 }}
          className="relative flex shrink-0 items-center justify-center rounded-sm border border-rule bg-paper font-mono text-[11px] text-mid"
        >
          +{more}
        </span>
      )}
    </div>
  )
}
