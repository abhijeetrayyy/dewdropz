import Image from 'next/image'
import { BLUR_DATA_URL, DAY_ARC } from '@/lib/constants'

// The header for the pages you meet before you are on the board — signed out,
// and setting up.
//
// Same photograph and same register as the board's own header, deliberately: a
// person arriving at Trek Buddy for the first time should not be shown the
// storefront's editorial band and then, one click later, a completely different
// product. Continuity is what makes three routes feel like one place.
//
// Narrower than the board header and with no controls in it, because these
// pages have exactly one thing to do and the eye should reach it.
export default function TrekGate({
  eyebrow,
  title,
  lede,
  image = DAY_ARC.firstLight,
}: {
  eyebrow: string
  title: React.ReactNode
  lede: string
  image?: string
}) {
  return (
    <header className="relative isolate overflow-hidden bg-ink">
      <Image
        src={image}
        alt=""
        fill
        priority
        sizes="100vw"
        placeholder="blur"
        blurDataURL={BLUR_DATA_URL}
        className="object-cover object-center opacity-80"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-ink/80 via-ink/30 to-ink/90" />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-ink/70 via-ink/25 to-transparent" />

      <div className="relative mx-auto max-w-3xl px-6 pb-12 pt-32 md:px-10 md:pt-36">
        <p className="trek-label font-mono text-sage">{eyebrow}</p>
        <h1 className="mt-4 max-w-xl font-display text-[clamp(30px,5vw,50px)] font-light leading-[0.98] text-paper">
          {title}
        </h1>
        <p className="mt-4 max-w-md font-body text-sm leading-relaxed text-paper/70">{lede}</p>
      </div>
    </header>
  )
}
