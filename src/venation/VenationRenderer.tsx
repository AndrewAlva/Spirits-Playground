import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { VenationEngine } from './engine'
import { config } from './config'
import BranchLine, {
  MAX_POINTS_PER_BRANCH,
  type BranchLineHandle,
} from './BranchLine'

const MAX_BRANCHES = 120 // hard cap on live strands; oldest evicted past this
const NODE_POS_CAP = 5000 // bound the parent-position cache for infinite runs
const NODE_POS_TRIM = 2500 // entries kept after a trim

interface BranchState {
  id: number
  initialPoints: number[] // root-first seed, stable identity per strand
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
  const nodePos = useRef(new Map<number, THREE.Vector3>()) // nodeId → position
  const pending = useRef(new Map<number, number[][]>()) // points awaiting strand mount
  const refCbCache = useRef(new Map<number, (h: BranchLineHandle | null) => void>())
  const nextBranchId = useRef(0)
  const recent = useRef<THREE.Vector3[]>([]) // last few nodes, for the frontier

  // Last-seen GUI counters, so we only act when the user actually edits.
  const lastVisual = useRef(config.visualVersion)
  const lastWidth = useRef(config.widthVersion)
  const lastReset = useRef(config.resetVersion)

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
  }

  useFrame(() => {
    const e = engineRef.current!

    // Respond to GUI edits (cheap version-counter checks).
    if (config.resetVersion !== lastReset.current) {
      lastReset.current = config.resetVersion
      resetAll()
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

    const { newNodes } = e.iterate()

    // The engine already throttles itself to a few nodes per tick, so we
    // consume every node it returns — dropping any here would desync the
    // rendered strands from the engine's node graph.
    let added: BranchState[] | null = null
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
      } else {
        // Fork, root growth, or a full strand → start a new strand at the
        // parent so the fork point is shared visually.
        const parentPos = nodePos.current.get(n.parentId!) ?? n.position
        const id = nextBranchId.current++
        branchPoints.current.set(id, 2)
        tipToBranch.current.set(n.id, id)
        const state: BranchState = {
          id,
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

    // Bound the parent-position cache. Fork seeds only ever reference very
    // recent tips, so dropping the oldest entries is safe over long runs.
    if (nodePos.current.size > NODE_POS_CAP) {
      const drop = nodePos.current.size - NODE_POS_TRIM
      const it = nodePos.current.keys()
      for (let i = 0; i < drop; i++) {
        const k = it.next().value
        if (k !== undefined) nodePos.current.delete(k)
      }
    }

    // Frontier = centroid of the most recently added nodes.
    if (recent.current.length > 0) {
      const c = frontier.current.set(0, 0, 0)
      for (const v of recent.current) c.add(v)
      c.multiplyScalar(1 / recent.current.length)
    }

    if (e.attractorCount < config.replenishBelow) e.replenishAttractors(frontier.current)

    if (added) {
      setBranches((prev) => {
        let next = prev.concat(added!)
        if (next.length > MAX_BRANCHES) {
          const removeCount = next.length - MAX_BRANCHES
          for (let i = 0; i < removeCount; i++) {
            const r = next[i]
            handles.current.delete(r.id)
            branchPoints.current.delete(r.id)
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
        <BranchLine key={b.id} ref={refCb(b.id)} initialPoints={b.initialPoints} />
      ))}
    </>
  )
}
