import Image from 'next/image'
import Link from 'next/link'

// Source PNG (public/logo/mountain.png) is a 2000×2000 canvas where the actual
// mark occupies a ~1346×741 region — rendering it untrimmed at a fixed height
// would leave huge invisible padding and make the glyph look tiny next to the
// wordmark. public/logo/mountain-mark.png is a tight crop of that same mark
// (1425×820, regenerated with a small margin), used everywhere instead.
const MARK_ASPECT = 1425 / 820

export function Logo({
  href = '/',
  markHeight = 28,
  wordmarkClassName = 'font-display tracking-widest text-paper',
  tagline,
  taglineClassName = 'font-display italic text-sage',
  priority = false,
  className = '',
}: {
  href?: string | null
  markHeight?: number
  wordmarkClassName?: string
  tagline?: string
  taglineClassName?: string
  priority?: boolean
  className?: string
}) {
  const markWidth = Math.round(markHeight * MARK_ASPECT)

  const content = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* alt="" — decorative next to the adjacent DEWDROPZ text, which already
          carries the accessible name; avoids a double "Dewdropz, Dewdropz" read. */}
      <Image
        src="/logo/mountain-mark.png"
        alt=""
        width={markWidth}
        height={markHeight}
        priority={priority}
        className="flex-shrink-0 object-contain"
        style={{ height: markHeight, width: markWidth }}
      />
      <span className="flex flex-col leading-none">
        <span className={wordmarkClassName}>DEWDROPZ</span>
        {tagline && <span className={`mt-1 ${taglineClassName}`}>{tagline}</span>}
      </span>
    </span>
  )

  if (!href) return content

  return (
    <Link href={href} aria-label="DEWDROPZ — home" className="inline-flex">
      {content}
    </Link>
  )
}
