import { NextResponse } from 'next/server'
import { verifyStripeWebhook } from '@/actions/payments'

export async function POST(request: Request) {
  try {
    const payload = await request.text()
    const signature = request.headers.get('stripe-signature')!

    const result = await verifyStripeWebhook(payload, signature)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Stripe webhook error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 }
    )
  }
}
