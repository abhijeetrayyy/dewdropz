'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'

// An inline numeric cell that will not destroy the value it is editing.
//
// The version this replaces did `parseInt(next) || 0` on a debounce, which had
// two consequences on a live catalogue:
//
//   • Clearing the box to retype saved ZERO. Select-all, type a new price, and
//     for 400ms the field is empty — that empty string became 0 and was
//     committed. A price silently became free.
//   • `parseInt('1899.50')` is 1899, so paise were truncated on every edit.
//
// So: an empty or half-typed value is not a value. Nothing commits until the
// text parses to a finite number, and leaving the field with junk in it puts
// the last good value back rather than inventing one.
export function EditableNumber({
  value,
  onCommit,
  mode,
  align = 'right',
  className,
  ariaLabel,
}: {
  /** Canonical value. Rupees for mode="rupees", whole units for mode="integer". */
  value: number
  onCommit: (next: number) => Promise<void>
  mode: 'rupees' | 'integer'
  align?: 'left' | 'right'
  className?: string
  ariaLabel: string
}) {
  const format = (n: number) => (mode === 'rupees' ? String(n) : String(Math.trunc(n)))
  const [local, setLocal] = useState(() => format(value))
  const [pending, setPending] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The last value known to be saved, so an abandoned edit has something to
  // fall back to that is not zero.
  const committed = useRef(value)

  useEffect(() => { committed.current = value; setLocal(format(value)) }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function parse(text: string): number | null {
    const t = text.trim()
    if (t === '' || t === '-' || t === '.') return null
    const n = mode === 'rupees' ? parseFloat(t) : parseInt(t, 10)
    if (!Number.isFinite(n) || n < 0) return null
    return n
  }

  function handleChange(next: string) {
    // Digits, and a single decimal point when the field holds money.
    const allowed = mode === 'rupees' ? /^[0-9]*\.?[0-9]{0,2}$/ : /^[0-9]*$/
    if (!allowed.test(next)) return
    setLocal(next)

    if (timer.current) clearTimeout(timer.current)
    const parsed = parse(next)
    if (parsed === null) return // mid-edit — wait, don't guess

    timer.current = setTimeout(async () => {
      if (parsed === committed.current) return
      setPending(true)
      try {
        await onCommit(parsed)
        committed.current = parsed
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not save')
        setLocal(format(committed.current))
      } finally {
        setPending(false)
      }
    }, 500)
  }

  function handleBlur() {
    if (parse(local) === null) setLocal(format(committed.current))
  }

  return (
    <div className={`relative flex items-center ${className ?? ''}`}>
      {mode === 'rupees' && (
        <span className="pointer-events-none absolute left-2 text-xs text-gray-400">₹</span>
      )}
      <Input
        // Deliberately text + inputMode rather than type="number": the spinner
        // overlaps right-aligned figures in a narrow cell, and a number input
        // reports '' for anything it considers invalid, which is what made the
        // old cell unable to tell "empty" from "zero".
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        className={`h-8 w-full text-xs tabular-nums ${align === 'right' ? 'text-right' : ''} ${mode === 'rupees' ? 'pl-5' : ''} ${pending ? 'opacity-60' : ''}`}
      />
    </div>
  )
}
