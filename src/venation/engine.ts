import * as THREE from 'three'
import type { Attractor, VeinNode } from './types'
import { DEFAULT_CONFIG, type EngineParams } from './config'

export interface IterationResult {
  newNodes: VeinNode[]
  killedAttractors: number[]
}

/**
 * Pure Space Colonization engine — no rendering dependencies. Owns the vein
 * graph (nodes + parent links) and the attractor cloud. A uniform-grid spatial
 * index over the attractors keeps every lookup local (no O(n²) scans), which is
 * what makes this viable on mobile.
 *
 * All tunables live on the injected `params` object (defaulting to
 * DEFAULT_CONFIG). The renderer passes the live `config` singleton so the leva
 * GUI can retune growth on the fly — the engine simply reads the latest values
 * each iterate().
 */
export class VenationEngine {
  attractors: Attractor[] = []
  nodes: VeinNode[] = []
  params: EngineParams

  private childCount: number[] = []
  private aliveAttractors = 0
  private nextAttractorId = 0
  private nextNodeId = 0
  private grid = new Map<string, number[]>()

  // Reusable scratch objects so iterate() allocates as little as possible.
  private _v = new THREE.Vector3()
  private _dir = new THREE.Vector3()
  private _bias = new THREE.Vector3()
  private _near: number[] = []

  constructor(params: EngineParams = { ...DEFAULT_CONFIG }) {
    this.params = params
  }

  // Spatial-index cell size. Tied to the influence radius so a query sphere of
  // that radius is covered by the 3×3×3 neighbourhood of cells. Guarded so a
  // GUI-set radius of 0 can never produce a divide-by-zero / NaN cell key.
  private get cell(): number {
    return Math.max(1e-3, this.params.influenceRadius)
  }

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
    this.scatter(new THREE.Vector3(0, 0, 0), this.params.initialAttractors, this.params.initialRadius)
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
    const { maxAttractors, replenishRadius, replenishAhead, cullBehind } = this.params

    // Resolve the (optional) bias direction once.
    this._bias.set(this.params.biasX, this.params.biasY, this.params.biasZ)
    const hasBias = this.params.biasStrength > 0 && this._bias.lengthSq() > 1e-9
    if (hasBias) this._bias.normalize()

    // Abandon attractors the frontier has already swept past — otherwise they
    // stay "alive" forever behind the growth, keep the count above the
    // replenish threshold, and starve the advancing front (which is exactly
    // what made new branches stub out in place).
    if (hasBias) {
      const front = frontier.dot(this._bias)
      for (const a of this.attractors) {
        if (!a.alive) continue
        if (front - a.position.dot(this._bias) > cullBehind) {
          a.alive = false
          this.aliveAttractors--
        }
      }
    }

    // Seed fresh attractors ahead of the frontier (along the bias direction) so
    // there's always untouched territory to grow into.
    const need = maxAttractors - this.aliveAttractors
    if (need > 0) {
      const center = this._v.copy(frontier)
      if (hasBias) center.addScaledVector(this._bias, replenishAhead)
      this.scatter(center, need, replenishRadius)
    }

    if (this.attractors.length > maxAttractors * 4) {
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
    const { maxGrowthPerTick, candidateLimit, influenceRadius } = this.params
    let examined = 0
    for (
      let i = this.nodes.length - 1;
      i >= 0 && newNodes.length < maxGrowthPerTick && examined < candidateLimit;
      i--
    ) {
      const tip = this.nodes[i]
      if (!tip || this.childCount[tip.id] !== 0) continue
      examined++
      tip.age++

      // Gather this tip's influencing attractors via the spatial index and
      // accumulate the normalized average direction toward them.
      this.queryAttractors(tip.position, influenceRadius, near)
      const dirs: THREE.Vector3[] = []
      const mean = new THREE.Vector3()
      for (const idx of near) {
        const a = this.attractors[idx]
        if (!a.alive) continue
        const d = this._v.subVectors(a.position, tip.position)
        const dist = d.length()
        if (dist > influenceRadius || dist < 1e-6) continue
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

      const roomToFork = newNodes.length + 2 <= maxGrowthPerTick
      if (
        roomToFork &&
        dirs.length >= this.params.minForkAttractors &&
        maxAngle > this.params.forkSpread &&
        Math.random() < this.params.forkProbability
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
    const killRadius = this.params.killRadius
    for (const n of newNodes) {
      this.queryAttractors(n.position, killRadius, near)
      for (const idx of near) {
        const a = this.attractors[idx]
        if (!a.alive) continue
        if (a.position.distanceTo(n.position) <= killRadius) {
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
    const noise = this.params.branchAngleNoise
    this._dir.copy(dir).normalize()

    // Blend toward the bias direction (tropism): pulls every step the same way
    // so strands flow steadily instead of curling into a spiral.
    const bias = this.params.biasStrength
    if (bias > 0) {
      this._bias.set(this.params.biasX, this.params.biasY, this.params.biasZ)
      if (this._bias.lengthSq() > 1e-9) {
        this._bias.normalize()
        this._dir.multiplyScalar(1 - bias).addScaledVector(this._bias, bias)
        if (this._dir.lengthSq() < 1e-9) this._dir.copy(this._bias) // opposed → follow bias
      }
    }

    this._dir.normalize()
    this._dir.x += (Math.random() - 0.5) * noise
    this._dir.y += (Math.random() - 0.5) * noise
    this._dir.z += (Math.random() - 0.5) * noise
    this._dir.normalize()

    const pos = tip.position.clone().addScaledVector(this._dir, this.params.segmentLength)
    // Centered wobble (spec intent: "keeps it quasi-flat"); an always-positive
    // Math.random() * zWobble would drift monotonically off the plane.
    pos.z += (Math.random() - 0.5) * this.params.zWobble

    const child = this.addNode(pos, tip.id)
    this.childCount[tip.id]++
    return child
  }

  private scatter(center: THREE.Vector3, count: number, radius: number) {
    const zJitter = this.params.planeZJitter
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * radius // uniform over the disk
      const p = new THREE.Vector3(
        center.x + Math.cos(a) * r,
        center.y + Math.sin(a) * r,
        center.z + (Math.random() - 0.5) * zJitter,
      )
      this.attractors.push({ id: this.nextAttractorId++, position: p, alive: true })
      this.aliveAttractors++
    }
  }

  private cellKey(x: number, y: number, z: number): string {
    const c = this.cell
    return Math.floor(x / c) + ',' + Math.floor(y / c) + ',' + Math.floor(z / c)
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
    const c = this.cell
    const r = Math.max(1, Math.ceil(radius / c))
    const cx = Math.floor(p.x / c)
    const cy = Math.floor(p.y / c)
    const cz = Math.floor(p.z / c)
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
