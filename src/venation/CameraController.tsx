import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'

const POSITION_LERP = 0.012 // slow, cinematic position drift
const LOOK_LERP = 0.018 // slightly faster aim so the frontier stays framed
const OFFSET = new THREE.Vector3(0, 0, 2.2) // camera sits in front of the frontier

interface Props {
  /** Shared frontier centroid written by the renderer. */
  frontier: React.MutableRefObject<THREE.Vector3>
}

/** Cinematic follow camera — no OrbitControls. */
export default function CameraController({ frontier }: Props) {
  const camera = useThree((s) => s.camera)
  const lookTarget = useRef(new THREE.Vector3())
  const desired = useRef(new THREE.Vector3())

  useFrame(() => {
    const f = frontier.current
    desired.current.copy(f).add(OFFSET)

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, desired.current.x, POSITION_LERP)
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, desired.current.y, POSITION_LERP)
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, desired.current.z, POSITION_LERP)

    lookTarget.current.x = THREE.MathUtils.lerp(lookTarget.current.x, f.x, LOOK_LERP)
    lookTarget.current.y = THREE.MathUtils.lerp(lookTarget.current.y, f.y, LOOK_LERP)
    lookTarget.current.z = THREE.MathUtils.lerp(lookTarget.current.z, f.z, LOOK_LERP)
    camera.lookAt(lookTarget.current)
  })

  return null
}
