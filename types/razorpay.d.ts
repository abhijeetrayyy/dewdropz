export interface RazorpayCheckoutOptions {
  key: string
  amount: number
  currency: string
  name: string
  description?: string
  order_id: string
  prefill?: { name?: string; email?: string; contact?: string }
  theme?: { color?: string }
  handler: (response: {
    razorpay_payment_id: string
    razorpay_order_id: string
    razorpay_signature: string
  }) => void
  modal?: { ondismiss?: () => void }
}

export interface RazorpayCheckoutInstance {
  open: () => void
  /**
   * Razorpay emits `payment.failed` for a declined card or a timed-out UPI
   * collect — distinct from the modal being dismissed, which is `ondismiss`.
   * The web checkout never listened for it; the mobile payment page does,
   * because on a phone the difference between "you closed it" and "your bank
   * said no" is the difference between trying again and using another method.
   */
  on: (event: 'payment.failed', handler: (response: { error?: { description?: string } }) => void) => void
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance
  }
}
