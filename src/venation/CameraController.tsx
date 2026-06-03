import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { config } from './config'

interface Props {
  /** Shared frontier centroid written by the renderer. */
  frontier: React.MutableRefObject<THREE.Vector3>
}

/** Cinematic follow camera — no OrbitControls. Reads lerp/offset live. */
export default function CameraController({ frontier }: Props) {
  const camera = useThree((s) => s.camera)
  const lookTarget = useRef(new THREE.Vector3())
  const desired = useRef(new THREE.Vector3())

  useFrame(() => {
    const f = frontier.current
    const posLerp = config.cameraPositionLerp
    const lookLerp = config.cameraLookLerp
    desired.current.set(
      f.x + config.cameraOffsetX,
      f.y + config.cameraOffsetY,
      f.z + config.cameraOffsetZ,
    )

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, desired.current.x, posLerp)
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, desired.current.y, posLerp)
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, desired.current.z, posLerp)

    lookTarget.current.x = THREE.MathUtils.lerp(lookTarget.current.x, f.x, lookLerp)
    lookTarget.current.y = THREE.MathUtils.lerp(lookTarget.current.y, f.y, lookLerp)
    lookTarget.current.z = THREE.MathUtils.lerp(lookTarget.current.z, f.z, lookLerp)
    camera.lookAt(lookTarget.current)
  })

  return null
}
