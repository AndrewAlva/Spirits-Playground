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
  curtainSpread: number // lateral half-width added per unit of descent (fan-out)
  curtainMaxWidth: number // clamp on the curtain's lateral half-width
}

export interface VenationConfig extends EngineParams {
  // Veins / material.
  tipColor: string // hue of the growing tip (#00ffcc bright cyan)
  rootColor: string // hue of the root (#00aa44 deep green)
  tipEmissive: number // HDR multiplier on the tip so Bloom latches onto it
  tipWidth: number // line width at the tip
  rootWidth: number // line width at the root
  additiveBlending: boolean // bioluminescent glow where veins overlap

  // Growth rate (decoupled from frame rate). Simulation "ticks" per second;
  // each tick advances the flow by up to maxGrowthPerTick nodes.
  growthSpeed: number

  // Camera. Offset is the camera's position relative to the branch tip
  // (frontier) on each axis; the camera always looks at the tip.
  cameraPositionLerp: number
  cameraLookLerp: number
  cameraOffsetX: number
  cameraOffsetY: number
  cameraOffsetZ: number

  // Bloom / tone mapping.
  bloomIntensity: number
  luminanceThreshold: number
  luminanceSmoothing: number
  toneMappingExposure: number

  // Trail. The live strands form a trailing window behind the front; the fade
  // is measured as a fraction of that window so strands always reach full black
  // exactly as they're evicted (no popping), at any growth rate.
  maxBranches: number // live strand cap → how long the glowing trail is
  fadeStartFraction: number // 0..1 of the window where dimming begins

  // Depth: strands are distributed across a few discrete Z planes that parallax
  // under the descending camera.
  depthLayers: number // number of discrete Z planes (1 = flat)
  layerSpacing: number // Z distance between adjacent planes
  layerJumpChance: number // chance a new strand hops to an adjacent layer

  // Vein energy: bright pulses travelling along the veins toward the tips.
  pulseIntensity: number // 0 = off; HDR brightness added at the pulse
  pulseSpeed: number // pulses per second along a strand
  pulseWidth: number // pulse half-width in counter units (0..1)
  pulseCount: number // number of pulses spaced along a strand
  pulseColor: string // pulse tint (multiplied by pulseIntensity for HDR)
  pulseDirection: number // +1 = toward tips, -1 = toward roots

  // Hue shift over the trail: front hue rotates as strands age toward black.
  hueShift: number // hue turns added from front (0) to fully aged (1)

  // Drifting motes: faint atmospheric particles in the void.
  motesOpacity: number // 0 = off
  motesSize: number
  motesDrift: number // slow drift speed
  motesColors: [string, string, string, string] // palette; each mote picks one
  motesVersion: number // bumped when the palette changes (triggers recolor)

  // Monotonic counters so imperative consumers can cheaply detect GUI edits.
  visualVersion: number // colors / blending changed
  widthVersion: number // line widths changed
  resetVersion: number // user requested a fresh seed
}

export const DEFAULT_CONFIG: VenationConfig = {
  influenceRadius: 0.67,
  killRadius: 0.27,
  segmentLength: 0.08,
  maxAttractors: 3000,
  replenishRadius: 7.0,
  zWobble: 0.04,
  branchAngleNoise: 1.0,
  maxGrowthPerTick: 5,
  candidateLimit: 50,
  forkSpread: 2.77,
  minForkAttractors: 4,
  forkProbability: 0.46,
  initialAttractors: 350,
  initialRadius: 1.25,
  planeZJitter: 1.00,

  biasStrength: 0.68,
  biasX: 0,
  biasY: -0.1, // flow downward by default
  biasZ: 0,
  replenishAhead: 6.0,
  cullBehind: 2.0,
  curtainSpread: 0.08,
  curtainMaxWidth: 6.0,

  tipColor: '#884e17',
  rootColor: '#ffb752',
  tipEmissive: 2.1,
  tipWidth: 0.001,
  rootWidth: 0.05,
  additiveBlending: true,

  growthSpeed: 36, // ticks/sec (≈ half the previous fixed 60/frame rate)

  cameraPositionLerp: 0.05, // fast enough to keep the descending front framed
  cameraLookLerp: 0.08,
  cameraOffsetX: 0,
  cameraOffsetY: -2.6,
  cameraOffsetZ: 1.5, // zoomed out enough to see the widening curtain + fade

  bloomIntensity: 4.55,
  luminanceThreshold: 0.19,
  luminanceSmoothing: 0.1,
  toneMappingExposure: 1.15,

  maxBranches: 50,
  fadeStartFraction: 0.01,

  depthLayers: 3,
  layerSpacing: 0.4,
  layerJumpChance: 0.25,

  pulseIntensity: 1.5,
  pulseSpeed: 0.5,
  pulseWidth: 0.12,
  pulseCount: 2,
  pulseColor: '#ffffff',
  pulseDirection: 1,

  hueShift: 0.15,

  motesOpacity: 0.5,
  motesSize: 0.025,
  motesDrift: 0.05,
  motesColors: ['#8fffe6', '#aef0ff', '#ffd9a0', '#ffffff'],
  motesVersion: 0,

  visualVersion: 1,
  widthVersion: 0,
  resetVersion: 0,
}

/** The live, mutable configuration read across the experiment. */
export const config: VenationConfig = {
  ...DEFAULT_CONFIG,
  // Own copy of nested objects so live edits don't mutate DEFAULT_CONFIG.
  motesColors: [...DEFAULT_CONFIG.motesColors] as [string, string, string, string],
}
