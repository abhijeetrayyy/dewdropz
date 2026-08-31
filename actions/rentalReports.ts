'use server'

import { createAdminSupabaseClient } from '@/lib/supabase'
import { requireAdmin } from './auth'
import { shopToday, shopAddDays } from '@/lib/shopTime'

/**
 * What the rental data has always been able to answer, and never has.
 *
 * Every reservation since migration 096 has recorded which unit went out, for
 * which days, at what rent. Nothing has ever read it back. These two functions
 * are that read — one for the shape of a month, one for the shape of a season.
 */

// ── Utilisation ─────────────────────────────────────────────────────────────

export type UtilisationRow = {
  item_id: string
  slug: string
  name: string
  /** Physical copies that existed and were serviceable in the window. */
  units: number
  /** Unit-days available: the denominator. */
  unit_days: number
  /** Unit-days actually out: the numerator. */
  booked_days: number
  /** Percent, to two places. */
  utilisation: number
  bookings: number
  rent_collected: number
  late_collected: number
  damage_collected: number
}

/**
 * Which gear earns its shelf space.
 *
 * UNIT-DAYS, NOT BOOKINGS, and the distinction is the whole point. A tent
 * booked once for ten days and a tent booked ten times for a day each have the
 * same utilisation and are very different businesses — but counting BOOKINGS
 * would rank the second far above the first and tell you to buy more of the
 * wrong thing. The denominator is days a unit existed and was serviceable, so a
 * tent bought halfway through the window is not punished for the half it did
 * not exist for.
 *
 * The window defaults to the last 90 days, which is about one season of walking
 * and long enough that a quiet fortnight does not dominate the answer.
 */
export async function getRentalUtilisation(input?: {
  from?: string
  to?: string
}): Promise<{ from: string; to: string; rows: UtilisationRow[]; totals: {
  units: number; unitDays: number; bookedDays: number; utilisation: number
  rent: number; late: number; damage: number
} }> {
  await requireAdmin()

  // The shop's calendar, so a report run before 05:30 IST is not silently a day
  // short at both ends.
  const to = input?.to ?? shopToday()
  const from = input?.from ?? shopAddDays(to, -89)

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase.rpc('rental_utilisation', { p_from: from, p_to: to })

  if (error) throw new Error(`Could not read utilisation: ${error.message}`)

  const rows = (data ?? []) as UtilisationRow[]

  // Totalled from the rows rather than a second query, so the summary and the
  // table can never disagree — which is the failure mode of every dashboard
  // that computes its headline separately from its body.
  const unitDays = rows.reduce((a, r) => a + Number(r.unit_days), 0)
  const bookedDays = rows.reduce((a, r) => a + Number(r.booked_days), 0)

  return {
    from,
    to,
    rows,
    totals: {
      units: rows.reduce((a, r) => a + Number(r.units), 0),
      unitDays,
      bookedDays,
      utilisation: unitDays > 0 ? Math.round((10000 * bookedDays) / unitDays) / 100 : 0,
      rent: rows.reduce((a, r) => a + Number(r.rent_collected), 0),
      late: rows.reduce((a, r) => a + Number(r.late_collected), 0),
      damage: rows.reduce((a, r) => a + Number(r.damage_collected), 0),
    },
  }
}

// ── The calendar ────────────────────────────────────────────────────────────

export type CalendarRow = {
  item_id: string
  item_name: string
  unit_id: string
  unit_code: string
  unit_condition: string
  reservation_id: string | null
  booking_id: string | null
  booking_number: string | null
  customer_email: string | null
  starts_on: string | null
  ends_on: string | null
  /** The last day the shelf actually loses, cleaning buffer included. */
  buffer_until: string | null
  status: string | null
}

export type CalendarUnit = {
  unitId: string
  unitCode: string
  condition: string
  itemId: string
  itemName: string
  bars: {
    reservationId: string
    bookingId: string
    bookingNumber: string
    email: string
    startsOn: string
    endsOn: string
    bufferUntil: string
    status: string
  }[]
}

/**
 * A month, per unit, as bars.
 *
 * ONE QUERY, NOT A SCREENFUL OF THEM. The obvious implementation fetches every
 * reservation and works the overlaps out in JavaScript; that is both slower and
 * a second opinion about availability, which is exactly what the single
 * `rental_available_units` function exists to prevent. This calls a database
 * function that reads the same `period` column the exclusion constraint tests,
 * so what the calendar draws and what the shelf enforces are the same fact.
 *
 * The cleaning buffer comes back separately from the agreed dates, because the
 * calendar has to draw them differently — a customer's four days and the two
 * days of drying afterwards are both unavailable, and only one of them is
 * something anybody was charged for.
 */
export async function getRentalCalendar(input: {
  from: string
  to: string
  itemId?: string | null
}): Promise<{ from: string; to: string; units: CalendarUnit[] }> {
  await requireAdmin()

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase.rpc('rental_calendar', {
    p_from: input.from,
    p_to: input.to,
    p_item_id: input.itemId ?? null,
  })

  if (error) throw new Error(`Could not read the calendar: ${error.message}`)

  // Grouped here rather than in SQL: the shape a calendar wants is one row per
  // unit with its bars nested, and building that in Postgres would mean a
  // json_agg the function has no other reason to carry.
  const byUnit = new Map<string, CalendarUnit>()

  for (const r of (data ?? []) as CalendarRow[]) {
    let unit = byUnit.get(r.unit_id)
    if (!unit) {
      unit = {
        unitId: r.unit_id,
        unitCode: r.unit_code,
        condition: r.unit_condition,
        itemId: r.item_id,
        itemName: r.item_name,
        bars: [],
      }
      byUnit.set(r.unit_id, unit)
    }

    // A unit with nothing booked still comes back, as a row with null dates —
    // that is deliberate. A calendar that hides idle gear is a calendar that
    // cannot show you what is idle, which is half of what it is for.
    if (r.reservation_id && r.starts_on && r.ends_on) {
      unit.bars.push({
        reservationId: r.reservation_id,
        bookingId: r.booking_id ?? '',
        bookingNumber: r.booking_number ?? '',
        email: r.customer_email ?? '',
        startsOn: r.starts_on,
        endsOn: r.ends_on,
        bufferUntil: r.buffer_until ?? r.ends_on,
        status: r.status ?? 'reserved',
      })
    }
  }

  return {
    from: input.from,
    to: input.to,
    units: [...byUnit.values()].sort(
      (a, b) => a.itemName.localeCompare(b.itemName) || a.unitCode.localeCompare(b.unitCode),
    ),
  }
}
