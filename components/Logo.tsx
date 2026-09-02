import Image from 'next/image'
import Link from 'next/link'

// The master is a 2000×2000 canvas where the actual mark occupies a ~1346×741
// region — rendering it untrimmed at a fixed height would leave huge invisible
// padding and make the glyph look tiny next to the wordmark. So this is a tight
// crop of that mark with a small margin, at 712×410: over 4x the largest place
// it is ever drawn (168px wide, in the preloader), which covers 3x-DPR screens.
// The master itself is no longer in the repo — it is private, in the
// `brand-masters` bucket at logo/mountain-master-2000x2000.png; re-crop from
// there via scripts/archive-brand-masters.mjs if this ever needs regenerating.
// MARK_ASPECT stays the original 1425/820, which the 712×410 crop preserves.
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
        src="/logo/mountain-mark.webp"
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
    <Link href={href} prefetch={false} aria-label="DEWDROPZ — home" className="inline-flex">
      {content}
    </Link>
  )
}
