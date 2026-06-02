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
import { MeshLineGeometry, MeshLineMaterial } from 'meshline'

// Register the pmndrs meshline classes so they're usable as JSX intrinsics.
extend({ MeshLineGeometry, MeshLineMaterial })

declare module '@react-three/fiber' {
  interface ThreeElements {
    meshLineGeometry: ThreeElement<typeof MeshLineGeometry>
    meshLineMaterial: ThreeElement<typeof MeshLineMaterial>
  }
}

/** Pre-allocated position capacity per strand (never reallocated). */
export const MAX_POINTS_PER_BRANCH = 512

const ROOT_WIDTH = 0.018
const TIP_WIDTH = 0.006

// meshline invokes the width callback with p ∈ [0,1] where p=0 is the FIRST
// point and p=1 the LAST. We store points root-first (index 0 = root, last =
// growing tip), so the spec's "0 = tip / 1 = root, 0.006 + p*0.012" becomes the
// equivalent inverted form below — thick at the root, tapering to the tip.
const widthCallback = (p: number) => TIP_WIDTH + (1 - p) * (ROOT_WIDTH - TIP_WIDTH)

// pmndrs `meshline` has no per-vertex color attribute; its material instead
// interpolates a 2-stop `gradient` along the line's `counters` (0 at the first
// point → 1 at the last). We map that onto the spec's tip/root colors. The tip
// stop is HDR (channel > 1.0) so Bloom latches onto the growing frontier.
const ROOT_COLOR = new THREE.Color('#00aa44') // deep green at the root (counter 0)
const TIP_COLOR = new THREE.Color(0, 3.0, 2.0) // HDR cyan at the tip (counter 1)

export interface BranchLineHandle {
  /** Append one node to the tip end of the strand. */
  append: (x: number, y: number, z: number) => void
  /** Current number of points in the strand. */
  pointCount: () => number
}

interface BranchLineProps {
  /** Seed points, root-first, as a flat [x,y,z, x,y,z, ...] array. */
  initialPoints: number[]
}

function BranchLineImpl(
  { initialPoints }: BranchLineProps,
  ref: React.Ref<BranchLineHandle>,
) {
  const geometryRef = useRef<MeshLineGeometry>(null!)
  const materialRef = useRef<MeshLineMaterial>(null!)
  const size = useThree((s) => s.size)

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

  // Configure the material imperatively (HDR gradient survives this path).
  useLayoutEffect(() => {
    const m = materialRef.current
    if (!m) return
    m.gradient = [ROOT_COLOR, TIP_COLOR]
    m.useGradient = 1
    m.lineWidth = 1 // widthCallback supplies absolute widths
    m.transparent = true
    m.depthWrite = false // avoid overdraw sorting cost
    m.depthTest = false // strands never occlude each other over pure black
    m.blending = THREE.AdditiveBlending // bioluminescent glow where veins overlap
    m.toneMapped = false // keep HDR intact so Bloom's threshold catches the tips
    m.resolution.set(size.width, size.height)
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
    }),
    [],
  )

  return (
    <mesh frustumCulled={false}>
      <meshLineGeometry ref={geometryRef} attach="geometry" />
      <meshLineMaterial ref={materialRef} args={materialArgs} attach="material" />
    </mesh>
  )
}

// React.memo: existing strands must not re-render when the parent adds/removes
// sibling strands. `initialPoints` identity is kept stable per strand upstream.
export default memo(forwardRef(BranchLineImpl))
