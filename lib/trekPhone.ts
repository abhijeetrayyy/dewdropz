// Turning what a person types into the E.164 form Supabase Auth requires.
//
// Lives here rather than beside the action because a 'use server' module may
// only export async functions, and this is a pure one worth testing directly.

export type PhoneParse = { ok: true; phone: string } | { ok: false; error: string }

/**
 * Normalise what somebody actually types into E.164.
 *
 * Indians write their mobile eight different ways and almost never with a
 * country code. Foreigners — who this board explicitly wants — write theirs
 * with one. So a leading + is taken at face value, and a bare number is assumed
 * Indian, which is right for the overwhelming majority and never silently wrong
 * for the rest, because they will have typed the +.
 */
export function toE164(raw: string): PhoneParse {
  const trimmed = raw.trim()
  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')

  if (!digits) return { ok: false, error: 'Enter your mobile number.' }

  if (hasPlus) {
    if (digits.length < 8 || digits.length > 15) {
      return { ok: false, error: 'That does not look like a full international number.' }
    }
    return { ok: true, phone: `+${digits}` }
  }

  // 10 digits, the way an Indian mobile is written and said aloud.
  if (digits.length === 10) return { ok: true, phone: `+91${digits}` }
  // With the trunk 0 in front, as it appears on forms and visiting cards.
  if (digits.length === 11 && digits.startsWith('0')) return { ok: true, phone: `+91${digits.slice(1)}` }
  // Already carrying 91, just without the +.
  if (digits.length === 12 && digits.startsWith('91')) return { ok: true, phone: `+${digits}` }

  return {
    ok: false,
    error: 'Enter a 10-digit Indian mobile number, or the full number with a country code like +44.',
  }
}

