'use client'

import { useConsent } from '@/providers/ConsentProvider'

/**
 * Withdrawing consent has to be as available as giving it, so the footer
 * carries a way back to the choice. Re-opening it sets the state to 'unknown',
 * which brings the banner back — and `deny()` reloads if anything had already
 * been injected, because a loaded script cannot be unloaded.
 */
export default function CookieChoicesLink({ className }: { className?: string }) {
  const { reset } = useConsent()
  return (
    <button type="button" onClick={reset} className={className}>
      Cookie choices
    </button>
  )
}
