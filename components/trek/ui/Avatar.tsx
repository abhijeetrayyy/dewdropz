import Link from 'next/link'

// One avatar, everywhere.
//
// Before this there were four: a 16px forest disc in TrekPlanCard, a 24px one
// in the discover grid, a 40px sage one on the person page and a 52px one in
// YouCard — each with its own tint, its own type and its own way of deriving
// initials. Four treatments of the same object is how a product stops reading
// as one product, and it is especially costly here, because a board about
// finding people that shows people four different ways is arguing against
// itself.
//
// TINT IS DERIVED, NOT RANDOM. The colour comes from a hash of the user id, so
// a person is the same colour on the board, in the roster, in the chat and on
// their profile. That consistency is what lets you recognise somebody across
// screens without reading a name — which is most of what an avatar is for.
//
// THE RING IS A SHADOW, NEVER A BORDER. `box-shadow: 0 0 0 Npx` costs no
// layout, so a mentor's clay ring and a host's forest ring do not push the
// disc off the baseline the way a border would.

const TINTS: { bg: string; fg: string }[] = [
  { bg: 'rgba(31,74,46,0.10)',   fg: '#1F4A2E' },
  { bg: 'rgba(58,74,102,0.10)',  fg: '#3A4A66' },
  { bg: 'rgba(122,81,64,0.12)',  fg: '#7A5140' },
  { bg: 'rgba(138,90,23,0.12)',  fg: '#8A5A17' },
]

// The same four, lifted so they still read on an ink band.
const TINTS_DARK: { bg: string; fg: string }[] = [
  { bg: 'rgba(143,179,148,0.16)', fg: '#8FB394' },
  { bg: 'rgba(159,177,206,0.16)', fg: '#9FB1CE' },
  { bg: 'rgba(192,154,133,0.18)', fg: '#C09A85' },
  { bg: 'rgba(217,165,96,0.18)',  fg: '#D9A560' },
]

/** Stable across renders and machines — no Math.random, no index-in-list. */
function hash(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h
}

/** Two letters, from the two ends of a name — "Priya Negi" → PN, "Rohan" → RO. */
export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '··'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export type AvatarSize = 16 | 20 | 24 | 26 | 32 | 40 | 52 | 64 | 96

/** Which ring, if any. Rings mean rank or relationship, never decoration. */
export type AvatarRole = 'none' | 'you' | 'mentor' | 'host'

// A ring means rank or relationship, and there are only three.
//
// "You" was amber in the first pass, which put the loudest colour on the
// screen around the one face that needs no persuading. It is forest now — the
// same green as the primary act, because that is what "this one is yours"
// should look like — and amber is left free to mean the only thing it means
// here, which is that a clock is running.
const RING: Record<AvatarRole, string | null> = {
  none: null,
  you: 'var(--forest)',
  mentor: 'var(--clay)',
  host: 'var(--sage)',
}

export default function Avatar({
  name,
  id,
  size = 32,
  role = 'none',
  ground = 'light',
  href,
  className = '',
}: {
  name: string
  /** The user id, so the tint follows the person rather than their position. */
  id?: string | null
  size?: AvatarSize
  role?: AvatarRole
  /** What it is sitting on — decides which tint pair reads. */
  ground?: 'light' | 'dark'
  /** When given, the whole disc becomes the door to that person. */
  href?: string
  className?: string
}) {
  const pool = ground === 'dark' ? TINTS_DARK : TINTS
  const tint = pool[hash(id || name) % pool.length]
  const ring = RING[role]
  // Newsreader has the presence to carry a big disc; below 32px its contrast
  // collapses, so the small discs step down to Inter. They used to step down
  // to mono, which was wrong twice over: the typeface named here was still
  // Fraunces from the rejected prototype, and a pair of initials is not a
  // figure — mono is rationed to counts, times, distances, prices, queue
  // positions and dates in a fixed column, and "AR" is none of those.
  const serif = size >= 32

  const disc = (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full leading-none ${
        serif ? 'font-display' : 'font-body font-medium'
      } ${className}`}
      style={{
        height: size,
        width: size,
        background: tint.bg,
        color: tint.fg,
        fontSize: Math.max(8, Math.round(size * (serif ? 0.34 : 0.3))),
        boxShadow: ring
          ? `0 0 0 ${size >= 52 ? 3 : 2}px ${
              ground === 'dark' ? 'var(--ink)' : 'var(--surface)'
            }, 0 0 0 ${size >= 52 ? 5 : 4}px ${ring}`
          : undefined,
      }}
    >
      {initialsFor(name)}
    </span>
  )

  if (!href) return disc

  return (
    <Link
      href={href}
      aria-label={name}
      className="shrink-0 rounded-full transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
    >
      {disc}
    </Link>
  )
}
