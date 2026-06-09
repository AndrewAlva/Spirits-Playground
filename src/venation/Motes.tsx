import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { config } from './config'

const COUNT = 300 // fixed pool of motes
const FIELD = new THREE.Vector3(14, 14, 6) // box (full extents) around the front
const SCALE_MIN = 0.4 // per-mote size multiplier range (size variation)
const SCALE_MAX = 1.5
const MAX_TRAIL = 40 // ring-buffer capacity per mote (cap on trail length)

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
 * picks one of four palette colours, has a slightly randomized size, renders as
 * a soft circle, and trails a short fading curve showing where it has been
 * (brightest at the mote, fading to nothing). The field follows the growth
 * frontier and wraps motes that leave the box; on wrap the mote's whole trail
 * history is shifted with it so the curve stays continuous.
 */
export default function Motes({
  frontier,
}: {
  frontier: React.MutableRefObject<THREE.Vector3>
}) {
  const matRef = useRef<THREE.PointsMaterial>(null!)
  const trailMatRef = useRef<THREE.LineBasicMaterial>(null!)
  const lastVersion = useRef(-1)
  const elapsed = useRef(0)
  const head = useRef(0) // shared ring-buffer write index

  const circleTex = useMemo(makeCircleTexture, [])

  const data = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    const colors = new Float32Array(COUNT * 3)
    const scales = new Float32Array(COUNT)
    const drift = new Float32Array(COUNT * 3)
    const phase = new Float32Array(COUNT)
    const colorIndex = new Uint8Array(COUNT)
    const history = new Float32Array(COUNT * MAX_TRAIL * 3)
    for (let i = 0; i < COUNT; i++) {
      const x = (Math.random() - 0.5) * FIELD.x
      const y = (Math.random() - 0.5) * FIELD.y
      const z = (Math.random() - 0.5) * FIELD.z
      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      drift[i * 3] = Math.random() - 0.5
      drift[i * 3 + 1] = Math.random() - 0.5
      drift[i * 3 + 2] = Math.random() - 0.5
      phase[i] = Math.random() * Math.PI * 2
      scales[i] = SCALE_MIN + Math.random() * (SCALE_MAX - SCALE_MIN)
      colorIndex[i] = Math.floor(Math.random() * 4)
      // seed the whole trail history at the starting position
      for (let k = 0; k < MAX_TRAIL; k++) {
        const h = (i * MAX_TRAIL + k) * 3
        history[h] = x
        history[h + 1] = y
        history[h + 2] = z
      }
    }
    // pre-allocated trail segment buffers (one LineSegments for all motes)
    const segCount = COUNT * (MAX_TRAIL - 1)
    const trailPos = new Float32Array(segCount * 2 * 3)
    const trailCol = new Float32Array(segCount * 2 * 3)
    return { positions, colors, scales, drift, phase, colorIndex, history, trailPos, trailCol }
  }, [])

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
    g.setAttribute('color', new THREE.BufferAttribute(data.colors, 3))
    g.setAttribute('aScale', new THREE.BufferAttribute(data.scales, 1))
    return g
  }, [data])

  const trailGeom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(data.trailPos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(data.trailCol, 3))
    return g
  }, [data])

  // Per-vertex size: multiply gl_PointSize by the strand's aScale attribute.
  const onBeforeCompile = useMemo(
    () => (shader: { vertexShader: string }) => {
      shader.vertexShader =
        'attribute float aScale;\n' +
        shader.vertexShader.replace('gl_PointSize = size;', 'gl_PointSize = size * aScale;')
    },
    [],
  )

  // Recolor every dot from the current 4-colour palette.
  const tmpColor = useMemo(() => new THREE.Color(), [])
  const recolorDots = () => {
    const palette = config.motesColors
    for (let i = 0; i < COUNT; i++) {
      tmpColor.set(palette[data.colorIndex[i]] ?? '#ffffff')
      data.colors[i * 3] = tmpColor.r
      data.colors[i * 3 + 1] = tmpColor.g
      data.colors[i * 3 + 2] = tmpColor.b
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
    if (trailMatRef.current) trailMatRef.current.opacity = config.motesOpacity
    if (lastVersion.current !== config.motesVersion) {
      lastVersion.current = config.motesVersion
      recolorDots()
    }
    if (!mat || !mat.visible) return

    elapsed.current += delta
    const t = elapsed.current
    const f = frontier.current
    const d = Math.min(delta, 0.1) * config.motesDrift
    const swirl = config.motesSwirl
    const { positions, drift, phase, history } = data

    // advance the ring-buffer write slot
    head.current = (head.current + 1) % MAX_TRAIL
    const hk = head.current

    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3
      // integrate position: base drift + gentle swirl so paths curve
      let vx = drift[ix]
      let vy = drift[ix + 1]
      const vz = drift[ix + 2]
      if (swirl > 0) {
        vx += Math.sin(positions[ix + 1] * 0.6 + t * 0.5 + phase[i]) * swirl
        vy += Math.cos(positions[ix] * 0.6 + t * 0.4 + phase[i] * 1.3) * swirl
      }
      positions[ix] += vx * d
      positions[ix + 1] += vy * d
      positions[ix + 2] += vz * d

      // wrap around the box centred on the frontier; shift the mote's whole
      // trail history by the same offset so the curve stays continuous.
      const hbase = i * MAX_TRAIL * 3
      const rx = positions[ix] - f.x
      const ry = positions[ix + 1] - f.y
      const rz = positions[ix + 2] - f.z
      if (rx > FIELD.x / 2 || rx < -FIELD.x / 2) {
        const off = rx > 0 ? -FIELD.x : FIELD.x
        positions[ix] += off
        for (let k = 0; k < MAX_TRAIL; k++) history[hbase + k * 3] += off
      }
      if (ry > FIELD.y / 2 || ry < -FIELD.y / 2) {
        const off = ry > 0 ? -FIELD.y : FIELD.y
        positions[ix + 1] += off
        for (let k = 0; k < MAX_TRAIL; k++) history[hbase + k * 3 + 1] += off
      }
      if (rz > FIELD.z / 2 || rz < -FIELD.z / 2) {
        const off = rz > 0 ? -FIELD.z : FIELD.z
        positions[ix + 2] += off
        for (let k = 0; k < MAX_TRAIL; k++) history[hbase + k * 3 + 2] += off
      }

      // record the new position at the head slot
      const h = hbase + hk * 3
      history[h] = positions[ix]
      history[h + 1] = positions[ix + 1]
      history[h + 2] = positions[ix + 2]
    }
    geom.attributes.position.needsUpdate = true

    // Build the trail line segments: walk back from the head, fading the
    // per-vertex colour from intense (at the mote) to zero (oldest point).
    const rawL = Math.floor(config.motesTrailLength)
    if (rawL < 2) {
      trailGeom.setDrawRange(0, 0) // trails disabled
      return
    }
    const L = Math.min(MAX_TRAIL, rawL)
    const { trailPos, trailCol, colorIndex } = data
    const palette = config.motesColors
    const opacity = config.motesOpacity
    let v = 0 // vertex write cursor (×3)
    for (let i = 0; i < COUNT; i++) {
      tmpColor.set(palette[colorIndex[i]] ?? '#ffffff')
      const cr = tmpColor.r
      const cg = tmpColor.g
      const cb = tmpColor.b
      const hbase = i * MAX_TRAIL * 3
      for (let k = 0; k < L - 1; k++) {
        const sA = (hk - k + MAX_TRAIL) % MAX_TRAIL // newer point
        const sB = (hk - k - 1 + MAX_TRAIL) % MAX_TRAIL // older point
        const aBase = hbase + sA * 3
        const bBase = hbase + sB * 3
        // brightness fades along the trail (head = 1 → tail = 0)
        const fA = (1 - k / (L - 1)) * opacity
        const fB = (1 - (k + 1) / (L - 1)) * opacity

        trailPos[v] = history[aBase]
        trailPos[v + 1] = history[aBase + 1]
        trailPos[v + 2] = history[aBase + 2]
        trailCol[v] = cr * fA
        trailCol[v + 1] = cg * fA
        trailCol[v + 2] = cb * fA
        v += 3

        trailPos[v] = history[bBase]
        trailPos[v + 1] = history[bBase + 1]
        trailPos[v + 2] = history[bBase + 2]
        trailCol[v] = cr * fB
        trailCol[v + 1] = cg * fB
        trailCol[v + 2] = cb * fB
        v += 3
      }
    }
    trailGeom.setDrawRange(0, COUNT * (L - 1) * 2)
    trailGeom.attributes.position.needsUpdate = true
    trailGeom.attributes.color.needsUpdate = true
  })

  return (
    <group>
      <lineSegments geometry={trailGeom} frustumCulled={false}>
        <lineBasicMaterial
          ref={trailMatRef}
          vertexColors
          transparent
          opacity={config.motesOpacity}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
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
    </group>
  )
}
