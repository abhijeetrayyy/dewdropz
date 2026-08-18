'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { issueInvoiceNow } from '@/actions/invoicing'

// Raising the tax invoice for a supply that already went out.
//
// Shown only where there is something to invoice — a dispatched, uninvoiced,
// live order — because a button that refuses is worse than no button.
//
// Behind a confirm, and not because it is destructive. It spends the next
// number from a gapless serial register, and that number cannot be handed back:
// undoing this is a credit note and a reissue, not a delete. The dialog says so
// in those words rather than asking "are you sure?".
export default function IssueInvoiceButton({
  orderId,
  orderNumber,
  dispatchedAt,
}: {
  orderId: string
  orderNumber: string
  dispatchedAt: string
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [refusal, setRefusal] = useState<string | null>(null)

  const dispatched = new Date(dispatchedAt).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  function run() {
    setRefusal(null)
    startTransition(async () => {
      const result = await issueInvoiceNow(orderId)
      if (!result.ok) {
        // Held on the page, not in a toast. Every refusal from `issue_invoice`
        // names a specific thing to go and fix — a missing GSTIN, a state code
        // that disagrees — and that is a list to work through, not a message to
        // watch disappear.
        setRefusal(result.error)
        return
      }
      toast.success(
        result.alreadyExisted
          ? `${orderNumber} was already invoiced as ${result.serial}`
          : `Invoice ${result.serial} issued`
      )
    })
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="mt-3"
        onClick={() => setOpen(true)}
        disabled={pending}
      >
        {pending ? 'Issuing…' : 'Issue the invoice now'}
      </Button>

      {refusal && (
        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-900">Not issued</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">{refusal}</p>
          <p className="mt-2 text-xs leading-relaxed text-amber-800">
            No number was spent. Fix the above and press the button again.
          </p>
        </div>
      )}

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        variant="default"
        title={`Raise the tax invoice for ${orderNumber}?`}
        description={
          `This takes the next number from the invoice register and cannot be undone — ` +
          `correcting an issued invoice means a credit note and a fresh one. The invoice ` +
          `will be dated ${dispatched}, the day the goods left, not today.`
        }
        confirmLabel="Issue invoice"
        onConfirm={run}
      />
    </>
  )
}
