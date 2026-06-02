// Shared, mutable runtime configuration for the venation experiment.
//
// A single live singleton (`config`) is read directly each frame by the engine,
// the camera, the vein materials, and the post-processing pass. That means the
// leva GUI can tune the experiment on the fly simply by writing into this
// object — no prop threading, no React re-renders on the hot path. The GUI is
// gated behind the `?gui` query param (see Gui.tsx).

/** The subset of config the pure engine consumes. */
export interface EngineParams {
  influenceRadius: number // attractors influence nodes within this distance
  killRadius: number // attractors killed when a node enters this distance
  segmentLength: number // step size per growth iteration
  maxAttractors: number // soft cap; replenish when below threshold
  replenishRadius: number // radius around the frontier to spawn new attractors
  zWobble: number // max Z displacement per step (keeps it quasi-flat)
  branchAngleNoise: number // radians of random deviation per step
  maxGrowthPerTick: number // new nodes emitted per iterate() (visual legibility)
  candidateLimit: number // most-recent tips examined per tick (bounds cost)
  forkSpread: number // radians; angular spread above which a tip may fork
  minForkAttractors: number // minimum influencers before a fork is considered
  forkProbability: number // chance an eligible tip actually forks
  initialAttractors: number // attractors scattered around the seed on reset
  initialRadius: number // disk radius for the initial scatter
  planeZJitter: number // initial out-of-plane spread of attractors

  // Directional growth (tropism). Blends a constant bias direction into every
  // step so growth flows steadily one way instead of curling, and keeps the
  // attractor cloud marching ahead of the frontier instead of piling up.
  biasStrength: number // 0 = pure space colonization, 1 = fully directional
  biasX: number // bias direction (defaults point straight down)
  biasY: number
  biasZ: number
  replenishAhead: number // distance ahead of the frontier to seed new attractors
  cullBehind: number // abandon attractors this far behind the frontier
}

export interface VenationConfig extends EngineParams {
  // Veins / material.
  tipColor: string // hue of the growing tip (#00ffcc bright cyan)
  rootColor: string // hue of the root (#00aa44 deep green)
  tipEmissive: number // HDR multiplier on the tip so Bloom latches onto it
  tipWidth: number // line width at the tip
  rootWidth: number // line width at the root
  additiveBlending: boolean // bioluminescent glow where veins overlap

  // Camera.
  cameraPositionLerp: number
  cameraLookLerp: number
  cameraOffsetZ: number

  // Bloom / tone mapping.
  bloomIntensity: number
  luminanceThreshold: number
  luminanceSmoothing: number
  toneMappingExposure: number

  // Monotonic counters so imperative consumers can cheaply detect GUI edits.
  visualVersion: number // colors / blending changed
  widthVersion: number // line widths changed
  resetVersion: number // user requested a fresh seed
}

export const DEFAULT_CONFIG: VenationConfig = {
  influenceRadius: 0.8,
  killRadius: 0.12,
  segmentLength: 0.04,
  maxAttractors: 600,
  replenishRadius: 2.5,
  zWobble: 0.015,
  branchAngleNoise: 0.18,
  maxGrowthPerTick: 3,
  candidateLimit: 600,
  forkSpread: 0.9,
  minForkAttractors: 5,
  forkProbability: 0.5,
  initialAttractors: 350,
  initialRadius: 1.25,
  planeZJitter: 0.06,

  biasStrength: 0.45,
  biasX: 0,
  biasY: -1, // flow downward by default
  biasZ: 0,
  replenishAhead: 2.0,
  cullBehind: 2.0,

  tipColor: '#00ffcc',
  rootColor: '#00aa44',
  tipEmissive: 3.0,
  tipWidth: 0.006,
  rootWidth: 0.018,
  additiveBlending: true,

  cameraPositionLerp: 0.05, // fast enough to keep the descending front framed
  cameraLookLerp: 0.08,
  cameraOffsetZ: 2.2,

  bloomIntensity: 1.4,
  luminanceThreshold: 0.6,
  luminanceSmoothing: 0.4,
  toneMappingExposure: 1.2,

  visualVersion: 0,
  widthVersion: 0,
  resetVersion: 0,
}

/** The live, mutable configuration read across the experiment. */
export const config: VenationConfig = { ...DEFAULT_CONFIG }
