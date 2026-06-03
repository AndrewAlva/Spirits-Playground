import { useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import type { BloomEffect } from 'postprocessing'
import VenationRenderer from './VenationRenderer'
import CameraController from './CameraController'
import Motes from './Motes'
import Gui from './Gui'
import { config } from './config'
import { updatePulseUniforms } from './PulseMeshLineMaterial'

/**
 * Post-processing rig. Lives inside the Canvas so it can sync the live `config`
 * (bloom + tone-mapping exposure) to the GPU each frame without React state.
 */
function PostFx() {
  const bloomRef = useRef<BloomEffect | null>(null)
  const gl = useThree((s) => s.gl)

  useFrame((state) => {
    gl.toneMappingExposure = config.toneMappingExposure
    updatePulseUniforms(state.clock.elapsedTime, config)
    const bloom = bloomRef.current
    if (bloom) {
      bloom.intensity = config.bloomIntensity
      const lm = bloom.luminanceMaterial as unknown as {
        threshold: number
        smoothing: number
      }
      lm.threshold = config.luminanceThreshold
      lm.smoothing = config.luminanceSmoothing
    }
  })

  return (
    <EffectComposer>
      <Bloom
        ref={bloomRef}
        intensity={config.bloomIntensity}
        luminanceThreshold={config.luminanceThreshold}
        luminanceSmoothing={config.luminanceSmoothing}
        mipmapBlur
      />
    </EffectComposer>
  )
}

/**
 * Canvas + postprocessing shell for the venation animation. Pure black
 * background, ACES tone mapping, and a bloom pass tuned so only the HDR vein
 * tips bloom. The leva GUI (rendered outside the Canvas) appears with `?gui`.
 */
export default function VenationScene() {
  // Shared growth frontier: written by the renderer, read by the camera.
  const frontier = useRef(new THREE.Vector3())

  return (
    <>
      <Gui />
      <Canvas
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: config.toneMappingExposure,
        }}
        camera={{ position: [0, 0, 3], fov: 50 }}
        style={{ background: '#000000' }}
      >
        <VenationRenderer frontier={frontier} />
        <CameraController frontier={frontier} />
        <Motes frontier={frontier} />
        <PostFx />
      </Canvas>
    </>
  )
}
