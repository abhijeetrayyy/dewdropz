/**
 * The shop's rental terms, as data.
 *
 * WHY THIS FILE EXISTS
 *
 * `/rent/terms` contained no occurrence of the word "cancel", and
 * `cancelMyRentalBooking` refunded nothing — it flipped two statuses and told
 * the customer "cancelled — the dates are free again" while keeping their
 * money. The shop was operating a cancellation policy it had never written
 * down, through a button the product itself offered and then congratulated
 * people for pressing.
 *
 * So the policy lives here, once, and the terms page, the figure quoted in the
 * confirm dialog, the sentence shown BEFORE anybody pays, and the refund itself
 * all read this object. They cannot drift apart.
 *
 * NOT a `store_settings` column, deliberately. That row is rebuilt from an
 * explicit key list on every read (`normalizeHomeConfig`), and a key missing
 * from that list is silently dropped. A policy that can disappear on read is
 * worse than a policy in a file.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE REWRITE, AND WHY THE OLD BANDS COULD NOT SURVIVE PAY-TO-RESERVE
 *
 * The old policy was 100% / 50% / 0%, and it was written for a shop where
 * nobody had paid anything yet. Under that model the last band was a sentence
 * on a page: "inside two days the rent stays with us" cost a customer nothing,
 * because the rent was still in their pocket and would simply never be handed
 * over at the counter.
 *
 * The moment a reservation REQUIRES payment, that same sentence means the shop
 * keeps 100% of real money already taken from a real card. A total forfeiture
 * is the single most reliable way to turn one disappointed customer into a
 * chargeback, a review, and a story — and for a small shop in Dehradun whose
 * whole proposition is that it is trustworthy with your deposit, that is an
 * expensive way to save ₹1,475.
 *
 * WHAT THE SHOP ACTUALLY LOSES ON A CANCELLATION, which is what the retained
 * share has to cover and no more:
 *
 *   · The chance to re-let that unit for those dates. This is near zero a
 *     fortnight out and near total the night before — it is the whole reason
 *     the bands slope.
 *   · The payment gateway's fee on the original charge, which is NOT returned
 *     when a payment is refunded. It is small, and it is real.
 *
 * So the shape is: slope the bands, never reach zero, and never charge for
 * notice that costs the shop nothing.
 *
 * FOUR RULES, AND EACH ONE IS A DELIBERATE PIECE OF THE ANSWER.
 *
 * 1 · A GRACE WINDOW. Cancel within a day of booking and everything comes
 *     back, whatever the dates. This is the mis-click, the wrong month, the
 *     "my friend already booked one". The unit was held for a few hours, so it
 *     costs the shop nothing, and refusing it would be charging somebody for
 *     the shop's own checkout being easy to get wrong.
 *
 * 2 · THE BANDS NEVER REACH ZERO. The worst case returns a quarter. A shop
 *     that keeps everything looks like it wanted the cancellation; a shop that
 *     keeps three quarters and says why looks like a shop with costs.
 *
 * 3 · THE DEPOSIT IS ALWAYS RETURNED IN FULL. It is not consideration for a
 *     supply — it is the customer's own money, held. This is the one line here
 *     that should never acquire an exception, and it is the line the whole
 *     brand rests on.
 *
 * 4 · IF THE SHOP CANCELS, EVERYTHING COMES BACK. Whatever the notice. A tent
 *     that comes back damaged, a van that does not start, a double-booking the
 *     shop created — none of those are the customer's failure, and applying a
 *     customer band to them means the shop profits from its own mistake. The
 *     old code had no notion of who cancelled, so an admin cancelling a broken
 *     tent the night before kept 100% of that customer's money. That was not a
 *     policy decision; it was a missing parameter.
 *
 * THESE NUMBERS ARE THE CLIENT'S. Change them here; the page, the pre-payment
 * sentence and the refund all follow.
 */

export type CancellationBand = {
  /** Cancel at least this many days before the hire starts… */
  daysBefore: number
  /** …and this share of the RENT comes back, 0–1. */
  refundShare: number
  /** How the page says it. */
  label: string
  /** A short form for the figure quoted beside a live booking. */
  short: string
}

export const RENTAL_POLICY = {
  /**
   * Payment is what makes a reservation real. Stated here because the
   * storefront, the terms page and the confirmation all have to say the same
   * thing about it.
   */
  payment: {
    /**
     * Gear is held while a payment is completed, and released if it is not.
     * Fifteen minutes is long enough for a UPI app to open, a bank page to
     * load and a one-time password to arrive on a slow connection; short
     * enough that an abandoned checkout does not hold the last tent on a
     * Friday evening for an hour.
     */
    holdMinutes: 15,
    /** Said in the customer's words, everywhere this is explained. */
    holdLabel: '15 minutes',
  },

  cancellation: {
    /**
     * Cancel inside this many hours of booking and everything comes back,
     * regardless of how close the hire is. The mis-click window.
     */
    graceHours: 24,
    graceLabel: 'within 24 hours of booking',

    /**
     * Read top-down; the first band whose `daysBefore` is satisfied wins.
     * `daysBefore: 0` is the floor and must exist, or a same-day cancellation
     * has no band at all.
     */
    bands: [
      {
        daysBefore: 7,
        refundShare: 1.0,
        label: 'A week or more before it starts — all of the rent comes back.',
        short: 'all of it',
      },
      {
        daysBefore: 3,
        refundShare: 0.75,
        label: 'Three to six days before — three quarters of the rent comes back.',
        short: 'three quarters',
      },
      {
        daysBefore: 2,
        refundShare: 0.5,
        label: 'Two days before — half the rent comes back.',
        short: 'half',
      },
      {
        daysBefore: 0,
        refundShare: 0.25,
        // Says what the retained share is FOR. "The rent stays with us" is a
        // rule; this is a reason, and a reason is what stops a refund becoming
        // an argument.
        label:
          'Inside two days — a quarter of the rent comes back. At that notice the gear has been set aside and there is no realistic chance of letting it to somebody else.',
        short: 'a quarter',
      },
    ] as CancellationBand[],

    /**
     * The security deposit is NOT consideration for a supply — it is the
     * customer's money, held. It comes back in full on any cancellation, and
     * it is the one line in this policy that should never acquire an exception.
     */
    depositAlwaysReturned: true,

    /** A cancellation the shop causes is never charged for. */
    shopCancellationAlwaysFull: true,
  },

  /** Once gear is out, cancelling is not a thing that can happen — it is a
   *  return. `pending_payment` is here because an unpaid hold can always be
   *  abandoned; there is nothing to refund and nothing to charge for. */
  cancellableWhile: ['pending_payment', 'reserved'] as const,
}

/** Who called it off. The refund depends on it, and the old code had no way to
 *  express the distinction at all. */
export type CancelledBy = 'customer' | 'shop'

export type CancellationQuote = {
  /** Rent going back to the card, in paise. */
  rentRefund: number
  /** Rent the shop keeps, in paise. Always stated — a refund figure shown
   *  without the retained figure reads as though nothing was kept. */
  rentRetained: number
  /** Deposit going back, in paise. */
  depositRefund: number
  /** Everything the customer receives. */
  total: number
  /** Whole days from today to the first day of the hire; negative once it has
   *  started. */
  daysUntilStart: number
  /** Which rule decided this. */
  band: CancellationBand
  /** True when the grace window, not a band, is what made it whole. */
  underGrace: boolean
  /** True when the shop cancelled and the bands were therefore not applied. */
  shopCancelled: boolean
  /** One sentence, for a dialog. */
  summary: string
}

/**
 * What comes back if this booking is cancelled now.
 *
 * Pure, so it can be tested and so the terms page, the sentence shown before
 * payment, the confirm dialog and the refund itself all quote the same number.
 * Paise in, paise out.
 *
 * `now` and `bookedAt` are real timestamps because the grace window is measured
 * in hours; the band is measured in whole days from the shop's calendar, which
 * is why `today` is a separate `YYYY-MM-DD` rather than being derived from
 * `now` here. Deriving it would put the whole policy back on a UTC clock, which
 * is the bug `lib/shopTime.ts` exists to end.
 */
export function cancellationQuote(input: {
  /** Rent actually paid, in paise — not the rent owed. */
  rentPaid: number
  /** Deposit actually lodged, in paise. */
  depositHeld: number
  /** First day of the hire, `YYYY-MM-DD`. */
  startsOn: string
  /** The shop's today, `YYYY-MM-DD`. */
  today: string
  /** When the booking was made. A number is accepted so the band-only wrapper
   *  below can pass an epoch that is unambiguously outside the grace window. */
  bookedAt: Date | string | number
  /** Now. */
  now: Date | string | number
  /** Who is cancelling. Defaults to the customer, which is the charged case —
   *  a default that is wrong should cost the SHOP, not the customer. */
  cancelledBy?: CancelledBy
}): CancellationQuote {
  const { bands, graceHours, depositAlwaysReturned, shopCancellationAlwaysFull } =
    RENTAL_POLICY.cancellation

  const start = Date.parse(`${input.startsOn}T00:00:00Z`)
  const todayMs = Date.parse(`${input.today}T00:00:00Z`)
  const daysUntilStart = Math.round((start - todayMs) / 86_400_000)

  const band =
    bands.find((b) => daysUntilStart >= b.daysBefore) ?? bands[bands.length - 1]

  const bookedMs = new Date(input.bookedAt).getTime()
  const nowMs = new Date(input.now).getTime()
  // A clock that has gone backwards, or an unparseable timestamp, must not
  // silently grant or deny the grace window. Both resolve to "not under grace",
  // and the bands — which depend only on dates — still apply.
  const hoursSinceBooking =
    Number.isFinite(bookedMs) && Number.isFinite(nowMs) && nowMs >= bookedMs
      ? (nowMs - bookedMs) / 3_600_000
      : Infinity

  const shopCancelled = input.cancelledBy === 'shop' && shopCancellationAlwaysFull
  const underGrace = !shopCancelled && hoursSinceBooking < graceHours

  const share = shopCancelled || underGrace ? 1 : band.refundShare

  const paid = Math.max(0, Math.round(input.rentPaid))
  // Round the REFUND down and take the retained amount as the remainder, so the
  // two always sum to exactly what was paid. Rounding both independently is how
  // a rupee goes missing from a reconciliation.
  const rentRefund = share >= 1 ? paid : Math.max(0, Math.min(paid, Math.floor(paid * share)))
  const rentRetained = paid - rentRefund

  const depositRefund = depositAlwaysReturned ? Math.max(0, Math.round(input.depositHeld)) : 0

  return {
    rentRefund,
    rentRetained,
    depositRefund,
    total: rentRefund + depositRefund,
    daysUntilStart,
    band,
    underGrace,
    shopCancelled,
    summary: shopCancelled
      ? 'We cancelled this one, so everything you paid comes back in full.'
      : underGrace
        ? 'Cancelled within a day of booking — everything comes back in full.'
        : share >= 1
          ? 'Cancelled with a week or more to go — all of the rent comes back.'
          : `Cancelled ${daysUntilStart <= 0 ? 'on the day' : `${daysUntilStart} day${daysUntilStart === 1 ? '' : 's'} before`} — ${band.short} of the rent comes back.`,
  }
}

/**
 * The deadline for a full refund on a booking, as a plain day.
 *
 * This is the figure the storefront has to be able to say BEFORE anybody pays —
 * "free cancellation until the 13th" is a promise a person can act on, where
 * "a week or more before it starts" is a rule they have to do arithmetic on
 * while holding a card.
 *
 * `today` IS REQUIRED, AND THAT IS THE WHOLE FIX. An earlier version took only
 * the start date and returned `start − 7 days` unconditionally. For a hire
 * beginning inside the next week that date is in the PAST, so both storefronts
 * cheerfully printed "Cancel free until 29 Aug." on the first of September —
 * a promise about money, made before payment, that had already expired. It was
 * invisible in review because any start date more than a week out hides it.
 *
 * Null means "there is no such date to name", and the caller must then quote
 * the GRACE window instead — which is not a fallback but the genuinely
 * applicable rule: cancel within a day of booking and everything comes back,
 * however close the dates.
 */
export function fullRefundDeadline(startsOn: string, today: string): string | null {
  const top = RENTAL_POLICY.cancellation.bands[0]
  const start = Date.parse(`${startsOn}T00:00:00Z`)
  if (!Number.isFinite(start) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null
  const deadline = new Date(start - top.daysBefore * 86_400_000).toISOString().slice(0, 10)
  // ON the deadline still counts: `daysUntilStart >= 7` satisfies the top band,
  // so a cancellation that day is still whole. Only a deadline that has already
  // gone is unnameable.
  return deadline < today ? null : deadline
}

/**
 * DELIBERATELY NOT PROVIDED: a band-only convenience wrapper.
 *
 * There was one, briefly, and its own test caught it granting a full refund on
 * every cancellation in the shop. It passed epoch 0 for both `bookedAt` and
 * `now` to mean "no grace window here", and zero hours between them is very
 * much inside a 24-hour grace window — so the wrapper silently made every band
 * whole, on the one code path that actually moves money.
 *
 * A function whose safe use depends on remembering to pass sentinel timestamps
 * is a function that will eventually be called without them. Every caller uses
 * `cancellationQuote` and supplies the real ones.
 */
