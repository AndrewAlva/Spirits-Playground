import { useMemo } from 'react'
import { button, Leva, useControls } from 'leva'
import { config, DEFAULT_CONFIG } from './config'

/** True when the URL contains `?gui` (e.g. `?gui` or `?gui=1`). */
function guiRequested(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).has('gui')
}

/**
 * leva control panel for the venation experiment. Every control writes
 * straight into the live `config` singleton via a transient `onChange`, so the
 * engine / camera / materials / post-FX pick edits up on their next frame with
 * no React re-render. Visual + width edits bump version counters the renderer
 * watches; "Reset" bumps the reset counter to re-seed growth.
 *
 * The panel is gated behind `?gui`; otherwise it's hidden (controls are still
 * registered at their defaults, which is a no-op).
 */
export default function Gui() {
  const visible = useMemo(guiRequested, [])

  // ── Growth ────────────────────────────────────────────────────────────────
  useControls('Growth', {
    growthSpeed: {
      value: DEFAULT_CONFIG.growthSpeed,
      min: 1,
      max: 120,
      step: 1,
      onChange: (v: number) => (config.growthSpeed = v),
    },
    influenceRadius: {
      value: DEFAULT_CONFIG.influenceRadius,
      min: 0.05,
      max: 2.5,
      step: 0.01,
      onChange: (v: number) => (config.influenceRadius = v),
    },
    killRadius: {
      value: DEFAULT_CONFIG.killRadius,
      min: 0.02,
      max: 1,
      step: 0.01,
      onChange: (v: number) => (config.killRadius = v),
    },
    segmentLength: {
      value: DEFAULT_CONFIG.segmentLength,
      min: 0.005,
      max: 0.2,
      step: 0.005,
      onChange: (v: number) => (config.segmentLength = v),
    },
    branchAngleNoise: {
      value: DEFAULT_CONFIG.branchAngleNoise,
      min: 0,
      max: 1,
      step: 0.01,
      onChange: (v: number) => (config.branchAngleNoise = v),
    },
    zWobble: {
      value: DEFAULT_CONFIG.zWobble,
      min: 0,
      max: 0.2,
      step: 0.005,
      onChange: (v: number) => (config.zWobble = v),
    },
    maxGrowthPerTick: {
      value: DEFAULT_CONFIG.maxGrowthPerTick,
      min: 1,
      max: 20,
      step: 1,
      onChange: (v: number) => (config.maxGrowthPerTick = v),
    },
  })

  // ── Forking ─────────────────────────────────────────────────────────────────
  useControls('Forking', {
    forkSpread: {
      value: DEFAULT_CONFIG.forkSpread,
      min: 0,
      max: Math.PI,
      step: 0.01,
      onChange: (v: number) => (config.forkSpread = v),
    },
    minForkAttractors: {
      value: DEFAULT_CONFIG.minForkAttractors,
      min: 2,
      max: 30,
      step: 1,
      onChange: (v: number) => (config.minForkAttractors = v),
    },
    forkProbability: {
      value: DEFAULT_CONFIG.forkProbability,
      min: 0,
      max: 1,
      step: 0.01,
      onChange: (v: number) => (config.forkProbability = v),
    },
  })

  // ── Attractors ──────────────────────────────────────────────────────────────
  useControls('Attractors', {
    maxAttractors: {
      value: DEFAULT_CONFIG.maxAttractors,
      min: 50,
      max: 3000,
      step: 50,
      onChange: (v: number) => (config.maxAttractors = v),
    },
    replenishRadius: {
      value: DEFAULT_CONFIG.replenishRadius,
      min: 0.5,
      max: 8,
      step: 0.1,
      onChange: (v: number) => (config.replenishRadius = v),
    },
    candidateLimit: {
      value: DEFAULT_CONFIG.candidateLimit,
      min: 50,
      max: 5000,
      step: 50,
      onChange: (v: number) => (config.candidateLimit = v),
    },
  })

  // ── Direction (tropism) ──────────────────────────────────────────────────────
  useControls('Direction', {
    biasStrength: {
      value: DEFAULT_CONFIG.biasStrength,
      min: 0,
      max: 1,
      step: 0.01,
      onChange: (v: number) => (config.biasStrength = v),
    },
    biasX: {
      value: DEFAULT_CONFIG.biasX,
      min: -1,
      max: 1,
      step: 0.05,
      onChange: (v: number) => (config.biasX = v),
    },
    biasY: {
      value: DEFAULT_CONFIG.biasY,
      min: -1,
      max: 1,
      step: 0.05,
      onChange: (v: number) => (config.biasY = v),
    },
    biasZ: {
      value: DEFAULT_CONFIG.biasZ,
      min: -1,
      max: 1,
      step: 0.05,
      onChange: (v: number) => (config.biasZ = v),
    },
    replenishAhead: {
      value: DEFAULT_CONFIG.replenishAhead,
      min: 0,
      max: 6,
      step: 0.1,
      onChange: (v: number) => (config.replenishAhead = v),
    },
    cullBehind: {
      value: DEFAULT_CONFIG.cullBehind,
      min: 0.2,
      max: 8,
      step: 0.1,
      onChange: (v: number) => (config.cullBehind = v),
    },
    curtainSpread: {
      value: DEFAULT_CONFIG.curtainSpread,
      min: 0,
      max: 0.5,
      step: 0.01,
      onChange: (v: number) => (config.curtainSpread = v),
    },
    curtainMaxWidth: {
      value: DEFAULT_CONFIG.curtainMaxWidth,
      min: 1,
      max: 30,
      step: 0.5,
      onChange: (v: number) => (config.curtainMaxWidth = v),
    },
  })

  // ── Trail / fade ────────────────────────────────────────────────────────────
  useControls('Trail', {
    maxBranches: {
      value: DEFAULT_CONFIG.maxBranches,
      min: 20,
      max: 600,
      step: 10,
      onChange: (v: number) => (config.maxBranches = v),
    },
    fadeStartFraction: {
      value: DEFAULT_CONFIG.fadeStartFraction,
      min: 0,
      max: 1,
      step: 0.01,
      onChange: (v: number) => (config.fadeStartFraction = v),
    },
  })

  // ── Seeding (applied on Reset) ───────────────────────────────────────────────
  useControls('Seeding', {
    initialAttractors: {
      value: DEFAULT_CONFIG.initialAttractors,
      min: 10,
      max: 2000,
      step: 10,
      onChange: (v: number) => (config.initialAttractors = v),
    },
    initialRadius: {
      value: DEFAULT_CONFIG.initialRadius,
      min: 0.2,
      max: 5,
      step: 0.05,
      onChange: (v: number) => (config.initialRadius = v),
    },
    planeZJitter: {
      value: DEFAULT_CONFIG.planeZJitter,
      min: 0,
      max: 1,
      step: 0.01,
      onChange: (v: number) => (config.planeZJitter = v),
    },
    Reset: button(() => {
      config.resetVersion++
    }),
  })

  // ── Veins (live colors / widths) ─────────────────────────────────────────────
  useControls('Veins', {
    tipColor: {
      value: DEFAULT_CONFIG.tipColor,
      onChange: (v: string) => {
        config.tipColor = v
        config.visualVersion++
      },
    },
    rootColor: {
      value: DEFAULT_CONFIG.rootColor,
      onChange: (v: string) => {
        config.rootColor = v
        config.visualVersion++
      },
    },
    tipEmissive: {
      value: DEFAULT_CONFIG.tipEmissive,
      min: 1,
      max: 10,
      step: 0.1,
      onChange: (v: number) => {
        config.tipEmissive = v
        config.visualVersion++
      },
    },
    tipWidth: {
      value: DEFAULT_CONFIG.tipWidth,
      min: 0.001,
      max: 0.05,
      step: 0.001,
      onChange: (v: number) => {
        config.tipWidth = v
        config.widthVersion++
      },
    },
    rootWidth: {
      value: DEFAULT_CONFIG.rootWidth,
      min: 0.001,
      max: 0.08,
      step: 0.001,
      onChange: (v: number) => {
        config.rootWidth = v
        config.widthVersion++
      },
    },
    additiveBlending: {
      value: DEFAULT_CONFIG.additiveBlending,
      onChange: (v: boolean) => {
        config.additiveBlending = v
        config.visualVersion++
      },
    },
  })

  // ── Camera ────────────────────────────────────────────────────────────────
  useControls('Camera', {
    cameraPositionLerp: {
      value: DEFAULT_CONFIG.cameraPositionLerp,
      min: 0.001,
      max: 0.2,
      step: 0.001,
      onChange: (v: number) => (config.cameraPositionLerp = v),
    },
    cameraLookLerp: {
      value: DEFAULT_CONFIG.cameraLookLerp,
      min: 0.001,
      max: 0.2,
      step: 0.001,
      onChange: (v: number) => (config.cameraLookLerp = v),
    },
    cameraOffsetX: {
      value: DEFAULT_CONFIG.cameraOffsetX,
      min: -10,
      max: 10,
      step: 0.1,
      onChange: (v: number) => (config.cameraOffsetX = v),
    },
    cameraOffsetY: {
      value: DEFAULT_CONFIG.cameraOffsetY,
      min: -10,
      max: 10,
      step: 0.1,
      onChange: (v: number) => (config.cameraOffsetY = v),
    },
    cameraOffsetZ: {
      value: DEFAULT_CONFIG.cameraOffsetZ,
      min: -10,
      max: 10,
      step: 0.1,
      onChange: (v: number) => (config.cameraOffsetZ = v),
    },
  })

  // ── Bloom / Tone ────────────────────────────────────────────────────────────
  useControls('Bloom', {
    bloomIntensity: {
      value: DEFAULT_CONFIG.bloomIntensity,
      min: 0,
      max: 5,
      step: 0.05,
      onChange: (v: number) => (config.bloomIntensity = v),
    },
    luminanceThreshold: {
      value: DEFAULT_CONFIG.luminanceThreshold,
      min: 0,
      max: 1,
      step: 0.01,
      onChange: (v: number) => (config.luminanceThreshold = v),
    },
    luminanceSmoothing: {
      value: DEFAULT_CONFIG.luminanceSmoothing,
      min: 0,
      max: 1,
      step: 0.01,
      onChange: (v: number) => (config.luminanceSmoothing = v),
    },
    toneMappingExposure: {
      value: DEFAULT_CONFIG.toneMappingExposure,
      min: 0.1,
      max: 3,
      step: 0.05,
      onChange: (v: number) => (config.toneMappingExposure = v),
    },
  })

  // ── Depth (layered planes) ───────────────────────────────────────────────────
  useControls('Depth', {
    depthLayers: {
      value: DEFAULT_CONFIG.depthLayers,
      min: 1,
      max: 9,
      step: 1,
      onChange: (v: number) => (config.depthLayers = v),
    },
    layerSpacing: {
      value: DEFAULT_CONFIG.layerSpacing,
      min: 0,
      max: 2,
      step: 0.05,
      onChange: (v: number) => (config.layerSpacing = v),
    },
    layerJumpChance: {
      value: DEFAULT_CONFIG.layerJumpChance,
      min: 0,
      max: 1,
      step: 0.01,
      onChange: (v: number) => (config.layerJumpChance = v),
    },
  })

  // ── Pulses (vein energy) ─────────────────────────────────────────────────────
  useControls('Pulses', {
    pulseIntensity: {
      value: DEFAULT_CONFIG.pulseIntensity,
      min: 0,
      max: 6,
      step: 0.1,
      onChange: (v: number) => (config.pulseIntensity = v),
    },
    pulseSpeed: {
      value: DEFAULT_CONFIG.pulseSpeed,
      min: 0,
      max: 3,
      step: 0.05,
      onChange: (v: number) => (config.pulseSpeed = v),
    },
    pulseCount: {
      value: DEFAULT_CONFIG.pulseCount,
      min: 0.5,
      max: 8,
      step: 0.5,
      onChange: (v: number) => (config.pulseCount = v),
    },
    pulseWidth: {
      value: DEFAULT_CONFIG.pulseWidth,
      min: 0.01,
      max: 0.5,
      step: 0.01,
      onChange: (v: number) => (config.pulseWidth = v),
    },
    pulseColor: {
      value: DEFAULT_CONFIG.pulseColor,
      onChange: (v: string) => (config.pulseColor = v),
    },
    pulseDirection: {
      value: DEFAULT_CONFIG.pulseDirection,
      options: { 'Toward tips': 1, 'Toward roots': -1 },
      onChange: (v: number) => (config.pulseDirection = v),
    },
  })

  // ── Color journey ────────────────────────────────────────────────────────────
  useControls('Hue', {
    hueShift: {
      value: DEFAULT_CONFIG.hueShift,
      min: -0.5,
      max: 0.5,
      step: 0.01,
      onChange: (v: number) => {
        config.hueShift = v
        config.visualVersion++
      },
    },
  })

  // ── Motes (atmosphere) ───────────────────────────────────────────────────────
  useControls('Motes', {
    motesOpacity: {
      value: DEFAULT_CONFIG.motesOpacity,
      min: 0,
      max: 1,
      step: 0.01,
      onChange: (v: number) => (config.motesOpacity = v),
    },
    motesSize: {
      value: DEFAULT_CONFIG.motesSize,
      min: 0.005,
      max: 0.1,
      step: 0.005,
      onChange: (v: number) => (config.motesSize = v),
    },
    motesDrift: {
      value: DEFAULT_CONFIG.motesDrift,
      min: 0,
      max: 0.5,
      step: 0.01,
      onChange: (v: number) => (config.motesDrift = v),
    },
    motesColor1: {
      value: DEFAULT_CONFIG.motesColors[0],
      onChange: (v: string) => {
        config.motesColors[0] = v
        config.motesVersion++
      },
    },
    motesColor2: {
      value: DEFAULT_CONFIG.motesColors[1],
      onChange: (v: string) => {
        config.motesColors[1] = v
        config.motesVersion++
      },
    },
    motesColor3: {
      value: DEFAULT_CONFIG.motesColors[2],
      onChange: (v: string) => {
        config.motesColors[2] = v
        config.motesVersion++
      },
    },
    motesColor4: {
      value: DEFAULT_CONFIG.motesColors[3],
      onChange: (v: string) => {
        config.motesColors[3] = v
        config.motesVersion++
      },
    },
    motesTrailLength: {
      value: DEFAULT_CONFIG.motesTrailLength,
      min: 0,
      max: 200,
      step: 1,
      onChange: (v: number) => (config.motesTrailLength = v),
    },
    motesSwirl: {
      value: DEFAULT_CONFIG.motesSwirl,
      min: 0,
      max: 50,
      step: 0.01,
      onChange: (v: number) => (config.motesSwirl = v),
    },
  })

  // Single Leva panel; hidden unless `?gui` is present.
  return <Leva collapsed hidden={!visible} titleBar={{ title: 'Venation' }} />
}
