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

    lookTarget.current.x = THREE.MathUtils.lerp(lookTarget.current.x, f.x + config.cameraLookAtX, lookLerp)
    lookTarget.current.y = THREE.MathUtils.lerp(lookTarget.current.y, f.y + config.cameraLookAtY, lookLerp)
    lookTarget.current.z = THREE.MathUtils.lerp(lookTarget.current.z, f.z + config.cameraLookAtZ, lookLerp)
    camera.lookAt(lookTarget.current)

    // Extra per-axis rotation on top of the look direction (radians).
    camera.rotateX(config.cameraRotX)
    camera.rotateY(config.cameraRotY)
    camera.rotateZ(config.cameraRotZ)
  })

  return null
}
