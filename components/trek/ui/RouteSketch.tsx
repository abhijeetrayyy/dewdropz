import { dotColor, type HourLight } from '@/lib/trek'

// The shape of the day, drawn from the numbers the host already gave.
//
// `distance_km` and `gain_m` were collected by the composer, stored, and then
// printed as "12 km · 800 m" in grey mono — two of the three facts that decide
// whether somebody can actually do a walk, rendered smaller than the host's
// name. A profile line is not a picture of a climb.
//
// So: a deterministic elevation sketch. The curve is derived, not decorative —
// its length is the distance, its height is the climb over that distance, and
// its roughness is the gradient, so a flat 20 km and a steep 6 km look like
// what they are. Same inputs always produce the same curve, which matters:
// a walk that redrew itself between the board and its own page would be lying.
//
// No map dependency, no tiles to fetch, no key to leak. It is arithmetic.

/** A steady, seedable wobble — sin sums, so it is smooth and has no library. */
function wobble(x: number, seed: number): number {
  return (
    Math.sin(x * 3.1 + seed) * 0.5 +
    Math.sin(x * 7.3 + seed * 2.1) * 0.28 +
    Math.sin(x * 13.7 + seed * 0.7) * 0.14
  )
}

export default function RouteSketch({
  distanceKm,
  gainM,
  light,
  ground = 'dark',
  className = '',
}: {
  distanceKm?: number | null
  gainM?: number | null
  light: HourLight
  ground?: 'light' | 'dark'
  className?: string
}) {
  // With neither number there is nothing honest to draw, and an invented
  // mountain range on a card is exactly the kind of decoration this product
  // has spent its whole design avoiding.
  if (!distanceKm && !gainM) return null

  const km = Math.min(Math.max(distanceKm ?? 8, 1), 60)
  const gain = Math.min(Math.max(gainM ?? 300, 0), 2500)

  // Steepness: metres climbed per kilometre, normalised. A 100 m/km walk is
  // gentle; 300 m/km is a wall.
  const steep = Math.min(gain / km / 300, 1)
  const peak = 20 + steep * 58            // how high the curve gets, of 100
  const seed = (km * 7 + gain * 0.013) % 10

  const W = 300
  const H = 100
  const N = 60

  const pts: string[] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    // One climb and one descent, asymmetric — the top sits at 0.58, because a
    // day walk summits after halfway and comes down faster than it went up.
    const arc = Math.sin(Math.pow(t, 0.86) * Math.PI) ** 1.3
    const noise = wobble(t * km * 0.35, seed) * steep * 7
    const y = H - (arc * peak + noise + 6)
    pts.push(`${(t * W).toFixed(1)},${Math.max(4, Math.min(H - 2, y)).toFixed(1)}`)
  }

  const stroke = ground === 'dark' ? light.color : dotColor(light, 'light')

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={className}
    >
      <polygon points={`0,${H} ${pts.join(' ')} ${W},${H}`} fill={stroke} opacity="0.16" />
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        opacity="0.75"
      />
    </svg>
  )
}
