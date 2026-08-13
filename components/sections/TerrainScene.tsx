'use client'

import { useEffect, useMemo, useRef, type ComponentProps, type RefObject } from 'react'
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
      // Built ground is cleared ground. CLEARINGS is derived from ARRIVAL and
      // SHELTERS further down the file; reading it here is safe because effects
      // run long after module evaluation.
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

// A small pulsing marker at each waypoint — the in-world anchor the DOM label
// (rendered by the parent, projected to screen space) visually latches onto.
// All markers stay dark during the summit hold and fade in with the descent,
// matching their DOM labels — the hold belongs to the headline alone; the pins
// are what the descent reveals.
function WaypointMarkers({ progressRef, reduceMotion }: { progressRef: RefObject<number>; reduceMotion: boolean }) {
  const ringRefs = useRef<(THREE.Mesh | null)[]>([])
  const dotMatRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([])

  useFrame(({ clock }) => {
    const p = reduceMotion ? 0.1 : (progressRef.current ?? 0)
    WAYPOINTS.forEach((w, i) => {
      const gate = Math.min(1, Math.max(0, (p - (w.kind === 'trek' ? 0.16 : 0.13)) / 0.1))
      const ring = ringRefs.current[i]
      if (ring) {
        const t = (clock.elapsedTime + i * 1.3) % 2.6
        ring.scale.setScalar(1 + t * 2.2)
        const material = ring.material as THREE.MeshBasicMaterial
        material.opacity = Math.max(0, 0.55 - t * 0.24) * gate
      }
      const dotMat = dotMatRefs.current[i]
      if (dotMat) dotMat.opacity = gate
    })
  })

  return (
    <>
      {WAYPOINTS.map((w, i) => (
        <group key={w.id} position={[w.x, worldY(w.x, w.z) + 0.12, w.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.11, 16]} />
            <meshBasicMaterial
              ref={(el) => {
                dotMatRefs.current[i] = el
              }}
              color="#F6F3EA"
              transparent
              fog={false}
            />
          </mesh>
          <mesh
            ref={(el) => {
              ringRefs.current[i] = el
            }}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.14, 0.18, 24]} />
            <meshBasicMaterial color={w.kind === 'trek' ? '#B8826B' : '#7BA46F'} transparent opacity={0.5} fog={false} />
          </mesh>
        </group>
      ))}
    </>
  )
}

// Projects each waypoint's 3D position to on-screen percentages every frame and hands
// it to the DOM wrapper via callback — no React state, so this never triggers a
// re-render, just an imperative style update on plain positioned <Link> elements.
function Waypoints({ onProject }: { onProject: (states: Record<string, WaypointScreenState>) => void }) {
  const worldPositions = useMemo(() => {
    const map: Record<string, THREE.Vector3> = {}
    for (const w of WAYPOINTS) {
      map[w.id] = new THREE.Vector3(w.x, worldY(w.x, w.z) + w.labelHeight, w.z).add(GROUP_OFFSET)
    }
    return map
  }, [])
  const scratch = useRef(new THREE.Vector3())

  useFrame(({ camera }) => {
    const states: Record<string, WaypointScreenState> = {}
    for (const w of WAYPOINTS) {
      scratch.current.copy(worldPositions[w.id])
      scratch.current.project(camera)
      const visible =
        scratch.current.z < 1 && Math.abs(scratch.current.x) < 1.1 && Math.abs(scratch.current.y) < 1.1
      states[w.id] = {
        x: ((scratch.current.x + 1) / 2) * 100,
        y: ((1 - scratch.current.y) / 2) * 100,
        visible,
      }
    }
    onProject(states)
  })
  return null
}

// A hand-rolled radial-gradient sprite instead of drei's <Cloud> — that component's
// per-instance opacity compounds across overlapping puffs in a way that's hard to
// predict (a "thin mist" reads as a solid white wash once a dozen puffs overlap).
// Flat, low, individually-controlled billboards give a mist floor without that risk.
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

// ─── The arrival ─────────────────────────────────────────────────────────────
// What the descent is *for*.
//
// The camera path ends low in the valley at world (0, 3, 3.5) looking at
// (0, 0.8, -20) — so this sits right on that focus point, and only resolves in
// the last quarter of the scroll. Two lit windows, a chimney, a woodpile, and
// someone outside who waves as you arrive.
//
// It is hidden (and skipped entirely by the renderer) above the mountain, so it
// costs nothing for the 75% of the descent where you cannot see it.
//
// ── Why these exact coordinates ──────────────────────────────────────────────
// The first pass put this on the far side of the valley and it was invisible —
// not unrendered, *occluded*. The end camera sits low, and the ridge at world
// z ≈ -9.7 crests at y 4.35 while the sight line to the old site was at 3.18, so
// the mountain itself was standing in front of the house. The whole far bowl is
// walled off from this camera; the only ground it can actually see is the near
// slope. So the site was re-solved by marching the camera→house segment against
// the height field at four points across the fade (p = 0.78 → 1.0) and keeping
// only positions where both the base and the roofline clear the terrain the
// entire way. Local (2, 4) came out best: in frame the whole time, drifting from
// roughly 900px to 987px across as you descend, and ~9.6 units out at the end —
// close enough to read as detail rather than as a distant speck.
const ARRIVAL = { x: 2, z: 4 } as const
const ARRIVE_FROM = 0.72
/** Scaled so the house lands ~200px tall at the final camera distance. */
const ARRIVAL_SCALE = 0.85
/** Three-quarter view: square-on to the end camera would be -0.21rad, and a flat
 *  elevation is the least legible way to draw a building. The extra turn shows
 *  the front face and one gable wall. */
const ARRIVAL_TURN = 0.24
const HOUSE_W = 1.9
const HOUSE_D = 1.5
// ── The camp ─────────────────────────────────────────────────────────────────
// A single figure standing next to a house was the weakest thing in the scene:
// at ~90px a lone body reads as a doll, because there is nothing for it to be
// doing. A fire fixes that in three ways at once. It gives the figures a reason
// to be arranged the way they are, it gives them a light source to be lit by,
// and it is the one image that actually says "the walk is over" — which is what
// this whole descent has been building toward.
//
// All three sit forward of the house (larger local z = nearer the camera), so
// the composition stacks: lit house behind and above, camp in front and below.
// Positions were projected against the height field first — fire lands at
// roughly px 981 at the end of the descent, directly under the house, with the
// two figures flanking it at 888 and 1092.
const FIRE_AT = { x: -1.3, z: 2.6 } as const
// Where the seat log lies. The spot it inherited was chosen to frame a seated
// figure, and with the figure gone a log that far out just read as a fallen tree.
// This one is 0.55 from the flame and lands about 56px to its left — close enough
// to be furniture, on ground that barely drops between the two.
const SEAT_LOG_AT = { x: -1.82, z: 2.79 } as const

/** Group-local (x, z) → terrain-space (x, z), undoing the group's turn and scale.
 *  Needed by anything that has to sample the ground it stands on, and by the
 *  firelight, which lives outside the group entirely. */
function siteToTerrain(lx: number, lz: number): [number, number] {
  const s = Math.sin(ARRIVAL_TURN)
  const c = Math.cos(ARRIVAL_TURN)
  return [ARRIVAL.x + ARRIVAL_SCALE * (lx * c + lz * s), ARRIVAL.z + ARRIVAL_SCALE * (-lx * s + lz * c)]
}

/** Height of the ground under a group-local spot, expressed in the group's own
 *  units — so a figure standing 3 units from the house still has its feet on the
 *  slope rather than hovering over it. */
function siteOffset(lx: number, lz: number, seat: number) {
  const [tx, tz] = siteToTerrain(lx, lz)
  return (worldY(tx, tz) - seat) / ARRIVAL_SCALE
}

/** Which way to turn so a figure looks at the fire. Derived, not hand-tuned, so
 *  moving the fire turns everyone sitting around it. */
function faceFire(from: { x: number; z: number }) {
  return Math.atan2(FIRE_AT.x - from.x, FIRE_AT.z - from.z)
}

// Ground the forest leaves alone, because something is built on it. Derived from
// the structures themselves so the two can never drift apart — move the house and
// its clearing moves with it.
const CLEARINGS: readonly { x: number; z: number; r: number }[] = [
  // Wide: covers the house, the hiker standing off the gable, and enough room
  // that the home isn't crowded at the end of the descent.
  { x: ARRIVAL.x, z: ARRIVAL.z, r: 4.4 },
  // Tight: the ridge huts are meant to sit *in* the treeline, half-found.
  ...SHELTERS.map((s) => ({ x: s.x, z: s.z, r: 1.7 })),
]

/** Lowest point under the house's footprint. Seating on the minimum rather than
 *  the centre means a corner can never hang in the air on a sloped pad — the
 *  house cuts into the hill instead, which is how they're actually built here. */
function seatHeight(cx: number, cz: number) {
  const hw = (HOUSE_W * ARRIVAL_SCALE) / 2
  const hd = (HOUSE_D * ARRIVAL_SCALE) / 2
  let min = worldY(cx, cz)
  for (const dx of [-hw, hw]) {
    for (const dz of [-hd, hd]) min = Math.min(min, worldY(cx + dx, cz + dz))
  }
  return min
}

/** A soft radial patch, for grounding something that stands on the terrain. */
function useShadeTexture() {
  return useMemo(() => {
    const size = 64
    const c = document.createElement('canvas')
    c.width = c.height = size
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    g.addColorStop(0, 'rgba(0,0,0,0.62)')
    g.addColorStop(0.4, 'rgba(0,0,0,0.34)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    return new THREE.CanvasTexture(c)
  }, [])
}

// ─── Ground decals ───────────────────────────────────────────────────────────
// Contact shadow under each figure, and the pool of firelight on the grass.
//
// Both were flat planes to begin with, and on this slope a flat plane sinks into
// the hill on the uphill side and hangs over it on the downhill side. Worse, the
// missing shadows were the actual reason the whole camp looked like it was
// hovering: the geometry was seated correctly the whole time — the house base
// measures 0.31 *below* the terrain — but with no shadow and a camera this close
// to the slope's own angle, nothing told the eye where the ground was.
//
// So these sample the height field at every vertex and drape over the terrain.
// A 8×8 grid is 128 triangles and one draw call, and it costs nothing for the
// three quarters of the descent where the camp isn't drawn.
//
// Authored in terrain space, outside the arrival group, so there's no unwinding
// of that group's turn and scale to do.
function GroundDecal({
  cx,
  cz,
  size,
  map,
  color,
  additive,
  strength,
  order = 1,
  fadeRef,
  flickRef,
}: {
  cx: number
  cz: number
  size: number
  map: THREE.Texture
  color: string
  additive?: boolean
  strength: number
  /** Draw order among the decals — firelight goes over contact shade, not under. */
  order?: number
  fadeRef: RefObject<number>
  /** Optional flutter, so the firelight pool breathes with the flame. */
  flickRef?: RefObject<number>
}) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null)
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(size, size, 8, 8)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position
    // Lifted a hair off the surface — enough to clear z-fighting, not enough to
    // read as a floating sheet.
    for (let i = 0; i < pos.count; i++) pos.setY(i, worldY(cx + pos.getX(i), cz + pos.getZ(i)) + 0.035)
    pos.needsUpdate = true
    return g
  }, [cx, cz, size])

  useFrame(() => {
    const m = matRef.current
    if (!m) return
    const k = fadeRef.current ?? 0
    m.opacity = k * strength * (flickRef?.current ?? 1)
    m.visible = m.opacity > 0.004
  })

  return (
    <mesh geometry={geometry} position={[cx, 0, cz]} renderOrder={order}>
      <meshBasicMaterial
        ref={matRef}
        map={map}
        color={color}
        transparent
        opacity={0}
        depthWrite={false}
        blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </mesh>
  )
}

// Embers off the fire and smoke off the chimney are the same problem — particles
// that rise, spread, swell and fade — so they are the same shader, twice. Same
// trick the weather layer uses: positions upload once, every particle's whole
// life is a fract() of time in the vertex shader, so a frame costs one uniform
// write and one draw call each. Two of these together are cheaper than a single
// JS-animated sprite loop would be.
const RISE_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uRise;
  uniform float uSpan;
  uniform float uSize;
  uniform float uGrow;
  uniform float uSpread;
  attribute float aSeed;
  varying float vLife;

  void main() {
    // Each particle runs its own 0→1 life, offset by its seed, so they never
    // pulse in unison the way a shared clock would make them.
    float life = fract(aSeed + uTime * uRise);
    vec3 p = position;
    p.y += life * uSpan;
    p.x += sin(aSeed * 31.0 + uTime * 1.7) * uSpread * life;
    p.z += cos(aSeed * 23.0 + uTime * 1.3) * uSpread * life;
    vLife = life;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = clamp(uSize * (1.0 + life * uGrow) * (18.0 / max(-mv.z, 1.0)), 1.0, 60.0);
    gl_Position = projectionMatrix * mv;
  }
`

const RISE_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uFade;
  varying float vLife;

  void main() {
    // In fast, out slow — an ember flares the instant it leaves the fire and
    // dies out over the rest of its climb.
    float life = smoothstep(0.0, 0.10, vLife) * (1.0 - smoothstep(0.40, 1.0, vLife));
    float a = texture2D(uMap, gl_PointCoord).a * life * uOpacity * uFade;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
  }
`

function RisingParticles({
  count,
  radius,
  rise,
  span,
  size,
  grow,
  spread,
  color,
  opacity,
  map,
  additive,
  fadeRef,
  ...props
}: {
  count: number
  radius: number
  rise: number
  span: number
  size: number
  grow: number
  spread: number
  color: string
  opacity: number
  map: THREE.Texture
  additive?: boolean
  /** The arrival's own fade. Custom shaders don't honour material.opacity, so
   *  the group-wide fade has to be handed in as a uniform. */
  fadeRef: RefObject<number>
} & ComponentProps<'points'>) {
  const matRef = useRef<THREE.ShaderMaterial>(null)

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    let seed = 771049
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    for (let i = 0; i < count; i++) {
      // Scattered in a disc, not a square — a square spawn area is visible as
      // soon as the particles are big enough to see individually.
      const a = rand() * Math.PI * 2
      const r = Math.sqrt(rand()) * radius
      pos[i * 3] = Math.cos(a) * r
      pos[i * 3 + 1] = 0
      pos[i * 3 + 2] = Math.sin(a) * r
      seeds[i] = rand()
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    return g
  }, [count, radius])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uRise: { value: rise },
      uSpan: { value: span },
      uSize: { value: size },
      uGrow: { value: grow },
      uSpread: { value: spread },
      uMap: { value: map },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uFade: { value: 0 },
    }),
    [rise, span, size, grow, spread, map, color, opacity],
  )

  useFrame(({ clock }) => {
    const m = matRef.current
    if (!m) return
    m.uniforms.uTime.value = clock.elapsedTime
    m.uniforms.uFade.value = fadeRef.current ?? 0
  })

  return (
    <points geometry={geometry} frustumCulled={false} {...props}>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={RISE_VERT}
        fragmentShader={RISE_FRAG}
        transparent
        depthWrite={false}
        blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending}
        // Tells the arrival's fade pass to leave this material alone.
        userData={{ selfFade: true }}
      />
    </points>
  )
}

// ─── The cabin ───────────────────────────────────────────────────────────────
// Built once, into a single merged, vertex-coloured geometry: plinth, walls,
// roof, ridge, eaves, chimney, door and step are all one draw call. Previously
// each was its own mesh — fourteen draw calls for a building that never moves
// and never changes colour. The tree geometry in this file already works this
// way, and paintGeometry/mergeGeometries are the same helpers.
//
// Colour lives in the vertices, so the variety costs nothing: weathered stone
// under warm timber under a greyer, colder roof.
const CABIN_STONE = new THREE.Color('#4B443C')
const CABIN_WALL = new THREE.Color('#6B5540')
const CABIN_ROOF = new THREE.Color('#7C6853')
const CABIN_RIDGE = new THREE.Color('#5A4B3C')
const CABIN_DARK = new THREE.Color('#33261A')

function buildCabinGeometry() {
  const parts: THREE.BufferGeometry[] = []
  const add = (geo: THREE.BufferGeometry, color: THREE.Color) => parts.push(paintGeometry(geo, color))

  // Dry-stone footing, proud of the walls. Deep enough that no slope can open a
  // gap under the sill.
  const plinth = new THREE.BoxGeometry(2.04, 0.6, 1.64)
  plinth.translate(0, -0.16, 0)
  add(plinth, CABIN_STONE)

  const walls = new THREE.BoxGeometry(1.9, 1.0, 1.5)
  walls.translate(0, 0.5, 0)
  add(walls, CABIN_WALL)

  // Hip roof. A 4-sided cone is a square pyramid and the plan is 1.9 x 1.5, so
  // it is squashed on Z after the 45° turn — as a vertex operation here, which is
  // the same order the old parent-group scale achieved.
  const roof = new THREE.ConeGeometry(1.57, 0.68, 4)
  roof.rotateY(Math.PI / 4)
  roof.scale(1, 1, 0.82)
  roof.translate(0, 1.22, 0)
  add(roof, CABIN_ROOF)

  // Ridge cap. One board that gives the roof an edge to catch the firelight
  // instead of reading as a smooth cone. An earlier pass also ran fascia boards
  // along the eaves, but at 2.24 wide they stuck out past the roofline and read
  // as planks floating beside the building.
  const ridge = new THREE.BoxGeometry(0.16, 0.07, 0.16)
  ridge.translate(0, 1.55, 0)
  add(ridge, CABIN_RIDGE)

  const chimney = new THREE.BoxGeometry(0.22, 0.62, 0.22)
  chimney.translate(0.55, 1.52, 0.15)
  add(chimney, CABIN_STONE)
  const cap = new THREE.BoxGeometry(0.3, 0.07, 0.3)
  cap.translate(0.55, 1.86, 0.15)
  add(cap, CABIN_RIDGE)

  const door = new THREE.BoxGeometry(0.4, 0.68, 0.03)
  door.translate(-0.45, 0.34, 0.755)
  add(door, CABIN_DARK)
  const step = new THREE.BoxGeometry(0.54, 0.1, 0.24)
  step.translate(-0.45, 0.05, 0.87)
  add(step, CABIN_STONE)

  // Glazing bars. At this size an unbroken rectangle of light reads as a hole cut
  // in the wall; two crossed bars turn it into a window.
  for (const wx of [0.42, -0.95]) {
    const bar = new THREE.BoxGeometry(0.028, 0.34, 0.012)
    bar.translate(wx, 0.62, 0.762)
    add(bar, CABIN_DARK)
    const sill = new THREE.BoxGeometry(0.42, 0.026, 0.012)
    sill.translate(wx, 0.62, 0.762)
    add(sill, CABIN_DARK)
  }

  const merged = mergeGeometries(parts, false)
  merged.computeVertexNormals()
  for (const part of parts) part.dispose()
  return merged
}

/** The two lit panes as one geometry — they always share a brightness.
 *  `scale` sizes each quad in place. It cannot be applied to the merged result:
 *  scaling that would scale the pane POSITIONS as well, which flung the bloom
 *  quads clean off the wall and left a pale blob hanging beside the cabin. */
function buildWindowGeometry(z: number, scale = 1) {
  const parts = [0.42, -0.95].map((wx) => {
    const pane = new THREE.PlaneGeometry(0.42 * scale, 0.34 * scale)
    pane.translate(wx, 0.62, z)
    return pane
  })
  const merged = mergeGeometries(parts, false)
  for (const part of parts) part.dispose()
  return merged
}

/** Stone ring plus the log pile inside it, merged. */
function buildFireBaseGeometry() {
  const parts: THREE.BufferGeometry[] = []
  const ring = new THREE.TorusGeometry(0.26, 0.045, 5, 9)
  ring.rotateX(-Math.PI / 2)
  ring.translate(0, 0.03, 0)
  parts.push(paintGeometry(ring, new THREE.Color('#44423C')))
  for (let i = 0; i < 3; i++) {
    const log = new THREE.CylinderGeometry(0.038, 0.045, 0.42, 5)
    log.rotateX(-1.15)
    log.translate(0, 0.055, 0.05)
    log.rotateY((i * Math.PI * 2) / 3 + 0.4)
    parts.push(paintGeometry(log, new THREE.Color('#33251A')))
  }
  const merged = mergeGeometries(parts, false)
  merged.computeVertexNormals()
  for (const part of parts) part.dispose()
  return merged
}

/** Outer flame over a paler core, merged and vertex-coloured — both are additive
 *  and both flicker together, so there is no reason for two draw calls. */
function buildFlameGeometry() {
  const outer = new THREE.ConeGeometry(0.115, 0.32, 6)
  outer.translate(0, 0.15, 0)
  const inner = new THREE.ConeGeometry(0.058, 0.19, 6)
  inner.translate(0, 0.11, 0)
  const merged = mergeGeometries(
    [paintGeometry(outer, new THREE.Color('#C25A12')), paintGeometry(inner, new THREE.Color('#FFD9A0'))],
    false
  )
  outer.dispose()
  inner.dispose()
  return merged
}

function Arrival({ progressRef, reduceMotion }: { progressRef: RefObject<number>; reduceMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null)
  const flameRef = useRef<THREE.Mesh>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  const fadeRef = useRef(0)
  const fireFlickRef = useRef(1)
  const lamp = useLampTexture()
  const shade = useShadeTexture()
  const mist = useSoftMistTexture()

  const cabin = useMemo(() => buildCabinGeometry(), [])
  const panes = useMemo(() => buildWindowGeometry(0.756), [])
  const glow = useMemo(() => buildWindowGeometry(0.785, 2.9), [])
  const fireBase = useMemo(() => buildFireBaseGeometry(), [])
  const flame = useMemo(() => buildFlameGeometry(), [])

  const y = useMemo(() => seatHeight(ARRIVAL.x, ARRIVAL.z), [])
  const fireY = useMemo(() => siteOffset(FIRE_AT.x, FIRE_AT.z, y), [y])
  const logY = useMemo(() => siteOffset(SEAT_LOG_AT.x, SEAT_LOG_AT.z, y), [y])
  // Terrain-space anchors for the ground decals, which live outside the group.
  const fireXZ = useMemo(() => siteToTerrain(FIRE_AT.x, FIRE_AT.z), [])
  const logXZ = useMemo(() => siteToTerrain(SEAT_LOG_AT.x, SEAT_LOG_AT.z), [])
  const firePos = useMemo<[number, number, number]>(() => {
    const [tx, tz] = siteToTerrain(FIRE_AT.x, FIRE_AT.z)
    // Held above the logs: sat down in the flame, inverse-square blew the nearest
    // wood out to white while everything a metre away stayed dark.
    return [tx, worldY(tx, tz) + 0.78, tz]
  }, [])

  useFrame(({ clock }) => {
    // Reduced motion holds the camera just off the summit (see CameraRig), so the
    // arrival has to read the same progress the camera does — at p = 1 the camp
    // would switch on at full opacity as a speck on a slope you never descend.
    const p = reduceMotion ? 0.1 : (progressRef.current ?? 0)
    const k = Math.min(1, Math.max(0, (p - ARRIVE_FROM) / (1 - ARRIVE_FROM)))
    fadeRef.current = k
    const t = clock.elapsedTime
    // Two flutters, not one. The windows are an oil lamp behind glass — slow and
    // steady. The fire is open flame — faster and much wider. Sharing a single
    // curve made the whole camp pulse in unison, which reads as an animation
    // rather than as two different kinds of burning.
    const lampFlicker = 0.86 + Math.sin(t * 3.1) * 0.08 + Math.sin(t * 7.7) * 0.06
    const fireFlicker = 0.74 + Math.sin(t * 7.9) * 0.14 + Math.sin(t * 13.3) * 0.12
    fireFlickRef.current = fireFlicker

    // The light is always mounted and only its intensity moves. Adding or removing
    // a light forces every lit material in the scene to recompile its shader, and
    // doing that at the moment of reveal would hitch exactly where the page most
    // needs to be smooth.
    if (lightRef.current) lightRef.current.intensity = k * fireFlicker * 3.4

    const g = groupRef.current
    if (g) {
      // visible=false skips the draw calls entirely for most of the descent.
      g.visible = k > 0.01
      if (!g.visible) return
    }

    // Materials opt into a brightness ceiling and a flutter through userData, so a
    // glow can sit at 0.7 and a flame can gutter without either needing its own
    // ref threaded up here.
    if (g) {
      g.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined
        if (!m || !('opacity' in m) || m.userData.selfFade) return
        const base = (m.userData.baseOpacity as number) ?? 1
        const flick = m.userData.flick === 'fire' ? fireFlicker : m.userData.flick === 'lamp' ? lampFlicker : 1
        m.opacity = k * base * flick
      })
    }

    // The flame breathes rather than scaling uniformly — taller and thinner as it
    // flares, which is the shape change that reads as fire.
    if (flameRef.current) {
      flameRef.current.scale.set(0.94 + fireFlicker * 0.14, 0.72 + fireFlicker * 0.42, 0.94 + fireFlicker * 0.14)
      flameRef.current.rotation.y = Math.sin(t * 2.3) * 0.3
    }
  })

  return (
    <>
      {/* Firelight. Deliberately outside the group that gets hidden — see the
          recompile note in the frame loop. Tight distance so it warms the camp,
          the near wall and the ground it stands on, and reaches nothing else. */}
      <pointLight ref={lightRef} position={firePos} color="#FF9A3C" intensity={0} distance={8} decay={2} />

      {/* Ground contact. Without these the camp reads as hovering even though
          every piece of it is seated correctly — see the note on GroundDecal. */}
      <GroundDecal cx={ARRIVAL.x} cz={ARRIVAL.z} size={3.0} map={shade} color="#0A120C" strength={0.45} fadeRef={fadeRef} />
      <GroundDecal cx={logXZ[0]} cz={logXZ[1]} size={1.1} map={shade} color="#0A120C" strength={0.4} fadeRef={fadeRef} />
      <GroundDecal
        cx={fireXZ[0]}
        cz={fireXZ[1]}
        size={2.4}
        map={lamp}
        color="#FFFFFF"
        additive
        order={2}
        strength={0.62}
        fadeRef={fadeRef}
        flickRef={fireFlickRef}
      />

      <group ref={groupRef} position={[ARRIVAL.x, y, ARRIVAL.z]} rotation={[0, ARRIVAL_TURN, 0]} scale={ARRIVAL_SCALE}>
        {/* The cabin — one mesh, one material, one draw call. */}
        <mesh geometry={cabin}>
          <meshStandardMaterial vertexColors emissive="#2E2113" emissiveIntensity={0.3} roughness={0.9} transparent opacity={0} />
        </mesh>

        {/* The lit panes, and their spill onto the wall. fog={false} on both:
            weather can dim the mountain, but it can never put the house out. */}
        <mesh geometry={panes}>
          <meshBasicMaterial color="#FFD489" transparent opacity={0} fog={false} userData={{ flick: 'lamp' }} />
        </mesh>
        <mesh geometry={glow}>
          <meshBasicMaterial
            map={lamp}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            fog={false}
            userData={{ baseOpacity: 0.5, flick: 'lamp' }}
          />
        </mesh>

        {/* Chimney smoke — the one detail that says somebody lit the stove before
            you got here, and the reason the chimney is worth having. */}
        <RisingParticles
          position={[0.55, 1.9, 0.15]}
          count={14}
          radius={0.08}
          rise={0.13}
          span={2.4}
          size={7}
          grow={2.8}
          spread={0.55}
          color="#9AA096"
          opacity={0.15}
          map={mist}
          fadeRef={fadeRef}
        />

        {/* ── The fire ── */}
        <group position={[FIRE_AT.x, fireY, FIRE_AT.z]}>
          <mesh geometry={fireBase}>
            <meshStandardMaterial vertexColors roughness={1} transparent opacity={0} />
          </mesh>
          <mesh ref={flameRef} geometry={flame} position={[0, 0.13, 0]}>
            <meshBasicMaterial
              vertexColors
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              fog={false}
              userData={{ baseOpacity: 0.72, flick: 'fire' }}
            />
          </mesh>
          <sprite position={[0, 0.2, 0]} scale={1.05}>
            <spriteMaterial
              map={lamp}
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              fog={false}
              userData={{ baseOpacity: 0.6, flick: 'fire' }}
            />
          </sprite>
          <RisingParticles
            position={[0, 0.2, 0]}
            count={26}
            radius={0.14}
            rise={0.42}
            span={1.5}
            size={1.7}
            grow={0.5}
            spread={0.3}
            color="#FFB259"
            opacity={0.95}
            map={lamp}
            additive
            fadeRef={fadeRef}
          />
        </group>

        {/* A log to sit on, laid across the fire rather than pointing at it.
            Empty on purpose: an unoccupied seat by a lit fire says someone is
            here without having to draw them. */}
        <mesh
          position={[SEAT_LOG_AT.x, logY + 0.1, SEAT_LOG_AT.z]}
          rotation={[0, faceFire(SEAT_LOG_AT) + Math.PI / 2, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.115, 0.107, 0.8, 7]} />
          {/* Lighter than a shadowed log would be, so the firelight actually
              registers on it and it reads as a seat someone left. */}
          <meshStandardMaterial color="#4E3A28" roughness={1} transparent opacity={0} />
        </mesh>
      </group>
    </>
  )
}

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
  onWaypointProject,
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
  onWaypointProject: (states: Record<string, WaypointScreenState>) => void
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
        <WaypointMarkers progressRef={progressRef} reduceMotion={reduceMotion} />
        <Shelters progressRef={progressRef} reduceMotion={reduceMotion} />
        <Arrival progressRef={progressRef} reduceMotion={reduceMotion} />
      </group>
      <HeroWeather season={season} reduceMotion={reduceMotion} enabled={weather} />
      <DriftingMist />
      <Waypoints onProject={onWaypointProject} />
      <CameraRig progressRef={progressRef} reduceMotion={reduceMotion} ambient={ambient} dragRef={dragRef} />
    </Canvas>
  )
}
