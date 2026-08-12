import { NodeIO } from '@gltf-transform/core'
import { simplify, weld, prune, dedup, resample, quantize, compactPrimitive } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'

const [,, IN, OUT, RATIO] = process.argv
const KEEP = new Set(['CharacterArmature|Wave', 'CharacterArmature|Idle'])

const io = new NodeIO()
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

await doc.transform(
  prune(),
  dedup(),
  // Positions to int16, joints to uint8, weights to uint8. KHR_mesh_quantization
  // is read natively by three's GLTFLoader — no extra decoder to ship.
  quantize({ pattern: /.*/ }),
)
await io.write(OUT, doc)
console.log(`  triangles ${Math.round(beforeTris)} -> ${Math.round(count())}   clips ${root.listAnimations().length}`)
