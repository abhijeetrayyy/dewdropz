// Validating a GSTIN before it is frozen onto a tax invoice.
//
// WHY THIS EXISTS. `issue_invoice` (migration 048) checks only that the GSTIN's
// first two characters match seller_state_code. A number that is mistyped
// anywhere after that passes, gets copied onto the invoice row, and spends a
// serial from a gapless counter that cannot be rewound. Correcting it then means
// a credit note plus a fresh invoice, and every copy already sent to a customer
// is a defective document under Rule 46(a). The number is entered once, by hand,
// from a certificate — which is exactly the moment to check it.

/**
 * Assigned GST state codes: 01–38, plus 97 (Other Territory) and 99 (Centre
 * Jurisdiction). Codes above 38 are unassigned, so a 2-digit prefix outside
 * this set is a typo rather than a state this shop has not met yet.
 */
const STATE_CODES = new Set([
  ...Array.from({ length: 38 }, (_, i) => String(i + 1).padStart(2, '0')),
  '97',
  '99',
])

/**
 * 15 characters: state code, then the holder's PAN (5 letters, 4 digits, 1
 * letter), then an entity code, then a literal Z, then the check character.
 * The Z is fixed by the format — it is not a placeholder for anything.
 */
const SHAPE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * The check character: Luhn mod 36 over the first 14. Weights alternate 1,2
 * from the left, each product is folded (quotient + remainder, base 36), and
 * the check is whatever makes the total a multiple of 36.
 *
 * Reconstructed from public documentation, not from a statutory spec — which
 * is why validateGstin treats a checksum failure as overridable. Evidence is
 * reproducible via `node scripts/verify-gstin.mjs`: the canonical published
 * example 27AAPFU0939F1ZV validates, and every single-character substitution
 * (490) and adjacent transposition (12) of it is rejected.
 */
export function gstinCheckChar(first14: string): string {
  let total = 0
  for (let i = 0; i < 14; i++) {
    const value = ALPHABET.indexOf(first14[i])
    if (value < 0) return ''
    const product = value * (i % 2 === 0 ? 1 : 2)
    total += Math.floor(product / 36) + (product % 36)
  }
  return ALPHABET[(36 - (total % 36)) % 36]
}

export type GstinCheck =
  | { ok: true; value: string }
  | { ok: false; reason: string; kind: 'shape' | 'state' | 'checksum' }

/**
 * Normalises (trim + uppercase) and validates.
 *
 * The checksum verdict is returned separately as `kind: 'checksum'` because the
 * caller may choose to accept it. A shape or state-code failure is never
 * acceptable — those rules are fixed by the format. The checksum rests on an
 * algorithm reconstructed from public documentation, and wrongly rejecting a
 * genuine GSTIN would block invoicing entirely, which is worse than the typo it
 * guards against. So it is the owner's call, made once, with the certificate in
 * front of them.
 */
export function validateGstin(raw: string): GstinCheck {
  const value = raw.trim().toUpperCase().replace(/\s+/g, '')

  if (value.length !== 15) {
    return { ok: false, kind: 'shape', reason: `A GSTIN is 15 characters; this is ${value.length}.` }
  }
  if (!SHAPE.test(value)) {
    return {
      ok: false,
      kind: 'shape',
      reason:
        'Expected 2 digits, 5 letters, 4 digits, a letter, one more character, a literal Z, then the check character.',
    }
  }
  if (!STATE_CODES.has(value.slice(0, 2))) {
    return { ok: false, kind: 'state', reason: `${value.slice(0, 2)} is not an assigned GST state code.` }
  }

  const expected = gstinCheckChar(value)
  if (expected !== value[15 - 1]) {
    return {
      ok: false,
      kind: 'checksum',
      reason: `The check character should be ${expected}, not ${value[14]}. Compare it against your GST certificate one character at a time.`,
    }
  }

  return { ok: true, value }
}
