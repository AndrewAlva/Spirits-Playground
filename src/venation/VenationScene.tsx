import { useRef } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import VenationRenderer from './VenationRenderer'
import CameraController from './CameraController'

/**
 * Canvas + postprocessing shell for the venation animation. Pure black
 * background, ACES tone mapping, and a bloom pass tuned so only the HDR vein
 * tips bloom.
 */
export default function VenationScene() {
  // Shared growth frontier: written by the renderer, read by the camera.
  const frontier = useRef(new THREE.Vector3())

  return (
    <Canvas
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.2,
      }}
      camera={{ position: [0, 0, 3], fov: 50 }}
      style={{ background: '#000000' }}
    >
      <VenationRenderer frontier={frontier} />
      <CameraController frontier={frontier} />
      <EffectComposer>
        <Bloom
          intensity={1.4}
          luminanceThreshold={0.6}
          luminanceSmoothing={0.4}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  )
}
