import { NodeIO } from '@gltf-transform/core'
import { KHRMeshQuantization } from '@gltf-transform/extensions'
import { simplify, weld, prune, dedup, resample, quantize, compactPrimitive, join, joinPrimitives } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'

const [,, IN, OUT, RATIO] = process.argv
const KEEP = new Set(['CharacterArmature|Wave', 'CharacterArmature|Idle'])

// The quantization extension MUST be registered, or quantize() writes int16
// positions while extensionsUsed stays empty — a file that is not valid glTF.
// three.js happens to read it anyway (it infers the compensating node scale), so
// this shipped once without anyone noticing; a stricter loader would reject it.
const io = new NodeIO().registerExtensions([KHRMeshQuantization])
const doc = await io.read(IN)
const root = doc.getRoot()
const count = () => root.listMeshes().flatMap(m => m.listPrimitives())
  .reduce((n, p) => n + (p.getIndices()?.getCount() ?? 0) / 3, 0)
const beforeTris = count()

// Disposing the Animation alone is not enough: its channels and samplers stay
// in the graph still referencing their accessors, so prune() sees them as live.
// That left 943 orphaned accessors — 354KB — in the output.
for (const anim of root.listAnimations()) {
  if (KEEP.has(anim.getName())) continue
  for (const channel of anim.listChannels()) channel.dispose()
  for (const sampler of anim.listSamplers()) sampler.dispose()
  anim.dispose()
}

// The export is flat-shaded, so every triangle carries its own three vertices
// (6380 verts for 3124 triangles on the head alone). Welding can't merge them
// while the per-face NORMAL differs, and without welding the simplifier has no
// shared edges to collapse — which is why the first pass removed 26 triangles
// out of 10,198. Dropping NORMAL lets the vertices merge; the model is
// rendered flat-shaded anyway, so three.js derives face normals in the shader
// and nothing is lost. TEXCOORD_0 goes too: this asset has zero textures.
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    for (const semantic of ['NORMAL', 'TEXCOORD_0', 'TANGENT', 'COLOR_0']) {
      const attr = prim.getAttribute(semantic)
      if (attr) prim.setAttribute(semantic, null)
    }
  }
}

// Each material is its own primitive, and every primitive is its own draw call —
// 15 per character, 30 for the pair, which was the single largest block of draw
// calls in the scene. At the size these are rendered (~100px tall) the eyebrow,
// eye and hair-vs-black distinctions are invisible, so near-duplicates are folded
// together and the primitives that shared a material can then be joined.
const MERGE = { Brown2: 'Brown', LightGreen: 'Green', Eyebrows: 'Black', Hair: 'Black', Eye: 'Black', Gold: 'Grey' }
const byName = new Map(root.listMaterials().map((m) => [m.getName(), m]))
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const target = MERGE[prim.getMaterial()?.getName()]
    if (target && byName.get(target)) prim.setMaterial(byName.get(target))
  }
}

await MeshoptSimplifier.ready
await doc.transform(
  resample(),
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: Number(RATIO), error: 0.05, lockBorder: false }),
)

// simplify() only rewrites the index buffer — the vertex buffers still carry
// every original vertex, so the file stayed at 403KB of geometry for 1.2k
// triangles. compactPrimitive drops the ones nothing references any more.
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) compactPrimitive(prim)
}

// join() merges whole meshes, not the primitives inside one — after folding the
// materials down, each mesh still held several primitives that now share a
// material. Merge those explicitly; every primitive is a draw call.
for (const mesh of root.listMeshes()) {
  const groups = new Map()
  for (const prim of mesh.listPrimitives()) {
    const key = prim.getMaterial()?.getName() ?? '_'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(prim)
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue
    const merged = joinPrimitives(group)
    for (const prim of group) { mesh.removePrimitive(prim); prim.dispose() }
    mesh.addPrimitive(merged)
  }
}

await doc.transform(
  join({ keepNamed: false }),
  prune(),
  dedup(),
  // Positions to int16, joints to uint8, weights to uint8. KHR_mesh_quantization
  // is read natively by three's GLTFLoader — no extra decoder to ship.
  quantize({ pattern: /.*/ }),
)
await io.write(OUT, doc)
const prims = root.listMeshes().reduce((n, m) => n + m.listPrimitives().length, 0)
console.log(`  triangles ${Math.round(beforeTris)} -> ${Math.round(count())}   clips ${root.listAnimations().length}   primitives(=draw calls) ${prims}   materials ${root.listMaterials().length}`)
