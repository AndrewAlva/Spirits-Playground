import * as THREE from 'three'
import type { Attractor, VeinNode } from './types'

// ────────────────────────────────────────────────────────────────────────────
// Tunable algorithm parameters
// ────────────────────────────────────────────────────────────────────────────
export const INFLUENCE_RADIUS = 0.8 // attractors influence nodes within this distance
export const KILL_RADIUS = 0.12 // attractors killed when a node enters this distance
export const SEGMENT_LENGTH = 0.04 // step size per growth iteration
export const MAX_ATTRACTORS = 600 // soft cap; replenish when below threshold
export const REPLENISH_RADIUS = 2.5 // radius around growth frontier to spawn attractors
export const Z_WOBBLE = 0.015 // max Z displacement per step (keeps it quasi-flat)
export const BRANCH_ANGLE_NOISE = 0.18 // radians of random deviation per step

// Secondary tunables (not part of the public parameter block).
const INITIAL_ATTRACTORS = 350 // attractors scattered around the seed on reset
const INITIAL_RADIUS = 1.25 // disk radius for the initial scatter
const PLANE_Z_JITTER = 0.06 // initial out-of-plane spread of attractors
const MAX_GROWTH_PER_TICK = 3 // new nodes emitted per iterate() (visual legibility)
const CANDIDATE_LIMIT = 600 // most-recent tips examined per tick (bounds cost)
const FORK_SPREAD = 0.9 // radians; angular spread above which a tip may fork
const MIN_FORK_ATTRACTORS = 5 // minimum influencers before a fork is considered
const FORK_PROBABILITY = 0.5 // chance an eligible tip actually forks

// Spatial-index cell size. Equal to INFLUENCE_RADIUS so a query sphere of that
// radius is covered by the 3×3×3 neighbourhood of cells.
const CELL = INFLUENCE_RADIUS

export interface IterationResult {
  newNodes: VeinNode[]
  killedAttractors: number[]
}

/**
 * Pure Space Colonization engine — no rendering dependencies. Owns the vein
 * graph (nodes + parent links) and the attractor cloud. A uniform-grid spatial
 * index over the attractors keeps every lookup local (no O(n²) scans), which is
 * what makes this viable on mobile.
 */
export class VenationEngine {
  attractors: Attractor[] = []
  nodes: VeinNode[] = []

  private childCount: number[] = []
  private aliveAttractors = 0
  private nextAttractorId = 0
  private nextNodeId = 0
  private grid = new Map<string, number[]>()

  // Reusable scratch objects so iterate() allocates as little as possible.
  private _v = new THREE.Vector3()
  private _dir = new THREE.Vector3()
  private _near: number[] = []

  /** Clear all state, plant one root node at the origin, scatter attractors. */
  reset() {
    this.attractors = []
    this.nodes = []
    this.childCount = []
    this.aliveAttractors = 0
    this.nextAttractorId = 0
    this.nextNodeId = 0
    this.grid.clear()

    this.addNode(new THREE.Vector3(0, 0, 0), null)
    this.scatter(new THREE.Vector3(0, 0, 0), INITIAL_ATTRACTORS, INITIAL_RADIUS)
  }

  get attractorCount(): number {
    return this.aliveAttractors
  }

  getNode(id: number): VeinNode | undefined {
    return this.nodes[id]
  }

  /** Nodes that have no children yet (the live growth frontier). */
  getActiveTips(): VeinNode[] {
    const tips: VeinNode[] = []
    for (const n of this.nodes) {
      if (n && this.childCount[n.id] === 0) tips.push(n)
    }
    return tips
  }

  /**
   * Scatter new attractors near the current growth frontier so growth never
   * terminates. Also compacts dead attractors occasionally to bound memory.
   */
  replenishAttractors(frontier: THREE.Vector3) {
    const need = MAX_ATTRACTORS - this.aliveAttractors
    if (need > 0) this.scatter(frontier, need, REPLENISH_RADIUS)

    if (this.attractors.length > MAX_ATTRACTORS * 4) {
      this.attractors = this.attractors.filter((a) => a.alive)
    }
  }

  /** One tick of the space colonization algorithm. */
  iterate(): IterationResult {
    this.rebuildGrid()

    const newNodes: VeinNode[] = []
    const killed: number[] = []
    const near = this._near

    // Advance the most-recent productive tips (frontier-first). The budget is
    // counted in emitted nodes (not tips) so the renderer can consume every
    // node returned and stay perfectly in sync. Bounding the examined count
    // keeps the per-frame cost flat even as the node graph grows large.
    let examined = 0
    for (
      let i = this.nodes.length - 1;
      i >= 0 && newNodes.length < MAX_GROWTH_PER_TICK && examined < CANDIDATE_LIMIT;
      i--
    ) {
      const tip = this.nodes[i]
      if (!tip || this.childCount[tip.id] !== 0) continue
      examined++
      tip.age++

      // Gather this tip's influencing attractors via the spatial index and
      // accumulate the normalized average direction toward them.
      this.queryAttractors(tip.position, INFLUENCE_RADIUS, near)
      const dirs: THREE.Vector3[] = []
      const mean = new THREE.Vector3()
      for (const idx of near) {
        const a = this.attractors[idx]
        if (!a.alive) continue
        const d = this._v.subVectors(a.position, tip.position)
        const dist = d.length()
        if (dist > INFLUENCE_RADIUS || dist < 1e-6) continue
        const unit = d.multiplyScalar(1 / dist).clone()
        dirs.push(unit)
        mean.add(unit)
      }
      if (dirs.length === 0) continue
      mean.normalize()

      // Fork when the influencers fan out across a wide angle: split them into
      // two angular groups and grow a child toward each. Otherwise grow one.
      let maxAngle = 0
      for (const d of dirs) {
        const ang = Math.acos(THREE.MathUtils.clamp(d.dot(mean), -1, 1))
        if (ang > maxAngle) maxAngle = ang
      }

      const roomToFork = newNodes.length + 2 <= MAX_GROWTH_PER_TICK
      if (
        roomToFork &&
        dirs.length >= MIN_FORK_ATTRACTORS &&
        maxAngle > FORK_SPREAD &&
        Math.random() < FORK_PROBABILITY
      ) {
        const perp = new THREE.Vector3(-mean.y, mean.x, 0)
        if (perp.lengthSq() < 1e-6) perp.set(0, -mean.z, mean.y)
        perp.normalize()

        const ga = new THREE.Vector3()
        const gb = new THREE.Vector3()
        let na = 0
        let nb = 0
        for (const d of dirs) {
          if (d.dot(perp) >= 0) {
            ga.add(d)
            na++
          } else {
            gb.add(d)
            nb++
          }
        }
        if (na > 0 && nb > 0) {
          newNodes.push(this.grow(tip, ga.normalize()))
          newNodes.push(this.grow(tip, gb.normalize()))
        } else {
          newNodes.push(this.grow(tip, mean))
        }
      } else {
        newNodes.push(this.grow(tip, mean))
      }
    }

    // Kill attractors that any new node has reached.
    for (const n of newNodes) {
      this.queryAttractors(n.position, KILL_RADIUS, near)
      for (const idx of near) {
        const a = this.attractors[idx]
        if (!a.alive) continue
        if (a.position.distanceTo(n.position) <= KILL_RADIUS) {
          a.alive = false
          this.aliveAttractors--
          killed.push(a.id)
        }
      }
    }

    return { newNodes, killedAttractors: killed }
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private addNode(position: THREE.Vector3, parentId: number | null): VeinNode {
    const id = this.nextNodeId++
    const node: VeinNode = { id, position: position.clone(), parentId, age: 0 }
    this.nodes[id] = node
    this.childCount[id] = 0
    return node
  }

  /** Step one new node from `tip` toward `dir`, with angle noise and Z wobble. */
  private grow(tip: VeinNode, dir: THREE.Vector3): VeinNode {
    this._dir.copy(dir).normalize()
    this._dir.x += (Math.random() - 0.5) * BRANCH_ANGLE_NOISE
    this._dir.y += (Math.random() - 0.5) * BRANCH_ANGLE_NOISE
    this._dir.z += (Math.random() - 0.5) * BRANCH_ANGLE_NOISE
    this._dir.normalize()

    const pos = tip.position.clone().addScaledVector(this._dir, SEGMENT_LENGTH)
    // Centered wobble (spec intent: "keeps it quasi-flat"); an always-positive
    // Math.random() * Z_WOBBLE would drift monotonically off the plane.
    pos.z += (Math.random() - 0.5) * Z_WOBBLE

    const child = this.addNode(pos, tip.id)
    this.childCount[tip.id]++
    return child
  }

  private scatter(center: THREE.Vector3, count: number, radius: number) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * radius // uniform over the disk
      const p = new THREE.Vector3(
        center.x + Math.cos(a) * r,
        center.y + Math.sin(a) * r,
        center.z + (Math.random() - 0.5) * PLANE_Z_JITTER,
      )
      this.attractors.push({ id: this.nextAttractorId++, position: p, alive: true })
      this.aliveAttractors++
    }
  }

  private cellKey(x: number, y: number, z: number): string {
    return (
      Math.floor(x / CELL) + ',' + Math.floor(y / CELL) + ',' + Math.floor(z / CELL)
    )
  }

  private rebuildGrid() {
    this.grid.clear()
    for (let i = 0; i < this.attractors.length; i++) {
      const a = this.attractors[i]
      if (!a.alive) continue
      const k = this.cellKey(a.position.x, a.position.y, a.position.z)
      let bucket = this.grid.get(k)
      if (!bucket) {
        bucket = []
        this.grid.set(k, bucket)
      }
      bucket.push(i)
    }
  }

  /** Collect indices of attractors in cells overlapping the query sphere. */
  private queryAttractors(p: THREE.Vector3, radius: number, out: number[]) {
    out.length = 0
    const r = Math.max(1, Math.ceil(radius / CELL))
    const cx = Math.floor(p.x / CELL)
    const cy = Math.floor(p.y / CELL)
    const cz = Math.floor(p.z / CELL)
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dz = -r; dz <= r; dz++) {
          const bucket = this.grid.get(cx + dx + ',' + (cy + dy) + ',' + (cz + dz))
          if (bucket) for (const idx of bucket) out.push(idx)
        }
      }
    }
  }
}
