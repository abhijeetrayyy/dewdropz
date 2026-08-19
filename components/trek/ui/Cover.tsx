import Image from 'next/image'
import { BLUR_DATA_URL } from '@/lib/constants'
import { coverlessField, scrimForHour, type HourLight } from '@/lib/trek'
import RouteSketch from './RouteSketch'

// A photograph is never raw.
//
// Every image on the board sits under a gradient, and the gradient carries the
// walk's hour — so the foot of a 05:10 card is warm and the foot of a 22:00 one
// is cold, before a single word has been read. That is the difference between
// a picture with a caption on it and a card that knows what it is.
//
// AND WHEN THERE IS NO PHOTOGRAPH — which, on a board this young, is most of
// them — the fallback is not a grey box. It is a dark field carrying a trace of
// the hour's colour, with a contour drawn from the walk's real distance and
// climb. A board of coverless walks should look composed, so a host is tempted
// into adding a picture rather than shamed into it.

export default function Cover({
  src,
  light,
  distanceKm,
  gainM,
  sizes,
  priority = false,
  scrimFrom = 40,
  className = '',
  children,
}: {
  src?: string | null
  light: HourLight
  /**
   * Accepted so the fifteen call sites that pass it keep compiling, and
   * deliberately not rendered: the fallback field used to print the place name
   * across it at 15% white, which became a duplicate the moment the title moved
   * into the card body — a ghost word sitting under the countdown chip.
   */
  place?: string
  distanceKm?: number | null
  gainM?: number | null
  sizes?: string
  priority?: boolean
  /** Where the scrim starts. Lower for tall frames, higher for shallow ones. */
  scrimFrom?: number
  className?: string
  /** Pills, stamps and type laid over the frame. */
  children?: React.ReactNode
}) {
  return (
    <div className={`relative overflow-hidden bg-ink ${className}`}>
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          priority={priority}
          sizes={sizes ?? '(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw'}
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          className="object-cover opacity-90 transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: coverlessField(light) }}
        >
          {/* Just the profile of the day. The first pass also set the place
              name across the field at 15% white, which was a nice idea until
              the title moved into the card body — at which point the card was
              printing the same word twice, once as a ghost sitting under the
              countdown chip. */}
          <RouteSketch
            distanceKm={distanceKm}
            gainM={gainM}
            light={light}
            className="absolute inset-x-0 bottom-0 h-2/3 w-full"
          />
        </div>
      )}

      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: scrimForHour(light, scrimFrom) }}
      />

      {children}
    </div>
  )
}
