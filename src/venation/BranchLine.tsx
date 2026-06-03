import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react'
import * as THREE from 'three'
import { extend, useThree, type ThreeElement } from '@react-three/fiber'
import { MeshLineGeometry } from 'meshline'
import { config } from './config'
import { PulseMeshLineMaterial } from './PulseMeshLineMaterial'

// Register the meshline geometry + our pulse material as JSX intrinsics.
extend({ MeshLineGeometry, PulseMeshLineMaterial })

declare module '@react-three/fiber' {
  interface ThreeElements {
    meshLineGeometry: ThreeElement<typeof MeshLineGeometry>
    pulseMeshLineMaterial: ThreeElement<typeof PulseMeshLineMaterial>
  }
}

/** Pre-allocated position capacity per strand (never reallocated). */
export const MAX_POINTS_PER_BRANCH = 512

// meshline invokes the width callback with p ∈ [0,1] where p=0 is the FIRST
// point and p=1 the LAST. We store points root-first (index 0 = root, last =
// growing tip), so the spec's "0 = tip / 1 = root, 0.006 + p*0.012" becomes the
// equivalent inverted form below — thick at the root, tapering to the tip. Reads
// live config so width tweaks apply on the next flush.
const widthCallback = (p: number) =>
  config.tipWidth + (1 - p) * (config.rootWidth - config.tipWidth)

// pmndrs `meshline` has no per-vertex color attribute; its material instead
// interpolates a 2-stop `gradient` along the line's `counters` (0 at the first
// point → 1 at the last). We map that onto the configured tip/root colors. The
// tip stop is pushed HDR (× tipEmissive) so Bloom latches onto the frontier.

export interface BranchLineHandle {
  /** Append one node to the tip end of the strand. */
  append: (x: number, y: number, z: number) => void
  /** Current number of points in the strand. */
  pointCount: () => number
  /** Re-apply the configured colors / blending (GUI live edit). */
  applyColor: () => void
  /** Re-apply the configured widths to existing points (GUI live edit). */
  applyWidth: () => void
  /**
   * Update the trail look: `fade` 1→0 is brightness behind the front, `age`
   * 0→1 is how far back the strand sits (drives the hue shift).
   */
  setTrail: (fade: number, age: number) => void
}

interface BranchLineProps {
  /** Seed points, root-first, as a flat [x,y,z, x,y,z, ...] array. */
  initialPoints: number[]
  /** Z offset of this strand's depth plane (parallax layering). */
  layerZ: number
}

function BranchLineImpl(
  { initialPoints, layerZ }: BranchLineProps,
  ref: React.Ref<BranchLineHandle>,
) {
  const geometryRef = useRef<MeshLineGeometry>(null!)
  const materialRef = useRef<PulseMeshLineMaterial>(null!)
  const size = useThree((s) => s.size)
  const fadeRef = useRef(1) // 1 = full brightness, 0 = faded to black
  const ageRef = useRef(0) // 0 = at the front, 1 = fully aged (hue shifted)
  const meshPos = useMemo<[number, number, number]>(() => [0, 0, layerZ], [layerZ])

  // Single pre-allocated buffer for the life of the strand. Growth writes into
  // it with a cursor; we never recreate the geometry object or this array.
  const positions = useMemo(() => new Float32Array(MAX_POINTS_PER_BRANCH * 3), [])
  const countRef = useRef(0)

  // MeshLineMaterial's constructor takes a required parameter object; the
  // resolution is corrected to the real viewport size in the effect below.
  const materialArgs = useMemo(
    () => [{ resolution: new THREE.Vector2(1, 1) }] as const,
    [],
  )

  // Push the currently-filled slice into the geometry. `subarray` is a view
  // (no copy); only the populated portion is handed to meshline.
  const flush = () => {
    const g = geometryRef.current
    if (!g) return
    g.setPoints(positions.subarray(0, countRef.current * 3), widthCallback)
  }

  // Seed the strand with its initial points once the geometry exists.
  useLayoutEffect(() => {
    const n = Math.min(initialPoints.length, MAX_POINTS_PER_BRANCH * 3)
    for (let i = 0; i < n; i++) positions[i] = initialPoints[i]
    countRef.current = Math.floor(n / 3)
    flush()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Write the configured colors (scaled by the current fade) into this strand's
  // OWN gradient uniform — mutated in place so strands never alias each other's
  // colors, which is what lets each fade independently.
  const pushColors = () => {
    const m = materialRef.current
    if (!m) return
    const g = m.uniforms.gradient.value as THREE.Color[]
    const fade = fadeRef.current
    const dh = ageRef.current * config.hueShift // hue turns added as the strand ages
    g[0].set(config.rootColor)
    g[1].set(config.tipColor).multiplyScalar(config.tipEmissive)
    if (dh !== 0) {
      g[0].offsetHSL(dh, 0, 0)
      g[1].offsetHSL(dh, 0, 0)
    }
    g[0].multiplyScalar(fade)
    g[1].multiplyScalar(fade)
    m.useGradient = 1
  }

  // Re-apply colors + blending (GUI live edit). Cheap: colors are uniforms and
  // blending is render state, so no shader recompile is needed.
  const applyColor = () => {
    const m = materialRef.current
    if (!m) return
    pushColors()
    m.blending = config.additiveBlending ? THREE.AdditiveBlending : THREE.NormalBlending
  }

  // Update trail brightness + age (hue). Skips tiny changes to avoid work.
  const setTrail = (fade: number, age: number) => {
    const f = fade < 0 ? 0 : fade > 1 ? 1 : fade
    const a = age < 0 ? 0 : age > 1 ? 1 : age
    if (Math.abs(f - fadeRef.current) < 0.002 && Math.abs(a - ageRef.current) < 0.004) return
    fadeRef.current = f
    ageRef.current = a
    pushColors()
  }

  // Configure the material imperatively (HDR gradient survives this path).
  useLayoutEffect(() => {
    const m = materialRef.current
    if (!m) return
    m.useGradient = 1
    m.lineWidth = 1 // widthCallback supplies absolute widths
    m.transparent = true
    m.depthWrite = false // avoid overdraw sorting cost
    m.depthTest = false // strands never occlude each other over pure black
    m.toneMapped = false // keep HDR intact so Bloom's threshold catches the tips
    m.resolution.set(size.width, size.height)
    applyColor()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the screen-space line width correct across viewport resizes.
  useLayoutEffect(() => {
    materialRef.current?.resolution.set(size.width, size.height)
  }, [size])

  // Free GPU buffers when the strand is culled (branch cap eviction / reset).
  useEffect(() => {
    return () => {
      geometryRef.current?.dispose()
      materialRef.current?.dispose()
    }
  }, [])

  useImperativeHandle(
    ref,
    (): BranchLineHandle => ({
      append(x, y, z) {
        if (countRef.current >= MAX_POINTS_PER_BRANCH) return
        const i = countRef.current * 3
        positions[i] = x
        positions[i + 1] = y
        positions[i + 2] = z
        countRef.current++
        flush()
      },
      pointCount: () => countRef.current,
      applyColor,
      applyWidth: flush, // re-runs widthCallback over the existing points
      setTrail,
    }),
    [],
  )

  return (
    <mesh frustumCulled={false} position={meshPos}>
      <meshLineGeometry ref={geometryRef} attach="geometry" />
      <pulseMeshLineMaterial ref={materialRef} args={materialArgs} attach="material" />
    </mesh>
  )
}

// React.memo: existing strands must not re-render when the parent adds/removes
// sibling strands. `initialPoints` identity is kept stable per strand upstream.
export default memo(forwardRef(BranchLineImpl))
