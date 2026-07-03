import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import Stripe from 'https://esm.sh/stripe@16.8.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2025-03-31.basil',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response('No signature', { status: 400 })
  }

  const body = await req.text()
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

  try {
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)

    // Log the event
    await supabase.from('webhook_events').insert({
      provider: 'stripe',
      event_type: event.type,
      payload: event.data.object,
    })

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const orderId = session.metadata?.order_id

        if (orderId) {
          await supabase
            .from('orders')
            .update({
              payment_status: 'paid',
              payment_intent_id: session.id,
              status: 'confirmed',
              confirmed_at: new Date().toISOString(),
            })
            .eq('id', orderId)
        }
        break
      }
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object
        const orderId = paymentIntent.metadata?.order_id

        if (orderId) {
          await supabase
            .from('orders')
            .update({ payment_status: 'failed' })
            .eq('id', orderId)
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
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
