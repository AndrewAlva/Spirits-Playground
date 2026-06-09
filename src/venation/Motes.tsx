import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { config } from './config'

const COUNT = 300 // fixed pool of motes
const FIELD = new THREE.Vector3(14, 14, 6) // box (full extents) around the front
const SCALE_MIN = 0.4 // per-mote size multiplier range (size variation)
const SCALE_MAX = 1.5
const MAX_TRAIL = 40 // ring-buffer capacity per mote (cap on trail length)
const TAIL_SCALE = 0.12 // trail tapers from full size at the head to this at the tail

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
 * Faint drifting motes in the void. Each mote picks one of four palette colours
 * and flows along the same downward growth current as the veins (bias direction
 * + a little swirl), trailing a short fading curve. The mote and its trail are
 * one round-sprite point cloud whose size tapers (full at the mote → a point at
 * the tail) and whose colour fades to nothing — additive, so it glows under
 * bloom and reads as a soft tapering ribbon. One draw call for everything.
 *
 * The field follows the growth frontier and wraps motes that leave the box; on
 * wrap a mote's whole trail history shifts with it so the curve stays continuous.
 */
export default function Motes({
  frontier,
}: {
  frontier: React.MutableRefObject<THREE.Vector3>
}) {
  const matRef = useRef<THREE.PointsMaterial>(null!)
  const elapsed = useRef(0)
  const head = useRef(0) // shared ring-buffer write index

  const circleTex = useMemo(makeCircleTexture, [])

  const data = useMemo(() => {
    const motePos = new Float32Array(COUNT * 3) // current mote positions
    const drift = new Float32Array(COUNT * 3) // per-mote random spread velocity
    const phase = new Float32Array(COUNT)
    const baseScale = new Float32Array(COUNT)
    const colorIndex = new Uint8Array(COUNT)
    const history = new Float32Array(COUNT * MAX_TRAIL * 3)
    for (let i = 0; i < COUNT; i++) {
      const x = (Math.random() - 0.5) * FIELD.x
      const y = (Math.random() - 0.5) * FIELD.y
      const z = (Math.random() - 0.5) * FIELD.z
      motePos[i * 3] = x
      motePos[i * 3 + 1] = y
      motePos[i * 3 + 2] = z
      drift[i * 3] = Math.random() - 0.5
      drift[i * 3 + 1] = Math.random() - 0.5
      drift[i * 3 + 2] = Math.random() - 0.5
      phase[i] = Math.random() * Math.PI * 2
      baseScale[i] = SCALE_MIN + Math.random() * (SCALE_MAX - SCALE_MIN)
      colorIndex[i] = Math.floor(Math.random() * 4)
      for (let k = 0; k < MAX_TRAIL; k++) {
        const h = (i * MAX_TRAIL + k) * 3
        history[h] = x
        history[h + 1] = y
        history[h + 2] = z
      }
    }
    // Render buffers: head + trail points for every mote (one Points cloud).
    const positions = new Float32Array(COUNT * MAX_TRAIL * 3)
    const colors = new Float32Array(COUNT * MAX_TRAIL * 3)
    const scales = new Float32Array(COUNT * MAX_TRAIL)
    return { motePos, drift, phase, baseScale, colorIndex, history, positions, colors, scales }
  }, [])

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
    g.setAttribute('color', new THREE.BufferAttribute(data.colors, 3))
    g.setAttribute('aScale', new THREE.BufferAttribute(data.scales, 1))
    return g
  }, [data])

  // Per-vertex size: multiply gl_PointSize by the point's aScale attribute.
  const onBeforeCompile = useMemo(
    () => (shader: { vertexShader: string }) => {
      shader.vertexShader =
        'attribute float aScale;\n' +
        shader.vertexShader.replace('gl_PointSize = size;', 'gl_PointSize = size * aScale;')
    },
    [],
  )

  const bias = useMemo(() => new THREE.Vector3(), [])
  // Palette parsed to rgb once per frame (avoid 1000s of hex parses).
  const palRGB = useMemo(
    () => [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()],
    [],
  )

  useFrame((_, delta) => {
    const mat = matRef.current
    if (mat) {
      mat.size = config.motesSize
      mat.visible = config.motesOpacity > 0.001
    }
    if (!mat || !mat.visible) return

    elapsed.current += delta
    const t = elapsed.current
    const f = frontier.current
    const d = Math.min(delta, 0.1) * config.motesDrift
    const swirl = config.motesSwirl
    const { motePos, drift, phase, history } = data

    // Shared current = the growth bias direction (motes flow with the veins),
    // with an in-plane perpendicular axis for the swirl wander.
    bias.set(config.biasX, config.biasY, config.biasZ)
    if (bias.lengthSq() < 1e-9) bias.set(0, -1, 0)
    bias.normalize()
    const px = -bias.y
    const py = bias.x

    head.current = (head.current + 1) % MAX_TRAIL
    const hk = head.current

    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3
      const s1 = Math.sin(motePos[ix + 1] * 0.6 + t * 0.5 + phase[i])
      const s2 = Math.cos(motePos[ix] * 0.6 + t * 0.4 + phase[i] * 1.3)
      const vx = bias.x + px * s1 * swirl + drift[ix] * 0.25
      const vy = bias.y + py * s1 * swirl + drift[ix + 1] * 0.25
      const vz = bias.z + s2 * swirl * 0.6 + drift[ix + 2] * 0.25
      motePos[ix] += vx * d
      motePos[ix + 1] += vy * d
      motePos[ix + 2] += vz * d

      // wrap around the box centred on the frontier; shift the trail history
      // by the same offset so the curve stays continuous across a wrap.
      const hbase = i * MAX_TRAIL * 3
      const rx = motePos[ix] - f.x
      const ry = motePos[ix + 1] - f.y
      const rz = motePos[ix + 2] - f.z
      if (rx > FIELD.x / 2 || rx < -FIELD.x / 2) {
        const off = rx > 0 ? -FIELD.x : FIELD.x
        motePos[ix] += off
        for (let k = 0; k < MAX_TRAIL; k++) history[hbase + k * 3] += off
      }
      if (ry > FIELD.y / 2 || ry < -FIELD.y / 2) {
        const off = ry > 0 ? -FIELD.y : FIELD.y
        motePos[ix + 1] += off
        for (let k = 0; k < MAX_TRAIL; k++) history[hbase + k * 3 + 1] += off
      }
      if (rz > FIELD.z / 2 || rz < -FIELD.z / 2) {
        const off = rz > 0 ? -FIELD.z : FIELD.z
        motePos[ix + 2] += off
        for (let k = 0; k < MAX_TRAIL; k++) history[hbase + k * 3 + 2] += off
      }

      const h = hbase + hk * 3
      history[h] = motePos[ix]
      history[h + 1] = motePos[ix + 1]
      history[h + 2] = motePos[ix + 2]
    }

    // Parse the palette once this frame.
    const pal = config.motesColors
    for (let j = 0; j < 4; j++) palRGB[j].set(pal[j] ?? '#ffffff')
    const opacity = config.motesOpacity

    // Fill the point cloud: head (k=0, full size/colour) → tail (tapered + faded).
    const L = Math.max(1, Math.min(MAX_TRAIL, Math.floor(config.motesTrailLength)))
    const denom = L > 1 ? L - 1 : 1
    const { positions, colors, scales, baseScale, colorIndex } = data
    let p = 0 // point write cursor (×3)
    let s = 0 // scale write cursor
    for (let i = 0; i < COUNT; i++) {
      const c = palRGB[colorIndex[i]]
      const hbase = i * MAX_TRAIL * 3
      const base = baseScale[i]
      for (let k = 0; k < L; k++) {
        const slot = (hk - k + MAX_TRAIL) % MAX_TRAIL
        const sBase = hbase + slot * 3
        const u = k / denom // 0 at head → 1 at tail
        const fade = (1 - u) * opacity // colour intensity along the trail
        const taper = 1 - (1 - TAIL_SCALE) * u // size taper head → tail

        positions[p] = history[sBase]
        positions[p + 1] = history[sBase + 1]
        positions[p + 2] = history[sBase + 2]
        colors[p] = c.r * fade
        colors[p + 1] = c.g * fade
        colors[p + 2] = c.b * fade
        scales[s] = base * taper
        p += 3
        s += 1
      }
    }
    geom.setDrawRange(0, COUNT * L)
    geom.attributes.position.needsUpdate = true
    geom.attributes.color.needsUpdate = true
    geom.attributes.aScale.needsUpdate = true
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
        opacity={1}
        depthWrite={false}
        toneMapped={false}
        blending={THREE.AdditiveBlending}
        onBeforeCompile={onBeforeCompile}
      />
    </points>
  )
}
