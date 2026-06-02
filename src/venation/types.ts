import * as THREE from 'three'
import type { MeshLineGeometry } from 'meshline'

/** A point in space that attracts vein growth, consumed once reached. */
export interface Attractor {
  id: number
  position: THREE.Vector3
  alive: boolean
}

/** A single node along a vein path. */
export interface VeinNode {
  id: number
  position: THREE.Vector3
  parentId: number | null
  age: number
}

/**
 * A continuous vein strand. The engine itself is graph-based (nodes +
 * parent links); `Branch` is the render-side grouping of nodes into a single
 * `meshline` strand. `geometry` is null until the strand is mounted.
 */
export interface Branch {
  nodes: VeinNode[]
  geometry: MeshLineGeometry | null
}
