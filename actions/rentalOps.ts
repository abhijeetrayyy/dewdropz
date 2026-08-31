'use server'

import { revalidatePath } from 'next/cache'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { requireAdmin } from './auth'
import { uploadFileAdmin, deleteFile, getSignedUrl, STORAGE_BUCKETS } from '@/lib/supabase/storage'
import { enqueue } from '@/lib/jobs'
import { shopToday, shopTomorrow, shopAddDays } from '@/lib/shopTime'
import type { RentalDamagePhoto } from '@/types/database'

/**
 * Running a rental once it exists: evidence, movement, and telling people
 * things before they become a problem.
 *
 * Everything here is staff-facing. The customer-facing halves live in
 * actions/rentals.ts (booking, cancelling) and actions/rentalExtensions.ts.
 */

type Fail = { ok: false; error: string }

// ── Evidence ────────────────────────────────────────────────────────────────
//
// WHY THIS EXISTS. Damage was a number and a note typed by whoever took the
// return. In a dispute that is an assertion, and an assertion is worth nothing
// against a customer who says the pole was already bent.
//
// A photograph at handover and another at return is the cheapest protection
// either side has — and it protects the CUSTOMER at least as much as the shop.
// "It was already like that" is a defensible position when there is a handover
// picture, and an indefensible one when there is not.

const PHOTO_MIME = ['image/jpeg', 'image/png', 'image/webp']
const PHOTO_MAX_BYTES = 8 * 1024 * 1024

export async function addRentalPhoto(input: {
  bookingId: string
  stage: 'handover' | 'return'
  file: File
  note?: string
  reservationId?: string | null
}): Promise<{ ok: true; photo: RentalDamagePhoto } | Fail> {
  const actor = await requireAdmin()

  if (!PHOTO_MIME.includes(input.file.type)) {
    return { ok: false, error: 'Photographs must be JPEG, PNG or WebP.' }
  }
  if (input.file.size > PHOTO_MAX_BYTES) {
    return { ok: false, error: 'That photograph is over 8MB — take it again at a lower resolution.' }
  }

  const supabase = createAdminSupabaseClient()
  const { data: booking } = await supabase
    .from('rental_bookings')
    .select('id, booking_number')
    .eq('id', input.bookingId)
    .maybeSingle()

  if (!booking) return { ok: false, error: 'That booking could not be found.' }

  // Foldered by booking so a whole rental's evidence can be found, and listed,
  // without a database round trip — which is what you want at the moment
  // somebody is arguing about it.
  const ext = input.file.type.split('/')[1]
  const path = `${booking.booking_number}/${input.stage}/${crypto.randomUUID()}.${ext}`

  const uploaded = await uploadFileAdmin(STORAGE_BUCKETS.RENTAL_EVIDENCE, path, input.file, input.file.type)
  if (!uploaded) return { ok: false, error: 'That photograph could not be stored. Try again.' }

  const { data: photo, error } = await supabase
    .from('rental_damage_photos')
    .insert({
      booking_id: input.bookingId,
      reservation_id: input.reservationId ?? null,
      stage: input.stage,
      // The PATH, not a URL. The bucket is private, so a stored URL would be
      // either useless or a permanent public link — and the second is the thing
      // a private bucket exists to prevent.
      url: path,
      note: input.note ?? null,
      actor_id: actor.id,
    })
    .select('*')
    .single()

  if (error || !photo) {
    // The row is what makes the object findable; an orphan in the bucket is
    // storage nobody can reach. Clean it up rather than leaving it.
    await deleteFile(STORAGE_BUCKETS.RENTAL_EVIDENCE, path).catch(() => {})
    return { ok: false, error: 'That photograph could not be recorded.' }
  }

  await supabase.from('rental_events').insert({
    booking_id: input.bookingId,
    kind: 'photo_added',
    note: `${input.stage} photograph${input.note ? ` — ${input.note}` : ''}`,
    actor_id: actor.id,
  })

  revalidatePath('/admin/rentals')
  return { ok: true, photo: photo as RentalDamagePhoto }
}

/**
 * The evidence for a booking, with links that expire.
 *
 * Ten minutes is deliberately short. These are links to photographs of somebody
 * else's property taken to settle a money question, and a link that lives
 * forever is a public bucket with extra steps.
 */
export async function getRentalPhotos(
  bookingId: string,
): Promise<(RentalDamagePhoto & { signedUrl: string | null })[]> {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()

  const { data } = await supabase
    .from('rental_damage_photos')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true })

  const rows = (data ?? []) as RentalDamagePhoto[]
  return Promise.all(
    rows.map(async (p) => ({
      ...p,
      signedUrl: await getSignedUrl(STORAGE_BUCKETS.RENTAL_EVIDENCE, p.url, 600),
    })),
  )
}

export async function deleteRentalPhoto(photoId: string): Promise<{ ok: true } | Fail> {
  const actor = await requireAdmin()
  const supabase = createAdminSupabaseClient()

  const { data: photo } = await supabase
    .from('rental_damage_photos')
    .select('id, booking_id, url, stage')
    .eq('id', photoId)
    .maybeSingle()

  if (!photo) return { ok: false, error: 'That photograph could not be found.' }

  await deleteFile(STORAGE_BUCKETS.RENTAL_EVIDENCE, photo.url as string).catch(() => {})
  await supabase.from('rental_damage_photos').delete().eq('id', photoId)

  // Recorded, because deleting evidence is exactly the kind of action that
  // should leave a mark. The photograph is gone; the fact that somebody removed
  // it is not.
  await supabase.from('rental_events').insert({
    booking_id: photo.booking_id,
    kind: 'note',
    note: `A ${photo.stage} photograph was deleted`,
    actor_id: actor.id,
  })

  revalidatePath('/admin/rentals')
  return { ok: true }
}

// ── Logistics ───────────────────────────────────────────────────────────────
//
// A posted rental is charged for two journeys and, until now, tracked for
// neither. The money for the return leg has always been collected; the movement
// was somebody remembering.

export async function recordRentalDispatch(input: {
  bookingId: string
  carrier: string
  tracking: string
}): Promise<{ ok: true } | Fail> {
  const actor = await requireAdmin()
  if (!input.carrier.trim() || !input.tracking.trim()) {
    return { ok: false, error: 'A dispatch needs both a carrier and a tracking number.' }
  }

  const supabase = createAdminSupabaseClient()
  const { error } = await supabase
    .from('rental_bookings')
    .update({
      out_carrier: input.carrier.trim(),
      out_tracking: input.tracking.trim(),
      dispatched_at: new Date().toISOString(),
    })
    .eq('id', input.bookingId)

  if (error) return { ok: false, error: error.message }

  await supabase.from('rental_events').insert({
    booking_id: input.bookingId,
    kind: 'dispatched',
    note: `${input.carrier.trim()} · ${input.tracking.trim()}`,
    actor_id: actor.id,
  })

  await enqueue('rental.dispatched', { bookingId: input.bookingId })

  revalidatePath('/admin/rentals')
  revalidatePath('/account/rentals')
  return { ok: true }
}

/**
 * Book the journey home.
 *
 * THE RETURN LEG IS THE SHOP'S JOB, and that is a decision rather than an
 * implementation detail. The customer has already paid for it — the pricer
 * charges delivery both ways on every posted rental — so asking them to arrange
 * it and claim it back would be charging for a service and then making them
 * perform it.
 *
 * The label URL is stored rather than generated here: carrier integrations
 * differ, and every one of them is a decision the shop has not made yet. What
 * this does is make the fact of the return leg a first-class thing the system
 * knows about, so the integration is a change of source rather than a change of
 * model.
 */
export async function bookRentalReturnLeg(input: {
  bookingId: string
  carrier: string
  tracking?: string
  labelUrl?: string
}): Promise<{ ok: true } | Fail> {
  const actor = await requireAdmin()
  if (!input.carrier.trim()) return { ok: false, error: 'Name the carrier collecting it.' }

  const supabase = createAdminSupabaseClient()
  const { data: booking } = await supabase
    .from('rental_bookings')
    .select('id, fulfilment, delivery_amount')
    .eq('id', input.bookingId)
    .maybeSingle()

  if (!booking) return { ok: false, error: 'That booking could not be found.' }
  if (booking.fulfilment !== 'ship') {
    return { ok: false, error: 'This rental is collected in person — there is no return leg to book.' }
  }

  await supabase
    .from('rental_bookings')
    .update({
      return_carrier: input.carrier.trim(),
      return_tracking: input.tracking?.trim() || null,
      return_label_url: input.labelUrl?.trim() || null,
      return_booked_at: new Date().toISOString(),
    })
    .eq('id', input.bookingId)

  await supabase.from('rental_events').insert({
    booking_id: input.bookingId,
    kind: 'return_booked',
    note: `${input.carrier.trim()}${input.tracking ? ` · ${input.tracking.trim()}` : ''}`,
    actor_id: actor.id,
  })

  await enqueue('rental.return_booked', { bookingId: input.bookingId })

  revalidatePath('/admin/rentals')
  revalidatePath('/account/rentals')
  return { ok: true }
}

export async function markRentalDelivered(bookingId: string): Promise<{ ok: true } | Fail> {
  const actor = await requireAdmin()
  const supabase = createAdminSupabaseClient()

  const { error } = await supabase
    .from('rental_bookings')
    .update({ delivered_at: new Date().toISOString() })
    .eq('id', bookingId)

  if (error) return { ok: false, error: error.message }

  await supabase.from('rental_events').insert({
    booking_id: bookingId, kind: 'delivered', actor_id: actor.id,
  })

  revalidatePath('/admin/rentals')
  return { ok: true }
}

// ── Reminders ───────────────────────────────────────────────────────────────

/**
 * The sweep, run from cron.
 *
 * THREE MESSAGES, AND EACH ONE IS A DIFFERENT PROBLEM BEING PREVENTED.
 *
 *   starting   — "your rental starts tomorrow" stops the no-show, which is a
 *                day nobody could book and nobody paid for.
 *   due        — "due back tomorrow" is the one that matters most, because
 *                without it the late fee accrues in silence and the first the
 *                customer hears of it is a deduction from their deposit. A
 *                penalty nobody was warned about is a penalty that gets argued
 *                about.
 *   overdue    — said once, on the day after. Not every day: a system that
 *                emails somebody daily about a tent is a system people mute.
 *
 * IDEMPOTENT BY CONSTRUCTION. Each message claims its own booking by writing
 * its timestamp in the same UPDATE that selects it, so two crons overlapping —
 * or one retrying — cannot send twice. That is why these are timestamps rather
 * than booleans: "when did we tell them" is the question asked in a dispute.
 */
export async function runRentalReminders(): Promise<{
  starting: number
  due: number
  overdue: number
}> {
  const supabase = createAdminSupabaseClient()
  // The SHOP's day. These were UTC, and the shop is UTC+05:30 — so a run in the
  // wrong window computed yesterday, claimed the wrong cohort, and (the claim
  // being one-shot) the right cohort was then NEVER warned. A reminder missed
  // this way is not late, it is gone.
  const today = shopToday()
  const tomorrow = shopTomorrow()

  const counts = { starting: 0, due: 0, overdue: 0 }

  /**
   * Claim a booking for one reminder, send it, and give the claim BACK if the
   * send could not even be queued.
   *
   * The claim-then-send order is right — the other way round risks a mail loop.
   * Its cost is a lost message when the step after the claim fails, and that
   * cost is normally repaid by the queue's retries. It was not, because
   * `enqueue` never throws: on a database error it returns `{ queued: false }`
   * and this code incremented the counter anyway. So a blip produced a booking
   * claimed forever, no job, no reminder, and an HTTP 200 reporting fourteen
   * emails that did not exist.
   */
  const claimAndSend = async (
    bookingId: string,
    column: 'reminder_starts_at' | 'reminder_due_at' | 'reminder_overdue_at',
    kind: 'starting' | 'due' | 'overdue',
  ): Promise<boolean> => {
    const { data: claimed } = await supabase
      .from('rental_bookings')
      .update({ [column]: new Date().toISOString() })
      .eq('id', bookingId)
      .is(column, null)
      .select('id')
    if (!claimed?.length) return false

    const queued = await enqueue('rental.reminder', { bookingId, kind })
    if (!queued.queued) {
      // Hand the claim back so tomorrow's run picks it up again.
      await supabase.from('rental_bookings').update({ [column]: null }).eq('id', bookingId)
      return false
    }
    return true
  }

  // ── Starting tomorrow ────────────────────────────────────────────────────
  const { data: starting } = await supabase
    .from('rental_bookings')
    .select('id, reservations:rental_reservations(starts_on, status)')
    .eq('status', 'reserved')
    .is('reminder_starts_at', null)
    // Bounded. This was unlimited, and because the date filter happens in JS
    // below, every reserved booking ever made was re-fetched on every run —
    // a working set that grows until PostgREST silently truncates it.
    .limit(500)

  for (const b of (starting ?? []) as { id: string; reservations: { starts_on: string; status: string }[] }[]) {
    const live = b.reservations.filter((r) => r.status !== 'cancelled')
    if (!live.length) continue
    const earliest = live.reduce((a, r) => (r.starts_on < a ? r.starts_on : a), live[0].starts_on)
    // `<=`, not `===`. Exact equality meant one missed run lost that day's
    // reminders permanently, because the claim is one-shot and nothing ever
    // looks at those bookings again. A window self-heals; a point does not.
    // Bounded below so a first deploy does not mail a year of backlog.
    if (earliest > tomorrow || earliest < shopAddDays(today, -7)) continue

    if (await claimAndSend(b.id, 'reminder_starts_at', 'starting')) counts.starting += 1
  }

  // ── Due back tomorrow, and overdue ───────────────────────────────────────
  const { data: out } = await supabase
    .from('rental_bookings')
    .select('id, reminder_due_at, reminder_overdue_at, reservations:rental_reservations(ends_on, status)')
    .eq('status', 'out')
    .limit(500)

  for (const b of (out ?? []) as {
    id: string
    reminder_due_at: string | null
    reminder_overdue_at: string | null
    reservations: { ends_on: string; status: string }[]
  }[]) {
    const live = b.reservations.filter((r) => r.status !== 'cancelled')
    if (!live.length) continue
    // The LAST end date on the booking, because the rental is not over until
    // the last thing on it is back.
    const dueOn = live.reduce((a, r) => (r.ends_on > a ? r.ends_on : a), live[0].ends_on)

    if (dueOn <= tomorrow && dueOn >= shopAddDays(today, -7) && !b.reminder_due_at) {
      if (await claimAndSend(b.id, 'reminder_due_at', 'due')) counts.due += 1
    }

    if (dueOn < today && !b.reminder_overdue_at) {
      if (await claimAndSend(b.id, 'reminder_overdue_at', 'overdue')) counts.overdue += 1
    }
  }

  return counts
}

/**
 * What is going out and what is due back today.
 *
 * The one report that changes a working day, and the reason it is a function
 * rather than a screen filter: the shop wants it in the morning, in an email,
 * before anybody opens an admin panel.
 */
export async function getRentalDaySheet(day?: string) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  // The shop's today. A day sheet is worthless if it is yesterday's for the
  // first five and a half hours of every morning, which is exactly the shift
  // that reads it.
  const on = day ?? shopToday()

  const { data: going } = await supabase
    .from('rental_reservations')
    .select('id, starts_on, ends_on, item:rental_items(name), unit:rental_units(code), booking:rental_bookings(id, booking_number, email, phone, fulfilment, status, pickup_slot)')
    .eq('starts_on', on)
    .neq('status', 'cancelled')

  const { data: coming } = await supabase
    .from('rental_reservations')
    .select('id, starts_on, ends_on, item:rental_items(name), unit:rental_units(code), booking:rental_bookings(id, booking_number, email, phone, fulfilment, status)')
    .eq('ends_on', on)
    // `out` only. Filtering merely on "not cancelled" listed gear that came
    // back this morning as still due back this afternoon, which is precisely
    // the thing this sheet exists to be trusted about.
    .eq('status', 'out')

  const { data: overdue } = await supabase
    .from('rental_reservations')
    .select('id, starts_on, ends_on, item:rental_items(name), unit:rental_units(code), booking:rental_bookings(id, booking_number, email, phone, status)')
    .lt('ends_on', on)
    .eq('status', 'out')

  return { day: on, going: going ?? [], coming: coming ?? [], overdue: overdue ?? [] }
}
