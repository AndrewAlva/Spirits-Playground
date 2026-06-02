# Spirits-Playground

A repo to experiment with different interaction techniques for a Spirits project coming up.

## Venation (`venation-3d`)

An infinite, continuously-growing 3D leaf-venation animation built with the
Space Colonization Algorithm. Bioluminescent dark aesthetic: pure black
background, cyan-to-green glowing veins, no UI chrome.

Stack: Vite + React + TypeScript + Tailwind + Three.js + `@react-three/fiber` +
`@react-three/drei` + `meshline` (pmndrs) + `@react-three/postprocessing`.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production bundle
```

### Layout

```
src/venation/
  engine.ts            # Pure-TS space colonization engine (grid-indexed)
  BranchLine.tsx       # One meshline strand (HDR gradient + width taper)
  VenationRenderer.tsx # R3F component mapping the node graph → strands
  CameraController.tsx # Cinematic follow camera
  VenationScene.tsx    # Canvas + Bloom postprocessing shell
  types.ts             # Shared types
```

### Notes on the `meshline` mapping

pmndrs `meshline` has no per-vertex color attribute, so the spec's
`vertexColors` color buffer is realized with the material's 2-stop `gradient`
(interpolated along `counters`): deep green at the root (`#00aa44`) → HDR cyan
at the tip (`new THREE.Color(0, 3, 2)`) so Bloom latches onto the growing
frontier. No custom GLSL was required, so the GLSL ES 3.0 rules in the brief
don't apply here. The width taper uses `widthCallback`; points are stored
root-first, so the callback is the inverted-but-equivalent form of the spec's
`0.006 + p*0.012`.
