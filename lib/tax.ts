// GST calculation.
//
// Pure on purpose — no database, no session — so the arithmetic that decides
// what a customer is charged can be exercised directly. The I/O half lives in
// `lib/tax.server.ts`.
//
// Everything here is in paise. Rates are percentages (5 means 5%).

export type TaxRate = {
  hsn_code: string
  min_price: number
  max_price: number | null
  rate: number
}

export type TaxableLine = {
  /** Stable key so the caller can match results back to its own lines. */
  key: string
  hsnCode: string | null
  /** Per-unit price. The apparel slab is decided per PIECE, not per line. */
  unitPrice: number
  quantity: number
}

export type LineTax = {
  key: string
  hsnCode: string | null
  rate: number
  /** Line value after its apportioned share of the order discount. */
  taxableValue: number
  taxAmount: number
}

/**
 * The rate for one unit.
 *
 * Matched on the UNIT price because that is how the apparel threshold is
 * written in the law — a ₹900 tee is 5% whether you buy one or ten. Applying
 * the band to the line total would push a customer into 12% for buying two.
 */
export function resolveRate(rates: TaxRate[], hsnCode: string | null, unitPrice: number, fallbackRate: number): number {
  if (!hsnCode) return fallbackRate
  const match = rates.find(
    (r) => r.hsn_code === hsnCode && unitPrice >= r.min_price && (r.max_price == null || unitPrice < r.max_price)
  )
  // An HSN with no band covering this price is a gap in the rate table, not a
  // reason to charge nothing.
  return match ? match.rate : fallbackRate
}

/**
 * Tax for a whole cart, with an order-level discount spread across the lines.
 *
 * The discount has to be apportioned rather than subtracted from the total,
 * because lines can sit at different rates: taking ₹200 off a cart holding a
 * 5% tee and an 18% bottle gives a different tax bill depending on which line
 * the money comes off. Proportional apportionment is the defensible reading —
 * the discount reduces each line's value in the ratio it contributed.
 *
 * Rounding: each line is floored to the paise, and the order's tax is the SUM
 * of the lines. Recomputing tax on the summed taxable value instead would
 * disagree with the per-line figures printed on the invoice.
 */
export function calculateTax(params: {
  lines: TaxableLine[]
  rates: TaxRate[]
  fallbackRate: number
  /** Total order-level discount in paise (promotions + coupons). */
  discount?: number
  enabled?: boolean
}): { lines: LineTax[]; totalTax: number; breakdown: { rate: number; taxable: number; tax: number }[] } {
  const { lines, rates, fallbackRate, discount = 0, enabled = true } = params

  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)
  // A discount can never exceed the cart; clamped here as well as upstream so
  // this function is safe to call on its own.
  const effectiveDiscount = Math.max(0, Math.min(discount, subtotal))

  let allocated = 0
  const lineTaxes: LineTax[] = lines.map((line, index) => {
    const lineValue = line.unitPrice * line.quantity

    // The last line absorbs the rounding remainder, so the apportioned shares
    // always add back up to exactly the discount given. Without this a ₹100
    // discount across three lines quietly becomes ₹99.99.
    const isLast = index === lines.length - 1
    const share = subtotal === 0 ? 0
      : isLast ? effectiveDiscount - allocated
      : Math.floor((lineValue * effectiveDiscount) / subtotal)
    allocated += share

    const taxableValue = Math.max(0, lineValue - share)
    const rate = enabled ? resolveRate(rates, line.hsnCode, line.unitPrice, fallbackRate) : 0

    return {
      key: line.key,
      hsnCode: line.hsnCode,
      rate,
      taxableValue,
      taxAmount: Math.floor((taxableValue * rate) / 100),
    }
  })

  // One entry per distinct rate — the shape a GST invoice's summary takes.
  const byRate = new Map<number, { rate: number; taxable: number; tax: number }>()
  for (const l of lineTaxes) {
    if (l.taxAmount === 0 && l.rate === 0) continue
    const entry = byRate.get(l.rate) ?? { rate: l.rate, taxable: 0, tax: 0 }
    entry.taxable += l.taxableValue
    entry.tax += l.taxAmount
    byRate.set(l.rate, entry)
  }

  return {
    lines: lineTaxes,
    totalTax: lineTaxes.reduce((sum, l) => sum + l.taxAmount, 0),
    breakdown: [...byRate.values()].sort((a, b) => a.rate - b.rate),
  }
}

/**
 * Whether this sale is inter-state.
 *
 * Compared loosely because addresses are typed by customers — "uttarakhand",
 * "Uttarakhand " and "UTTARAKHAND" are one state, and treating them as three
 * would put IGST on a local delivery.
 */
export function isInterState(originState: string, destinationState: string | null | undefined): boolean {
  if (!destinationState) return false
  const normalise = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
  return normalise(originState) !== normalise(destinationState)
}

/**
 * Split a tax amount for display. Intra-state GST is levied half as CGST and
 * half as SGST; the odd paise goes to CGST so the two halves still sum to the
 * total charged.
 */
export function splitTax(taxAmount: number, interState: boolean) {
  if (interState) return { igst: taxAmount, cgst: 0, sgst: 0 }
  const sgst = Math.floor(taxAmount / 2)
  return { igst: 0, cgst: taxAmount - sgst, sgst }
}
