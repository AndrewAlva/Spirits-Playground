import * as THREE from 'three'
import { MeshLineMaterial, type MeshLineMaterialParameters } from 'meshline'
import { DEFAULT_CONFIG } from './config'

// Shared uniforms for the flowing pulses. Every strand's material points its
// pulse uniforms at THESE objects, so updating them once per frame animates all
// strands at once (no per-material work on the hot path). `uFade` is the one
// exception — it's per-instance so each strand's pulses fade with its trail.
export const pulseUniforms = {
  uTime: { value: 0 },
  uPulseSpeed: { value: DEFAULT_CONFIG.pulseSpeed },
  uPulseWidth: { value: DEFAULT_CONFIG.pulseWidth },
  uPulseIntensity: { value: DEFAULT_CONFIG.pulseIntensity },
  uPulseCount: { value: DEFAULT_CONFIG.pulseCount },
  uPulseColor: { value: new THREE.Color(DEFAULT_CONFIG.pulseColor) },
  uPulseDirection: { value: DEFAULT_CONFIG.pulseDirection },
}

/**
 * MeshLineMaterial that adds coloured pulses travelling along the line. The
 * pulse is a moving bright band in `vCounters` space (0 = root → 1 = tip);
 * `uPulseDirection` flips its travel direction. The pulse is tinted by
 * `uPulseColor` (× intensity → HDR so Bloom catches it) and scaled by the
 * per-strand `uFade` so it dims away with the trail.
 */
export class PulseMeshLineMaterial extends MeshLineMaterial {
  constructor(parameters: MeshLineMaterialParameters) {
    super(parameters)

    this.uniforms.uTime = pulseUniforms.uTime
    this.uniforms.uPulseSpeed = pulseUniforms.uPulseSpeed
    this.uniforms.uPulseWidth = pulseUniforms.uPulseWidth
    this.uniforms.uPulseIntensity = pulseUniforms.uPulseIntensity
    this.uniforms.uPulseCount = pulseUniforms.uPulseCount
    this.uniforms.uPulseColor = pulseUniforms.uPulseColor
    this.uniforms.uPulseDirection = pulseUniforms.uPulseDirection
    this.uniforms.uFade = { value: 1 } // per-instance, set by the strand each tick

    this.fragmentShader =
      'uniform float uTime;\nuniform float uPulseSpeed;\nuniform float uPulseWidth;\n' +
      'uniform float uPulseIntensity;\nuniform float uPulseCount;\n' +
      'uniform vec3 uPulseColor;\nuniform float uPulseDirection;\nuniform float uFade;\n' +
      this.fragmentShader.replace(
        'gl_FragColor = diffuseColor;',
        [
          // Bright band moving along the line; direction flips its travel.
          'float _ph = fract(vCounters * uPulseCount - uTime * uPulseSpeed * uPulseDirection);',
          'float _d = min(_ph, 1.0 - _ph);',
          'float _pulse = smoothstep(uPulseWidth, 0.0, _d);',
          'gl_FragColor = diffuseColor + uPulseColor * _pulse * uPulseIntensity * uFade;',
        ].join('\n'),
      )

    this.needsUpdate = true
  }
}

/** Push the current config into the shared pulse uniforms (call once per frame). */
export function updatePulseUniforms(
  elapsed: number,
  cfg: {
    pulseSpeed: number
    pulseWidth: number
    pulseIntensity: number
    pulseCount: number
    pulseColor: string
    pulseDirection: number
  },
) {
  pulseUniforms.uTime.value = elapsed
  pulseUniforms.uPulseSpeed.value = cfg.pulseSpeed
  pulseUniforms.uPulseWidth.value = cfg.pulseWidth
  pulseUniforms.uPulseIntensity.value = cfg.pulseIntensity
  pulseUniforms.uPulseCount.value = cfg.pulseCount
  pulseUniforms.uPulseColor.value.set(cfg.pulseColor)
  pulseUniforms.uPulseDirection.value = cfg.pulseDirection
}
