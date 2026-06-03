import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { VenationEngine } from './engine'
import { config } from './config'
import BranchLine, {
  MAX_POINTS_PER_BRANCH,
  type BranchLineHandle,
} from './BranchLine'

const HARD_BRANCH_CAP = 1000 // absolute safety ceiling on live strands
const MAX_TICKS_PER_FRAME = 6 // catch-up cap so a stalled tab can't spiral
const NODE_POS_CAP = 5000 // bound the parent-position cache for infinite runs
const NODE_POS_TRIM = 2500 // entries kept after a trim

interface BranchState {
  id: number
  initialPoints: number[] // root-first seed, stable identity per strand
  layerZ: number // depth-plane offset (parallax layering)
}

interface Props {
  /** Shared frontier centroid (written here, read by the camera). */
  frontier: React.MutableRefObject<THREE.Vector3>
}

/**
 * Drives the engine each frame and maps its node graph onto a pool of
 * `BranchLine` strands. A node that continues an existing tip is appended to
 * that strand (O(1) via a ref map); a fork or a full strand starts a new one.
 */
export default function VenationRenderer({ frontier }: Props) {
  const engineRef = useRef<VenationEngine | null>(null)
  if (!engineRef.current) engineRef.current = new VenationEngine(config)

  const [branches, setBranches] = useState<BranchState[]>([])

  // Imperative bookkeeping — refs, so updates never trigger React re-renders.
  const handles = useRef(new Map<number, BranchLineHandle>())
  const tipToBranch = useRef(new Map<number, number>()) // engine tip nodeId → branchId
  const branchPoints = useRef(new Map<number, number>()) // branchId → point count
  const branchTip = useRef(new Map<number, THREE.Vector3>()) // branchId → tip position (fade)
  const branchLayer = useRef(new Map<number, number>()) // branchId → depth-layer index
  const nodeBranch = useRef(new Map<number, number>()) // nodeId → its branchId (for fork inheritance)
  const nodePos = useRef(new Map<number, THREE.Vector3>()) // nodeId → position
  const pending = useRef(new Map<number, number[][]>()) // points awaiting strand mount
  const refCbCache = useRef(new Map<number, (h: BranchLineHandle | null) => void>())
  const nextBranchId = useRef(0)
  const recent = useRef<THREE.Vector3[]>([]) // last few nodes, for the frontier

  // Last-seen GUI counters, so we only act when the user actually edits.
  const lastVisual = useRef(config.visualVersion)
  const lastWidth = useRef(config.widthVersion)
  const lastReset = useRef(config.resetVersion)

  // Scratch + smoothed window length for the per-frame trail-fade pass.
  const biasDir = useRef(new THREE.Vector3())
  const fadeWindow = useRef(1)

  // Time accumulator that decouples growth speed from the frame rate.
  const growthAcc = useRef(0)

  const registerHandle = useCallback((id: number, h: BranchLineHandle | null) => {
    if (h) {
      handles.current.set(id, h)
      const queued = pending.current.get(id)
      if (queued) {
        for (const [x, y, z] of queued) h.append(x, y, z)
        pending.current.delete(id)
      }
    } else {
      handles.current.delete(id)
    }
  }, [])

  // Stable ref callback per strand id, so a parent re-render doesn't detach and
  // re-attach every existing strand's imperative handle.
  const refCb = useCallback(
    (id: number) => {
      let cb = refCbCache.current.get(id)
      if (!cb) {
        cb = (h: BranchLineHandle | null) => registerHandle(id, h)
        refCbCache.current.set(id, cb)
      }
      return cb
    },
    [registerHandle],
  )

  // Clear all render-side state and re-seed the engine from a single root.
  const resetAll = useCallback(() => {
    const e = engineRef.current!
    e.reset()
    handles.current.clear()
    tipToBranch.current.clear()
    branchPoints.current.clear()
    branchTip.current.clear()
    branchLayer.current.clear()
    nodeBranch.current.clear()
    nodePos.current.clear()
    pending.current.clear()
    refCbCache.current.clear()
    nextBranchId.current = 0
    recent.current = []

    const root = e.getNode(0)
    if (root) {
      nodePos.current.set(0, root.position.clone())
      frontier.current.copy(root.position)
    }
    setBranches([])
  }, [frontier])

  // Initialize on mount.
  useEffect(() => {
    resetAll()
  }, [resetAll])

  // Append to a live strand, buffering if it hasn't mounted yet.
  const appendToBranch = (branchId: number, p: THREE.Vector3) => {
    const h = handles.current.get(branchId)
    if (h) {
      h.append(p.x, p.y, p.z)
    } else {
      let queue = pending.current.get(branchId)
      if (!queue) {
        queue = []
        pending.current.set(branchId, queue)
      }
      queue.push([p.x, p.y, p.z])
    }
    branchPoints.current.set(branchId, (branchPoints.current.get(branchId) ?? 0) + 1)
    const tip = branchTip.current.get(branchId)
    if (tip) tip.copy(p)
    else branchTip.current.set(branchId, p.clone())
  }

  useFrame((_, delta) => {
    const e = engineRef.current!

    // Respond to GUI edits (cheap version-counter checks).
    if (config.resetVersion !== lastReset.current) {
      lastReset.current = config.resetVersion
      resetAll()
      growthAcc.current = 0
      return // start fresh next frame
    }
    if (config.visualVersion !== lastVisual.current) {
      lastVisual.current = config.visualVersion
      for (const h of handles.current.values()) h.applyColor()
    }
    if (config.widthVersion !== lastWidth.current) {
      lastWidth.current = config.widthVersion
      for (const h of handles.current.values()) h.applyWidth()
    }

    // Growth runs on a time accumulator so its rate is decoupled from the frame
    // rate: growthSpeed is "ticks per second", each tick advancing the sim by up
    // to maxGrowthPerTick small nodes. Lowering it slows the flow without
    // changing the step size, so the motion stays just as smooth.
    growthAcc.current += Math.min(delta, 0.1) * config.growthSpeed
    let steps = Math.floor(growthAcc.current)
    growthAcc.current -= steps
    if (steps > MAX_TICKS_PER_FRAME) steps = MAX_TICKS_PER_FRAME

    let added: BranchState[] | null = null
    for (let step = 0; step < steps; step++) {
      const { newNodes } = e.iterate()

      // Consume every node the engine returns — dropping any would desync the
      // rendered strands from the engine's node graph.
      for (let i = 0; i < newNodes.length; i++) {
        const n = newNodes[i]
        nodePos.current.set(n.id, n.position)

        recent.current.push(n.position)
        if (recent.current.length > 10) recent.current.shift()

        const parentBranch = tipToBranch.current.get(n.parentId!)
        const canContinue =
          parentBranch !== undefined &&
          (branchPoints.current.get(parentBranch) ?? 0) < MAX_POINTS_PER_BRANCH

        if (canContinue) {
          // Continue the parent strand and move its tip marker to this node.
          appendToBranch(parentBranch!, n.position)
          tipToBranch.current.delete(n.parentId!)
          tipToBranch.current.set(n.id, parentBranch!)
          nodeBranch.current.set(n.id, parentBranch!)
        } else {
          // Fork, root growth, or a full strand → start a new strand at the
          // parent so the fork point is shared visually.
          const parentPos = nodePos.current.get(n.parentId!) ?? n.position
          const id = nextBranchId.current++
          branchPoints.current.set(id, 2)
          branchTip.current.set(id, n.position.clone())
          tipToBranch.current.set(n.id, id)
          nodeBranch.current.set(n.id, id)

          // Inherit the parent strand's depth layer, occasionally hopping to an
          // adjacent plane so the structure spreads across layers over time.
          const layers = Math.max(1, Math.floor(config.depthLayers))
          const parentBranchId = nodeBranch.current.get(n.parentId!)
          const mid = Math.floor(layers / 2)
          let layer = parentBranchId !== undefined
            ? branchLayer.current.get(parentBranchId) ?? mid
            : mid
          if (layers > 1 && Math.random() < config.layerJumpChance) {
            layer += Math.random() < 0.5 ? -1 : 1
          }
          layer = Math.min(layers - 1, Math.max(0, layer))
          branchLayer.current.set(id, layer)
          const layerZ = (layer - (layers - 1) / 2) * config.layerSpacing

          const state: BranchState = {
            id,
            layerZ,
            initialPoints: [
              parentPos.x,
              parentPos.y,
              parentPos.z,
              n.position.x,
              n.position.y,
              n.position.z,
            ],
          }
          ;(added ??= []).push(state)
        }
      }

      // Frontier = centroid of the most recently added nodes.
      if (recent.current.length > 0) {
        const c = frontier.current.set(0, 0, 0)
        for (const v of recent.current) c.add(v)
        c.multiplyScalar(1 / recent.current.length)
      }

      // Cull-behind + spawn-ahead keeps the attractor cloud marching with the
      // frontier (self-regulates via the maxAttractors target).
      e.replenishAttractors(frontier.current)
    }

    // Bound the parent-position cache. Fork seeds only ever reference very
    // recent tips, so dropping the oldest entries is safe over long runs.
    if (nodePos.current.size > NODE_POS_CAP) {
      const drop = nodePos.current.size - NODE_POS_TRIM
      const it = nodePos.current.keys()
      for (let i = 0; i < drop; i++) {
        const k = it.next().value
        if (k !== undefined) {
          nodePos.current.delete(k)
          nodeBranch.current.delete(k)
        }
      }
    }

    // Trail fade: dim each strand toward black by how far it sits behind the
    // front along the bias direction, so only the leading edge glows. The fade
    // window auto-tracks the furthest live strand (smoothed), so strands always
    // reach full black right as they're evicted — no popping, at any growth rate.
    {
      const bd = biasDir.current.set(config.biasX, config.biasY, config.biasZ)
      if (bd.lengthSq() < 1e-9) bd.set(0, -1, 0)
      bd.normalize()
      const frontProj = frontier.current.dot(bd)

      let maxBehind = 0
      for (const tip of branchTip.current.values()) {
        const behind = frontProj - tip.dot(bd)
        if (behind > maxBehind) maxBehind = behind
      }
      // Smooth the window so it doesn't jump when the furthest strand evicts.
      fadeWindow.current += (maxBehind - fadeWindow.current) * 0.05
      const win = Math.max(0.5, fadeWindow.current)
      const a = win * config.fadeStartFraction
      const b = Math.max(a + 1e-3, win)

      for (const [id, tip] of branchTip.current) {
        const h = handles.current.get(id)
        if (!h) continue
        const behind = frontProj - tip.dot(bd) // >0 ⇒ behind/above the front
        const t = Math.min(1, Math.max(0, (behind - a) / (b - a)))
        const fade = 1 - t * t * (3 - 2 * t) // 1 at the front → 0 once fully behind
        const age = Math.min(1, Math.max(0, behind / win)) // 0 front → 1 old (hue)
        h.setTrail(fade, age)
      }
    }

    if (added) {
      setBranches((prev) => {
        let next = prev.concat(added!)
        const cap = Math.min(HARD_BRANCH_CAP, Math.max(1, Math.floor(config.maxBranches)))
        if (next.length > cap) {
          const removeCount = next.length - cap
          for (let i = 0; i < removeCount; i++) {
            const r = next[i]
            handles.current.delete(r.id)
            branchPoints.current.delete(r.id)
            branchTip.current.delete(r.id)
            branchLayer.current.delete(r.id)
            pending.current.delete(r.id)
            refCbCache.current.delete(r.id)
            for (const [k, v] of tipToBranch.current) {
              if (v === r.id) tipToBranch.current.delete(k)
            }
          }
          next = next.slice(removeCount) // unmount → BranchLine disposes its GPU buffers
        }
        return next
      })
    }
  })

  return (
    <>
      {branches.map((b) => (
        <BranchLine
          key={b.id}
          ref={refCb(b.id)}
          initialPoints={b.initialPoints}
          layerZ={b.layerZ}
        />
      ))}
    </>
  )
}
