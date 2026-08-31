'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Camera, Truck, Undo2, Loader2, Trash2 } from 'lucide-react'
import {
  addRentalPhoto, getRentalPhotos, deleteRentalPhoto,
  recordRentalDispatch, bookRentalReturnLeg, markRentalDelivered,
} from '@/actions/rentalOps'
import { refundRentalDeposit } from '@/actions/rentalPayments'
import type { RentalDamagePhoto } from '@/types/database'

/**
 * The three things an operator does to a rental that are not "hand it over" or
 * "take it back": photograph it, move it, and settle the deposit when the
 * automatic settlement did not.
 *
 * Deliberately collapsed behind a disclosure rather than laid out inline. Most
 * bookings need none of this, and a row of six controls on every card is how a
 * screen becomes something people scan past.
 */

type Props = {
  bookingId: string
  fulfilment: 'pickup' | 'ship'
  status: string
  depositAmount: number
  depositState: string
  depositRefunded: number
  outTracking: string | null
  returnTracking: string | null
}

type Photo = RentalDamagePhoto & { signedUrl: string | null }

export default function RentalBookingOps(props: Props) {
  const [open, setOpen] = useState(false)
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  const [pending, start] = useTransition()
  const [carrier, setCarrier] = useState('')
  const [tracking, setTracking] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<'handover' | 'return'>(
    props.status === 'out' ? 'return' : 'handover',
  )

  function reveal() {
    setOpen(true)
    if (photos === null) {
      start(async () => setPhotos(await getRentalPhotos(props.bookingId)))
    }
  }

  function upload(file: File) {
    start(async () => {
      const res = await addRentalPhoto({ bookingId: props.bookingId, stage, file })
      if (!res.ok) { toast.error(res.error); return }
      toast.success(`${stage === 'handover' ? 'Handover' : 'Return'} photograph saved`)
      setPhotos(await getRentalPhotos(props.bookingId))
    })
  }

  function remove(id: string) {
    start(async () => {
      const res = await deleteRentalPhoto(id)
      if (!res.ok) { toast.error(res.error); return }
      setPhotos(await getRentalPhotos(props.bookingId))
    })
  }

  function dispatch() {
    if (!carrier.trim() || !tracking.trim()) {
      toast.error('A dispatch needs both a carrier and a tracking number.')
      return
    }
    start(async () => {
      const res = await recordRentalDispatch({ bookingId: props.bookingId, carrier, tracking })
      toast[res.ok ? 'success' : 'error'](res.ok ? 'Dispatched — the customer has been told.' : res.error)
      if (res.ok) { setCarrier(''); setTracking('') }
    })
  }

  function bookReturn() {
    if (!carrier.trim()) { toast.error('Name the carrier collecting it.'); return }
    start(async () => {
      const res = await bookRentalReturnLeg({
        bookingId: props.bookingId, carrier, tracking: tracking || undefined,
      })
      toast[res.ok ? 'success' : 'error'](res.ok ? 'Return leg booked.' : res.error)
      if (res.ok) { setCarrier(''); setTracking('') }
    })
  }

  const depositOutstanding =
    props.depositAmount > 0 && props.depositRefunded === 0 && props.depositState === 'held'

  if (!open) {
    return (
      <button
        type="button"
        onClick={reveal}
        className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:border-gray-400 hover:text-gray-900"
      >
        Photos, shipping &amp; deposit
      </button>
    )
  }

  return (
    <div className="mt-3 w-full rounded-md border border-gray-200 bg-gray-50 p-3">
      {pending && (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-gray-500">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Working…
        </p>
      )}

      {/* ── Evidence ───────────────────────────────────────────────────────── */}
      <section>
        <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-700">
          <Camera className="h-3.5 w-3.5" aria-hidden="true" /> Photographs
        </h4>
        <p className="mt-1 text-xs text-gray-500">
          One set at handover, one at return. This protects the customer as much as the shop — “it
          was already like that” is defensible with a handover picture and not without one.
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as 'handover' | 'return')}
            className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs"
            aria-label="Photograph stage"
          >
            <option value="handover">At handover</option>
            <option value="return">At return</option>
          </select>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) upload(f)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 hover:border-gray-500"
          >
            Add a photograph
          </button>
        </div>

        {photos && photos.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {photos.map((p) => (
              <li key={p.id} className="relative">
                {/* Signed, and expiring in ten minutes. The bucket is private:
                    these are photographs of somebody's property taken to settle
                    a money question, and a permanent link is a public bucket
                    with extra steps. */}
                {p.signedUrl ? (
                  <a href={p.signedUrl} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.signedUrl}
                      alt={`${p.stage} photograph`}
                      className="h-16 w-16 rounded-md border border-gray-200 object-cover"
                    />
                  </a>
                ) : (
                  <span className="grid h-16 w-16 place-items-center rounded-md border border-gray-200 bg-white text-[10px] text-gray-400">
                    expired
                  </span>
                )}
                <span className="absolute left-0 top-0 rounded-br-md rounded-tl-md bg-black/60 px-1 text-[9px] uppercase text-white">
                  {p.stage === 'handover' ? 'out' : 'in'}
                </span>
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  aria-label="Delete photograph"
                  className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-white text-gray-400 shadow ring-1 ring-gray-200 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {photos && photos.length === 0 && (
          <p className="mt-2 text-xs text-gray-400">No photographs on this booking yet.</p>
        )}
      </section>

      {/* ── Logistics ──────────────────────────────────────────────────────── */}
      {props.fulfilment === 'ship' && (
        <section className="mt-4 border-t border-gray-200 pt-3">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-700">
            <Truck className="h-3.5 w-3.5" aria-hidden="true" /> Both legs
          </h4>
          <p className="mt-1 text-xs text-gray-500">
            The customer has already paid for the journey home — delivery is charged both ways on
            every posted rental — so booking it is the shop&rsquo;s job, not theirs.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="Carrier"
              className="h-8 w-32 rounded-md border border-gray-200 bg-white px-2 text-xs"
            />
            <input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="Tracking"
              className="h-8 w-40 rounded-md border border-gray-200 bg-white px-2 text-xs"
            />
            <button
              type="button"
              onClick={dispatch}
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 hover:border-gray-500"
            >
              Record dispatch
            </button>
            <button
              type="button"
              onClick={bookReturn}
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 hover:border-gray-500"
            >
              Book the return
            </button>
            <button
              type="button"
              onClick={() => start(async () => {
                const r = await markRentalDelivered(props.bookingId)
                toast[r.ok ? 'success' : 'error'](r.ok ? 'Marked delivered.' : r.error)
              })}
              className="rounded-md px-2 py-1.5 text-xs text-gray-500 hover:text-gray-900"
            >
              Delivered
            </button>
          </div>
          {(props.outTracking || props.returnTracking) && (
            <p className="mt-2 font-mono text-[11px] text-gray-500">
              {props.outTracking && <>out {props.outTracking}</>}
              {props.outTracking && props.returnTracking && ' · '}
              {props.returnTracking && <>back {props.returnTracking}</>}
            </p>
          )}
        </section>
      )}

      {/* ── The deposit ────────────────────────────────────────────────────── */}
      {depositOutstanding && (
        <section className="mt-4 border-t border-gray-200 pt-3">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-700">
            <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> Deposit
          </h4>
          <p className="mt-1 text-xs text-gray-500">
            Normally settled automatically when a return is recorded. This is here for the case that
            always eventually happens — a gateway that was down at the moment it mattered.
          </p>
          <button
            type="button"
            onClick={() => start(async () => {
              const r = await refundRentalDeposit({ bookingId: props.bookingId })
              toast[r.ok ? 'success' : 'error'](
                r.ok
                  ? r.unrecovered > 0
                    ? `Settled. ₹${(r.unrecovered / 100).toLocaleString('en-IN')} is owed beyond the deposit — not charged.`
                    : 'Deposit returned.'
                  : r.error,
              )
            })}
            className="mt-2 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 hover:border-gray-500"
          >
            Settle the deposit now
          </button>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-4 text-xs text-gray-400 hover:text-gray-700"
      >
        Close
      </button>
    </div>
  )
}
