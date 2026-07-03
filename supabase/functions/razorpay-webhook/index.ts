import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

serve(async (req) => {
  const signature = req.headers.get('x-razorpay-signature')
  if (!signature) {
    return new Response('No signature', { status: 400 })
  }

  const body = await req.json()
  const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')!

  // Verify signature
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const expectedSignature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(JSON.stringify(body))
  )

  // Convert to hex for comparison
  const expectedHex = Array.from(new Uint8Array(expectedSignature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  if (signature !== expectedHex) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const event = body

    await supabase.from('webhook_events').insert({
      provider: 'razorpay',
      event_type: event.event,
      payload: event,
    })

    switch (event.event) {
      case 'payment.captured': {
        const razorpayOrderId = event.payload?.payment?.entity?.order_id
        if (razorpayOrderId) {
          const { data: order } = await supabase
            .from('orders')
            .select('id')
            .eq('payment_intent_id', razorpayOrderId)
            .single()

          if (order) {
            await supabase
              .from('orders')
              .update({
                payment_status: 'paid',
                status: 'confirmed',
                confirmed_at: new Date().toISOString(),
              })
              .eq('id', order.id)
          }
        }
        break
      }
      case 'payment.failed': {
        const failedOrderId = event.payload?.payment?.entity?.order_id
        if (failedOrderId) {
          const { data: order } = await supabase
            .from('orders')
            .select('id')
            .eq('payment_intent_id', failedOrderId)
            .single()

          if (order) {
            await supabase
              .from('orders')
              .update({ payment_status: 'failed' })
              .eq('id', order.id)
          }
        }
        break
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
