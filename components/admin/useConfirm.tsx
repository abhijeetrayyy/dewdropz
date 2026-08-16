'use client'

import { useCallback, useRef, useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'

type Options = {
  title: string
  description: string
  confirmLabel?: string
  variant?: 'default' | 'destructive'
}

/**
 * `confirm()` with the app's own dialog, keeping the shape callers already use.
 *
 * ConfirmDialog is controlled, which is right for a page with one known
 * destructive action but heavy for the nine admin pages that were still calling
 * the browser's `confirm()` — each would need its own open state, a pending
 * target, and a handler, just to ask "are you sure". So they kept using the
 * native dialog: a gray OS box with no styling, no wording control, and a
 * default button people dismiss by reflex, guarding things like "delete this
 * coupon" and "delete all rates in this zone".
 *
 * This returns a promise instead, so a call site changes from
 *
 *     if (!confirm('Delete this tag?')) return
 *
 * to
 *
 *     if (!(await confirm({ title: 'Delete this tag?', description: '…' }))) return
 *
 * — same control flow, same early return, nothing else to rewire. Render
 * `dialog` anywhere in the component.
 */
export function useConfirm() {
  const [options, setOptions] = useState<Options | null>(null)
  // Held across renders so the promise created on ask() is the one settled by
  // the button, however many renders happen in between.
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  const confirm = useCallback((opts: Options) => {
    setOptions(opts)
    return new Promise<boolean>((resolve) => { resolver.current = resolve })
  }, [])

  const settle = useCallback((ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = null
    setOptions(null)
  }, [])

  const dialog = (
    <ConfirmDialog
      open={options !== null}
      // Covers Escape, the Cancel button and a click outside — all of which
      // must resolve false rather than leaving the caller awaiting forever.
      onOpenChange={(open) => { if (!open) settle(false) }}
      title={options?.title ?? ''}
      description={options?.description ?? ''}
      confirmLabel={options?.confirmLabel}
      variant={options?.variant}
      onConfirm={() => settle(true)}
    />
  )

  return { confirm, dialog }
}
