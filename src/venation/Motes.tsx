import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { config } from './config'

const COUNT = 300 // fixed pool of motes
const FIELD = new THREE.Vector3(14, 14, 6) // box (half-extents ×2) around the front

/**
 * Faint drifting particles in the void — atmosphere and depth cues. The field
 * follows the growth frontier and wraps motes that fall outside the box, so a
 * persistent cloud surrounds the descending camera while individual motes hold
 * world positions long enough to parallax.
 */
export default function Motes({
  frontier,
}: {
  frontier: React.MutableRefObject<THREE.Vector3>
}) {
  const pointsRef = useRef<THREE.Points>(null!)
  const matRef = useRef<THREE.PointsMaterial>(null!)

  const { positions, drift } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    const drift = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * FIELD.x
      positions[i * 3 + 1] = (Math.random() - 0.5) * FIELD.y
      positions[i * 3 + 2] = (Math.random() - 0.5) * FIELD.z
      // gentle per-mote drift direction
      drift[i * 3] = (Math.random() - 0.5)
      drift[i * 3 + 1] = (Math.random() - 0.5)
      drift[i * 3 + 2] = (Math.random() - 0.5)
    }
    return { positions, drift }
  }, [])

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return g
  }, [positions])

  useFrame((_, delta) => {
    const mat = matRef.current
    if (mat) {
      mat.opacity = config.motesOpacity
      mat.size = config.motesSize
      mat.visible = config.motesOpacity > 0.001
    }
    if (!mat || !mat.visible) return

    const f = frontier.current
    const d = Math.min(delta, 0.1) * config.motesDrift
    const arr = positions
    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3
      arr[ix] += drift[ix] * d
      arr[ix + 1] += drift[ix + 1] * d
      arr[ix + 2] += drift[ix + 2] * d
      // wrap motes that leave the box centered on the frontier
      const rx = arr[ix] - f.x
      const ry = arr[ix + 1] - f.y
      const rz = arr[ix + 2] - f.z
      if (rx > FIELD.x / 2) arr[ix] -= FIELD.x
      else if (rx < -FIELD.x / 2) arr[ix] += FIELD.x
      if (ry > FIELD.y / 2) arr[ix + 1] -= FIELD.y
      else if (ry < -FIELD.y / 2) arr[ix + 1] += FIELD.y
      if (rz > FIELD.z / 2) arr[ix + 2] -= FIELD.z
      else if (rz < -FIELD.z / 2) arr[ix + 2] += FIELD.z
    }
    geom.attributes.position.needsUpdate = true
  })

  return (
    <points ref={pointsRef} geometry={geom} frustumCulled={false}>
      <pointsMaterial
        ref={matRef}
        color="#8fffe6"
        size={config.motesSize}
        sizeAttenuation
        transparent
        opacity={config.motesOpacity}
        depthWrite={false}
        toneMapped={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
