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
function rawHeight(x: number, z: number) {
  let h = 0
  let amp = 1
  let freq = 0.032
  for (let o = 0; o < 5; o++) {
    const n = terrainNoise(x * freq, z * freq)
    h += (1 - Math.abs(n)) * amp
    amp *= 0.52
    freq *= 2.1
  }
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

function worldY(x: number, z: number) {
  return rawHeight(x, z) * 3.4 - 4.5
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
    if (t < 0.4) c.lerpColors(ROCK_LOW, ROCK_MID, t / 0.4)
    else if (t < 0.72) c.lerpColors(ROCK_MID, SAGE, (t - 0.4) / 0.32)
    else c.lerpColors(SAGE, SNOW, (t - 0.72) / 0.28)
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
const SHELTERS = [
  { x: -17, z: -5, scale: 1.5, phase: 0.0, turn: 0.5 },
  { x: 15, z: -11, scale: 1.3, phase: 2.1, turn: -0.6 },
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

function Shelters({ progressRef, reduceMotion }: { progressRef: RefObject<number>; reduceMotion: boolean }) {
  const lamp = useLampTexture()
  const glowRefs = useRef<(THREE.Sprite | null)[]>([])
  const windowRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([])

  useFrame(({ clock }) => {
    const p = reduceMotion ? 0.1 : (progressRef.current ?? 0)
    const dawn = 1 - Math.min(1, p / 0.4)
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
          </group>
        )
      })}
    </group>
  )
}


// Built ground is cleared ground. The arrival camp used to hold a 4.4-unit
// clearing here for the cabin and the fire; with those gone the pines close back
// over the site, because a bald patch of hillside with nothing standing in it is
// just a hole in the forest.
const CLEARINGS: readonly { x: number; z: number; r: number }[] = SHELTERS.map((s) => ({
  x: s.x,
  z: s.z,
  r: 1.7,
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

function pathLerp(out: THREE.Vector3, hero: THREE.Vector3, start: THREE.Vector3, end: THREE.Vector3, p: number) {
  if (p < HERO_PHASE) {
    // Smoothstep the summit-to-entry blend so leaving the hold feels like a
    // push-off rather than a linear slide.
    const t = p / HERO_PHASE
    out.lerpVectors(hero, start, t * t * (3 - 2 * t))
  } else {
    out.lerpVectors(start, end, (p - HERO_PHASE) / (1 - HERO_PHASE))
  }
}

export interface DragState {
  yaw: number
  pitch: number
  active: boolean
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

  useFrame(({ camera, pointer, size, clock }) => {
    // Reduced motion holds just off the summit — the hero framing, held still.
    const p = reduceMotion ? 0.1 : (progressRef.current ?? 0)
    if (ambient) {
      // Touch devices have no hover parallax, so the vista breathes on its own —
      // a slow figure-eight drift through the same smoothing path the mouse uses,
      // making the mountain feel alive without asking the thumb for anything.
      const t = clock.elapsedTime
      smoothed.current.x += (Math.sin(t * 0.11) * 0.55 - smoothed.current.x) * 0.02
      smoothed.current.y += (Math.cos(t * 0.07) * 0.3 - smoothed.current.y) * 0.02
    } else {
      smoothed.current.x += (pointer.x - smoothed.current.x) * 0.04
      smoothed.current.y += (pointer.y - smoothed.current.y) * 0.04
    }

    // A tall/narrow (portrait) viewport shows far less horizontal terrain relative to
    // its height than the landscape framing this path was tuned for, leaving the ridge
    // as a thin band lost in empty fog. Pulling the camera down and pitching the look
    // target lower compensates so the terrain still fills the frame on phones.
    const aspect = size.width / size.height
    const portrait = Math.max(0, 0.85 - aspect)

    pathLerp(pos.current, HERO_POS, START_POS, END_POS, p)
    pos.current.x += smoothed.current.x * 1.1
    pos.current.y += smoothed.current.y * 0.45 - portrait * 9
    camera.position.copy(pos.current)

    pathLerp(look.current, HERO_LOOK, START_LOOK, END_LOOK, p)
    look.current.y -= portrait * 6
    camera.lookAt(look.current)

    // Click-and-drag free look, layered on top of the scroll path via a post-lookAt
    // rotation. The target snaps to zero the instant dragging stops, so releasing
    // eases the view back onto the path instead of leaving it stuck off-axis.
    const drag = dragRef.current
    const target = drag?.active ? drag : { yaw: 0, pitch: 0 }
    appliedDrag.current.yaw += (target.yaw - appliedDrag.current.yaw) * 0.08
    appliedDrag.current.pitch += (target.pitch - appliedDrag.current.pitch) * 0.08
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
}: {
  progressRef: RefObject<number>
  reduceMotion: boolean
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
        <Shelters progressRef={progressRef} reduceMotion={reduceMotion} />
      </group>
      <HeroWeather season={season} reduceMotion={reduceMotion} enabled={weather} />
      <DriftingMist />
      <CameraRig progressRef={progressRef} reduceMotion={reduceMotion} ambient={ambient} dragRef={dragRef} />
    </Canvas>
  )
}
