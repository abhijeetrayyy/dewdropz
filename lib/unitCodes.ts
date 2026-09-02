/**
 * Turning what a shopkeeper types into a list of tag codes.
 *
 * THE PROBLEM. `rental_units` is one row per physical copy, which is the right
 * model and makes stocking six identical tents six trips through a one-field
 * form — type FST-001, click Add, wait for a refresh, type FST-002. The shop
 * buys gear in batches; the admin made it feel like it buys gear one at a time.
 *
 * So the field accepts what a person would actually write on a delivery note:
 *
 *   FST-001, FST-002, FST-003     a list
 *   FST-001 FST-002               spaces or newlines, equally
 *   FST-001..006                  a range, keeping the prefix and the width
 *   FST-001..006, CKK-001         both at once
 *
 * Pure and tested, because the range expansion is the kind of arithmetic that
 * is obviously right and quietly off by one — and being off by one here means
 * a physical tent that the system does not know exists, or a tag code on a
 * shelf that matches nothing.
 */

/** How many units one paste may create. A range typed as `A-1..99999` is
 *  almost certainly a typo, and it should be refused rather than inserted. */
export const MAX_UNITS_PER_PASTE = 50

export type UnitCodeResult =
  | { ok: true; codes: string[] }
  | { ok: false; error: string }

const RANGE = /^(.*?)(\d+)\.\.(\d+)$/

export function expandUnitCodes(input: string): UnitCodeResult {
  const parts = input
    .split(/[,\n\r\t ]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  if (!parts.length) return { ok: false, error: 'Type at least one unit code.' }

  const codes: string[] = []
  for (const part of parts) {
    const m = RANGE.exec(part)
    if (!m) { codes.push(part); continue }

    const [, prefix, fromRaw, toRaw] = m
    const from = Number(fromRaw)
    // The end of a range keeps the START's width, so `FST-001..006` and
    // `FST-001..6` both mean the same six tents. Writing the full number twice
    // is what a person does; writing it once is what they often do.
    const to = Number(toRaw)
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
      return { ok: false, error: `“${part}” is not a range this understands.` }
    }
    if (to < from) {
      return { ok: false, error: `“${part}” counts backwards.` }
    }
    if (to - from + 1 > MAX_UNITS_PER_PASTE) {
      return { ok: false, error: `“${part}” would create ${to - from + 1} units. ${MAX_UNITS_PER_PASTE} is the most at once.` }
    }
    const width = fromRaw.length
    for (let n = from; n <= to; n++) {
      codes.push(`${prefix}${String(n).padStart(width, '0')}`)
    }
  }

  // Deduplicated, keeping the first occurrence, because `(item_id, code)` is
  // UNIQUE and a paste containing the same code twice should add it once
  // rather than fail the whole batch.
  const seen = new Set<string>()
  const unique = codes.filter((c) => (seen.has(c) ? false : (seen.add(c), true)))

  if (unique.length > MAX_UNITS_PER_PASTE) {
    return { ok: false, error: `That is ${unique.length} units. ${MAX_UNITS_PER_PASTE} is the most at once.` }
  }
  const tooLong = unique.find((c) => c.length > 40)
  if (tooLong) return { ok: false, error: `“${tooLong}” is too long for a tag code.` }

  return { ok: true, codes: unique }
}
