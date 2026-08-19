'use client'

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// ─────────────────────────────────────────────────────────────────────────────
// Weather on the hero — the real season, on the real range.
// ─────────────────────────────────────────────────────────────────────────────
// Not decoration. This is the same season logic the trail guide already runs on
// (see TRAILS[].bestMonths): the Uttarakhand Himalaya has a monsoon that soaks
// July–September, a winter that snows December–February, and a post-monsoon
// window that is famously the clearest air of the year. So the hero shows
// whatever is actually happening on the mountain the day you visit it — rain in
// August, snow in January, clear at altitude in October.
//
// ── Why this is cheap ────────────────────────────────────────────────────────
// The expensive way to do weather is a JS loop that moves N particles every
// frame and re-uploads the position buffer. That is O(N) CPU work per frame plus
// a GPU upload, and it is what makes most "snow effect" scripts jank.
//
// This does none of that. Positions are uploaded ONCE. Every particle's fall,
// sway and wrap is computed in the vertex shader from a single `uTime` uniform,
// so per frame the CPU writes exactly one float and issues one extra draw call —
// regardless of whether there are 400 particles or 4,000. It also rides the
// hero's existing WebGL context and render loop, so there is no second canvas,
// no second RAF, and no extra compositing layer.
//
// ── Where it doesn't run ─────────────────────────────────────────────────────
//   • prefers-reduced-motion  → nothing at all
//   • touch / coarse pointer  → nothing (phones already get the ambient hero,
//                               and this is the one effect a mid-range Android
//                               would actually feel)
//   • clear season            → no particles; only the air changes
// ─────────────────────────────────────────────────────────────────────────────

// Season parsing lives in `lib/season.ts`, a module with no 3D dependency.
// SummitHero imports `resolveSeason` statically, and importing it from HERE
// dragged 883 KB of three.js into the initial document on every device and
// defeated the dynamic import of TerrainScene entirely. Re-exported so this
// module's existing callers are unchanged. See lib/season.ts.
export { seasonForDate, resolveSeason, type Season } from '@/lib/season'
import type { Season } from '@/lib/season'

type Profile = {
  count: number
  fall: number // world units/sec
  sway: number // lateral drift amplitude
  size: number // point size before distance attenuation
  color: string
  opacity: number
  /** How much the season closes the air in. 0 = as-authored, 1 = socked in. */
  haze: number
  hazeColor: THREE.Color
}

const PROFILES: Record<'rain' | 'snow', Profile> = {
  rain: {
    count: 2600,
    fall: 30,
    sway: 0.3,
    size: 34,
    color: '#C6D8DE',
    opacity: 0.38,
    haze: 1,
    hazeColor: new THREE.Color('#26382E'),
  },
  snow: {
    count: 900,
    fall: 2.4,
    sway: 1.5,
    size: 11,
    color: '#EFF4F0',
    opacity: 0.8,
    haze: 0.55,
    hazeColor: new THREE.Color('#22303A'),
  },
}

// The volume particles live in. Tall enough to cover the descent, wide enough
// that the camera never reaches an edge.
const FOG_HAZE = new THREE.Color('#33463C')

const SPAN_XZ = 80
const SPAN_Y = 46

/** A soft round flake. */
function makeSnowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.45, 'rgba(255,255,255,0.7)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 32, 32)
  const t = new THREE.CanvasTexture(c)
  t.needsUpdate = true
  return t
}

/** A vertical streak.
 *
 *  Points render as screen-aligned SQUARES and gl_PointCoord spans 0–1 across
 *  that square, so the sprite has to be square too. A tall, narrow canvas gets
 *  stretched horizontally into a fat smear — which is exactly what a first pass
 *  at this looked like. The canvas is square; the streak is thin *within* it. */
function makeRainTexture() {
  const S = 64
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  // ~9% of the width — at a 30px point that lands as a ~3px drop on screen.
  const w = 6
  const x = (S - w) / 2
  const grad = g.createLinearGradient(0, 0, 0, S)
  grad.addColorStop(0, 'rgba(255,255,255,0)')
  grad.addColorStop(0.25, 'rgba(255,255,255,0.9)')
  grad.addColorStop(0.8, 'rgba(255,255,255,0.55)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(x, 2, w, S - 4)
  const t = new THREE.CanvasTexture(c)
  t.minFilter = THREE.LinearFilter
  t.magFilter = THREE.LinearFilter
  t.needsUpdate = true
  return t
}

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uFall;
  uniform float uSway;
  uniform float uSize;
  uniform float uSpanY;
  attribute float aSpeed;
  attribute float aPhase;
  varying float vFade;

  void main() {
    vec3 p = position;

    // Fall + wrap, entirely on the GPU. mod() means a particle that leaves the
    // bottom reappears at the top with no CPU respawn bookkeeping.
    p.y = mod(p.y - uTime * uFall * aSpeed, uSpanY);

    // Lateral drift. Barely there for rain, the whole character of snow.
    p.x += sin(uTime * 0.55 * aSpeed + aPhase) * uSway;
    p.z += cos(uTime * 0.42 * aSpeed + aPhase * 1.7) * uSway * 0.7;

    // Fade in/out at the top and bottom of the column so wrapping never pops.
    float h = p.y / uSpanY;
    vFade = smoothstep(0.0, 0.10, h) * (1.0 - smoothstep(0.80, 1.0, h));

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    // Clamped so a particle drifting close to the camera can't balloon into a
    // full-screen smear — the failure mode of naive 1/z point sizing.
    gl_PointSize = clamp(uSize * (18.0 / max(-mv.z, 1.0)), 1.0, 46.0);
    gl_Position = projectionMatrix * mv;
  }
`

const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;

  void main() {
    float a = texture2D(uMap, gl_PointCoord).a * vFade * uOpacity;
    if (a < 0.012) discard;
    gl_FragColor = vec4(uColor, a);
  }
`

/** How much a season closes the air in, for Atmosphere's fog pass.
 *  Exported rather than applied here so exactly one component writes scene.fog. */
export function seasonHaze(season: Season): { haze: number; color: THREE.Color; floor: number } | null {
  // Fog is the one season made entirely of air: no precipitation at all, just
  // the valley cloud that sits in the pines until mid-morning. It is also the
  // cheapest state in the whole system — zero particles, one fog tweak.
  // `floor` is how much of the haze applies at the summit hold, before any
  // descent. Rain and snow open on a visible vista and thicken as you drop into
  // the valley. Fog is different: being socked in *at altitude* is the whole
  // state, so it starts almost fully applied.
  // Fog used to be haze 1 / floor 0.92, and it wiped the scene out. At the
  // summit hold that pulled the fog's far plane in to 36 units while the range
  // itself sits about 44 away — so the entire mountain fell outside the fog and
  // there was nothing left to look at. Real valley cloud doesn't erase a range;
  // it drifts through it in banks. The global haze is now light enough to keep
  // the ridgelines, and the weather is carried by the moving banks below.
  if (season === 'fog') return { haze: 0.5, color: FOG_HAZE, floor: 0.3 }
  if (season === 'clear') return null
  const p = PROFILES[season]
  return { haze: p.haze, color: p.hazeColor, floor: 0.35 }
}


// ── Drifting cloud, for the fog season ───────────────────────────────────────
// Flat sheets lying low across the valley, sliding sideways and wrapping. Ground
// cloud in the Uttarakhand pre-monsoon does exactly this: it pours through the
// pines and moves, rather than sitting as a uniform grey.
//
// Ten planes, one draw call each, moved by three float writes per frame. They sit
// in world space rather than following the camera, which is the whole point —
// the descent passes through them.
const BANK_SPAN = 110
const FOG_BANKS = [
  { x: -38, y: 2.6, z: -4, w: 30, h: 13, speed: 0.62, opacity: 0.3, phase: 0.0 },
  { x: -6, y: 1.1, z: -13, w: 38, h: 15, speed: 0.44, opacity: 0.26, phase: 1.1 },
  { x: 26, y: 3.4, z: -22, w: 34, h: 14, speed: 0.71, opacity: 0.24, phase: 2.3 },
  { x: -24, y: 5.0, z: -30, w: 44, h: 17, speed: 0.35, opacity: 0.22, phase: 3.4 },
  { x: 12, y: 0.2, z: 2, w: 26, h: 11, speed: 0.85, opacity: 0.28, phase: 4.2 },
  { x: 40, y: 6.2, z: -38, w: 48, h: 18, speed: 0.29, opacity: 0.2, phase: 5.0 },
  { x: -14, y: 7.8, z: -46, w: 52, h: 20, speed: 0.24, opacity: 0.18, phase: 0.7 },
  { x: 4, y: 4.2, z: -18, w: 32, h: 13, speed: 0.53, opacity: 0.23, phase: 2.9 },
  { x: -30, y: 0.6, z: -8, w: 28, h: 12, speed: 0.77, opacity: 0.27, phase: 3.9 },
  { x: 20, y: 2.0, z: -26, w: 36, h: 15, speed: 0.4, opacity: 0.21, phase: 1.7 },
] as const

/** A lumpy cloud, not a circle — a single radial gradient reads as a smoke ring
 *  the moment two of them overlap. */
function makeCloudTexture() {
  const S = 128
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  // Deterministic blobs, so the field is identical on every load.
  let seed = 9137
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let i = 0; i < 7; i++) {
    const r = S * (0.16 + rand() * 0.16)
    const x = S * (0.28 + rand() * 0.44)
    const y = S * (0.3 + rand() * 0.4)
    const grad = g.createRadialGradient(x, y, 0, x, y, r)
    grad.addColorStop(0, 'rgba(255,255,255,0.5)')
    grad.addColorStop(0.55, 'rgba(255,255,255,0.16)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, S, S)
  }
  const t = new THREE.CanvasTexture(c)
  t.needsUpdate = true
  return t
}

function FogBanks({ reduceMotion }: { reduceMotion: boolean }) {
  const texture = useMemo(() => makeCloudTexture(), [])
  const refs = useRef<(THREE.Mesh | null)[]>([])

  useFrame(({ clock }) => {
    // Reduced motion still gets the cloud, it just doesn't move.
    const t = reduceMotion ? 0 : clock.elapsedTime
    for (let i = 0; i < FOG_BANKS.length; i++) {
      const b = FOG_BANKS[i]
      const m = refs.current[i]
      if (!m) continue
      // mod() wrap, same idea as the precipitation shader — a bank that leaves
      // one side reappears on the other with no bookkeeping.
      m.position.x = (((b.x + t * b.speed + BANK_SPAN / 2) % BANK_SPAN) + BANK_SPAN) % BANK_SPAN - BANK_SPAN / 2
      m.position.y = b.y + Math.sin(t * 0.11 + b.phase) * 0.6
    }
  })

  return (
    <group>
      {FOG_BANKS.map((b, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          position={[b.x, b.y, b.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={3}
        >
          <planeGeometry args={[b.w, b.h]} />
          <meshBasicMaterial
            map={texture}
            color="#D8E6E2"
            transparent
            opacity={b.opacity}
            depthWrite={false}
            fog={false}
          />
        </mesh>
      ))}
    </group>
  )
}

export function HeroWeather({
  season,
  reduceMotion,
  enabled,
}: {
  season: Season
  reduceMotion: boolean
  /** Capability gate — false on touch/coarse-pointer devices. */
  enabled: boolean
}) {
  const { camera } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const active = enabled && !reduceMotion
  const profile = season === 'rain' || season === 'snow' ? PROFILES[season] : null

  const texture = useMemo(() => {
    if (!active || !profile) return null
    return season === 'rain' ? makeRainTexture() : makeSnowTexture()
  }, [active, profile, season])

  const geometry = useMemo(() => {
    if (!active || !profile) return null
    const g = new THREE.BufferGeometry()
    const n = profile.count
    const pos = new Float32Array(n * 3)
    const speed = new Float32Array(n)
    const phase = new Float32Array(n)
    // Deterministic, so the field is identical across mounts and between
    // server and client — no hydration flicker.
    let seed = 20260812
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rand() - 0.5) * SPAN_XZ
      pos[i * 3 + 1] = rand() * SPAN_Y
      pos[i * 3 + 2] = (rand() - 0.5) * SPAN_XZ
      speed[i] = 0.75 + rand() * 0.5
      phase[i] = rand() * Math.PI * 2
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1))
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
    return g
  }, [active, profile])

  const uniforms = useMemo(() => {
    if (!profile || !texture) return null
    return {
      uTime: { value: 0 },
      uFall: { value: profile.fall },
      uSway: { value: profile.sway },
      uSize: { value: profile.size },
      uSpanY: { value: SPAN_Y },
      uMap: { value: texture },
      uColor: { value: new THREE.Color(profile.color) },
      uOpacity: { value: profile.opacity },
    }
  }, [profile, texture])

  // The seasonal haze is applied by Atmosphere, not here — that component
  // already owns scene.fog for the descent, and two components writing the same
  // object each frame is how fog ends up flickering between two answers.
  useFrame(({ clock }) => {
    if (!active) return

    if (matRef.current) matRef.current.uniforms.uTime.value = clock.elapsedTime

    // Keep the column centred on the camera in X/Z so density never thins out
    // as the descent travels. One vector write per frame.
    if (groupRef.current) {
      groupRef.current.position.x = camera.position.x
      groupRef.current.position.z = camera.position.z
    }
  })

  if (!active) return null
  // Fog is carried by moving banks rather than by particles or by crushing the
  // scene's fog range.
  if (season === 'fog') return <FogBanks reduceMotion={reduceMotion} />
  if (!geometry || !uniforms) return null

  return (
    <group ref={groupRef}>
      <points geometry={geometry} frustumCulled={false} renderOrder={2}>
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={VERT}
          fragmentShader={FRAG}
          transparent
          depthWrite={false}
          blending={season === 'rain' ? THREE.NormalBlending : THREE.AdditiveBlending}
        />
      </points>
    </group>
  )
}
