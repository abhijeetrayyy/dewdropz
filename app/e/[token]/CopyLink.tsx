'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

// The URL pill under the invite card.
//
// It exists for the person who was sent the card and wants to forward it, so
// the address has to be the real one — which is only knowable in the browser.
// Read through useSyncExternalStore, the same way `useClock` reads the time:
// the server snapshot is the path this page was routed at, so the pill is
// never empty, and the full URL arrives after mount without a hydration
// mismatch or a setState cascading out of an effect.
//
// The protocol is dropped from the display because "dewdropz.in/e/9f3c…" is a
// thing you read out loud and "https://dewdropz.in/e/9f3c…" is a thing you skip.
//
// It used to be clay and monospace with an amber "copy" — three colours and a
// typeface spent on the least important object on the page. Monospace is for a
// figure here, and this is an address; clay means a limit, and nothing about
// forwarding a link is limited; amber means a clock is running, and none is.
// So the pill is the page's own rule and grey, and the one word you press is
// the forest every other act on the product takes.
const noSubscribe = () => () => {}
const hrefSnapshot = () => window.location.href

export default function CopyLink({ path }: { path: string }) {
  const url = useSyncExternalStore(noSubscribe, hrefSnapshot, () => path)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2400)
    return () => clearTimeout(t)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // Refused on an insecure origin, or by a browser that asks first. The
      // address bar is right there, so this is a convenience, not the only way.
      setCopied(false)
    }
  }

  return (
    <span className="flex max-w-full items-center gap-3.5 rounded-full border border-rule bg-surface px-5 py-2.5 font-body text-[13px] text-mid">
      <span className="truncate">{url.replace(/^https?:\/\//, '')}</span>
      <button
        type="button"
        onClick={copy}
        aria-live="polite"
        className="shrink-0 border-b border-forest/40 pb-px font-medium text-forest transition-colors hover:border-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
      >
        {copied ? 'Copied ✓' : 'Copy'}
      </button>
    </span>
  )
}
