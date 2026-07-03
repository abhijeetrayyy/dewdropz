import { NextResponse } from 'next/server'
import { verifyRazorpayWebhook } from '@/actions/payments'

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const signature = request.headers.get('x-razorpay-signature')!

    const result = await verifyRazorpayWebhook(payload, signature)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Razorpay webhook error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 }
    )
  }
}
