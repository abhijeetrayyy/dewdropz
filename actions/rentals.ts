'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminSupabaseClient, createPublicSupabaseClient } from '@/lib/supabase'
import { getUser, requireAdmin } from './auth'
import { rateLimit } from '@/lib/rateLimit'
import { sendRentalConfirmationEmail } from '@/lib/email'
import { priceRental, rentalDays, lateFee, type RentalPrice, type RentalPricedLine } from '@/lib/rentalPricing'
import type { RentalItem, RentalUnit, RentalBooking, RentalReservation } from '@/types/database'

/**
 * Hiring gear.
 *
 * The shape of this module follows the one rule the sale path already lives by:
 * nothing the browser sends is trusted with a price or with availability. A
 * request carries slugs, dates and quantities; every rupee is resolved from
 * `rental_items`, and every unit is resolved from
 * `rental_available_units(...)` — the same database function the storefront
 * calendar and the admin view read, so the shelf a customer is shown and the
 * shelf they book against cannot be two different opinions.
 *
 * AVAILABILITY IS CHECKED TWICE, ON PURPOSE. Once here, to give a sentence a
 * person can act on ("only one left for those dates"), and once by the
 * exclusion constraint in migration 096, which is what actually makes a double
 * booking impossible when two people check out for the last tent in the same
 * second. The check is for the message; the constraint is for the truth.
 */

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date.')

const rentalLineSchema = z.object({
  slug: z.string().min(1),
  startsOn: DATE,
  endsOn: DATE,
  quantity: z.number().int().min(1).max(10),
})

const bookingSchema = z.object({
  lines: z.array(rentalLineSchema).min(1).max(10),
  fulfilment: z.enum(['pickup', 'ship']),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  address: z.record(z.string(), z.unknown()).nullish(),
  pickupSlot: z.string().datetime().nullish(),
  notes: z.string().max(500).optional(),
})

export type RentalQuoteInput = z.infer<typeof bookingSchema>

// ── Public reads ────────────────────────────────────────────────────────────

export async function getRentalItems(): Promise<RentalItem[]> {
  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase
    .from('rental_items')
    .select('*')
    .eq('is_active', true)
    .order('sort', { ascending: true })
    .order('name', { ascending: true })
  if (error) return []
  return (data ?? []) as RentalItem[]
}

/**
 * Can this product also be rented, and from how much a day?
 *
 * The link lives on `rental_items.product_id` rather than on the product,
 * because renting is the narrower case — most products will never be rentable,
 * and every product listing in the shop would otherwise pay for a join it never
 * uses. So the product page asks separately, for the one product it shows.
 */
export async function getRentalForProduct(
  productId: string,
): Promise<{ slug: string; daily_rate: number; deposit: number } | null> {
  const supabase = createPublicSupabaseClient()
  const { data } = await supabase
    .from('rental_items')
    .select('slug,daily_rate,deposit')
    .eq('product_id', productId)
    .eq('is_active', true)
    .maybeSingle()
  return (data as { slug: string; daily_rate: number; deposit: number }) ?? null
}

export async function getRentalItem(slug: string): Promise<RentalItem | null> {
  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase
    .from('rental_items')
    // The sellable product rides along, so the page can offer "own it instead"
    // without a second round trip.
    .select('*, product:products(slug,name,price,inventory_quantity)')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  if (error) return null
  return (data as RentalItem) ?? null
}

/**
 * How many units of an item are free for a window.
 *
 * Answered by the database function so the buffer between hires is applied by
 * the same code the booking write uses. A unit due back the morning somebody
 * wants it is correctly reported as unavailable.
 */
export async function getRentalAvailability(
  itemId: string,
  startsOn: string,
  endsOn: string,
): Promise<{ available: number; unitIds: string[] }> {
  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase.rpc('rental_available_units', {
    p_item_id: itemId,
    p_start: startsOn,
    p_end: endsOn,
  })
  if (error) return { available: 0, unitIds: [] }
  const rows = (data ?? []) as { unit_id: string }[]
  return { available: rows.length, unitIds: rows.map((r) => r.unit_id) }
}

/** What a hire would cost. Public — a shopper deserves the real figure while deciding. */
export async function quoteRental(input: RentalQuoteInput): Promise<
  { ok: true; price: RentalPrice } | { ok: false; error: string }
> {
  const parsed = bookingSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Check the dates and try again.' }

  const priced = await buildPricedLines(parsed.data)
  if (!priced.ok) return { ok: false, error: priced.error }

  const state =
    parsed.data.fulfilment === 'ship'
      ? ((parsed.data.address?.state as string | undefined) ?? null)
      : 'Uttarakhand'

  const price = await priceRental({
    lines: priced.lines,
    fulfilment: parsed.data.fulfilment,
    state,
    country: 'India',
  })
  return { ok: true, price }
}

/** Resolve slugs to real items, refusing anything the shop does not offer. */
type PricedLines =
  | { ok: false; error: string }
  | { ok: true; lines: RentalPricedLine[]; bySlug: Map<string, RentalItem> }

async function buildPricedLines(input: RentalQuoteInput): Promise<PricedLines> {
  const supabase = createAdminSupabaseClient()
  const slugs = [...new Set(input.lines.map((l) => l.slug))]
  const { data: items } = await supabase
    .from('rental_items')
    .select('*')
    .in('slug', slugs)
    .eq('is_active', true)

  const bySlug = new Map((items ?? []).map((i) => [i.slug as string, i as RentalItem]))
  const missing = slugs.filter((s) => !bySlug.has(s))
  if (missing.length) {
    return { ok: false, error: 'Something in your booking is no longer available to rent.' }
  }

  const lines = input.lines.map((l) => {
    const it = bySlug.get(l.slug)!
    return {
      itemId: it.id,
      slug: it.slug,
      name: it.name,
      dailyRate: it.daily_rate,
      deposit: it.deposit,
      weeklyDiscountPct: it.weekly_discount_pct,
      gstRate: Number(it.gst_rate),
      minDays: it.min_days,
      maxDays: it.max_days,
      startsOn: l.startsOn,
      endsOn: l.endsOn,
      quantity: l.quantity,
    }
  })

  // Fulfilment has to be one the item actually supports — a 4-person tent that
  // is pickup-only must not be postable just because the cart says so.
  for (const l of input.lines) {
    const it = bySlug.get(l.slug)!
    if (input.fulfilment === 'ship' && !it.allows_shipping) {
      return { ok: false, error: `${it.name} is collection-only — it cannot be posted.` }
    }
    if (input.fulfilment === 'pickup' && !it.allows_pickup) {
      return { ok: false, error: `${it.name} is only available posted.` }
    }
  }

  return { ok: true, lines, bySlug }
}

/**
 * A booking number a person can read out over the phone.
 *
 * The tail was four decimal digits — 9,000 per day — drawn once with no retry,
 * against a UNIQUE constraint. That is the birthday problem with a customer on
 * the other end: at fifty bookings in a day there is already a 12.7% chance two
 * of them collide, and a collision did not retry, it failed the booking and
 * told somebody "could not start that booking".
 *
 * Now five crockford-ish base32 characters — no I, L, O or U, so it cannot be
 * misheard as a digit or read as a word — giving ~33.5 million per day instead
 * of 9,000. `createRentalBooking` also retries on a unique violation, because
 * more entropy makes a collision unlikely, not impossible, and the difference
 * between those two is somebody's booking.
 */
const NUMBER_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function bookingNumber(): string {
  const d = new Date()
  const stamp = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
  const bytes = crypto.getRandomValues(new Uint8Array(5))
  const tail = Array.from(bytes, (b) => NUMBER_ALPHABET[b % NUMBER_ALPHABET.length]).join('')
  return `DDZ-R-${stamp}-${tail}`
}

// ── The booking write ───────────────────────────────────────────────────────

export async function createRentalBooking(
  input: RentalQuoteInput & { userId?: string | null },
): Promise<
  | { ok: true; bookingId: string; bookingNumber: string }
  // `code` exists so callers can tell "the world moved" from "you sent
  // nonsense" WITHOUT pattern-matching the prose. The mobile route needs that
  // distinction to answer 409 rather than 400, and matching on wording is a
  // contract that breaks silently the first time a sentence is reworded — as
  // it did: a regex looking for "none free" never matched the real message,
  // "… is not free between …", so a sold-out hire answered 400.
  | { ok: false; error: string; code?: 'unavailable' }
> {
  const parsed = bookingSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Check the dates and try again.' }
  if (parsed.data.fulfilment === 'ship' && !parsed.data.address) {
    return { ok: false, error: 'Add a delivery address, or choose collection instead.' }
  }

  const priced = await buildPricedLines(parsed.data)
  if (!priced.ok) return { ok: false, error: priced.error }

  const supabase = createAdminSupabaseClient()

  // Pick actual units, and refuse early with a sentence that says what is short.
  const assignments: { line: (typeof priced.lines)[number]; unitIds: string[] }[] = []
  for (const line of priced.lines) {
    const { available, unitIds } = await getRentalAvailability(line.itemId, line.startsOn, line.endsOn)
    if (available < line.quantity) {
      return {
        ok: false,
        code: 'unavailable',
        error:
          available === 0
            ? `${line.name} is not free between ${line.startsOn} and ${line.endsOn}.`
            : `Only ${available} ${line.name} free for those dates — you asked for ${line.quantity}.`,
      }
    }
    assignments.push({ line, unitIds: unitIds.slice(0, line.quantity) })
  }

  const state =
    parsed.data.fulfilment === 'ship'
      ? ((parsed.data.address?.state as string | undefined) ?? null)
      : 'Uttarakhand'
  const price = await priceRental({
    lines: priced.lines,
    fulfilment: parsed.data.fulfilment,
    state,
    country: 'India',
  })
  if (price.errors.length) return { ok: false, error: price.errors[0] }

  // Retry on a duplicate number. Entropy makes a collision unlikely; the retry
  // makes it harmless. Anything that is NOT a unique violation breaks out
  // immediately — retrying a real error just fails three times more slowly.
  let booking: { id: string; booking_number: string } | null = null
  let bookingErr: { code?: string; message?: string } | null = null
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await supabase
    .from('rental_bookings')
    .insert({
      booking_number: bookingNumber(),
      user_id: input.userId ?? null,
      email: parsed.data.email,
      phone: parsed.data.phone ?? null,
      fulfilment: parsed.data.fulfilment,
      address: parsed.data.address ?? null,
      pickup_slot: parsed.data.pickupSlot ?? null,
      rent_amount: price.rentAmount,
      delivery_amount: price.deliveryAmount,
      tax_amount: price.taxAmount,
      deposit_amount: price.depositAmount,
      total_amount: price.totalAmount,
      notes: parsed.data.notes ?? null,
    })
    .select('id, booking_number')
    .single()

    if (!error) { booking = data as { id: string; booking_number: string }; break }
    bookingErr = error
    // 23505 = unique_violation. Only that is worth another go.
    if (error.code !== '23505') break
  }

  if (!booking) {
    console.error('[rentals] could not create booking', bookingErr)
    return { ok: false, error: 'Could not start that booking. Try again.' }
  }

  // Reservations. The exclusion constraint is the real gate: between the
  // availability read above and this insert, somebody else may have taken the
  // last unit. A 23P01 here is that race losing, not a bug.
  const rows: Record<string, unknown>[] = []
  for (const { line, unitIds } of assignments) {
    const days = rentalDays(line.startsOn, line.endsOn)
    const item = priced.bySlug.get(line.slug)!
    const perUnitRent = Math.round(
      (price.lines.find((p) => p.itemId === line.itemId)?.rentAmount ?? 0) / unitIds.length,
    )
    for (const unitId of unitIds) {
      rows.push({
        booking_id: booking.id,
        item_id: line.itemId,
        unit_id: unitId,
        starts_on: line.startsOn,
        ends_on: line.endsOn,
        // The held window includes the cleaning buffer. Written here rather
        // than defaulted so the range and the dates can never disagree.
        period: `[${line.startsOn},${addDays(line.endsOn, item.buffer_days + 1)})`,
        daily_rate: line.dailyRate,
        days,
        rent_amount: perUnitRent,
        deposit: line.deposit,
      })
    }
  }

  const { error: resErr } = await supabase.from('rental_reservations').insert(rows)
  if (resErr) {
    // Leaving a booking behind with no gear on it would be a row that looks
    // like a hire and holds nothing. Cascade removes any lines that landed.
    await supabase.from('rental_bookings').delete().eq('id', booking.id)
    const raced = resErr.code === '23P01' || /rental_no_double_booking/.test(resErr.message)
    return {
      ok: false,
      ...(raced ? { code: 'unavailable' as const } : {}),
      error: raced
        ? 'Somebody just booked the last one for those dates. Pick different dates.'
        : 'Could not hold that gear. Try again.',
    }
  }

  await supabase.from('rental_events').insert({
    booking_id: booking.id,
    kind: 'created',
    amount: price.totalAmount,
    note: `${rows.length} unit(s), ${parsed.data.fulfilment}`,
  })

  // The confirmation both storefronts have always promised.
  //
  // NEVER blocking. The booking is already written and the gear is already
  // held; if the mail provider is unconfigured or down, the customer still has
  // a booking and the confirmation screen still shows the number. Letting a
  // failed email throw here would roll a successful booking into an error
  // message — the worst possible trade for a message we can resend.
  try {
    await sendRentalConfirmationEmail({
      email: parsed.data.email,
      bookingNumber: booking.booking_number as string,
      fulfilment: parsed.data.fulfilment,
      lines: price.lines.map((l) => ({
        name: l.name, startsOn: priced.lines.find((p) => p.itemId === l.itemId)?.startsOn ?? '',
        endsOn: priced.lines.find((p) => p.itemId === l.itemId)?.endsOn ?? '',
        days: l.days, quantity: l.quantity,
      })),
      rentAmount: price.rentAmount,
      deliveryAmount: price.deliveryAmount,
      taxAmount: price.taxAmount,
      totalAmount: price.totalAmount,
      depositAmount: price.depositAmount,
    })
  } catch (e) {
    console.error('[rentals] confirmation email failed for', booking.booking_number, e)
  }

  revalidatePath('/admin/rentals')
  return { ok: true, bookingId: booking.id, bookingNumber: booking.booking_number as string }
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ── Customer reads ──────────────────────────────────────────────────────────

/**
 * The signed-in customer's own bookings.
 *
 * SECURITY. This took a `userId` from its caller and looked it up with the
 * SERVICE-ROLE client, which bypasses RLS — and this file is `'use server'`, so
 * every export here is a callable endpoint. Anyone who could reach it could ask
 * for any customer's bookings by id and receive their email, phone, snapshotted
 * delivery address, dates and amounts. The parameter WAS the vulnerability.
 *
 * The identity now comes from the session and nothing else. There is no
 * argument to tamper with, which is the only version of this that is safe by
 * construction rather than by everyone remembering to check.
 */
export async function getMyRentalBookings() {
  const user = await getUser()
  if (!user) return []

  const supabase = createAdminSupabaseClient()
  const { data } = await supabase
    .from('rental_bookings')
    .select('*, reservations:rental_reservations(*, item:rental_items(name,slug,images))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  return (data ?? []) as (RentalBooking & { reservations: RentalReservation[] })[]
}

// ── Admin: the catalogue ────────────────────────────────────────────────────

/**
 * A customer calling off their own booking.
 *
 * `cancelRentalBooking` is admin-only and always was, which meant the only way
 * to cancel was to telephone the shop — for gear that has not left the building
 * and money that has not changed hands. That is not a policy, it is a missing
 * screen.
 *
 * Two rules, both enforced here rather than trusted to the caller:
 *   • It must be YOUR booking. Ownership comes from the session; the booking id
 *     alone proves nothing.
 *   • Only while it is still `reserved`. Once the gear is handed over the
 *     deposit is held and a return, not a cancellation, is what happens next —
 *     and a cancelled row would free dates for a tent somebody is holding.
 */
export async function cancelMyRentalBooking(bookingId: string) {
  const user = await getUser()
  if (!user) return { ok: false as const, error: 'Sign in to manage your bookings.' }

  const supabase = createAdminSupabaseClient()
  const { data: booking } = await supabase
    .from('rental_bookings')
    .select('id, user_id, status')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking || booking.user_id !== user.id) {
    // Same answer either way: an attacker must not learn that a booking exists.
    return { ok: false as const, error: 'That booking could not be found.' }
  }
  if (booking.status !== 'reserved') {
    return {
      ok: false as const,
      error:
        booking.status === 'cancelled'
          ? 'That booking is already cancelled.'
          : 'This one is already under way — call the shop and we will sort it out.',
    }
  }

  // Cancelling the reservations is what frees the dates: the exclusion
  // constraint ignores cancelled rows, so the units are bookable again at once.
  await supabase.from('rental_reservations').update({ status: 'cancelled' }).eq('booking_id', bookingId)
  const { error } = await supabase.from('rental_bookings').update({ status: 'cancelled' }).eq('id', bookingId)
  if (error) return { ok: false as const, error: 'That did not go through. Try again.' }

  await supabase.from('rental_events').insert({
    booking_id: bookingId, kind: 'cancelled', note: 'Cancelled by the customer',
  })
  revalidatePath('/account/rentals')
  revalidatePath('/admin/rentals')
  return { ok: true as const }
}

/**
 * Finding a booking you made without an account.
 *
 * THE HOLE THIS FILLS. Both storefronts let somebody book with just an email.
 * Both "your rentals" screens require a session and filter on `user_id`, which
 * is NULL for a guest. There was no lookup anywhere — so a guest booking sat in
 * the database holding a unit off the shelf, and the person who made it could
 * never see it again. With the mailer unconfigured they did not even get the
 * confirmation.
 *
 * BOTH FACTORS ARE REQUIRED. The number alone is not a credential: it is
 * printed on a screen, read out at a counter and sent by email. Pairing it with
 * the address the booking was made under means holding one without the other
 * gets you nothing, and the rate limit stops anybody grinding through the pair.
 *
 * The answer is identical whether the number is wrong, the email is wrong, or
 * the booking does not exist — otherwise this becomes an oracle for which
 * booking numbers are real.
 */
export async function findRentalBooking(bookingNumber: string, email: string) {
  const limited = await rateLimit('rental-lookup', { limit: 8, windowSeconds: 600 })
  if (!limited.ok) return { ok: false as const, error: limited.error }

  const number = bookingNumber.trim().toUpperCase()
  const address = email.trim().toLowerCase()
  if (!number || !address) {
    return { ok: false as const, error: 'Enter the booking number and the email you used.' }
  }

  const supabase = createAdminSupabaseClient()
  const { data } = await supabase
    .from('rental_bookings')
    .select('*, reservations:rental_reservations(*, item:rental_items(name,slug,images))')
    .eq('booking_number', number)
    .maybeSingle()

  // One answer for every kind of miss — see the note above.
  if (!data || String(data.email).trim().toLowerCase() !== address) {
    return {
      ok: false as const,
      error: 'No booking matches that number and email. Check both, or call the shop.',
    }
  }

  return { ok: true as const, booking: data as RentalBooking & { reservations: RentalReservation[] } }
}

/**
 * Guest bookings, claimed by the account that owns the email.
 *
 * Somebody books as a guest, then signs in or signs up with the same address.
 * Without this their booking stays orphaned forever — visible only through the
 * lookup, and never on "your rentals". Matching on the email the booking was
 * made under is the same evidence the lookup asks for, and the account has
 * already proved control of that address by signing in to it.
 *
 * Called on sign-in beside the cart adoption, and safe to run every time: it
 * only ever touches rows that have no owner yet.
 */
export async function claimGuestRentalBookings(userId: string, email: string) {
  const address = email.trim().toLowerCase()
  if (!address) return { claimed: 0 }

  const supabase = createAdminSupabaseClient()
  const { data } = await supabase
    .from('rental_bookings')
    .update({ user_id: userId })
    .is('user_id', null)
    .ilike('email', address)
    .select('id')

  const claimed = data?.length ?? 0
  if (claimed > 0) {
    revalidatePath('/account/rentals')
    console.info(`[rentals] claimed ${claimed} guest booking(s) for ${address}`)
  }
  return { claimed }
}

export async function getRentalItemsAdmin() {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { data } = await supabase
    .from('rental_items')
    .select('*, units:rental_units(*)')
    .order('sort')
  return (data ?? []) as (RentalItem & { units: RentalUnit[] })[]
}

export async function upsertRentalItem(input: Partial<RentalItem> & { name: string; slug: string }) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  // Conflict on whichever key the caller actually has.
  //
  // This was fixed to 'slug', which is right for a new item but wrong the
  // moment somebody EDITS one and changes its slug: the row carries an id that
  // already exists, the new slug matches nothing, and the upsert falls through
  // to an insert that dies on the primary key. Editing by id is the identity
  // the admin form is actually working with.
  const { data, error } = await supabase
    .from('rental_items')
    .upsert(input as never, { onConflict: input.id ? 'id' : 'slug' })
    .select()
    .single()
  if (error) return { ok: false as const, error: mapRentalError(error.message) }
  revalidatePath('/admin/rentals')
  revalidatePath('/rent')
  return { ok: true as const, item: data as RentalItem }
}

export async function addRentalUnit(itemId: string, code: string) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('rental_units').insert({ item_id: itemId, code: code.trim() })
  if (error) {
    return {
      ok: false as const,
      error: /unique/i.test(error.message)
        ? `Unit ${code} already exists for this item.`
        : error.message,
    }
  }
  revalidatePath('/admin/rentals')
  return { ok: true as const }
}

export async function setUnitCondition(
  unitId: string,
  condition: 'good' | 'fair' | 'repair' | 'retired',
  notes?: string,
) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const patch: Record<string, unknown> = { condition, notes: notes ?? null }
  // Retiring stamps the date so the unit stops being offered without losing
  // its history — the row is why we know what happened to it.
  if (condition === 'retired') patch.retired_at = new Date().toISOString().slice(0, 10)
  else patch.retired_at = null
  const { error } = await supabase.from('rental_units').update(patch).eq('id', unitId)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/admin/rentals')
  return { ok: true as const }
}

// ── Admin: the lifecycle ────────────────────────────────────────────────────

export async function getRentalBookings(status?: string) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  let q = supabase
    .from('rental_bookings')
    .select('*, reservations:rental_reservations(*, item:rental_items(name,slug), unit:rental_units(code))')
    .order('created_at', { ascending: false })
    .limit(100)
  if (status && status !== 'all') q = q.eq('status', status)
  const { data } = await q
  return (data ?? []) as (RentalBooking & { reservations: RentalReservation[] })[]
}

/** Gear leaves the shop. The deposit is recorded here because it is taken here. */
export async function handOverBooking(bookingId: string, depositTaken: number) {
  const actor = await requireAdmin()
  const supabase = createAdminSupabaseClient()

  const { error } = await supabase
    .from('rental_bookings')
    .update({
      status: 'out',
      deposit_state: depositTaken > 0 ? 'held' : 'waived',
    })
    .eq('id', bookingId)
    .eq('status', 'reserved')
  if (error) return { ok: false as const, error: error.message }

  await supabase.from('rental_reservations').update({ status: 'out' }).eq('booking_id', bookingId)
  await supabase.from('rental_events').insert([
    { booking_id: bookingId, kind: 'handed_over', actor_id: actor.id },
    {
      booking_id: bookingId,
      kind: depositTaken > 0 ? 'deposit_held' : 'note',
      amount: depositTaken || null,
      note: depositTaken > 0 ? 'Security deposit taken at handover' : 'Deposit waived',
      actor_id: actor.id,
    },
  ])
  revalidatePath('/admin/rentals')
  return { ok: true as const }
}

/**
 * Gear comes back, and the money is settled in one place.
 *
 * Late fees are computed from the dates rather than typed in, so two people
 * inspecting the same return reach the same figure. Damage is a judgement and
 * is therefore an input — but it is recorded as its own event with a note, so
 * a charge can always be explained.
 */
export async function returnBooking(input: {
  bookingId: string
  damageFee?: number
  damageNote?: string
  refundDeposit?: boolean
}) {
  const actor = await requireAdmin()
  const supabase = createAdminSupabaseClient()

  const { data: booking } = await supabase
    .from('rental_bookings')
    .select('*, reservations:rental_reservations(*)')
    .eq('id', input.bookingId)
    .single()
  if (!booking) return { ok: false as const, error: 'That booking no longer exists.' }

  const b = booking as RentalBooking & { reservations: RentalReservation[] }
  const today = new Date().toISOString().slice(0, 10)

  // Late by the latest end date on the booking, at that line's own daily rate.
  let late = 0
  for (const r of b.reservations) {
    const daysLate = Math.max(0, rentalDays(r.ends_on, today) - 1)
    late += lateFee(r.daily_rate, daysLate, b.deposit_amount)
  }
  late = Math.min(late, b.deposit_amount || late)

  const damage = Math.max(0, Math.round(input.damageFee ?? 0))
  const owed = late + damage
  const refunding = input.refundDeposit !== false

  const { error } = await supabase
    .from('rental_bookings')
    .update({
      status: 'closed',
      late_fee: late,
      damage_fee: damage,
      deposit_state: !refunding ? 'forfeited' : owed >= b.deposit_amount ? 'forfeited' : 'refunded',
    })
    .eq('id', input.bookingId)
  if (error) return { ok: false as const, error: error.message }

  // Returning EARLY has to free the days that were not used.
  //
  // The held `period` — not the status — is what availability and the exclusion
  // constraint read, so a returned reservation whose period still runs to the
  // original end date keeps a unit off the shelf it is physically back on. Bring
  // a tent back on the 13th of a hire booked to the 16th and, without this, it
  // stays unbookable for three days it is sitting in the shop.
  //
  // So the period is shrunk to the ACTUAL return date plus that item's cleaning
  // buffer. The end date the customer agreed to is left untouched on
  // `ends_on` — that is what they were charged against, and rewriting it would
  // quietly change the terms of a hire after the fact.
  const returnedOn = today
  for (const r of b.reservations) {
    const { data: item } = await supabase
      .from('rental_items').select('buffer_days').eq('id', r.item_id).single()
    const buffer = (item?.buffer_days as number | undefined) ?? 0
    const freeFrom = addDays(returnedOn, buffer + 1)
    // Never extend a period — an unusually late return keeps whatever the
    // original hold was, so this can only ever give days back.
    const end = freeFrom < addDays(r.ends_on, buffer + 1) ? freeFrom : addDays(r.ends_on, buffer + 1)
    await supabase
      .from('rental_reservations')
      .update({
        status: 'returned',
        returned_at: new Date().toISOString(),
        period: `[${r.starts_on},${end})`,
      })
      .eq('id', r.id)
  }

  const events: Record<string, unknown>[] = [
    { booking_id: input.bookingId, kind: 'returned', actor_id: actor.id },
    { booking_id: input.bookingId, kind: 'inspected', actor_id: actor.id, note: input.damageNote ?? null },
  ]
  if (late > 0) events.push({ booking_id: input.bookingId, kind: 'late_fee', amount: late, actor_id: actor.id })
  if (damage > 0)
    events.push({ booking_id: input.bookingId, kind: 'damage_fee', amount: damage, note: input.damageNote ?? null, actor_id: actor.id })
  if (b.deposit_amount > 0) {
    const back = Math.max(0, b.deposit_amount - owed)
    events.push({
      booking_id: input.bookingId,
      kind: back > 0 ? 'deposit_refunded' : 'deposit_forfeited',
      amount: back > 0 ? back : b.deposit_amount,
      actor_id: actor.id,
    })
  }
  await supabase.from('rental_events').insert(events)

  revalidatePath('/admin/rentals')
  return { ok: true as const, lateFee: late, damageFee: damage, depositReturned: Math.max(0, b.deposit_amount - owed) }
}

export async function cancelRentalBooking(bookingId: string, reason?: string) {
  const actor = await requireAdmin()
  const supabase = createAdminSupabaseClient()
  // Cancelling the reservations is what frees the dates — the exclusion
  // constraint ignores cancelled rows, so the units become bookable again the
  // moment this lands.
  await supabase.from('rental_reservations').update({ status: 'cancelled' }).eq('booking_id', bookingId)
  const { error } = await supabase.from('rental_bookings').update({ status: 'cancelled' }).eq('id', bookingId)
  if (error) return { ok: false as const, error: error.message }
  await supabase.from('rental_events').insert({
    booking_id: bookingId, kind: 'cancelled', note: reason ?? null, actor_id: actor.id,
  })
  revalidatePath('/admin/rentals')
  return { ok: true as const }
}

function mapRentalError(message: string): string {
  if (/rental_items_slug_shape/.test(message)) return 'The URL handle may only contain lowercase letters, numbers and hyphens.'
  if (/rental_items_day_range/.test(message)) return 'The maximum rental period must be at least the minimum.'
  if (/rental_items_some_fulfilment/.test(message)) return 'Allow collection, posting, or both — an item with neither can never be rented.'
  if (/daily_rate/.test(message)) return 'The daily rate must be more than zero.'
  // The one an admin will actually hit: two pieces of gear given the same
  // handle. Postgres says "duplicate key value violates unique constraint",
  // which tells a shopkeeper nothing.
  if (/rental_items_slug_key|duplicate key/.test(message)) return 'Another item already uses that URL handle. Pick a different one.'
  return message
}
