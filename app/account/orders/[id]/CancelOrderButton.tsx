'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cancelOrder } from '@/actions/orders'

export default function CancelOrderButton({ orderId, userId }: { orderId: string; userId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  async function handleCancel() {
    setCancelling(true)
    try {
      const result = await cancelOrder(orderId, userId)
      if (result && 'error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Order cancelled')
      setOpen(false)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not cancel this order')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-body text-xs text-clay hover:underline transition-colors"
      >
        Cancel Order
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
            <AlertDialogDescription>
              This can&apos;t be undone. Stock held for this order will be released, and if you&apos;ve already
              been charged, a refund will be issued automatically to your original payment method.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep Order</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={cancelling} className="bg-red-600 hover:bg-red-700 focus:ring-red-600">
              {cancelling ? 'Cancelling…' : 'Cancel Order'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
