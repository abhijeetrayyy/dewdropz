import { dotColor, lightForTime, type HourLight } from '@/lib/trek'

// The hour a walk leaves at.
//
// The first pass drew this as a filled pill in the hour's colour, which is what
// the prototype did — and on a board of eight walks it produced eight saturated
// lozenges competing with eight photographs. The information (this leaves at
// first light) was true and the presentation was a paint chart.
//
// So the pill is now a NEUTRAL chip carrying a coloured dot. The colour is
// still doing the work — a row of dots reads as a day passing exactly as well
// as a row of lozenges did — but it is spending eight pixels on it instead of
// eight hundred, and the time itself stays legible on any photograph underneath.
//
// `solid` is kept for the two places where the hour is the subject rather than
// an attribute: the walk's own masthead, and the invite card.

export default function HourPill({
  time,
  light,
  withLabel = false,
  ground = 'dark',
  solid = false,
  className = '',
}: {
  /** 'HH:MM' or 'HH:MM:SS'. Null renders nothing — a multi-day trek has no hour. */
  time: string | null | undefined
  /** Pass it if you already computed it; otherwise it is derived. */
  light?: HourLight
  /** Adds "· First light", for surfaces with room for the sentence. */
  withLabel?: boolean
  /** What it is sitting on. Photographs count as dark. */
  ground?: 'light' | 'dark'
  /** Fill it in the hour's own colour. For a masthead, not for a card. */
  solid?: boolean
  className?: string
}) {
  if (!time) return null
  const l = light ?? lightForTime(time)
  const dark = ground === 'dark'

  if (solid) {
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-mono text-[12px] font-medium leading-none tabular-nums ${className}`}
        style={{ background: l.bg, color: l.fg }}
      >
        {time.slice(0, 5)}
        {/* The time is the figure and keeps mono; "First light" is the name of
            an hour, and a name set in mono reads as a field value. */}
        {withLabel && <span className="font-body opacity-80">· {l.label}</span>}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 font-mono text-[11px] font-medium leading-none tabular-nums ${
        dark ? 'trek-glass-sm text-paper' : 'border border-rule bg-surface text-text'
      } ${className}`}
    >
      <span
        aria-hidden="true"
        className="h-[6px] w-[6px] shrink-0 rounded-full"
        style={{ background: dotColor(l, dark ? 'dark' : 'light') }}
      />
      {time.slice(0, 5)}
      {withLabel && (
        <span className={`font-body ${dark ? 'text-paper/65' : 'text-mid'}`}>· {l.label}</span>
      )}
    </span>
  )
}

/** The 4px rail down the side of a row. Same idea, no room for a chip. */
export function HourBar({
  light,
  height = 36,
  ground = 'light',
  className = '',
}: {
  light: HourLight
  height?: number
  ground?: 'light' | 'dark'
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={`block w-1 shrink-0 rounded-[2px] ${className}`}
      style={{ height, background: dotColor(light, ground) }}
    />
  )
}
