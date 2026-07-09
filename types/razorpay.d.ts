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
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance
  }
}
