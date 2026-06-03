import { MeshLineMaterial, type MeshLineMaterialParameters } from 'meshline'
import { DEFAULT_CONFIG } from './config'

// Shared uniforms for the flowing pulses. Every strand's material points its
// pulse uniforms at THESE objects, so updating them once per frame animates all
// strands at once (no per-material work on the hot path).
export const pulseUniforms = {
  uTime: { value: 0 },
  uPulseSpeed: { value: DEFAULT_CONFIG.pulseSpeed },
  uPulseWidth: { value: DEFAULT_CONFIG.pulseWidth },
  uPulseIntensity: { value: DEFAULT_CONFIG.pulseIntensity },
  uPulseCount: { value: DEFAULT_CONFIG.pulseCount },
}

/**
 * MeshLineMaterial that adds bright pulses travelling along the line toward the
 * tip. The pulse is a moving bright band in `vCounters` space (0 = root → 1 =
 * tip), added on top of the existing gradient so it reads as energy flowing up
 * each vein. HDR brightness (× intensity) means Bloom catches the pulses.
 */
export class PulseMeshLineMaterial extends MeshLineMaterial {
  constructor(parameters: MeshLineMaterialParameters) {
    super(parameters)

    this.uniforms.uTime = pulseUniforms.uTime
    this.uniforms.uPulseSpeed = pulseUniforms.uPulseSpeed
    this.uniforms.uPulseWidth = pulseUniforms.uPulseWidth
    this.uniforms.uPulseIntensity = pulseUniforms.uPulseIntensity
    this.uniforms.uPulseCount = pulseUniforms.uPulseCount

    this.fragmentShader =
      'uniform float uTime;\nuniform float uPulseSpeed;\nuniform float uPulseWidth;\n' +
      'uniform float uPulseIntensity;\nuniform float uPulseCount;\n' +
      this.fragmentShader.replace(
        'gl_FragColor = diffuseColor;',
        [
          // Bright band moving from root (0) toward tip (1) over time.
          'float _ph = fract(vCounters * uPulseCount - uTime * uPulseSpeed);',
          'float _d = min(_ph, 1.0 - _ph);',
          'float _pulse = smoothstep(uPulseWidth, 0.0, _d);',
          'gl_FragColor = diffuseColor + diffuseColor * _pulse * uPulseIntensity;',
        ].join('\n'),
      )

    this.needsUpdate = true
  }
}

/** Push the current config into the shared pulse uniforms (call once per frame). */
export function updatePulseUniforms(
  elapsed: number,
  cfg: { pulseSpeed: number; pulseWidth: number; pulseIntensity: number; pulseCount: number },
) {
  pulseUniforms.uTime.value = elapsed
  pulseUniforms.uPulseSpeed.value = cfg.pulseSpeed
  pulseUniforms.uPulseWidth.value = cfg.pulseWidth
  pulseUniforms.uPulseIntensity.value = cfg.pulseIntensity
  pulseUniforms.uPulseCount.value = cfg.pulseCount
}
