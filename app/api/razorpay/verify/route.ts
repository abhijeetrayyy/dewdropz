import { NextResponse } from 'next/server'
import { verifyRazorpayPayment } from '@/actions/payments'

// Called by the checkout page immediately after Razorpay Checkout's success
// handler fires client-side, so the customer sees a confirmed order without
// waiting on the webhook (which is still the durable, replay-safe source of
// truth and will confirm the same order again if this call is ever missed).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)

  if (
    !body ||
    typeof body.orderId !== 'string' ||
    typeof body.razorpay_order_id !== 'string' ||
    typeof body.razorpay_payment_id !== 'string' ||
    typeof body.razorpay_signature !== 'string'
  ) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const result = await verifyRazorpayPayment({
    orderId: body.orderId,
    razorpayOrderId: body.razorpay_order_id,
    razorpayPaymentId: body.razorpay_payment_id,
    razorpaySignature: body.razorpay_signature,
  })

  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
