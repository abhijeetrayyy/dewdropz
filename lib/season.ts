/**
 * The season, with no 3D engine attached.
 *
 * WHY THIS FILE EXISTS — AND WHY THE OBVIOUS FIX WAS NOT ENOUGH
 *
 * `SummitHero` loads the terrain the correct way:
 *
 *     const TerrainScene = dynamic(() => import('./TerrainScene'), { ssr: false })
 *
 * and it did not work. Ten lines above it sat:
 *
 *     import { resolveSeason, type Season } from './HeroWeather'
 *
 * a static import, for two pure functions that parse a query string and read a
 * month off a Date. `HeroWeather.tsx` opens with `import * as THREE from
 * 'three'` and `import { useFrame, useThree } from '@react-three/fiber'`, so
 * that one import dragged the whole engine into the hero's own chunk. The
 * bundler is right to do it: a static import is a promise the module will be
 * there synchronously.
 *
 * Measured on the production build: the three.js chunk — 883,341 bytes raw,
 * 231,767 gzipped — was emitted inside a `<script>` in the served HTML, on
 * every device, including the phones that take the ambient branch and never
 * construct a renderer at all.
 *
 * The council's prescribed fix was to gate the mount:
 * `{mounted && !reduceMotion && !ambientMobile && <TerrainScene/>}`. That is
 * correct and it is also applied — but on its own it would have changed
 * nothing about the download, because the download was decided at build time
 * by an import ten lines above the one everybody was looking at.
 *
 * The rule worth keeping: a `dynamic()` import buys you nothing if any static
 * import in the same module reaches the same dependency. Check the whole
 * import graph, not the line that looks like the answer.
 *
 * `HeroWeather` re-exports these so its own callers do not change.
 */

export type Season = 'rain' | 'snow' | 'fog' | 'clear'

/** Real Uttarakhand seasons, by month. Matches the trail guide's own windows. */
export function seasonForDate(d = new Date()): Season {
  const m = d.getMonth() // 0-indexed
  if (m === 11 || m <= 1) return 'snow' // Dec–Feb: winter snow
  if (m >= 6 && m <= 8) return 'rain' // Jul–Sep: monsoon
  if (m === 2 || m === 3) return 'fog' // Mar–Apr: valley cloud before the heat
  return 'clear' // May–Jun pre-monsoon, Oct–Nov post-monsoon
}

/** `?season=snow|rain|fog|clear` forces a season, for previewing the other
 *  three quarters of the year without changing the system clock. Read-only and
 *  ignored unless the value is one of the four — so an arbitrary query string
 *  can never put the hero into an undefined state. */
export function resolveSeason(search?: string, fallback?: Season): Season {
  const v = new URLSearchParams(search ?? '').get('season')
  if (v === 'snow' || v === 'rain' || v === 'fog' || v === 'clear') return v
  // Defaults to `clear` at the call site: no particles is the cheapest possible
  // first paint, and it makes the weather something a visitor chooses rather
  // than something imposed on them before they have seen the mountain at all.
  return fallback ?? seasonForDate()
}
