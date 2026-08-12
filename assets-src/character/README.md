# Character asset pipeline

`public/character/adventurer.glb` is a decimated build of `adventurer-original.glb`
("Adventurer" by Quaternius, CC0).

    1.9 MB, 10,198 tris, 24 clips   ->   95 KB, 1,221 tris, 2 clips

`decimate.mjs` produces it. The toolchain is deliberately **not** a project
dependency — install it somewhere outside the repo and run:

    npm install @gltf-transform/core @gltf-transform/functions meshoptimizer
    node decimate.mjs adventurer-original.glb ../../public/character/adventurer.glb 0.12

The last argument is the triangle ratio. 0.12 is the shipped setting; 0.20 and
0.35 are also reasonable if the silhouette ever needs more detail.

Two things the script does that are easy to get wrong, both explained in its
comments: it strips NORMAL before welding (the export is flat-shaded, so nothing
merges otherwise and the simplifier collapses nothing), and it disposes each
animation's channels and samplers rather than just the animation (otherwise 943
orphaned accessors survive `prune()` and the file stays at 527KB).

Because NORMAL is stripped, the renderer must set `flatShading` on the materials.
