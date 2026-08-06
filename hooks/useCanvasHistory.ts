'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Canvas } from 'fabric'

// Tracks which canvas instances already have history listeners wired, so a
// spurious extra effect invocation (React dev-mode double-invoke, Fast
// Refresh, etc.) can never register the same handler twice on the same
// canvas — which would otherwise double-push every snapshot and make undo
// jump back two steps at a time instead of one.
const wired = new WeakSet<Canvas>()

// Snapshot-based undo/redo — simplest thing that works correctly with
// Fabric's own event model. Each add/modify/remove pushes a full canvas.
// toJSON() snapshot; undo/redo just reloads a prior snapshot. Fires on
// object:modified (once per finished drag/resize/rotate gesture) and
// text:changed (per keystroke while editing), not on every animation frame,
// so the stack stays a reasonable size.
export function useCanvasHistory(canvas: Canvas | null) {
  const stack = useRef<string[]>([])
  const pointer = useRef(-1)
  const restoring = useRef(false)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const updateFlags = useCallback(() => {
    setCanUndo(pointer.current > 0)
    setCanRedo(pointer.current < stack.current.length - 1)
  }, [])

  const snapshot = useCallback(() => {
    if (!canvas || restoring.current) return
    const json = JSON.stringify(canvas.toJSON())
    stack.current = stack.current.slice(0, pointer.current + 1)
    stack.current.push(json)
    pointer.current = stack.current.length - 1
    updateFlags()
  }, [canvas, updateFlags])

  useEffect(() => {
    if (!canvas || wired.has(canvas)) return
    wired.add(canvas)
    stack.current = [JSON.stringify(canvas.toJSON())]
    pointer.current = 0
    updateFlags()

    canvas.on('object:added', snapshot)
    canvas.on('object:modified', snapshot)
    canvas.on('object:removed', snapshot)
    canvas.on('text:changed', snapshot)
    return () => {
      canvas.off('object:added', snapshot)
      canvas.off('object:modified', snapshot)
      canvas.off('object:removed', snapshot)
      canvas.off('text:changed', snapshot)
      wired.delete(canvas)
    }
  }, [canvas, snapshot, updateFlags])

  const restore = useCallback(
    (index: number) => {
      if (!canvas || index < 0 || index >= stack.current.length) return
      restoring.current = true
      canvas.loadFromJSON(stack.current[index]).then(() => {
        canvas.renderAll()
        restoring.current = false
      })
      pointer.current = index
      updateFlags()
    },
    [canvas, updateFlags]
  )

  const undo = useCallback(() => restore(pointer.current - 1), [restore])
  const redo = useCallback(() => restore(pointer.current + 1), [restore])

  return { undo, redo, canUndo, canRedo }
}
