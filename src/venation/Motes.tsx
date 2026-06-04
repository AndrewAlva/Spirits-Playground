import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { config } from './config'

const COUNT = 300 // fixed pool of motes
const FIELD = new THREE.Vector3(14, 14, 6) // box (full extents) around the front
const SCALE_MIN = 0.4 // per-mote size multiplier range (size variation)
const SCALE_MAX = 1.5

/** Soft radial-gradient sprite so points render as round, glowing dots. */
function makeCircleTexture(): THREE.Texture {
  const s = 64
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.7)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  const tex = new THREE.CanvasTexture(c)
  tex.needsUpdate = true
  return tex
}

/**
 * Faint drifting particles in the void — atmosphere and depth cues. Each mote
 * picks one of four palette colours, has a slightly randomized size, and renders
 * as a soft circle. The field follows the growth frontier and wraps motes that
 * fall outside the box, so a persistent cloud surrounds the descending camera
 * while individual motes hold world positions long enough to parallax.
 */
export default function Motes({
  frontier,
}: {
  frontier: React.MutableRefObject<THREE.Vector3>
}) {
  const matRef = useRef<THREE.PointsMaterial>(null!)
  const lastVersion = useRef(-1)

  const circleTex = useMemo(makeCircleTexture, [])

  const { positions, colors, scales, drift, colorIndex } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    const colors = new Float32Array(COUNT * 3)
    const scales = new Float32Array(COUNT)
    const drift = new Float32Array(COUNT * 3)
    const colorIndex = new Uint8Array(COUNT)
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * FIELD.x
      positions[i * 3 + 1] = (Math.random() - 0.5) * FIELD.y
      positions[i * 3 + 2] = (Math.random() - 0.5) * FIELD.z
      drift[i * 3] = Math.random() - 0.5
      drift[i * 3 + 1] = Math.random() - 0.5
      drift[i * 3 + 2] = Math.random() - 0.5
      scales[i] = SCALE_MIN + Math.random() * (SCALE_MAX - SCALE_MIN)
      colorIndex[i] = Math.floor(Math.random() * 4)
    }
    return { positions, colors, scales, drift, colorIndex }
  }, [])

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    g.setAttribute('aScale', new THREE.BufferAttribute(scales, 1))
    return g
  }, [positions, colors, scales])

  // Per-vertex size: multiply gl_PointSize by the strand's aScale attribute.
  const onBeforeCompile = useMemo(
    () => (shader: { vertexShader: string }) => {
      shader.vertexShader =
        'attribute float aScale;\n' +
        shader.vertexShader.replace('gl_PointSize = size;', 'gl_PointSize = size * aScale;')
    },
    [],
  )

  // Recolor every mote from the current 4-colour palette.
  const c = useMemo(() => new THREE.Color(), [])
  const recolor = () => {
    const palette = config.motesColors
    for (let i = 0; i < COUNT; i++) {
      c.set(palette[colorIndex[i]] ?? '#ffffff')
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    geom.attributes.color.needsUpdate = true
  }

  useFrame((_, delta) => {
    const mat = matRef.current
    if (mat) {
      mat.opacity = config.motesOpacity
      mat.size = config.motesSize
      mat.visible = config.motesOpacity > 0.001
    }
    if (lastVersion.current !== config.motesVersion) {
      lastVersion.current = config.motesVersion
      recolor()
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
    <points geometry={geom} frustumCulled={false}>
      <pointsMaterial
        ref={matRef}
        map={circleTex}
        vertexColors
        size={config.motesSize}
        sizeAttenuation
        transparent
        opacity={config.motesOpacity}
        depthWrite={false}
        toneMapped={false}
        blending={THREE.AdditiveBlending}
        onBeforeCompile={onBeforeCompile}
      />
    </points>
  )
}
