'use client'

import { useState, useTransition } from 'react'
import { History, Loader2 } from 'lucide-react'
import { getRentalHistory, type RentalHistoryEntry } from '@/actions/rentalOps'
import RentalHistory from '@/components/rent/RentalHistory'

/**
 * The booking's history, fetched when somebody asks for it.
 *
 * On demand rather than with the page: twenty-five bookings on screen, each
 * with up to a couple of dozen events, is a join nobody has asked for on every
 * load of a list where the common errand is "hand this one over". Opening one
 * is a click and a single query.
 *
 * The drawing is `components/rent/RentalHistory.tsx`, and this disclosure is
 * used on BOTH surfaces — the operator's booking card and the customer's own —
 * because the query, the permission rule and the timeline are all one thing.
 * The rental council's warning was about exactly this artefact: it was found
 * four times and three different screens were proposed for it.
 */
export default function RentalHistoryPanel({
  bookingId,
  audience = 'staff',
  label = 'History',
}: {
  bookingId: string
  /** Staff see operational events too; a customer sees what happened and what
   *  it cost. Every event that moved money is shown to both. */
  audience?: 'staff' | 'customer'
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<RentalHistoryEntry[] | null>(null)
  const [pending, start] = useTransition()

  function toggle() {
    if (open) { setOpen(false); return }
    setOpen(true)
    // Fetched once. Re-opening a booking whose history is already loaded should
    // not go back to the database — and if something happened in between, the
    // action that caused it called `router.refresh()`, which remounts this.
    if (entries === null) start(async () => setEntries(await getRentalHistory(bookingId)))
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-md border border-rule px-2.5 py-1.5 text-xs text-mid transition-colors hover:border-forest hover:text-forest"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <History className="h-3.5 w-3.5" aria-hidden="true" />}
        {open ? 'Hide' : label}
      </button>

      {open && (
        <div className="mt-3 rounded-md border border-rule bg-paper-deep/40 p-4">
          {entries === null ? (
            <p className="font-body text-[13px] text-mid">Reading the log…</p>
          ) : (
            <RentalHistory entries={entries} audience={audience} />
          )}
        </div>
      )}
    </div>
  )
}
