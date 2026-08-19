import Avatar, { type AvatarSize } from './Avatar'

// A set of people, drawn as people.
//
// "3/8" is a fact about a walk. Three overlapping faces is a fact about a
// party, and only one of those two makes somebody want to come. Everywhere the
// old board printed a count of humans — the card foot, the plan masthead, the
// thread header, the console's confirmed list — it now prints the humans, with
// the count demoted to the caption it always was.
//
// The overlap is cut with a ring in the GROUND colour rather than a border, so
// the discs read as stacked prints rather than as a row of buttons. That means
// the caller has to say what they are sitting on; there is no way to guess it.

export type Face = { id: string; name: string; role?: 'none' | 'you' | 'mentor' | 'host' }

export default function FacePile({
  people,
  max = 5,
  size = 26,
  ground = 'light',
  /** The colour the cut-out ring is painted in — must match what is behind. */
  ringColor,
  className = '',
}: {
  people: Face[]
  max?: number
  size?: AvatarSize
  ground?: 'light' | 'dark'
  ringColor?: string
  className?: string
}) {
  if (people.length === 0) return null

  const shown = people.slice(0, max)
  const extra = people.length - shown.length
  const ring = ringColor ?? (ground === 'dark' ? 'var(--ink)' : 'var(--surface)')

  return (
    <span className={`flex items-center ${className}`}>
      {shown.map((p, i) => (
        <span
          key={p.id}
          className="relative rounded-full"
          style={{
            marginLeft: i === 0 ? 0 : -6,
            boxShadow: `0 0 0 2px ${ring}`,
            zIndex: shown.length - i,
          }}
        >
          <Avatar name={p.name} id={p.id} size={size} ground={ground} role={p.role} />
        </span>
      ))}

      {extra > 0 && (
        <span
          className="relative grid place-items-center rounded-full font-mono tabular-nums"
          style={{
            marginLeft: -6,
            height: size,
            minWidth: size,
            padding: '0 4px',
            fontSize: Math.max(8, Math.round(size * 0.32)),
            background: ground === 'dark' ? 'rgba(250,250,248,0.12)' : 'var(--paper-warm)',
            color: ground === 'dark' ? 'rgba(250,250,248,0.78)' : 'var(--mid)',
            boxShadow: `0 0 0 2px ${ring}`,
          }}
        >
          +{extra}
        </span>
      )}
    </span>
  )
}
