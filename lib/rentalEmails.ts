import 'server-only'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'
// The one origin variable, the same one robots.ts and sitemap.ts read. A second
// one is how a canonical link ends up on a different domain from the sitemap.
const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://dewdropz.shop').replace(/\/$/, '')

/**
 * What the shop says to somebody who has its gear.
 *
 * WHY THESE EXIST. The rental system could take a booking and settle it, and in
 * between it said nothing at all. The consequence was not cosmetic: the late fee
 * accrues at the full daily rate from the day after the rental ends, and until
 * now the first a customer heard about it was a deduction from their deposit. A
 * penalty nobody was warned about is a penalty that gets argued about, and the
 * argument is one the shop deserves to lose.
 *
 * Every one of these is queued, never sent inline, so a mail provider having a
 * bad afternoon cannot fail a payment or a dispatch. They are all safe to send
 * twice — the queue is at-least-once — but the reminder sweep claims each
 * booking before enqueuing, so in practice they are not.
 */

const money = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const day = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })

type BookingForEmail = {
  id: string
  booking_number: string
  email: string
  fulfilment: 'pickup' | 'ship'
  status: string
  total_amount: number
  deposit_amount: number
  deposit_refunded: number
  late_fee: number
  damage_fee: number
  out_carrier: string | null
  out_tracking: string | null
  return_carrier: string | null
  return_tracking: string | null
  return_label_url: string | null
  reservations: {
    starts_on: string
    ends_on: string
    status: string
    item: { name: string } | null
  }[]
}

async function loadBooking(bookingId: string): Promise<BookingForEmail | null> {
  const { data } = await createAdminSupabaseClient()
    .from('rental_bookings')
    .select(
      'id, booking_number, email, fulfilment, status, total_amount, deposit_amount, deposit_refunded, ' +
        'late_fee, damage_fee, out_carrier, out_tracking, return_carrier, return_tracking, return_label_url, ' +
        'reservations:rental_reservations(starts_on, ends_on, status, item:rental_items(name))',
    )
    .eq('id', bookingId)
    .maybeSingle()

  return (data as unknown as BookingForEmail) ?? null
}

/** The dates the customer actually agreed to, ignoring cancelled lines. */
function span(b: BookingForEmail): { from: string; to: string; items: string } | null {
  const live = b.reservations.filter((r) => r.status !== 'cancelled')
  if (!live.length) return null
  return {
    from: live.reduce((a, r) => (r.starts_on < a ? r.starts_on : a), live[0].starts_on),
    to: live.reduce((a, r) => (r.ends_on > a ? r.ends_on : a), live[0].ends_on),
    items: [...new Set(live.map((r) => r.item?.name ?? 'Gear'))].join(', '),
  }
}

/** One frame, so seven emails do not become seven designs. */
function shell(opts: { heading: string; lead: string; rows?: [string, string][]; footer?: string }) {
  const rows = (opts.rows ?? [])
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#4C584D;font-size:14px">${k}</td>` +
        `<td style="padding:6px 0;text-align:right;font-size:14px;color:#141A15"><strong>${v}</strong></td></tr>`,
    )
    .join('')

  return `
  <div style="font-family:Georgia,'Times New Roman',serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#141A15">
    <p style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#78846F;margin:0 0 18px">DEWDROPZ · Gear rental</p>
    <h1 style="font-family:Helvetica,Arial,sans-serif;font-size:24px;line-height:1.2;margin:0 0 14px">${opts.heading}</h1>
    <p style="font-size:16px;line-height:1.6;color:#4C584D;margin:0 0 20px">${opts.lead}</p>
    ${rows ? `<table style="width:100%;border-collapse:collapse;border-top:1px solid #DFE5DB;border-bottom:1px solid #DFE5DB;margin:0 0 20px">${rows}</table>` : ''}
    ${opts.footer ? `<p style="font-size:14px;line-height:1.6;color:#78846F;margin:0">${opts.footer}</p>` : ''}
    <p style="font-size:13px;color:#78846F;margin:24px 0 0;border-top:1px solid #EBEFE8;padding-top:16px">
      Questions? Reply to this email, or read the rental terms at ${SITE_URL}/rent/terms
    </p>
  </div>`
}

// ── Paid ────────────────────────────────────────────────────────────────────

export async function sendRentalPaidEmail(bookingId: string) {
  const b = await loadBooking(bookingId)
  if (!b) return
  const s = span(b)

  await sendEmail({
    to: b.email,
    subject: `Rental ${b.booking_number} is paid for`,
    html: shell({
      heading: 'That’s paid — the gear is yours for those dates.',
      lead: s
        ? `${s.items}, ${day(s.from)} to ${day(s.to)}.`
        : 'Your rental is confirmed.',
      rows: [
        ['Booking', b.booking_number],
        ['Paid', money(b.total_amount)],
        ...(b.deposit_amount > 0
          ? ([['Refundable deposit', money(b.deposit_amount)]] as [string, string][])
          : []),
      ],
      footer:
        b.deposit_amount > 0
          ? 'The deposit is held, not charged — it comes back when the gear does, less anything owed for a late return or damage.'
          : undefined,
    }),
  })
}

// ── Extended ────────────────────────────────────────────────────────────────

export async function sendRentalExtendedEmail(bookingId: string) {
  const b = await loadBooking(bookingId)
  if (!b) return
  const s = span(b)
  if (!s) return

  await sendEmail({
    to: b.email,
    subject: `Rental ${b.booking_number} now runs to ${day(s.to)}`,
    html: shell({
      heading: 'Extended.',
      lead: `${s.items} is yours until ${day(s.to)}. Nothing else changes — same gear, same deposit.`,
      rows: [
        ['Booking', b.booking_number],
        ['New return date', day(s.to)],
      ],
      footer: 'The late fee only starts the day after that one, so there is nothing to worry about until then.',
    }),
  })
}

// ── Reminders ───────────────────────────────────────────────────────────────

export async function sendRentalReminderEmail(
  bookingId: string,
  kind: 'starting' | 'due' | 'overdue',
) {
  const b = await loadBooking(bookingId)
  if (!b) return
  const s = span(b)
  if (!s) return

  const supabase = createAdminSupabaseClient()

  if (kind === 'starting') {
    await sendEmail({
      to: b.email,
      subject: `${s.items} is ready for tomorrow`,
      html: shell({
        heading: 'Ready for you tomorrow.',
        lead:
          b.fulfilment === 'pickup'
            ? `${s.items}, from ${day(s.from)}. Come and collect it whenever suits — bring something with your name on it.`
            : `${s.items}, from ${day(s.from)}. It is on its way to you.`,
        rows: [
          ['Booking', b.booking_number],
          ['From', day(s.from)],
          ['Back by', day(s.to)],
        ],
      }),
    })
  }

  if (kind === 'due') {
    await sendEmail({
      to: b.email,
      subject: `${s.items} is due back tomorrow`,
      html: shell({
        heading: 'Due back tomorrow.',
        lead: `Just so it does not creep up on you: ${s.items} is due back on ${day(s.to)}.`,
        rows: [
          ['Booking', b.booking_number],
          ['Due back', day(s.to)],
          ...(b.deposit_amount > 0
            ? ([['Deposit held', money(b.deposit_amount)]] as [string, string][])
            : []),
        ],
        footer:
          'After that date a late fee runs at the daily rate, taken from the deposit. If you need longer, extend it from your account — it takes a moment and costs less than being late.',
      }),
    })
  }

  if (kind === 'overdue') {
    await sendEmail({
      to: b.email,
      subject: `${s.items} was due back on ${day(s.to)}`,
      html: shell({
        heading: 'That gear is overdue.',
        lead: `${s.items} was due back on ${day(s.to)}. A late fee is now running at the daily rate, and it comes out of the deposit.`,
        rows: [
          ['Booking', b.booking_number],
          ['Was due', day(s.to)],
        ],
        footer:
          'If something has gone wrong, tell us — we would much rather know than charge you. If it is already on its way back, ignore this.',
      }),
    })
  }

  await supabase.from('rental_events').insert({
    booking_id: bookingId,
    kind: 'reminder_sent',
    note: kind,
  })
}

// ── Logistics ───────────────────────────────────────────────────────────────

export async function sendRentalDispatchEmail(bookingId: string) {
  const b = await loadBooking(bookingId)
  if (!b) return
  const s = span(b)

  await sendEmail({
    to: b.email,
    subject: `Your rental is on its way`,
    html: shell({
      heading: 'It’s on its way.',
      lead: s ? `${s.items}, posted today for ${day(s.from)}.` : 'Your rental has been dispatched.',
      rows: [
        ['Booking', b.booking_number],
        ...(b.out_carrier ? ([['Carrier', b.out_carrier]] as [string, string][]) : []),
        ...(b.out_tracking ? ([['Tracking', b.out_tracking]] as [string, string][]) : []),
      ],
      footer: 'The return journey is already paid for — we will send the details before it is due back.',
    }),
  })
}

export async function sendRentalReturnLegEmail(bookingId: string) {
  const b = await loadBooking(bookingId)
  if (!b) return
  const s = span(b)

  await sendEmail({
    to: b.email,
    subject: `Getting ${b.booking_number} back to us`,
    html: shell({
      heading: 'The journey home is booked.',
      lead: s
        ? `${s.items} is due back on ${day(s.to)}, and the return is arranged — you do not need to pay for it or organise anything.`
        : 'The return leg is arranged.',
      rows: [
        ['Booking', b.booking_number],
        ...(b.return_carrier ? ([['Carrier', b.return_carrier]] as [string, string][]) : []),
        ...(b.return_tracking ? ([['Tracking', b.return_tracking]] as [string, string][]) : []),
      ],
      footer: b.return_label_url
        ? `Print the label here: <a href="${b.return_label_url}" style="color:#24503A">return label</a>. Pack it as it arrived, and the courier will do the rest.`
        : 'Pack it as it arrived, and the courier will do the rest.',
    }),
  })
}

// ── The deposit, settled ────────────────────────────────────────────────────

export async function sendRentalDepositSettledEmail(bookingId: string) {
  const b = await loadBooking(bookingId)
  if (!b) return

  const deducted = b.late_fee + b.damage_fee
  const rows: [string, string][] = [
    ['Booking', b.booking_number],
    ['Deposit held', money(b.deposit_amount)],
  ]
  if (b.late_fee > 0) rows.push(['Late return', `− ${money(b.late_fee)}`])
  if (b.damage_fee > 0) rows.push(['Damage', `− ${money(b.damage_fee)}`])
  rows.push(['Returned to you', money(b.deposit_refunded)])

  await sendEmail({
    to: b.email,
    subject:
      b.deposit_refunded === b.deposit_amount
        ? `Your deposit is on its way back`
        : `Your deposit, settled`,
    html: shell({
      heading:
        b.deposit_refunded === b.deposit_amount
          ? 'All of it is coming back.'
          : 'Here is exactly what happened to your deposit.',
      lead:
        deducted === 0
          ? 'The gear came back in good order and on time, so the whole deposit is being returned.'
          : 'The deposit has been settled. Every deduction is listed below, and every one of them has a note against it in your booking — ask and we will show you.',
      rows,
      footer:
        b.deposit_refunded > 0
          ? 'Card and UPI refunds usually land within three to five working days. Cash deposits are returned at the counter.'
          : 'Nothing is being returned on this one. If you think that is wrong, reply — this is a conversation, not a final answer.',
    }),
  })
}
