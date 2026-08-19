import { dotColor, type HourLight } from '@/lib/trek'

// Capacity, drawn as seats.
//
// The old board rendered `going_count/capacity` as the literal string "3/8" in
// 10px grey mono, in three places. That is a fraction, and a fraction is a
// thing you have to do arithmetic on before you know whether to hurry. Eight
// segments with three filled is a thing you know at a glance — and it is also
// literally true, because these ARE seats: a walk has a fixed number of places
// and each one is either taken or it is not.
//
// Never a percentage bar. A percentage bar says "62% full", which is a
// statistic about the walk; the segments say "five places left", which is an
// instruction about what to do next.
//
// THE FILL IS FOREST, NOT THE HOUR. It was the hour, on the reasoning that
// everything on a card should carry it — and the result was that a dawn walk's
// meter was eight amber blocks, comfortably the loudest object on the card, and
// on a board of eight cards the meters read as the subject. They are not the
// subject. A filled seat means a person is confirmed on this walk, which is the
// same thing sage and forest mean everywhere else on the product, and the hour
// is already carried twice on the card — by the dot in the hour chip and by the
// kicker. Colour has one job per meaning here, and this meaning is not "when".
//
// The caption counts THE SAME denominator as the segments, which the old
// PlanRail did not: it drew `min_party` bars under a caption reading
// `capacity`, so the picture and the words disagreed.

export default function SeatMeter({
  taken,
  capacity,
  ground = 'light',
  showCaption = true,
  captionClassName = '',
  className = '',
}: {
  taken: number
  capacity: number
  /**
   * Accepted and deliberately unused. Every call site already computes the
   * walk's hour and passed it here when the fill was hour-coloured; keeping the
   * prop means the fill could go back to being hour-aware without touching
   * fifteen callers, and removing it would be churn for nothing.
   */
  light?: HourLight
  ground?: 'light' | 'dark'
  showCaption?: boolean
  captionClassName?: string
  className?: string
}) {
  // Above about sixteen the segments stop being countable and start being a
  // texture, at which point a bar is the honest drawing.
  const segments = Math.min(Math.max(capacity, 1), 16)
  const filled = Math.round((Math.min(taken, capacity) / Math.max(capacity, 1)) * segments)
  const fill = ground === 'dark' ? 'var(--sage)' : 'var(--forest)'
  const empty = ground === 'dark' ? 'rgba(250,250,248,0.16)' : 'var(--rule)'
  const left = Math.max(capacity - taken, 0)

  return (
    <div className={className}>
      <div
        className="flex gap-[3px]"
        role="img"
        aria-label={`${taken} of ${capacity} places taken`}
      >
        {Array.from({ length: segments }).map((_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="h-[5px] flex-1 rounded-full"
            style={{ background: i < filled ? fill : empty }}
          />
        ))}
      </div>

      {showCaption && (
        <p
          className={`trek-label-xs mt-2 tabular-nums ${
            captionClassName || (ground === 'dark' ? 'text-paper/55' : 'text-mid')
          }`}
        >
          {left === 0
            ? `Full · ${capacity} going`
            : `${taken} of ${capacity} · ${left} place${left === 1 ? '' : 's'} left`}
        </p>
      )}
    </div>
  )
}

// Quorum is a different question with a different answer, so it gets a
// different meter.
//
// Seats ask "can I still come?". Quorum asks "when does the address arrive?" —
// the meeting point is withheld until `min_party` people are going, and that is
// the single best mechanic in the product. It was a sentence.
export function QuorumMeter({
  going,
  minParty,
  light,
  ground = 'light',
  className = '',
}: {
  going: number
  minParty: number
  light: HourLight
  ground?: 'light' | 'dark'
  className?: string
}) {
  const fill = dotColor(light, ground)
  const short = Math.max(minParty - going, 0)

  return (
    <div className={className}>
      <div
        className="flex items-center gap-1.5"
        role="img"
        aria-label={`${going} of ${minParty} needed`}
      >
        {Array.from({ length: minParty }).map((_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="grid h-2.5 w-2.5 place-items-center rounded-full"
            style={{
              background: i < going ? fill : 'transparent',
              boxShadow: `0 0 0 1px ${
                i < going
                  ? fill
                  : ground === 'dark'
                    ? 'rgba(248,245,237,0.3)'
                    : 'var(--rule-warm)'
              }`,
            }}
          />
        ))}
      </div>
      <p
        className={`trek-label-xs mt-2 tabular-nums ${
          ground === 'dark' ? 'text-paper/60' : 'text-mid'
        }`}
      >
        {short === 0
          ? 'Point released'
          : `${short} more ${short === 1 ? 'person' : 'people'} and the point is released`}
      </p>
    </div>
  )
}
