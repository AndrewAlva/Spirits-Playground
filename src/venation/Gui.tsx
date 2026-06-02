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
    replenishBelow: {
      value: DEFAULT_CONFIG.replenishBelow,
      min: 0,
      max: 2000,
      step: 10,
      onChange: (v: number) => (config.replenishBelow = v),
    },
    candidateLimit: {
      value: DEFAULT_CONFIG.candidateLimit,
      min: 50,
      max: 5000,
      step: 50,
      onChange: (v: number) => (config.candidateLimit = v),
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
    cameraOffsetZ: {
      value: DEFAULT_CONFIG.cameraOffsetZ,
      min: 0.5,
      max: 8,
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

  // Single Leva panel; hidden unless `?gui` is present.
  return <Leva collapsed hidden={!visible} titleBar={{ title: 'Venation' }} />
}
