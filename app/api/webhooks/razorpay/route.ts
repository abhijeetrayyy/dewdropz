import { NextResponse } from 'next/server'
import { verifyRazorpayWebhook } from '@/actions/payments'

export async function POST(request: Request) {
  const signature = request.headers.get('x-razorpay-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  try {
    // Signature verification needs the exact bytes Razorpay signed — read as text,
    // not request.json(), which would hand the handler an already-parsed object.
    const rawBody = await request.text()
    const result = await verifyRazorpayWebhook(rawBody, signature)
    if ('error' in result) return NextResponse.json(result, { status: 400 })
    return NextResponse.json(result)
  } catch (error) {
    console.error('Razorpay webhook error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 }
    )
  }
}
