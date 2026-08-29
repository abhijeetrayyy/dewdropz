'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { cancelMyRentalBooking } from '@/actions/rentals'

/**
 * Only offered while a booking is still `reserved` — nothing is charged and no
 * gear has moved, so calling it off should not require a phone call. Confirmed
 * first, because the dates go back on the shelf immediately and somebody else
 * can take them.
 */
export default function CancelRentalButton({ bookingId, number }: { bookingId: string; number: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)

  async function cancel() {
    setBusy(true)
    try {
      const res = await cancelMyRentalBooking(bookingId)
      if (!res.ok) { toast.error(res.error); return }
      toast.success(`${number} cancelled — the dates are free again`)
      setAsking(false)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="font-body text-[13px] text-mid underline underline-offset-4 hover:text-clay-deep"
      >
        Cancel this booking
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="font-body text-[13px] text-ink">Cancel {number}? The dates go back on the shelf.</span>
      <button
        type="button"
        onClick={cancel}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-full bg-clay-deep px-4 py-2 font-body text-[13px] text-paper disabled:opacity-50"
      >
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Yes, cancel
      </button>
      <button
        type="button"
        onClick={() => setAsking(false)}
        disabled={busy}
        className="font-body text-[13px] text-mid hover:text-ink"
      >
        Keep it
      </button>
    </div>
  )
}
