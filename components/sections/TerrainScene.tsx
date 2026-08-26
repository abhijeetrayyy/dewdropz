'use client'

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createNoise2D } from 'simplex-noise'
import { HeroWeather, seasonHaze, type Season } from './HeroWeather'

const ROCK_LOW = new THREE.Color('#241811')
const ROCK_MID = new THREE.Color('#3F4F3A')
const SAGE = new THREE.Color('#7BA46F')
const SNOW = new THREE.Color('#F6F3EA')

const TERRAIN_SIZE = 70
const terrainNoise = createNoise2D(() => 0.42)
// Every 3D position in this file lives in the terrain group's local space; the group
// itself sits at this world offset, so anything projected to screen space (the
// waypoint labels) has to add it back before calling camera.project().
export const GROUP_OFFSET = new THREE.Vector3(0, -1.5, -10)

// Ridged fractal-Brownian-motion noise reads as sharp mountain ridgelines rather
// than rolling hills — each octave folds the noise back on itself via 1 - |n|.
// Pulled out as its own function (rather than inlined in the geometry builder) so
// tree/trail/marker placement can query the exact same surface the mesh uses —
// otherwise foliage would float above or sink into the ground it's meant to sit on.
//
// ── THE SHAPE, RESHAPED (client mark-up, 23 August) ──────────────────────────
//
// "If you can change the mountain shape of the background with right resolution
// and size it will be better", against a sample of a high alpine range: a few
// tall, sharp, snow-capped peaks with real vertical relief and daylight between
// them. What the old field produced was closer to foothills — plenty of ridges,
// all at roughly the same height, none of them a summit.
//
// Three changes, all to this function; nothing downstream needed touching
// because every consumer already samples the same surface:
//
//   1. SHARPER RIDGES. `1 - |n|` peaks in a rounded arch. Raising it to a power
//      (RIDGE_SHARPNESS) pulls the shoulders down and leaves the crest, which
//      is the difference between a hill and an arête.
//   2. FEWER, BIGGER LANDFORMS. The base frequency drops (0.032 → 0.021), so
//      one massif occupies the frame instead of six competing bumps, and the
//      octave falloff steepens (0.52 → 0.46) so the fine noise textures the
//      rock rather than adding a second range on top of it.
//   3. A PEAK CURVE. The summed field is run through a gentle exponent at the
//      end, which flattens the valley floor and lets the high ground run away
//      upward — the tall-peaks-over-low-ground silhouette of the sample. The
//      vertical scale in `worldY` then does the rest.
const RIDGE_SHARPNESS = 1.45
const PEAK_CURVE = 1.28

function rawHeight(x: number, z: number) {
  let h = 0
  let amp = 1
  let freq = 0.021
  let norm = 0
  for (let o = 0; o < 5; o++) {
    const n = terrainNoise(x * freq, z * freq)
    h += Math.pow(1 - Math.abs(n), RIDGE_SHARPNESS) * amp
    norm += amp
    amp *= 0.46
    freq *= 2.1
  }
  // Back to roughly 0..1 before the curve, so PEAK_CURVE means the same thing
  // regardless of how many octaves are being summed.
  h = Math.pow(h / norm, PEAK_CURVE) * norm
  // Gentle rise toward the far edge so the range reads as approaching, not flat.
  h += (1 - (z + TERRAIN_SIZE / 2) / TERRAIN_SIZE) * 2.4
  return h
}

// The noise field is fully deterministic (fixed seed), so this range only needs
// computing once — every consumer (color bands, tree band, trail height) shares it.
const { MIN_H, MAX_H } = (() => {
  let minH = Infinity
  let maxH = -Infinity
  const step = TERRAIN_SIZE / 70
  for (let x = -TERRAIN_SIZE / 2; x <= TERRAIN_SIZE / 2; x += step) {
    for (let z = -TERRAIN_SIZE / 2; z <= TERRAIN_SIZE / 2; z += step) {
      const h = rawHeight(x, z)
      if (h < minH) minH = h
      if (h > maxH) maxH = h
    }
  }
  return { MIN_H: minH, MAX_H: maxH }
})()

function normalizedHeight(x: number, z: number) {
  return (rawHeight(x, z) - MIN_H) / (MAX_H - MIN_H || 1)
}

// 3.4 → 3.75 for the extra relief the sample has, and the offset is then solved
// (not guessed) to pin the valley floor exactly where it has always been.
//
// The reshaped field spans 0.149..3.904; the old one spanned 0.620..4.279. So
// the two numbers are tied: -4.5 with the new field would have dropped the
// floor by 2.1 units, out from under the fog plane and the treeline the rest of
// the scene is placed against. -2.95 keeps the floor at y ≈ -2.39 and puts the
// whole of the extra height into the peaks, which take the summit from 10.0 to
// 11.7 — taller mountains, same ground under them.
function worldY(x: number, z: number) {
  return rawHeight(x, z) * 3.75 - 2.95
}

// Real places on this exact terrain, every coordinate found by sampling the height
// field, not guessed. Two kinds: 'collection' pins sit at the elevations their gear
// is built for; 'trek' pins put actual bookable trails on the range at plausible
// relative heights (Kedarkantha on the far left ridge t≈0.65, Har Ki Dun and Nag
// Tibba in the treeline foreground t≈0.44) — the old TrailMap section's job, done
// in-world. Exported so the DOM wrapper can render matching interactive labels.
// Typed explicitly (not `as const`) so the trek-handling code keeps compiling
// while the trek entries below are paused.
export interface Waypoint {
  id: string
  name: string
  kind: 'collection' | 'trek'
  href: string
  x: number
  z: number
  labelHeight: number
}

export const WAYPOINTS: readonly Waypoint[] = [
  { id: 'silent-altitude', name: 'Silent Altitude', kind: 'collection', href: '/collections/silent-altitude', x: -9.5, z: -31.5, labelHeight: 2.4 },
  { id: 'mist-and-morning', name: 'Mist & Morning', kind: 'collection', href: '/collections/mist-and-morning', x: 4, z: -27, labelHeight: 1.5 },
  // Treks paused as a business line — restore the in-world trek pins by uncommenting.
  // { id: 'kedarkantha', name: 'Kedarkantha — 3,800m', kind: 'trek', href: '/treks', x: -23.5, z: -29, labelHeight: 1.9 },
  // { id: 'har-ki-dun', name: 'Har Ki Dun — 3,566m', kind: 'trek', href: '/treks', x: 5, z: -9.5, labelHeight: 1.3 },
  // { id: 'nag-tibba', name: 'Nag Tibba — 3,022m', kind: 'trek', href: '/treks', x: -18.5, z: -9, labelHeight: 1.3 },
]

export interface WaypointScreenState {
  x: number
  y: number
  visible: boolean
}

function buildTerrainGeometry(segments: number) {
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, segments, segments)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const c = new THREE.Color()

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const t = normalizedHeight(x, z)
    pos.setY(i, worldY(x, z))
    // THE SNOWLINE, LOWERED AND SHORTENED.
    //
    // The bands used to be rock → sage → snow with snow starting at 0.72 and
    // only reaching pure white at t = 1.0. Under the reshaped field barely any
    // of the surface is that high — under one per cent — so the range had no
    // snow on it at all, which is the one thing the sample the client attached
    // is unmistakably about. Snow now starts at 0.66 and is fully white by
    // 0.88, so the peaks the new field actually produces get caps.
    if (t < 0.4) c.lerpColors(ROCK_LOW, ROCK_MID, t / 0.4)
    else if (t < 0.66) c.lerpColors(ROCK_MID, SAGE, (t - 0.4) / 0.26)
    else c.lerpColors(SAGE, SNOW, Math.min(1, (t - 0.66) / 0.22))
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  return geo
}

function Terrain({ segments }: { segments: number }) {
  const geometry = useMemo(() => buildTerrainGeometry(segments), [segments])
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0} fog />
    </mesh>
  )
}

function paintGeometry(geo: THREE.BufferGeometry, color: THREE.Color) {
  const count = geo.attributes.position.count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
}

const TRUNK_COLOR = new THREE.Color('#2A1B12')
const FOLIAGE_DARK = new THREE.Color('#141F17')
const FOLIAGE_LIGHT = new THREE.Color('#233826')

// A single cone read as a Christmas-tree cutout, not a pine. Three tapering,
// overlapping tiers plus a visible trunk is what actually reads as a conifer at
// this silhouette scale — merged into one geometry so instancing stays one draw call.
function buildPineGeometry() {
  const parts: THREE.BufferGeometry[] = []

  const trunk = new THREE.CylinderGeometry(0.035, 0.055, 0.24, 5)
  trunk.translate(0, 0.12, 0)
  parts.push(paintGeometry(trunk, TRUNK_COLOR))

  const tiers = [
    { radius: 0.3, height: 0.5, y: 0.32, color: FOLIAGE_DARK },
    { radius: 0.22, height: 0.42, y: 0.6, color: FOLIAGE_LIGHT },
    { radius: 0.13, height: 0.32, y: 0.85, color: FOLIAGE_DARK },
  ]
  for (const tier of tiers) {
    const cone = new THREE.ConeGeometry(tier.radius, tier.height, 7)
    cone.translate(0, tier.y, 0)
    parts.push(paintGeometry(cone, tier.color))
  }

  const merged = mergeGeometries(parts, false)
  merged.computeVertexNormals()
  return merged
}

// Stylized pine silhouettes scattered on the mid-slope band only — bare rock at the
// valley floor, bare snow at the peaks, treeline in between, same as a real range.
function Trees({ count }: { count: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => buildPineGeometry(), [])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    // Seeded, not Math.random(). The terrain, the trail and the weather field are
    // all deterministic already; the forest was the one thing that reshuffled on
    // every load. That made the scene impossible to check — a pine grew straight
    // through the arrival roof on one load and stood clear on the next — and it
    // meant nobody saw the same mountain twice.
    // Chosen, not arbitrary: seeds were scored on how the forest lands in the
    // frames that matter — enough pines on the near slope to read as woodland,
    // a handful ringing the arrival clearing so the house sits in the trees
    // rather than on a lawn, and depth left on the mid slope behind it.
    let seed = 21958
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    let placed = 0
    let attempts = 0
    while (placed < count && attempts < count * 8) {
      attempts++
      const x = (rand() - 0.5) * TERRAIN_SIZE * 0.92
      const z = -rand() * TERRAIN_SIZE * 0.85 + 6
      const t = normalizedHeight(x, z)
      if (t < 0.14 || t > 0.5) continue
      // CLEARINGS is derived from SHELTERS further down the file; reading it
      // here is safe because effects run long after module evaluation.
      if (CLEARINGS.some((c) => Math.hypot(x - c.x, z - c.z) < c.r)) continue
      const scale = 0.6 + rand() * 0.9
      dummy.position.set(x, worldY(x, z), z)
      dummy.rotation.y = rand() * Math.PI * 2
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(placed, dummy.matrix)
      placed++
    }
    mesh.count = placed
    mesh.instanceMatrix.needsUpdate = true
  }, [count])

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, count]} frustumCulled={false}>
      <meshStandardMaterial vertexColors roughness={1} fog />
    </instancedMesh>
  )
}

// A single glowing route threading through the range — the same "trail mapped"
// language as the interactive map section, just felt here instead of read. Runs
// through both waypoints so it reads as one continuous journey between them.
// Hidden during the summit hold: the bright line cut straight through the
// headline's space and competed with it — the trail is the descent's reward,
// revealed only once the journey actually starts.
function TrailPath({ progressRef, reduceMotion }: { progressRef: RefObject<number>; reduceMotion: boolean }) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null)
  const geometry = useMemo(() => {
    const controlPoints: [number, number][] = [
      [-15, 21],
      [-9, 9],
      [-9.5, -8],
      [-2, -20],
      [4, -27],
    ]
    const points = controlPoints.map(([x, z]) => new THREE.Vector3(x, worldY(x, z) + 0.1, z))
    const curve = new THREE.CatmullRomCurve3(points)
    return new THREE.TubeGeometry(curve, 120, 0.05, 6, false)
  }, [])

  useFrame(() => {
    const p = reduceMotion ? 0.1 : (progressRef.current ?? 0)
    const gate = Math.min(1, Math.max(0, (p - 0.14) / 0.1))
    if (matRef.current) matRef.current.opacity = 0.5 * gate
  })

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial ref={matRef} color="#D8E8C8" transparent opacity={0} fog={false} />
    </mesh>
  )
}

function useSoftMistTexture() {
  return useMemo(() => {
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
      gradient.addColorStop(0, 'rgba(255,255,255,0.85)')
      gradient.addColorStop(0.5, 'rgba(255,255,255,0.32)')
      gradient.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, size, size)
    }
    const texture = new THREE.CanvasTexture(canvas)
    return texture
  }, [])
}

const MIST_PUFFS = [
  { pos: [-9, -3.6, -9] as const, w: 13, h: 5, drift: 0.9, speed: 0.05, opacity: 0.22 },
  { pos: [7, -3.3, -17] as const, w: 15, h: 6, drift: 1.3, speed: 0.035, opacity: 0.18 },
  { pos: [0, -2.7, -4] as const, w: 10, h: 4, drift: 0.7, speed: 0.07, opacity: 0.16 },
  { pos: [-4, -3.9, -23] as const, w: 16, h: 6, drift: 1.1, speed: 0.03, opacity: 0.16 },
]

// ─── Shelters ────────────────────────────────────────────────────────────────
// Two lamps burning on the range at 04:30.
//
// Deliberately tiny — a hut you can only just resolve, and a lamp that is
// mostly a smudge of warm light. The point isn't the architecture, it's the
// sentence it writes: someone is up there, and they were awake before you were.
// That is the entire emotional premise of the brand in two pixels of amber.
//
// They burn out as the sun arrives, on the same descent progress that already
// fades the stars — so the mountain is inhabited at dawn and empty by morning.
// Placed out on the flanks and reasonably near the camera, so they sit low and
// wide in frame rather than behind the centred headline — a first pass put one
// directly under the "GO" and it just read as a rendering artefact.
//
// THE THIRD ONE IS THE CAMP, AND IT IS THE POINT OF ACT 1.
//
// The two above are deliberately peripheral — evidence, at the edge of vision,
// that the range is inhabited. The centre one is the opposite: it is what act
// 1's zoom is pushing toward, and it has a fire going. The header comment on
// SummitHero still records that a lit cabin with a bonfire used to end the
// descent and was cut when the collections took that frame; this brings it
// back where it actually belongs, in the establishing shot, at the bottom of
// the frame the headline leaves empty.
//
// The position is measured, not placed by eye, and measured across the WHOLE of
// act 1 rather than at frame one — because two things move it while the brand
// story holds: the camera descends 17 → 13 units, and the range layer scales
// about its own centre from 1.00 to 1.16.
//
// Projected through both, local z = 11.5 sits at 76% down a 16:10 frame at the
// start and 79% at act 1's handover: near enough stationary, because the
// descent lifts it in frame by almost exactly as much as the zoom pushes it
// down. It clears the two calls to action, which bottom out at 63%, by about
// 80px, and it never approaches the bottom edge.
//
// z = 13 was the first pass and drifted to 83% — still in frame, but visibly
// sliding toward the bottom of a shot it is supposed to be the subject of.
const SHELTERS = [
  { x: -17, z: -5, scale: 1.5, phase: 0.0, turn: 0.5, fire: false, clearing: 1.7 },
  { x: 15, z: -11, scale: 1.3, phase: 2.1, turn: -0.6, fire: false, clearing: 1.7 },
  { x: 0, z: 11.5, scale: 1.25, phase: 1.1, turn: 0.22, fire: true, clearing: 3.1 },
] as const

function useLampTexture() {
  return useMemo(() => {
    const size = 64
    const c = document.createElement('canvas')
    c.width = c.height = size
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    // Hot core → lamp amber → nothing. Warmer than anything else in the scene,
    // which is what makes it read as firelight rather than another star.
    g.addColorStop(0, 'rgba(255,244,214,1)')
    g.addColorStop(0.22, 'rgba(255,196,92,0.85)')
    g.addColorStop(0.55, 'rgba(226,140,44,0.28)')
    g.addColorStop(1, 'rgba(226,140,44,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    return new THREE.CanvasTexture(c)
  }, [])
}

/** Where the fire stands relative to its hut, in the hut's own units. */
const FIRE_OFFSET = { x: 1.15, z: 0.55 }

/**
 * Where the campfire's base sits inside its shelter group.
 *
 * The fire stands beside the hut, not in it, and on ground that is not the
 * hut's ground — this slope drops about 0.4 of a unit across the clearing. So
 * the offset is sampled off the real height field and expressed relative to
 * the group origin, which is already at `worldY(sh.x, sh.z)`. Without this the
 * flame either floats above the hillside or is buried to the tip.
 */
function worldFireBase(sh: (typeof SHELTERS)[number]) {
  return worldY(sh.x + FIRE_OFFSET.x * sh.scale, sh.z + FIRE_OFFSET.z * sh.scale) - worldY(sh.x, sh.z)
}

/**
 * The colour of a flame at height `t` — 0 at the fuel, 1 at the frayed tip.
 *
 * White-hot where the wood is, through yellow and amber, to the deep orange a
 * flame goes as it lets go. Sampling one ramp for the core of each row and a
 * point further up it for that row's edges is what gives the flame heat ACROSS
 * as well as UP: the middle of the fire is always hotter than its own edge, and
 * a flame drawn without that reads as coloured paper.
 */
const FIRE_RAMP: readonly [number, number, number, number][] = [
  [0.0, 255, 246, 214],
  [0.18, 255, 216, 128],
  [0.45, 255, 160, 56],
  [0.75, 236, 108, 26],
  [1.0, 194, 62, 14],
]

function fireRamp(t: number): [number, number, number] {
  const p = Math.min(1, Math.max(0, t))
  for (let i = 1; i < FIRE_RAMP.length; i++) {
    const [hi, hr, hg, hb] = FIRE_RAMP[i]
    if (p > hi && i < FIRE_RAMP.length - 1) continue
    const [lo, lr, lg, lb] = FIRE_RAMP[i - 1]
    const k = (p - lo) / (hi - lo || 1)
    return [
      Math.round(lr + (hr - lr) * k),
      Math.round(lg + (hg - lg) * k),
      Math.round(lb + (hb - lb) * k),
    ]
  }
  return [255, 246, 214]
}

/**
 * The bonfire's flame, as a texture.
 *
 * Deliberately NOT the lamp's radial gradient. A circle reads as a light; a
 * flame needs a shape — wide and hot where it meets the fuel, tapering and
 * cooling as it goes — and at the ~24px this burns at on screen, silhouette is
 * the only thing carrying it. One canvas at mount, nothing per frame.
 *
 * ── WHAT WAS WRONG WITH THE LAST ONE ───────────────────────────────────────
 *
 * Two things, and together they turned the fire into a white spike:
 *
 * 1. EVERY ROW WAS A KNIFE EDGE. The horizontal gradient ran transparent →
 *    core → transparent with the core on a single stop at 0.5, so each row was
 *    bright at exactly its centre pixel and faint everywhere else. Stacked up,
 *    that is not a flame — it is a vertical line with wings, which is why it
 *    read as a beam of light standing on the hillside. The core is a plateau
 *    now (0.24 → 0.76), so the flame has a body.
 *
 * 2. IT WAS SYMMETRICAL AND POINTED. A straight taper to an exact apex is a
 *    traffic cone. This one carries a slight belly, a gentle lean baked into
 *    the centre line, and an alpha that frays out over the top third instead
 *    of arriving at a needle.
 */
function useFlameTexture() {
  return useMemo(() => {
    const w = 96
    const h = 160
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')!

    for (let y = 0; y < h; y++) {
      // 0 at the base, 1 at the tip.
      const t = 1 - y / h
      // Wide and round where it meets the logs, through a slight belly, frayed
      // rather than pointed at the top.
      const half = Math.pow(1 - t, 0.5) * (0.72 + 0.28 * Math.sin(t * Math.PI)) * (w * 0.5)
      if (half <= 0.35) continue
      // Flames are not symmetrical. A gentle lean, baked in, is the cheapest
      // thing there is that stops this reading as a cone.
      const cx = w / 2 + Math.sin(t * Math.PI * 1.35) * w * 0.05

      // Full where the fire is doing its work, tucked under at the very base so
      // the logs read as holding the flame rather than being behind it, and
      // gone by the tip.
      const a = Math.min(1, 0.55 + t * 3) * Math.pow(1 - t, 1.05)
      const [cr, cg, cb] = fireRamp(t * 0.62)
      const [er, eg, eb] = fireRamp(Math.min(1, t * 1.2 + 0.16))

      const g = ctx.createLinearGradient(cx - half, 0, cx + half, 0)
      g.addColorStop(0, `rgba(${er},${eg},${eb},0)`)
      g.addColorStop(0.24, `rgba(${er},${eg},${eb},${(a * 0.5).toFixed(3)})`)
      g.addColorStop(0.5, `rgba(${cr},${cg},${cb},${a.toFixed(3)})`)
      g.addColorStop(0.76, `rgba(${er},${eg},${eb},${(a * 0.5).toFixed(3)})`)
      g.addColorStop(1, `rgba(${er},${eg},${eb},0)`)
      ctx.fillStyle = g
      ctx.fillRect(cx - half, y, half * 2, 1)
    }

    return new THREE.CanvasTexture(c)
  }, [])
}

/**
 * The light the fire lays on its own clearing.
 *
 * This used to borrow the lamp's texture, which has a white-hot core — squashed
 * flat on the ground that came out as a bright bar under the flame, so it was
 * dimmed until it disappeared instead. A pool of firelight has no core: it is
 * brightest under the fire and simply runs out. No white here at any stop.
 */
function useFirePoolTexture() {
  return useMemo(() => {
    const size = 128
    const c = document.createElement('canvas')
    c.width = c.height = size
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    g.addColorStop(0, 'rgba(255,178,88,0.72)')
    g.addColorStop(0.26, 'rgba(252,132,44,0.38)')
    g.addColorStop(0.58, 'rgba(206,88,26,0.11)')
    g.addColorStop(1, 'rgba(184,70,20,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    return new THREE.CanvasTexture(c)
  }, [])
}

/** One ember: a hot point with a soft edge. Tinted per-particle by the geometry. */
function useEmberTexture() {
  return useMemo(() => {
    const size = 32
    const c = document.createElement('canvas')
    c.width = c.height = size
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.34, 'rgba(255,206,132,0.72)')
    g.addColorStop(1, 'rgba(255,170,90,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    return new THREE.CanvasTexture(c)
  }, [])
}

/**
 * The fire's own dimensions, in its hut's units — one place to tune it.
 *
 * The two numbers that decide whether this reads as a campfire at all:
 *
 *   flameHeight  about 0.7 of the hut it stands beside. Taller than the hut and
 *                it stops being a campfire and starts being a bonfire in front
 *                of a shed; much shorter and the fuel out-masses the fire.
 *   poolWidth    a first pass ran this at 2.4 — three world units, wider than
 *                the hut is tall. Additive light spread that thin over dark
 *                ground does not read as a lit clearing, it reads as a grey
 *                haze lying across the hillside with a building in it. Kept
 *                tight and a little brighter instead: light has to have an
 *                edge somewhere or it is just fog.
 */
const FIRE = {
  logRadius: 0.2,
  logHeight: 0.13,
  flameWidth: 0.52,
  flameHeight: 0.72,
  /** The inner flame, as a fraction of the outer one. Wider in proportion than
   *  it is tall: at this size a core narrower than about 0.6 stops being a
   *  hotter flame inside the first and becomes a bright vertical line in it. */
  coreWidth: 0.6,
  coreHeight: 0.48,
  poolWidth: 1.45,
  poolHeight: 0.4,
  emberCount: 18,
  emberRise: 1.5,
  emberSpread: 0.26,
  emberSize: 0.085,
} as const

/**
 * How lit the camp is at scrub progress `p`: 1 while the brand frame holds,
 * 0 once it has handed over. Shared by the huts and the fire so the range
 * cannot go half-empty.
 */
function dawnLevel(p: number, from: number, to: number) {
  return 1 - Math.min(1, Math.max(0, (p - from) / Math.max(0.0001, to - from)))
}

interface Embers {
  /** Four per ember: rise speed, birth phase, bearing out of the fire, reach. */
  seeds: Float32Array
  positions: Float32Array
  colors: Float32Array
}

/**
 * The ember buffers, built once per fire and then rewritten in place each
 * frame. A fixed LCG seeds them, like the stars, so the camp looks the same on
 * every mount.
 *
 * Held in a ref and touched only from effects and the frame loop — never during
 * render. This project's react-hooks rules reject both halves of the obvious
 * shape here: a useMemo result may not be mutated afterwards, and a ref may not
 * be read while rendering. So the geometry is declared empty in the JSX and
 * these attributes are hung on it on mount, which keeps every mutable thing out
 * of the render pass. An empty BufferGeometry draws nothing rather than
 * throwing, so the frame between mount and that effect is simply a frame with
 * no embers in it.
 */
function createEmbers(): Embers {
  const n = FIRE.emberCount
  const seeds = new Float32Array(n * 4)
  let seed = 8675309
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let i = 0; i < n; i++) {
    seeds[i * 4] = 0.22 + rand() * 0.3
    seeds[i * 4 + 1] = rand()
    seeds[i * 4 + 2] = rand() * Math.PI * 2
    seeds[i * 4 + 3] = 0.25 + rand() * 0.75
  }
  return { seeds, positions: new Float32Array(n * 3), colors: new Float32Array(n * 3) }
}

/**
 * The camp's fire.
 *
 * Five pieces, and the reason each is there:
 *
 *   the logs   a squat dark cone — the fuel, and the thing that stops the
 *              flame reading as a floating spark
 *   the pool   the light it throws, a wide flat bloom lying on the clearing
 *   the body   the flame's shape and most of its colour, guttering slowly
 *   the core   a smaller, hotter flame inside the first, on its own faster
 *              clock — one billboard alone always looks like a decal, two on
 *              different clocks look like combustion
 *   the embers eighteen points rising, cooling and going out
 *
 * All of it `fog={false}` for the same reason the hut windows are: a fire you
 * cannot see through fog is not doing its job, and the weather switch is
 * allowed to obscure the mountain but not to put the camp out.
 *
 * ── THE FLAME USED TO HOVER ────────────────────────────────────────────────
 *
 * Worth recording, because it is the kind of bug that hides in plain sight.
 * The fire group is already positioned at `worldFireBase(sh)` — the height of
 * the ground under the fire, relative to the ground under the hut. The frame
 * loop then set the flame sprite's LOCAL y to `worldFireBase(sh) + half its
 * height`, applying that same ground offset a second time inside the group
 * that had already applied it. So the flame stood off the logs by the fall of
 * the slope across the clearing, which is a good fraction of its own height,
 * and the fuel sat under it looking like a separate object.
 *
 * Everything in here is local to the fire's own ground now, and the group is
 * the only thing that knows where that ground is.
 */
function Campfire({
  scale: S,
  phase,
  progressRef,
  reduceMotion,
  dawnFrom,
  dawnTo,
}: {
  scale: number
  phase: number
  progressRef: RefObject<number>
  reduceMotion: boolean
  dawnFrom: number
  dawnTo: number
}) {
  const flameTex = useFlameTexture()
  const poolTex = useFirePoolTexture()
  const emberTex = useEmberTexture()

  const bodyRef = useRef<THREE.Sprite>(null)
  const coreRef = useRef<THREE.Sprite>(null)
  const poolRef = useRef<THREE.Sprite>(null)

  const emberRef = useRef<THREE.Points>(null)
  const emberData = useRef<Embers | null>(null)

  useEffect(() => {
    const points = emberRef.current
    if (!points) return
    const data = (emberData.current ??= createEmbers())
    points.geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
    points.geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3))
  }, [])

  useFrame(({ clock }) => {
    const p = reduceMotion ? 0.1 : (progressRef.current ?? 0)
    const dawn = dawnLevel(p, dawnFrom, dawnTo)
    const t = clock.elapsedTime

    // Three detuned sines, an octave apart. A real flame changes HEIGHT more
    // than it changes brightness, so the scale carries most of this.
    const body =
      0.86 +
      Math.sin(t * 5.7 + phase) * 0.1 +
      Math.sin(t * 11.3 + phase * 3) * 0.07 +
      Math.sin(t * 19.1 + phase * 5) * 0.04

    if (bodyRef.current) {
      const fl = bodyRef.current
      const mat = fl.material as THREE.SpriteMaterial
      mat.opacity = dawn * body
      const height = FIRE.flameHeight * S * (0.8 + body * 0.3)
      fl.scale.set(FIRE.flameWidth * S * (0.92 + body * 0.12), height, 1)
      // Sprites are centred, so standing one on the ground means lifting it by
      // half its own height — and then dropping it back INTO the fuel, so it
      // comes out of the logs rather than balancing on them.
      fl.position.y = height / 2 + FIRE.logHeight * S * 0.35
    }

    // The core runs faster and out of phase with the body it sits inside.
    const core = 0.82 + Math.sin(t * 8.9 + phase * 2) * 0.12 + Math.sin(t * 17.3 + phase * 4) * 0.06
    if (coreRef.current) {
      const co = coreRef.current
      const mat = co.material as THREE.SpriteMaterial
      mat.opacity = dawn * core * 0.9
      const height = FIRE.flameHeight * FIRE.coreHeight * S * (0.8 + core * 0.34)
      co.scale.set(FIRE.flameWidth * FIRE.coreWidth * S * (0.9 + core * 0.16), height, 1)
      co.position.y = height / 2 + FIRE.logHeight * S * 0.25
    }

    // Light on the ground does not gutter as fast as the flame throwing it, so
    // the pool runs on a slower clock than either flame. Following the body
    // exactly is what makes a fire look like a blinking bulb.
    if (poolRef.current) {
      const pl = poolRef.current
      const mat = pl.material as THREE.SpriteMaterial
      const glow = 0.82 + Math.sin(t * 3.9 + phase) * 0.12 + Math.sin(t * 7.1 + phase * 2) * 0.06
      mat.opacity = dawn * glow * 0.62
      const k = 0.94 + glow * 0.12
      pl.scale.set(FIRE.poolWidth * S * k, FIRE.poolHeight * S * k, 1)
    }

    const points = emberRef.current
    const data = emberData.current
    if (!points || !data) return
    const { positions, colors, seeds } = data
    const from = FIRE.logHeight * S * 0.8
    for (let i = 0; i < FIRE.emberCount; i++) {
      const speed = seeds[i * 4]
      const birth = seeds[i * 4 + 1]
      const angle = seeds[i * 4 + 2]
      const reach = seeds[i * 4 + 3]
      // One ember's whole life, 0 at the fuel and 1 where it goes out.
      const life = (t * speed + birth) % 1
      const drift = FIRE.emberSpread * S * reach * life
      positions[i * 3] = Math.cos(angle) * drift + Math.sin(life * 9 + birth * 21) * drift * 0.55
      positions[i * 3 + 1] = from + life * FIRE.emberRise * S
      positions[i * 3 + 2] = Math.sin(angle) * drift
      // Additive blending, so fading to black IS fading out — no per-particle
      // alpha needed. Cooling from yellow toward red on the way up is what a
      // rising ember actually does.
      const b = Math.max(
        0,
        dawn * Math.pow(1 - life, 1.6) * (0.55 + 0.45 * Math.sin(t * 22 + birth * 37))
      )
      colors[i * 3] = b
      colors[i * 3 + 1] = b * (0.52 - life * 0.34)
      colors[i * 3 + 2] = b * (0.16 - life * 0.13)
    }
    points.geometry.attributes.position.needsUpdate = true
    points.geometry.attributes.color.needsUpdate = true
  })

  return (
    <>
      <mesh position={[0, FIRE.logHeight * S * 0.5, 0]}>
        <coneGeometry args={[FIRE.logRadius * S, FIRE.logHeight * S, 6]} />
        {/* Charred wood with an ember in it. The last pass ran emissive
            #C2500F at 0.5 over a light base and came out salmon pink — a
            plastic wedge beside the fire rather than the fuel under it. */}
        <meshStandardMaterial color="#1E150E" emissive="#5A1D04" emissiveIntensity={0.28} roughness={1} />
      </mesh>

      {/* Squashed on Y and seated so its lower edge runs into the hillside, so
          it reads as light lying ON the clearing rather than as a second,
          rounder flame behind the first. renderOrder keeps the three additive
          billboards stacked pool → body → core however the camera moves; they
          share a position, so distance sorting alone cannot decide it. */}
      <sprite ref={poolRef} position={[0, FIRE.logHeight * S * 0.9, 0]} renderOrder={1}>
        <spriteMaterial
          map={poolTex}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          fog={false}
        />
      </sprite>

      <sprite ref={bodyRef} renderOrder={2}>
        <spriteMaterial
          map={flameTex}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          fog={false}
        />
      </sprite>

      <sprite ref={coreRef} renderOrder={3}>
        <spriteMaterial
          map={flameTex}
          color="#FFE9B0"
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          fog={false}
        />
      </sprite>

      {/* Never culled: the embers move every frame, so the bounding sphere
          would have to be recomputed with them — and the fire is a couple of
          world units across and on screen the whole time it burns. */}
      <points ref={emberRef} frustumCulled={false} renderOrder={4}>
        <bufferGeometry />
        <pointsMaterial
          map={emberTex}
          size={FIRE.emberSize * S}
          sizeAttenuation
          vertexColors
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          fog={false}
        />
      </points>
    </>
  )
}

function Shelters({
  progressRef,
  reduceMotion,
  dawnFrom,
  dawnTo,
}: {
  progressRef: RefObject<number>
  reduceMotion: boolean
  /** Scrub progress at which the lamps and the fire start going out… */
  dawnFrom: number
  /** …and the progress at which they are out. */
  dawnTo: number
}) {
  const lamp = useLampTexture()
  const glowRefs = useRef<(THREE.Sprite | null)[]>([])
  const windowRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([])

  useFrame(({ clock }) => {
    const p = reduceMotion ? 0.1 : (progressRef.current ?? 0)
    // THE BURN-OUT, TIED TO ACT 1 RATHER THAN TO A MAGIC NUMBER.
    //
    // This was `1 - min(1, p / 0.4)`: the lamps began dying the instant anyone
    // touched the wheel and were three-quarters gone by the time the old act 1
    // handed over. With act 1 now nearly a full screen long that curve would
    // have put the camp out before most of the brand story had been read. The
    // window is passed in from the act-1 exit, so the range is inhabited for
    // exactly as long as the brand frame holds, and empty the moment it goes.
    const dawn = dawnLevel(p, dawnFrom, dawnTo)
    const t = clock.elapsedTime
    SHELTERS.forEach((sh, i) => {
      // Two detuned sines read as a flame guttering; a single sine reads as a
      // pulsing dot, which is what an animation looks like rather than a lamp.
      const flicker = 0.84 + Math.sin(t * 3.1 + sh.phase) * 0.09 + Math.sin(t * 7.7 + sh.phase * 2) * 0.07
      const win = windowRefs.current[i]
      if (win) win.opacity = dawn * flicker
      const sprite = glowRefs.current[i]
      if (sprite) {
        const mat = sprite.material as THREE.SpriteMaterial
        mat.opacity = dawn * flicker * 0.75
        const s = sh.scale * (0.95 + flicker * 0.12)
        sprite.scale.set(s, s, s)
      }
    })
  })

  return (
    <group>
      {SHELTERS.map((sh, i) => {
        const y = worldY(sh.x, sh.z)
        const S = sh.scale
        return (
          <group key={i} position={[sh.x, y, sh.z]} rotation={[0, sh.turn, 0]}>
            {/* Walls. Deliberately NOT near-black: the first version painted the
                hut #1A1712 against dark terrain, so the structure vanished and
                all that survived was the glow — which is exactly why it read as
                "a yellow circle" rather than a building. A warm stone tone with
                a little emissive keeps the silhouette legible at this size. */}
            <mesh position={[0, 0.3 * S, 0]}>
              <boxGeometry args={[0.95 * S, 0.6 * S, 0.75 * S]} />
              <meshStandardMaterial color="#6B5540" emissive="#2E2113" emissiveIntensity={0.55} roughness={0.9} />
            </mesh>

            {/* A proper pitched roof, overhanging the walls — the single most
                recognisable thing about a hut at any distance. Lighter than the
                walls so the roofline separates against the slope. */}
            <mesh position={[0, 0.78 * S, 0]} rotation={[0, Math.PI / 4, 0]}>
              <coneGeometry args={[0.85 * S, 0.5 * S, 4]} />
              <meshStandardMaterial color="#8A7259" emissive="#3A2C1B" emissiveIntensity={0.4} roughness={0.85} />
            </mesh>

            {/* The lit window. This is the lamp — a small bright rectangle on
                the wall, not a floating orb. fog={false} so weather can never
                put it out; a light you can still see through fog is the point. */}
            <mesh position={[0, 0.34 * S, 0.381 * S]}>
              <planeGeometry args={[0.34 * S, 0.26 * S]} />
              <meshBasicMaterial
                ref={(el) => {
                  windowRefs.current[i] = el as THREE.MeshBasicMaterial
                }}
                color="#FFD489"
                transparent
                fog={false}
              />
            </mesh>

            {/* A tight bloom around the window only — small enough that it reads
                as light spilling out, not as a glowing ball sitting on a hill. */}
            <sprite
              ref={(el) => {
                glowRefs.current[i] = el
              }}
              position={[0, 0.36 * S, 0.44 * S]}
            >
              <spriteMaterial map={lamp} transparent depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
            </sprite>

            {/* ── The bonfire ──────────────────────────────────────────────
                The camp's fire, and act 1's subject. Everything it is made of
                lives in `Campfire`; the group here only says where the ground
                under it is, which is NOT the ground under the hut — this slope
                drops about 0.4 of a unit across the clearing. */}
            {sh.fire && (
              <group position={[FIRE_OFFSET.x * S, worldFireBase(sh), FIRE_OFFSET.z * S]}>
                <Campfire
                  scale={S}
                  phase={sh.phase}
                  progressRef={progressRef}
                  reduceMotion={reduceMotion}
                  dawnFrom={dawnFrom}
                  dawnTo={dawnTo}
                />
              </group>
            )}
          </group>
        )
      })}
    </group>
  )
}


// Built ground is cleared ground. Each shelter names its own radius rather than
// sharing one: the camp needs room for the fire and the ground it lights, the
// two flank huts do not — and a bald patch of hillside wider than the thing
// standing in it is just a hole in the forest.
const CLEARINGS: readonly { x: number; z: number; r: number }[] = SHELTERS.map((s) => ({
  x: s.x,
  z: s.z,
  r: s.clearing,
}))

function DriftingMist() {
  const texture = useSoftMistTexture()
  const refs = useRef<(THREE.Mesh | null)[]>([])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    MIST_PUFFS.forEach((p, i) => {
      const mesh = refs.current[i]
      if (!mesh) return
      mesh.position.x = p.pos[0] + Math.sin(t * p.speed + i * 2) * p.drift
    })
  })

  return (
    <group>
      {MIST_PUFFS.map((p, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          position={p.pos}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[p.w, p.h]} />
          <meshBasicMaterial map={texture} transparent opacity={p.opacity} depthWrite={false} fog={false} />
        </mesh>
      ))}
    </group>
  )
}

// The sky. A gradient dome (deep night at the zenith, a warm pre-sunrise band at
// the horizon), a soft glow where the sun is about to break, and stars that burn
// off as the descent begins. Without this, everything above the ridgeline was a
// flat void — a dawn with no sky.
const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const SKY_FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform float uDay;
  void main() {
    float h = clamp(vDir.y, -0.15, 1.0);
    vec3 zenith  = mix(vec3(0.030, 0.066, 0.052), vec3(0.052, 0.100, 0.078), uDay);
    vec3 mid     = mix(vec3(0.070, 0.132, 0.104), vec3(0.096, 0.164, 0.126), uDay);
    vec3 horizon = mix(vec3(0.820, 0.600, 0.360), vec3(0.930, 0.760, 0.470), uDay);
    vec3 col = mix(mid, zenith, smoothstep(0.05, 0.62, h));
    float glow = pow(1.0 - clamp(abs(h - 0.02) * 3.2, 0.0, 1.0), 2.4);
    col = mix(col, horizon, glow * (0.50 + 0.28 * uDay));
    gl_FragColor = vec4(col, 1.0);
  }
`

function DawnSky({ progressRef, reduceMotion }: { progressRef: RefObject<number>; reduceMotion: boolean }) {
  const matRef = useRef<THREE.ShaderMaterial>(null)

  useFrame(() => {
    const mat = matRef.current
    if (mat) mat.uniforms.uDay.value = reduceMotion ? 0.1 : (progressRef.current ?? 0)
  })

  return (
    <mesh renderOrder={-2}>
      <sphereGeometry args={[88, 32, 20]} />
      <shaderMaterial
        ref={matRef}
        side={THREE.BackSide}
        depthWrite={false}
        uniforms={{ uDay: { value: 0 } }}
        vertexShader={SKY_VERT}
        fragmentShader={SKY_FRAG}
      />
    </mesh>
  )
}

// Soft additive glow low on the horizon — the sun about to break, placed over the
// right side of the frame where the vista used to be at its emptiest.
function DawnGlow() {
  const texture = useSoftMistTexture()
  return (
    <mesh position={[18, 3, -78]} renderOrder={-1}>
      <planeGeometry args={[85, 48]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.55}
        color="#F0B87A"
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  )
}

function DawnStars({ progressRef, reduceMotion }: { progressRef: RefObject<number>; reduceMotion: boolean }) {
  const matRef = useRef<THREE.PointsMaterial>(null)
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const count = 220
    const positions = new Float32Array(count * 3)
    // Deterministic LCG so the constellation is stable across mounts.
    let seed = 20260710
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    for (let i = 0; i < count; i++) {
      const theta = rand() * Math.PI * 2
      const y = 0.12 + rand() * 0.82
      const r = Math.sqrt(Math.max(0, 1 - y * y))
      const radius = 84
      positions[i * 3] = Math.cos(theta) * r * radius
      positions[i * 3 + 1] = y * radius
      positions[i * 3 + 2] = Math.sin(theta) * r * radius
    }
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return g
  }, [])

  useFrame(() => {
    const p = reduceMotion ? 0.1 : (progressRef.current ?? 0)
    // Stars burn off in the first third of the descent as the day arrives.
    if (matRef.current) matRef.current.opacity = 0.8 * (1 - Math.min(1, p / 0.35))
  })

  return (
    <points geometry={geometry} renderOrder={-1}>
      <pointsMaterial
        ref={matRef}
        size={1.4}
        sizeAttenuation={false}
        color="#D8E4DA"
        transparent
        opacity={0.8}
        depthWrite={false}
        fog={false}
      />
    </points>
  )
}

// Dawn cools everything at the peak; by the time you've descended to the treeline
// the light has turned warm, like real morning sun breaking through. Both the key
// light and the fog colour lerp together so the shift reads as one continuous event.
// The summit hold sits much further back (z=34) than the fog range this scene
// was tuned for (10–40), which buried the whole range in fog at p=0. Clear air
// at altitude, thickening as the camera descends into the valley mist.
function updateFogRange(fog: THREE.Fog, descent: number) {
  fog.near = 18 - descent * 8
  fog.far = 80 - descent * 40
}

/** Closes the air in for the current season, on top of the descent's own fog.
 *  `k` is 0 (as authored) → 1 (fully socked in). */
function applySeasonHaze(fog: THREE.Fog, color: THREE.Color, k: number) {
  fog.near -= fog.near * 0.55 * k
  fog.far -= fog.far * 0.5 * k
  fog.color.lerp(color, 0.5 * k)
}

const DAWN_LIGHT = new THREE.Color('#B9D3F0')
const MORNING_LIGHT = new THREE.Color('#F6D9A0')
const DAWN_FOG = new THREE.Color('#1c2f24')
const MORNING_FOG = new THREE.Color('#332c1c')

function Atmosphere({
  progressRef,
  reduceMotion,
  season,
}: {
  progressRef: RefObject<number>
  reduceMotion: boolean
  season: Season
}) {
  const lightRef = useRef<THREE.DirectionalLight>(null)
  const { scene } = useThree()
  const scratch = useRef(new THREE.Color())

  useFrame(() => {
    const p = reduceMotion ? 0.1 : (progressRef.current ?? 0)
    if (lightRef.current) {
      scratch.current.lerpColors(DAWN_LIGHT, MORNING_LIGHT, p)
      lightRef.current.color.copy(scratch.current)
      lightRef.current.intensity = 1.5 + p * 0.7
    }
    if (scene.fog && 'color' in scene.fog) {
      const fog = scene.fog as THREE.Fog
      scratch.current.lerpColors(DAWN_FOG, MORNING_FOG, p)
      fog.color.copy(scratch.current)
      // The summit hold sits much further back (z=34) than the fog range this
      // scene was tuned for (10–40), which buried the whole range in fog at p=0.
      // Clear air at altitude, thickening as the camera descends into the valley
      // mist — physically honest, and it makes the hero vista actually visible.
      updateFogRange(fog, Math.min(1, p / 0.3))

      // Then the season closes the air in on top of that. Monsoon is genuinely
      // socked in; winter is colder and only slightly hazier; the clear season
      // leaves the scene exactly as authored. Applied here rather than in
      // HeroWeather so that only one component ever writes scene.fog — two
      // writers per frame is how fog ends up flickering between two answers.
      const h = seasonHaze(season)
      if (h) applySeasonHaze(fog, h.color, h.haze * Math.min(1, h.floor + p * (1 - h.floor)))
    }
  })

  return <directionalLight ref={lightRef} position={[10, 14, 6]} intensity={1.5} color={DAWN_LIGHT} />
}

// Three-keyframe descent: HERO is the summit-dawn hold the page opens on (wide,
// high, the whole range in frame), START is the old flythrough entry, END is the
// treeline. p 0→0.3 blends HERO→START, 0.3→1 runs the original descent.
const HERO_POS = new THREE.Vector3(0, 17, 34)
const START_POS = new THREE.Vector3(0, 13, 26)
const END_POS = new THREE.Vector3(0, 3, 3.5)
const HERO_LOOK = new THREE.Vector3(0, 3.5, -14)
const START_LOOK = new THREE.Vector3(0, 2, -10)
const END_LOOK = new THREE.Vector3(0, 0.8, -20)
const HERO_PHASE = 0.3

// The seam between the two segments used to be a hitch you could feel.
//
// Segment one smoothstepped HERO→START, and smoothstep's derivative at t=1 is
// zero — the camera eased to a dead stop at p=0.3. Segment two is a straight
// lerp START→END, so its velocity is constant and non-zero from its first
// frame: (END-START)/0.7, about 35 world-units per unit of progress. The camera
// therefore halted and then lurched, instantaneously, at exactly the frame
// where act 1 hands over to act 2 — felt in both directions, and worst coming
// back up because you meet the kick while already decelerating.
//
// Fixed by giving segment one a cubic Hermite instead of an eased lerp: it
// still leaves the summit from rest (the push-off the hold is built on), but it
// ARRIVES at START already travelling at exactly the speed segment two departs
// at. Velocity is now continuous across the seam, so there is nothing to feel.
// The tangent has to be a vector, not an eased scalar — segment two leaves
// along END-START, which is not the direction segment one was travelling.
const POS_TANGENT = new THREE.Vector3()
  .subVectors(END_POS, START_POS)
  .multiplyScalar(HERO_PHASE / (1 - HERO_PHASE))
const LOOK_TANGENT = new THREE.Vector3()
  .subVectors(END_LOOK, START_LOOK)
  .multiplyScalar(HERO_PHASE / (1 - HERO_PHASE))

function pathLerp(
  out: THREE.Vector3,
  hero: THREE.Vector3,
  start: THREE.Vector3,
  end: THREE.Vector3,
  p: number,
  tangent: THREE.Vector3
) {
  if (p < HERO_PHASE) {
    // Cubic Hermite with a zero tangent at the summit and `tangent` on arrival.
    // h10 is dropped because its coefficient (the departure tangent) is zero.
    const t = p / HERO_PHASE
    const t2 = t * t
    const t3 = t2 * t
    const h00 = 2 * t3 - 3 * t2 + 1
    const h01 = -2 * t3 + 3 * t2
    const h11 = t3 - t2
    out.set(0, 0, 0)
      .addScaledVector(hero, h00)
      .addScaledVector(start, h01)
      .addScaledVector(tangent, h11)
  } else {
    out.lerpVectors(start, end, (p - HERO_PHASE) / (1 - HERO_PHASE))
  }
}

export interface DragState {
  yaw: number
  pitch: number
  active: boolean
}

// ─── Smoothing that does not depend on the monitor ───────────────────────────
//
// Everything below used a fixed per-FRAME lerp — `x += (target - x) * 0.04`.
// Two things are wrong with that, and together they are the reason the range
// did not feel like it was under the visitor's control.
//
// 1. IT IS NOT TIME-BASED. 0.04 a frame reaches 95% of its target in about 73
//    frames: 1.2 seconds on a 60Hz panel and 0.6 on the 120Hz one most of this
//    audience is holding. The same gesture produced a different move on
//    different machines, and whenever the frame rate dipped the drift slowed
//    with it — motion that wobbles with the frame rate reads as jitter even
//    when no frame is dropped.
//
// 2. IT IS FAR TOO SLOW. The camera kept sliding for over a second after the
//    pointer stopped. So a visitor who nudged the mouse and then scrolled had
//    the range moving for two reasons at once, only one of which they had
//    asked for — and when the cursor came to rest somewhere else it slid back.
//    That is the "it jitters back to a position" on the way up.
//
// `approach` is the standard exponential form, `1 - e^(-dt/tau)`, so `tau` is a
// real time constant in seconds and the result is identical at any refresh
// rate. The pointer now settles in about a tenth of a second: long enough to
// round off raw mouse jitter, short enough that when the mouse stops, the
// mountain stops.
const PARALLAX_TAU = 0.11
const DRAG_TAU = 0.09
const AMBIENT_TAU = 1.7
/** A tab returning from the background reports one enormous delta; clamping it
 *  keeps that from arriving as a lurch across the whole frame. */
const MAX_STEP = 0.05

function approach(current: number, target: number, tau: number, dt: number) {
  return current + (target - current) * (1 - Math.exp(-dt / tau))
}

function CameraRig({
  progressRef,
  reduceMotion,
  ambient,
  dragRef,
}: {
  progressRef: RefObject<number>
  reduceMotion: boolean
  ambient?: boolean
  dragRef: RefObject<DragState>
}) {
  const smoothed = useRef({ x: 0, y: 0 })
  // Plain refs, not useMemo — these are scratch vectors mutated in place every frame
  // (the standard r3f pattern, avoiding an allocation per frame); useMemo's result is
  // treated as immutable by this project's react-hooks lint rules, useRef is not.
  const pos = useRef(new THREE.Vector3())
  const look = useRef(new THREE.Vector3())
  const appliedDrag = useRef({ yaw: 0, pitch: 0 })

  useFrame(({ camera, pointer, size, clock }, delta) => {
    const dt = Math.min(delta, MAX_STEP)
    // Reduced motion holds just off the summit — the hero framing, held still.
    const p = reduceMotion ? 0.1 : (progressRef.current ?? 0)
    if (ambient) {
      // Touch devices have no hover parallax, so the vista breathes on its own —
      // a slow figure-eight drift through the same smoothing path the mouse uses,
      // making the mountain feel alive without asking the thumb for anything.
      const t = clock.elapsedTime
      smoothed.current.x = approach(smoothed.current.x, Math.sin(t * 0.11) * 0.55, AMBIENT_TAU, dt)
      smoothed.current.y = approach(smoothed.current.y, Math.cos(t * 0.07) * 0.3, AMBIENT_TAU, dt)
    } else {
      // Settles in about a tenth of a second, so the range is wherever the
      // pointer is and stops when the pointer stops. While somebody is
      // scrolling with the cursor at rest — which is most of the time — this
      // contributes exactly nothing, and the only thing moving the mountain is
      // the scroll.
      smoothed.current.x = approach(smoothed.current.x, pointer.x, PARALLAX_TAU, dt)
      smoothed.current.y = approach(smoothed.current.y, pointer.y, PARALLAX_TAU, dt)
    }

    // A tall/narrow (portrait) viewport shows far less horizontal terrain relative to
    // its height than the landscape framing this path was tuned for, leaving the ridge
    // as a thin band lost in empty fog. Pulling the camera down and pitching the look
    // target lower compensates so the terrain still fills the frame on phones.
    const aspect = size.width / size.height
    const portrait = Math.max(0, 0.85 - aspect)

    pathLerp(pos.current, HERO_POS, START_POS, END_POS, p, POS_TANGENT)
    pos.current.x += smoothed.current.x * 1.1
    pos.current.y += smoothed.current.y * 0.45 - portrait * 9
    camera.position.copy(pos.current)

    pathLerp(look.current, HERO_LOOK, START_LOOK, END_LOOK, p, LOOK_TANGENT)
    look.current.y -= portrait * 6
    camera.lookAt(look.current)

    // Click-and-drag free look, layered on top of the scroll path via a post-lookAt
    // rotation. The target snaps to zero the instant dragging stops, so releasing
    // eases the view back onto the path instead of leaving it stuck off-axis.
    const drag = dragRef.current
    const target = drag?.active ? drag : { yaw: 0, pitch: 0 }
    appliedDrag.current.yaw = approach(appliedDrag.current.yaw, target.yaw, DRAG_TAU, dt)
    appliedDrag.current.pitch = approach(appliedDrag.current.pitch, target.pitch, DRAG_TAU, dt)
    camera.rotateY(appliedDrag.current.yaw)
    camera.rotateX(appliedDrag.current.pitch)
  })
  return null
}

export default function TerrainScene({
  progressRef,
  reduceMotion,
  ambient,
  segments,
  treeCount,
  season,
  weather,
  dragRef,
  active,
  onReady,
  dawnFrom,
  dawnTo,
}: {
  progressRef: RefObject<number>
  reduceMotion: boolean
  /** The scrub window over which the camp's lamps and fire go out. Passed in
   *  from SummitHero's act-1 exit rather than hardcoded here, so "the range is
   *  inhabited for exactly as long as the brand story holds" stays true when
   *  that story's length changes — which it just did, by a factor of two. */
  dawnFrom: number
  dawnTo: number
  // Touch-consumption mode: no scroll scrub drives the camera, so it drifts on
  // its own clock instead of following the (nonexistent) hover pointer.
  ambient?: boolean
  segments: number
  treeCount: number
  /** Real current season — drives the hero's precipitation and haze. */
  season: Season
  /** Capability gate for the weather layer (off on touch/coarse pointer). */
  weather: boolean
  dragRef: RefObject<DragState>
  /** False once the hero has scrolled out of view — the render loop stops. */
  active: boolean
  onReady?: () => void
}) {
  return (
    <Canvas
      // ── MEASURE THE LAYOUT BOX, NOT THE PAINTED ONE ──────────────────────
      //
      // This is the reason the range lurched partway through act 1 and again
      // on the way back up.
      //
      // SummitHero scales this canvas's ancestor — `RANGE_ZOOM_ACT1` and then
      // `RANGE_ZOOM_END`, a CSS `scale` from 1 to 1.30 across the pin. R3F
      // sizes its renderer from react-use-measure, which by default reads
      // `getBoundingClientRect()` — and a bounding rect INCLUDES every
      // transform on the way up the tree. So the scaled canvas measured itself
      // as 1.15x its own layout box and resized to that, and the CSS scale then
      // multiplied on top: the visitor saw a 1.15 zoom snap to 1.32 in one
      // frame, with the camera's aspect ratio re-derived under it, which is the
      // sideways shift that came with the jump.
      //
      // It fired on a 50ms debounce off react-use-measure's own scroll
      // listener, so it landed at whatever moment the scroll stream paused —
      // mid-act-1 — and again as the scale unwound back to 1 at the top.
      //
      // `offsetSize` switches width/height to `offsetWidth`/`offsetHeight`,
      // which are layout values and immune to transforms: the canvas now stays
      // at its real 100vw x 100svh however far the range is zoomed, and the
      // scale is purely the visual push it was written to be.
      //
      // `scroll: false` retires the listener that was doing the sampling. Every
      // scroll event on the page re-measured this element behind a debounce,
      // and with the size no longer moving all that survives is left/top —
      // which R3F only reads for pointer maths under a non-default
      // `eventPrefix`. We use the default ('offset'), so those are unread, and
      // the ResizeObserver still catches every real size change.
      resize={{ offsetSize: true, scroll: false }}
      // Off-screen, nothing renders at all. The hero is pinned for 260% of
      // scroll and then done with; before this the scene kept drawing the full
      // camp at ~77 draw calls the whole time a visitor read the rest of the
      // page, which is most of the time they spend on it.
      frameloop={active ? 'always' : 'never'}
      // 1.6 was costing 2.6x the fragments of DPR 1 on a retina display, and MSAA
      // on top of that. At 1.3 the terrain is still clean — it is flat-shaded
      // low-poly with no fine detail to alias — and the fragment bill drops by
      // about 40%.
      dpr={[1, 1.3]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      // Far plane must clear the sky dome's far side (r=88 sphere seen from a
      // camera ~38 units off-centre), or the dawn sky gets clipped to void.
      camera={{ fov: 45, near: 0.5, far: 240, position: [0, 17, 34] }}
      className="!absolute inset-0"
      onCreated={() => onReady?.()}
    >
      <color attach="background" args={['#182b22']} />
      <fog attach="fog" args={['#1c2f24', 10, 40]} />
      <DawnSky progressRef={progressRef} reduceMotion={reduceMotion} />
      <DawnStars progressRef={progressRef} reduceMotion={reduceMotion} />
      <DawnGlow />
      <hemisphereLight args={['#cfe0c8', '#0c100d', 0.75]} />
      <Atmosphere progressRef={progressRef} reduceMotion={reduceMotion} season={weather ? season : 'clear'} />
      <ambientLight intensity={0.15} />
      <group position={[0, -1.5, -10]}>
        <Terrain segments={segments} />
        <Trees count={treeCount} />
        <TrailPath progressRef={progressRef} reduceMotion={reduceMotion} />
        <Shelters
          progressRef={progressRef}
          reduceMotion={reduceMotion}
          dawnFrom={dawnFrom}
          dawnTo={dawnTo}
        />
      </group>
      <HeroWeather season={season} reduceMotion={reduceMotion} enabled={weather} />
      <DriftingMist />
      <CameraRig progressRef={progressRef} reduceMotion={reduceMotion} ambient={ambient} dragRef={dragRef} />
    </Canvas>
  )
}
