'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { markPrinted } from '@/actions/production'
import { toast } from 'sonner'
import { Check, Undo2 } from 'lucide-react'

/**
 * Marks one customised line as printed.
 *
 * Reversible on purpose: "printed" is a claim a human makes, and the recovery
 * from a mis-click should not be a database edit.
 */
export default function PrintedToggle({
  itemId, printed, printedBy, printedAt,
}: {
  itemId: string
  printed: boolean
  printedBy: string | null
  printedAt: string | null
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <div className="flex items-center gap-2">
      {printed && printedAt && (
        <span className="text-[11px] text-neutral-400">
          {new Date(printedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          {printedBy ? ` · ${printedBy}` : ''}
        </span>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              await markPrinted(itemId, !printed)
              toast.success(printed ? 'Moved back to the print queue' : 'Marked printed')
              router.refresh()
            } catch {
              toast.error('Could not update')
            }
          })
        }
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
          printed
            ? 'border-green-300 bg-green-50 text-green-800 hover:border-green-500'
            : 'border-neutral-300 text-neutral-700 hover:border-neutral-900'
        }`}
      >
        {printed ? <><Undo2 className="h-3.5 w-3.5" /> Printed</> : <><Check className="h-3.5 w-3.5" /> Mark printed</>}
      </button>
    </div>
  )
}
