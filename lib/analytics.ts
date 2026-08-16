// GA4 and Meta Pixel are loaded by their own scripts, so they arrive on
// `window` at runtime with no types of their own. Declaring them once here is
// what removes the four `@ts-ignore`s this file used to carry — and a declared
// signature is worth more than a suppression: `@ts-ignore` hides whatever error
// is on the next line, including one you did not mean to silence.
declare global {
  interface Window {
    gtag?: (command: 'event', eventName: string, params?: AnalyticsParams) => void
    fbq?: (command: 'track', eventName: string, params?: AnalyticsParams) => void
  }
}

/** Whatever the caller attaches to an event. Vendors accept arbitrary keys, but
 *  the values are scalars in practice — `unknown` rather than `any` so a typo
 *  in a call site is still a type error at that call site. */
export type AnalyticsParams = Record<string, unknown>

export const trackEvent = (eventName: string, params?: AnalyticsParams) => {
  if (typeof window === 'undefined') return

  window.gtag?.('event', eventName, params)

  if (window.fbq) {
    // Map common GA events to Facebook Pixel standard events
    let fbEvent = eventName
    if (eventName === 'add_to_cart') fbEvent = 'AddToCart'
    else if (eventName === 'begin_checkout') fbEvent = 'InitiateCheckout'
    else if (eventName === 'purchase') fbEvent = 'Purchase'
    else if (eventName === 'view_item') fbEvent = 'ViewContent'

    window.fbq('track', fbEvent, params)
  }
}
