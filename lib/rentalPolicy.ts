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
 * people for pressing. That is the shape of a chargeback the shop cannot
 * defend, because there is no paragraph to point at.
 *
 * So the policy lives here, once, and BOTH the arithmetic and the terms page
 * read it. They cannot drift apart, which was the other half of the problem:
 * `TRUST_POINTS` once printed a shipping promise beside a live setting that
 * governed it, and they agreed only by coincidence.
 *
 * NOT a `store_settings` column, deliberately. That row is rebuilt from an
 * explicit key list on every read (`normalizeHomeConfig`), and a key missing
 * from that list is silently dropped — which is exactly how every trail an
 * admin added used to vanish. A policy that can disappear on read is worse than
 * a policy in a file.
 *
 * THESE NUMBERS ARE THE CLIENT'S. Change them here; the page and the refund
 * follow automatically.
 */

export type CancellationBand = {
  /** Cancel at least this many days before the hire starts… */
  daysBefore: number
  /** …and this share of the RENT comes back, 0–1. */
  refundShare: number
  /** How the page says it. */
  label: string
}

export const RENTAL_POLICY = {
  /**
   * Read top-down; the first band whose `daysBefore` is satisfied wins.
   *
   * The defaults are deliberately generous at the far end and firm inside two
   * days, which is when a cancelled hire genuinely cannot be re-let: the gear
   * has been set aside, and nobody books a tent for tomorrow.
   */
  cancellation: [
    { daysBefore: 7, refundShare: 1.0, label: 'A week or more before it starts — everything comes back.' },
    { daysBefore: 2, refundShare: 0.5, label: 'Between two and seven days before — half the rent comes back.' },
    { daysBefore: 0, refundShare: 0.0, label: 'Inside two days — the rent stays with us. The gear was set aside.' },
  ] as CancellationBand[],

  /**
   * The security deposit is NOT consideration for a supply — it is the
   * customer's money, held. It comes back in full on any cancellation, and it
   * is the one line in this policy that should never acquire an exception.
   */
  depositAlwaysReturnedOnCancellation: true,

  /** Once gear is out, cancelling is not a thing that can happen — it is a return. */
  cancellableWhile: ['reserved'] as const,
}

/**
 * What comes back if this booking is cancelled today.
 *
 * Pure, so it can be tested and so the terms page, the confirm dialog and the
 * refund all quote the same number. Paise in, paise out.
 */
export function cancellationRefund(input: {
  /** Rent actually paid, in paise — not the rent owed. */
  rentPaid: number
  /** Deposit actually lodged, in paise. */
  depositHeld: number
  /** First day of the hire, `YYYY-MM-DD`. */
  startsOn: string
  /** The shop's today, `YYYY-MM-DD`. */
  today: string
}): { rentRefund: number; depositRefund: number; total: number; band: CancellationBand } {
  const start = new Date(`${input.startsOn}T00:00:00Z`).getTime()
  const now = new Date(`${input.today}T00:00:00Z`).getTime()
  const daysUntil = Math.round((start - now) / 86_400_000)

  const band =
    RENTAL_POLICY.cancellation.find((b) => daysUntil >= b.daysBefore) ??
    RENTAL_POLICY.cancellation[RENTAL_POLICY.cancellation.length - 1]

  // Round DOWN on the refund share so a half-rupee never rounds in a direction
  // the customer did not agree to; the shop keeps at most one paise.
  const rentRefund = Math.max(0, Math.min(input.rentPaid, Math.floor(input.rentPaid * band.refundShare)))
  const depositRefund = RENTAL_POLICY.depositAlwaysReturnedOnCancellation ? Math.max(0, input.depositHeld) : 0

  return { rentRefund, depositRefund, total: rentRefund + depositRefund, band }
}
