'use client'

import { useEffect, useMemo, useRef, useState, type ComponentProps, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
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
// Both figures were originally placed by eye and both landed badly — one with
// its back to the camera, the other stranded on dark ground a metre outside the
// firelight. These came out of a sweep of the ring around the fire instead,
// scored on four things at once: how far each sits from the flame in world
// space, how far it reads from the flame on screen, how much the ground drops
// away underneath it, and how many degrees off the camera axis it ends up
// facing. The result is symmetric — fire at px 980, one figure at 883, the other
// at 1077 — with both close enough that the firelight actually reaches them.
const SITTER_AT = { x: -1.8, z: 1.9 } as const
const WAVER_AT = { x: -1.2, z: 3.8 } as const
/** Nearly square to the camera — about 8° off. A wider three-quarter turn shows
 *  this figure's back-left quarter, which puts the pack AND the hanging arm on
 *  the same side of the silhouette, where they pile into an unreadable lump.
 *  Front-on, the pack hides behind the torso and the raised arm reads cleanly. */
const WAVER_TURN = -0.3

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

// ─── The two people at the fire ──────────────────────────────────────────────
// "Adventurer" by Quaternius (CC0), decimated to 1,221 triangles and the two
// clips this scene plays. See assets-src/character/README.md for the pipeline
// and public/character/CREDITS.txt for attribution.
//
// This replaces two figures built from boxes and spheres. That approach had a
// hard ceiling: at ~130px, with the fire lighting one side, every joint between
// primitives shows, and no amount of tuning proportions gets you a body that
// moves. A rigged mesh with an authored wave does in one clip what a dozen
// hand-placed shapes could not.
//
// ── What it costs, and when ──────────────────────────────────────────────────
// The source model is 1.9MB. Decimating it and dropping the 22 unused clips gets
// that to 95KB, which is the difference between an asset worth loading and one
// that isn't. Even so the fetch is
// gated on progress: nothing is requested until the descent passes PRELOAD_FROM,
// which leaves a comfortable margin before the camp resolves at ARRIVE_FROM.
//
// Phones never pay it at all. The scroll-scrubbed descent doesn't run on
// touch devices (see SummitHero), so progress stays at 0 there, the gate never
// opens, and the model is never requested.
const ADVENTURER_URL = '/character/adventurer.glb'
const CLIP_WAVE = 'CharacterArmature|Wave'
// The full Wave clip runs 1.67s, and well over half of it is the arm swinging up
// and back down through a horizontal pose that reads as pointing rather than
// waving. Captured across the cycle, the hand is only properly raised in the back
// third. Cropping to that keeps the greeting unmistakable — this lands at the very
// end of the descent and a viewer may only see a second of it.
const WAVE_FRAMES: readonly [number, number] = [26, 36]
const WAVE_FPS = 24
/** Fetch well before the camp fades in, so it is decoded and ready by then. */
const PRELOAD_FROM = 0.34
/** Height in terrain units, set against the cabin rather than picked by eye.
 *  The door is 0.58 tall in these units, so a figure at 0.78 stood taller than
 *  the doorway it was standing next to and turned the cabin into a shed. Just
 *  under the door height is what reads as a person at a house. */
const FIGURE_HEIGHT = 0.62

type Loaded = { scene: THREE.Group; animations: THREE.AnimationClip[] }

function useAdventurer(enabled: boolean) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  useEffect(() => {
    if (!enabled || loaded) return
    let cancelled = false
    new GLTFLoader().load(
      ADVENTURER_URL,
      (gltf) => {
        if (!cancelled) setLoaded({ scene: gltf.scene as THREE.Group, animations: gltf.animations })
      },
      undefined,
      // A failed fetch leaves the camp as fire + cabin, which still reads. Better
      // that than a broken frame at the emotional high point of the page.
      () => {}
    )
    return () => {
      cancelled = true
    }
  }, [enabled, loaded])
  return loaded
}

/** A pose is a set of rotations applied ON TOP of each bone's bind rotation, in
 *  radians about the bone's own axes. It has to compose rather than replace:
 *  a bind pose carries its own local rotations, and assigning to bone.rotation
 *  throws those away and folds the character in half. */
type Pose = Record<string, readonly [number, number, number]>

/** Bone names are matched on letters and digits only. three's GLTFLoader runs
 *  every node name through PropertyBinding.sanitizeNodeName, which strips dots —
 *  so the rig's "UpperLeg.L" arrives as "UpperLegL". Matching the raw name meant
 *  every bone with a dot silently missed, and the first seated pose came out as
 *  a figure standing bolt upright with its head bowed: Hips, Chest and Head had
 *  applied, and all four leg bones had not. */
const boneKey = (name: string) => name.replace(/[^A-Za-z0-9]/g, '').toLowerCase()

// Sitting. The pack has no sit clip — of its 24 animations not one is seated —
// so this is authored from the rig: thighs forward, shins down, a slight lean in
// toward the fire, forearms resting on the knees.
const SITTING_POSE: Pose = {
  // Signs matter and are not guessable: positive X swings a limb FORWARD on this
  // rig. The first attempt had the thighs at -1.42 and the shins at +1.35, which
  // very nearly cancel — the figure came out with straight legs trailing behind
  // it, pitched forward like a swan dive. Thigh forward, shin back by the same
  // amount, is what puts the shin vertical under a horizontal thigh.
  'UpperLeg.L': [1.4, 0, -0.07],
  'UpperLeg.R': [1.4, 0, 0.07],
  // Measured off the posed rig rather than guessed: at -1.3 the thigh came out
  // at a correct 75° from vertical but the shin was still 32° forward of it, so
  // the figure read as perching rather than sitting. More knee.
  'LowerLeg.L': [-1.78, 0, 0.06],
  'LowerLeg.R': [-1.78, 0, -0.06],
  Chest: [0.12, 0, 0],
  // Less shoulder, more elbow — at 0.85/0.35 the arms reached straight out in
  // front like a sleepwalker. Forearms should drop onto the knees.
  'UpperArm.L': [0.42, 0, 0.14],
  'UpperArm.R': [0.42, 0, -0.14],
  'LowerArm.L': [0.8, 0, 0],
  'LowerArm.R': [0.8, 0, 0],
  Head: [-0.05, 0, 0],
}

function Adventurer({
  source,
  clip,
  pose,
  seat,
  cx,
  cz,
  turn,
  fadeRef,
}: {
  source: Loaded
  /** Omitted for a posed figure — a mixer would overwrite the pose every frame. */
  clip?: string
  pose?: Pose
  /** Put a log under them. Its height comes from the posed rig, not from here. */
  seat?: boolean
  /** Terrain-space position — these live outside the arrival group. */
  cx: number
  cz: number
  turn: number
  fadeRef: RefObject<number>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const seatMatRef = useRef<THREE.MeshStandardMaterial>(null)
  const wasTransparent = useRef(true)

  // SkeletonUtils.clone, not Object3D.clone — a plain clone shares the skeleton,
  // so two copies would drive the same bones and play the same frame of the same
  // animation in lockstep.
  const built = useMemo(() => {
    const root = cloneSkinned(source.scene) as THREE.Group
    // Normalise to a known height: the export is authored at a scale that has
    // nothing to do with this mountain, and hard-coding a magic factor would
    // silently break if the asset is ever re-exported.
    // Pose first, then measure — the bounding box below has to describe the
    // shape we actually render, and a seated body is barely half the height of
    // a standing one.
    if (pose) {
      const byKey = new Map(Object.entries(pose).map(([k, v]) => [boneKey(k), v]))
      root.traverse((o) => {
        const rot = byKey.get(boneKey(o.name))
        if (!rot) return
        // rotateX/Y/Z multiply onto the existing quaternion, preserving the bind
        // rotation, which is the whole point (see the Pose docstring).
        o.rotateX(rot[0])
        o.rotateY(rot[1])
        o.rotateZ(rot[2])
      })
      root.updateMatrixWorld(true)
      root.traverse((o) => {
        const sm = o as THREE.SkinnedMesh
        if ((sm as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh) sm.skeleton.update()
      })
    }

    // Measure the SKINNED pose, not the bind pose.
    //
    // Box3.setFromObject transforms each mesh's bind-pose geometry by that mesh's
    // own world matrix. On this export (FBX2glTF) both the armature and the mesh
    // nodes carry a scale of 100 which the bind matrices then undo, so that
    // reading is meaningless: it reports the character as 63.8 units tall and 223
    // deep. Scaling by it put both figures on screen at about 2cm — invisible,
    // which is exactly what the first attempt rendered.
    //
    // applyBoneTransform runs a vertex through the actual skinning maths, so this
    // measures where the geometry really ends up: 1.83 units, feet on y=0. A few
    // hundred samples per mesh is plenty for a bounding box and it runs once.
    const box = new THREE.Box3()
    const v = new THREE.Vector3()
    root.updateMatrixWorld(true)
    root.traverse((o) => {
      const sm = o as THREE.SkinnedMesh
      if (!(sm as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh) return
      sm.skeleton.update()
      const pos = sm.geometry.attributes.position
      const step = Math.max(1, Math.floor(pos.count / 200))
      for (let i = 0; i < pos.count; i += step) {
        v.fromBufferAttribute(pos, i)
        sm.applyBoneTransform(i, v)
        v.applyMatrix4(sm.matrixWorld)
        box.expandByPoint(v)
      }
    })
    const h = box.max.y - box.min.y
    const k = h > 0 ? FIGURE_HEIGHT / h : 1
    root.scale.setScalar(k)
    // Feet on the ground, not the rig origin.
    root.position.y = -box.min.y * k

    // Where the hips actually ended up. A seated figure needs something under it,
    // and hard-coding that height is guesswork that goes wrong the moment the
    // pose changes — the first attempt put the log at standing-hip height and the
    // character sat on thin air with the log stranded behind. Reading the bone
    // back out of the posed rig keeps the two locked together.
    let hipY = 0
    root.updateMatrixWorld(true)
    root.traverse((o) => {
      if (boneKey(o.name) === 'hips') hipY = o.getWorldPosition(new THREE.Vector3()).y
    })
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      // Skinned bounds are computed from the bind pose, so an animated limb can
      // leave the box and the whole character pops out of existence.
      m.frustumCulled = false
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      // Cloned per instance: the fade writes to these every frame, and the loader
      // hands both copies the same material objects.
      const next = mats.map((mat) => {
        const c = mat.clone()
        // The build strips NORMAL (see assets-src/character/README.md), so face
        // normals have to come from the shader — which is also exactly the
        // faceted look this decimated model wants.
        if ('flatShading' in c) (c as THREE.MeshStandardMaterial).flatShading = true
        c.transparent = true
        c.opacity = 0
        // Depth still writes while fading, so the character's own parts sort
        // against each other instead of showing through one another.
        c.depthWrite = true
        return c
      })
      m.material = Array.isArray(m.material) ? next : next[0]
    })
    return { root, hipY }
  }, [source, pose])

  const { root: model, hipY } = built
  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model])

  useEffect(() => {
    if (!clip) return
    const found = source.animations.find((a) => a.name === clip)
    if (!found) return
    const useClip =
      clip === CLIP_WAVE
        ? THREE.AnimationUtils.subclip(found, 'Wave_raised', WAVE_FRAMES[0], WAVE_FRAMES[1], WAVE_FPS)
        : found
    const action = mixer.clipAction(useClip)
    // LoopPingPong, not LoopRepeat. A repeating loop has to teleport from the
    // last frame back to the first, and on a wave that is a visible snap of the
    // arm every cycle. Ping-pong plays the sweep forward then backward, so the
    // two ends of the loop ARE the turning points of the wave and there is no
    // discontinuity at all. Halved timeScale on top: the raw clip waves at a
    // frantic pace that reads as a twitch at this size.
    action.setLoop(THREE.LoopPingPong, Infinity)
    action.timeScale = clip === CLIP_WAVE ? 0.5 : 0.85
    action.reset().play()
    return () => {
      mixer.stopAllAction()
    }
  }, [mixer, source, clip])

  useEffect(() => () => mixer.uncacheRoot(model), [mixer, model])

  useFrame((_, delta) => {
    const g = groupRef.current
    const k = fadeRef.current ?? 0
    const visible = k > 0.01
    if (g) g.visible = visible
    if (!visible) return
    if (clip) mixer.update(delta)
    // Toggling `transparent` recompiles the shader, so it flips once at the end
    // of the fade rather than every frame.
    const wantTransparent = k < 0.995
    const flip = wantTransparent !== wasTransparent.current
    if (flip) wasTransparent.current = wantTransparent
    if (seatMatRef.current) seatMatRef.current.opacity = k
    model.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined
      if (!m || !('opacity' in m)) return
      m.opacity = k
      if (flip) {
        m.transparent = wantTransparent
        m.needsUpdate = true
      }
    })
  })

  return (
    <group ref={groupRef} position={[cx, worldY(cx, cz), cz]} rotation={[0, turn, 0]}>
      <primitive object={model} />
      {seat && (
        <mesh position={[0, hipY - 0.085, -0.06]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.095, 0.095, 0.62, 7]} />
          <meshStandardMaterial ref={seatMatRef} color="#3E2E20" roughness={1} transparent opacity={0} />
        </mesh>
      )}
    </group>
  )
}

function Arrival({ progressRef, reduceMotion }: { progressRef: RefObject<number>; reduceMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null)
  const armRef = useRef<THREE.Group>(null)
  const flameRef = useRef<THREE.Group>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  const fadeRef = useRef(0)
  const fireFlickRef = useRef(1)
  // Flipped once, on the way down, to start fetching the character model.
  const [nearArrival, setNearArrival] = useState(false)
  const adventurer = useAdventurer(nearArrival)
  const lamp = useLampTexture()
  const shade = useShadeTexture()
  const mist = useSoftMistTexture()
  const y = useMemo(() => seatHeight(ARRIVAL.x, ARRIVAL.z), [])
  // Every standing thing gets its own ground sample — otherwise a figure three
  // units from the house floats or sinks by however much the slope moves.
  const fireY = useMemo(() => siteOffset(FIRE_AT.x, FIRE_AT.z, y), [y])
  // The house is seated on the lowest corner of its own footprint, so anything
  // sitting *outside* that footprint — the doorstep, the woodpile — is on ground
  // the house never sampled, and floats wherever the slope falls away.
  // Terrain-space anchors for the ground decals, which live outside the group.
  const fireXZ = useMemo(() => siteToTerrain(FIRE_AT.x, FIRE_AT.z), [])
  const sitterXZ = useMemo(() => siteToTerrain(SITTER_AT.x, SITTER_AT.z), [])
  const waverXZ = useMemo(() => siteToTerrain(WAVER_AT.x, WAVER_AT.z), [])
  const stepY = useMemo(() => siteOffset(-0.45, 0.87, y), [y])
  const woodY = useMemo(() => siteOffset(1.15, 0.2, y), [y])
  // The firelight sits outside the fading group (see below), so it needs its
  // position in terrain space rather than group space.
  const firePos = useMemo<[number, number, number]>(() => {
    const [tx, tz] = siteToTerrain(FIRE_AT.x, FIRE_AT.z)
    // Held well above the logs on purpose. Sat down in the flame the light was
    // ~0.35 from the woodpile and ~0.8 from the figures, and inverse-square turned
    // that into a 4× difference — the logs blew out to white while the people
    // stayed dark. Raised, the ratio drops to about 1.6× and the whole camp lights
    // evenly.
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

    // The light is always mounted, and only its intensity moves. Adding or
    // removing a light from the scene forces every lit material to recompile its
    // shader — doing that at the moment of reveal would hitch exactly where the
    // page most needs to be smooth.
    fireFlickRef.current = fireFlicker
    if (!nearArrival && p > PRELOAD_FROM) setNearArrival(true)
    if (lightRef.current) lightRef.current.intensity = k * fireFlicker * 3.4

    const g = groupRef.current
    if (g) {
      // visible=false skips the draw calls entirely for most of the descent.
      g.visible = k > 0.01
      if (!g.visible) return
    }

    // Traversed rather than tracked through two dozen ref callbacks: ~40 objects
    // once a frame is nothing, and it keeps the JSX free of ref bookkeeping.
    // Materials opt into a brightness ceiling and a flutter through userData, so
    // a glow sprite can sit at 0.7 and a flame can gutter without either one
    // needing its own ref threaded up here.
    if (g) {
      g.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined
        if (!m || !('opacity' in m) || m.userData.selfFade) return
        const base = (m.userData.baseOpacity as number) ?? 1
        const flick = m.userData.flick === 'fire' ? fireFlicker : m.userData.flick === 'lamp' ? lampFlicker : 1
        m.opacity = k * base * flick
      })
    }

    // The flame breathes rather than scaling uniformly — taller and thinner as
    // it flares, which is the shape change that reads as fire.
    if (flameRef.current) {
      flameRef.current.scale.set(0.94 + fireFlicker * 0.14, 0.72 + fireFlicker * 0.42, 0.94 + fireFlicker * 0.14)
      flameRef.current.rotation.y = Math.sin(t * 2.3) * 0.3
    }

    // The wave only starts once you are actually close enough to be greeted.
    if (armRef.current) {
      armRef.current.rotation.z = -0.42 - Math.sin(t * 4.2) * 0.4 * k
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
      <GroundDecal cx={sitterXZ[0]} cz={sitterXZ[1]} size={1.0} map={shade} color="#0A120C" strength={0.42} fadeRef={fadeRef} />
      <GroundDecal cx={waverXZ[0]} cz={waverXZ[1]} size={0.95} map={shade} color="#0A120C" strength={0.46} fadeRef={fadeRef} />
      {/* The firelight on the grass, draped over the slope rather than laid flat. */}
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

      {/* The two people. Terrain-space siblings of the group below, so the
          group's turn and 0.85 scale don't have to be unwound for them. */}
      {adventurer && (
        <>
          <Adventurer
            source={adventurer}
            clip={CLIP_WAVE}
            cx={waverXZ[0]}
            cz={waverXZ[1]}
            turn={ARRIVAL_TURN + WAVER_TURN}
            fadeRef={fadeRef}
          />
          <Adventurer
            source={adventurer}
            pose={SITTING_POSE}
            seat
            cx={sitterXZ[0]}
            cz={sitterXZ[1]}
            turn={ARRIVAL_TURN + faceFire(SITTER_AT)}
            fadeRef={fadeRef}
          />
        </>
      )}

      <group ref={groupRef} position={[ARRIVAL.x, y, ARRIVAL.z]} rotation={[0, ARRIVAL_TURN, 0]} scale={ARRIVAL_SCALE}>
          {/* ── The home ──
          Timber matched to the ridge huts (#6B5540 walls / #8A7259 roof) rather
          than picked fresh. A brighter pass read as plastic against the muted
          slope, and more importantly it made the valley house look like it was
          built of something other than the lamps up on the mountain. */}
        {/* A stone plinth, slightly proud of the walls. Houses up here are built on
          dry-stone footings because the ground moves, and visually it's what
          stops the timber box from looking like it was dropped on the grass. */}
        <mesh position={[0, -0.16, 0]}>
          <boxGeometry args={[2.04, 0.6, 1.64]} />
          <meshStandardMaterial color="#4B443C" roughness={1} transparent opacity={0} />
        </mesh>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[1.9, 1, 1.5]} />
          <meshStandardMaterial color="#6B5540" emissive="#2E2113" emissiveIntensity={0.4} roughness={0.9} transparent opacity={0} />
        </mesh>
        {/* Hip roof. A 4-sided cone is a SQUARE pyramid, and the plan here is
          1.9 × 1.5 — so a roof sized to overhang the walls by 0.2 at the sides
          overhung by 0.4 front and back. It read as a pagoda on stilts, and the
          eaves hanging out over open ground were what made the whole house look
          like it was floating. The squash lives on a parent group rather than on
          the mesh: three.js applies a mesh's own scale before its rotation, so
          scaling the cone directly would shear the diamond instead of narrowing
          the finished roof. */}
        <group scale={[1, 1, 0.82]}>
          <mesh position={[0, 1.22, 0]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[1.57, 0.68, 4]} />
            <meshStandardMaterial color="#8A7259" emissive="#3A2C1B" emissiveIntensity={0.3} roughness={0.85} transparent opacity={0} />
          </mesh>
        </group>
        {/* Chimney */}
        <mesh position={[0.55, 1.5, 0.15]}>
          <boxGeometry args={[0.22, 0.55, 0.22]} />
          <meshStandardMaterial color="#5E4B39" roughness={1} transparent opacity={0} />
        </mesh>
        {/* Door, with a stone step out of it — the step is what implies someone
          walks in and out, rather than the door being painted on. */}
        <mesh position={[-0.45, 0.34, 0.755]}>
          <planeGeometry args={[0.4, 0.68]} />
          <meshStandardMaterial color="#3B2C1E" roughness={1} transparent opacity={0} />
        </mesh>
        <mesh position={[-0.45, stepY + 0.05, 0.87]}>
          <boxGeometry args={[0.54, 0.1, 0.24]} />
          <meshStandardMaterial color="#4B443C" roughness={1} transparent opacity={0} />
        </mesh>
        {/* Two lit windows — the reason the whole thing reads as inhabited — each
          with the same tight bloom the ridge huts use, so the light spills onto
          the wall instead of stopping dead at the pane. fog={false} on both:
          weather can dim the mountain, but it can never put the house out. */}
        {[0.42, -0.95].map((wx, i) => (
          <group key={i}>
            <mesh position={[wx, 0.62, 0.756]}>
              <planeGeometry args={[0.42, 0.34]} />
              <meshBasicMaterial color="#FFD489" transparent opacity={0} fog={false} userData={{ flick: 'lamp' }} />
            </mesh>
            {/* Glazing bars. At 200px an unbroken rectangle of light reads as a
              hole cut in the wall; two dark bars turn it into a window. */}
            <mesh position={[wx, 0.62, 0.762]}>
              <boxGeometry args={[0.028, 0.34, 0.008]} />
              <meshStandardMaterial color="#2A1F14" roughness={1} transparent opacity={0} />
            </mesh>
            <mesh position={[wx, 0.62, 0.762]}>
              <boxGeometry args={[0.42, 0.026, 0.008]} />
              <meshStandardMaterial color="#2A1F14" roughness={1} transparent opacity={0} />
            </mesh>
            <sprite position={[wx, 0.62, 0.85]} scale={1.15}>
              <spriteMaterial
                map={lamp}
                transparent
                opacity={0}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                fog={false}
                userData={{ baseOpacity: 0.7, flick: 'lamp' }}
              />
            </sprite>
          </group>
        ))}
        {/* Woodpile against the gable */}
        <mesh position={[1.15, woodY + 0.16, 0.2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.16, 0.16, 0.7, 6]} />
          <meshStandardMaterial color="#4A3A29" roughness={1} transparent opacity={0} />
        </mesh>

        {/* Chimney smoke. The one detail that says somebody lit the stove before
          you got here — and the reason the chimney is worth having at all. */}
        <RisingParticles
          position={[0.55, 1.82, 0.15]}
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

        {/* ── The fire ────────────────────────────────────────────────────────── */}
        <group position={[FIRE_AT.x, fireY, FIRE_AT.z]}>
          {/* Ring of stones. Five segments, not thirty — at this size the facets
            read as rocks, where a smooth torus reads as a rubber tube. */}
          <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.26, 0.045, 5, 9]} />
            <meshStandardMaterial color="#44423C" roughness={1} transparent opacity={0} />
          </mesh>

          {/* Three logs in a low crossed pile. They were a tall teepee first, and
            standing proud of the flame their dark uprights cut the bright cone
            into a hard "A" — the fire read as a lit tent. Laid almost flat they
            sit under the flame instead of in front of it. */}
          {[0, 1, 2].map((i) => (
            <group key={i} rotation={[0, (i * Math.PI * 2) / 3 + 0.4, 0]}>
              <mesh position={[0, 0.055, 0.05]} rotation={[-1.15, 0, 0]}>
                <cylinderGeometry args={[0.038, 0.045, 0.42, 5]} />
                <meshStandardMaterial color="#33251A" roughness={1} transparent opacity={0} />
              </mesh>
            </group>
          ))}

          {/* Flame: two additive cones, outer amber over a smaller near-white
            core. Deliberately small and mostly transparent — the first pass was
            a big opaque cone and it read as a lit tent, not a fire. What sells a
            fire at this size is the glow it throws and the way it moves, so the
            geometry stays modest and the bloom does the work. Basic materials
            with fog off: a fire that dims with distance haze looks like a
            sticker of a fire. */}
          <group ref={flameRef} position={[0, 0.13, 0]}>
            <mesh position={[0, 0.15, 0]}>
              <coneGeometry args={[0.115, 0.32, 6]} />
              <meshBasicMaterial
                color="#FF7A1E"
                transparent
                opacity={0}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                fog={false}
                userData={{ baseOpacity: 0.62, flick: 'fire' }}
              />
            </mesh>
            <mesh position={[0, 0.11, 0]}>
              <coneGeometry args={[0.058, 0.19, 6]} />
              <meshBasicMaterial
                color="#FFD9A0"
                transparent
                opacity={0}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                fog={false}
                userData={{ baseOpacity: 0.7, flick: 'fire' }}
              />
            </mesh>
          </group>

          {/* Bloom around the flame, and a pool of light on the ground. The pool is
            a flat plane rather than a sprite: a sprite billboards to face the
            camera, so light meant to lie on the grass would stand up like a wall
            as the descent came down to eye level. */}
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
  onWaypointProject: (states: Record<string, WaypointScreenState>) => void
  onReady?: () => void
}) {
  return (
    <Canvas
      dpr={[1, 1.6]}
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
