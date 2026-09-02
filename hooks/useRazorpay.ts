'use client'

import { useEffect, useState } from 'react'

/**
 * The gateway's checkout script, loaded once and shared.
 *
 * Five components in this repo each load this script with their own copy of the
 * same twelve lines. This is the shared one; the older call sites are left
 * alone deliberately — they are tested payment paths, and rewriting a working
 * checkout to save duplication is how a refactor becomes an outage.
 *
 * LOADED ON MOUNT, NOT ON CLICK. Somebody who taps Pay and then waits for a
 * script to download is somebody who taps it again.
 *
 * The script is NOT removed on unmount. An earlier version did, which meant a
 * customer who opened the booking panel, closed it and reopened it tore down
 * the gateway's own global state mid-flight. It is a third-party script on a
 * page the customer is about to pay on; leaving it loaded is the conservative
 * choice.
 */
export function useRazorpay(): boolean {
  const [ready, setReady] = useState(
    () => typeof window !== 'undefined' && typeof window.Razorpay === 'function',
  )

  useEffect(() => {
    if (typeof window.Razorpay === 'function') return

    const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay]')
    if (existing) {
      const onLoad = () => setReady(true)
      existing.addEventListener('load', onLoad)
      return () => existing.removeEventListener('load', onLoad)
    }

    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.dataset.razorpay = 'true'
    script.onload = () => setReady(true)
    document.body.appendChild(script)
  }, [])

  return ready
}
