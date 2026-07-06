export const trackEvent = (eventName: string, params?: Record<string, any>) => {
  if (typeof window !== 'undefined') {
    // @ts-ignore
    if (window.gtag) {
      // @ts-ignore
      window.gtag('event', eventName, params)
    }
    // @ts-ignore
    if (window.fbq) {
      // Map common GA events to Facebook Pixel standard events
      let fbEvent = eventName
      if (eventName === 'add_to_cart') fbEvent = 'AddToCart'
      else if (eventName === 'begin_checkout') fbEvent = 'InitiateCheckout'
      else if (eventName === 'purchase') fbEvent = 'Purchase'
      else if (eventName === 'view_item') fbEvent = 'ViewContent'
      
      // @ts-ignore
      window.fbq('track', fbEvent, params)
    }
  }
}
