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
npm run dev      # http://localhost:5173  (add ?gui for the controls)
npm run build    # type-check + production bundle
```

### Live controls — `?gui`

Append `?gui` to the URL (e.g. `http://localhost:5173/?gui`) to reveal a
[leva](https://github.com/pmndrs/leva) panel. Without `?gui` it stays hidden.
All controls write into a single live `config` singleton (`config.ts`) that the
engine, camera, materials, and post-FX read each frame — no React re-renders on
the hot path. Color/width edits and resets are picked up via version counters
the renderer watches.

The panel is organised into folders, matching `Gui.tsx`:

#### Growth
- **growthSpeed** — simulation ticks per second, decoupled from the frame rate. Lower = slower growth with the same smoothness.
- **influenceRadius** — max distance at which an attractor can pull on a vein tip.
- **killRadius** — distance at which a reached attractor is consumed and removed.
- **segmentLength** — world-space length each vein step adds per tick.
- **branchAngleNoise** — random angular jitter (radians) added to every growth step.
- **zWobble** — max random out-of-plane (Z) displacement per step; keeps growth quasi-flat.
- **maxGrowthPerTick** — max new vein nodes emitted per simulation tick.

#### Forking
- **forkSpread** — angular spread (radians) of the influencing attractors above which a tip may split in two.
- **minForkAttractors** — minimum influencing attractors required before a fork is considered.
- **forkProbability** — chance that an eligible tip actually forks.

#### Attractors
- **maxAttractors** — target size of the live attractor cloud the veins grow toward.
- **replenishRadius** — radius over which fresh attractors are scattered ahead of the front.
- **candidateLimit** — max recent tips examined per tick (performance bound on the search).

#### Direction (tropism + curtain)
- **biasStrength** — how strongly growth is pulled toward the bias direction (0 = pure space colonization, 1 = fully directional).
- **biasX / biasY / biasZ** — the "current" direction vector growth flows along (default points down).
- **replenishAhead** — how far ahead of the frontier (along the bias) new attractors are seeded.
- **cullBehind** — distance behind the frontier past which attractors are abandoned (keeps the cloud marching).
- **curtainSpread** — lateral half-width added per unit of descent (how much the curtain fans out).
- **curtainMaxWidth** — clamp on the curtain's lateral half-width.

#### Trail (vein fade)
- **maxBranches** — live strand cap; effectively how long the glowing vein trail is before the oldest strands are evicted.
- **fadeStartFraction** — fraction of the trailing window where vein dimming begins; strands reach black exactly as they're evicted.

#### Seeding (applied on Reset)
- **initialAttractors** — attractors scattered around the seed on reset.
- **initialRadius** — disk radius of that initial scatter.
- **planeZJitter** — out-of-plane spread of the initial attractors.
- **Reset** — button; re-seeds growth from a single root using the current Seeding values.

#### Veins
- **tipColor** — hue of the growing tip.
- **rootColor** — hue of the root end.
- **tipEmissive** — HDR multiplier on the tip color (pushes it past 1.0 so Bloom catches it).
- **tipWidth** — line width at the tip.
- **rootWidth** — line width at the root.
- **additiveBlending** — additive (glowing, overlaps brighten) vs normal blending for the veins.

#### Camera
- **cameraPositionLerp** — smoothing of the camera position as it follows the front (higher = snappier).
- **cameraLookLerp** — smoothing of the look-at target as it follows the front.
- **cameraOffsetX / Y / Z** — camera position offset from the branch tip (frontier), per axis.
- **cameraLookAtX / Y / Z** — push the look-at target away from the tip, per axis (±7, 0.001 steps).
- **cameraRotX / Y / Z** — extra rotation (radians) applied on top of the look direction, per axis (±7, 0.001 steps).

#### Bloom
- **bloomIntensity** — strength of the bloom glow.
- **luminanceThreshold** — brightness above which pixels bloom.
- **luminanceSmoothing** — softness of the threshold knee.
- **toneMappingExposure** — ACES tone-mapping exposure (overall image brightness).

#### Depth (layered planes)
- **depthLayers** — number of discrete Z planes strands are distributed across (1 = flat).
- **layerSpacing** — Z distance between adjacent planes (drives the parallax).
- **layerJumpChance** — chance a newly-created strand hops to an adjacent plane instead of staying on its parent's.

#### Pulses (vein energy)
- **pulseIntensity** — HDR brightness of the pulses added along the veins (0 = off).
- **pulseSpeed** — how fast pulses travel along a strand.
- **pulseCount** — number of pulses spaced along each strand.
- **pulseWidth** — width of each pulse band (in normalized along-strand units).
- **pulseColor** — pulse tint (× intensity for HDR).
- **pulseDirection** — travel direction: *Toward tips* or *Toward roots*.

#### Hue
- **hueShift** — hue rotation added across a vein's lifetime, from the front (0) to fully aged, before it fades to black.

#### Motes (atmosphere)
- **motesOpacity** — overall brightness of the motes and their trails (0 = off).
- **motesSize** — base sprite size of a mote head.
- **motesDrift** — overall speed of mote movement.
- **motesColor1–4** — four-color palette; each mote randomly takes one (trail matches its mote).
- **motesTrailLength** — max points in a mote's tapering, fading trail (0 = no trail). Scales down with a mote's life.
- **motesSwirl** — curliness of mote motion (0 = straight along the current).
- **motesCount** — how many motes are alive at once.
- **motesFadeSpeed** — life lost per second: how fast a mote fades out (ease-out-cubic) and dies before respawning elsewhere.

### Layout

```
src/venation/
  config.ts            # Live, mutable parameter singleton (GUI writes here)
  engine.ts            # Pure-TS space colonization engine (grid-indexed)
  BranchLine.tsx       # One meshline strand (HDR gradient + width taper)
  VenationRenderer.tsx # R3F component mapping the node graph → strands
  CameraController.tsx # Cinematic follow camera
  VenationScene.tsx    # Canvas + Bloom postprocessing shell
  Gui.tsx              # leva control panel, gated behind ?gui
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
