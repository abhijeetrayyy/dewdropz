import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { mobileCheckoutSchema } from '@/lib/validations'
import { syncLocalCartToDbCart } from '@/actions/checkout'
import { createOrder } from '@/actions/orders'
import { setPaymentStatusInternal } from '@/lib/orders-internal'

// ─────────────────────────────────────────────────────────────────────────────
// ⚠ UNVERIFIED. NO PAYMENT CREDENTIALS EXIST IN THIS REPOSITORY.
//
// `.env.local` has no RAZORPAY_KEY_ID, KEY_SECRET or WEBHOOK_SECRET, so not one
// line below has been run against Razorpay — not the order creation, not the
// signature check on the way back, not the failure branches. It compiles and it
// mirrors the web flow that does work; that is the whole of the evidence.
//
// Before this is trusted with a rupee, with test keys in place:
//   1. a successful payment marks the order paid and confirmed exactly once
//   2. an abandoned checkout leaves the order pending and re-payable
//   3. a tampered signature is rejected by /api/razorpay/verify
//   4. the webhook confirms the same order when the client never returns
//   5. the amount charged equals `orders.total_amount` to the paise
// ─────────────────────────────────────────────────────────────────────────────
//
// Creating a payable order for the app.
//
// This is `createRazorpayOrder`'s job, and it cannot be reused as-is: it reads
// the order back through `createServerSupabaseClient()`, which on a token-authed
// request has no cookie session and returns nothing. The rest of the shape is
// deliberately identical — same createOrder, same Razorpay Orders API call, same
// `setPaymentStatusInternal(..., { gatewayOrderId })`, because the webhook
// matches on `orders.payment_intent_id` and a flow that stored it differently
// would be a flow the webhook silently ignores.
//
// The app does NOT talk to Razorpay itself. It opens /pay/<orderId> in a browser
// sheet, which is what keeps the key secret out of the bundle and avoids adding
// a native module for a screen shown once per order.

export async function POST(request: NextRequest) {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    // Said plainly rather than failing deep inside a fetch to Razorpay with a
    // 401 the app would render as "something went wrong".
    return NextResponse.json(
      { error: 'Online payment is not switched on yet. Please choose cash on delivery.' },
      { status: 503 }
    )
  }

  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user }, error: authError } = await anon.auth.getUser(token)
  if (authError || !user || !user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = mobileCheckoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  const input = parsed.data
  const admin = createAdminSupabaseClient()

  // Same address handling as the COD route: reuse the row the shopper picked
  // rather than writing a duplicate on every attempt. Doubly important here,
  // because a customer who abandons a payment and tries again would otherwise
  // leave one address row per attempt.
  let addressId: string | null = null
  if (input.addressId) {
    const { data: owned } = await admin
      .from('addresses').select('id')
      .eq('id', input.addressId).eq('user_id', user.id).maybeSingle()
    addressId = owned?.id ?? null
  }
  if (!addressId) {
    const { data: address, error: addressError } = await admin
      .from('addresses')
      .insert({
        user_id: user.id, type: 'shipping',
        full_name: input.fullName, phone: input.phone,
        address_line1: input.addressLine1, address_line2: input.addressLine2 ?? null,
        city: input.city, state: input.state, postal_code: input.postalCode, country: 'India',
      })
      .select('id').single()
    if (addressError || !address) {
      return NextResponse.json({ error: 'Could not save address' }, { status: 500 })
    }
    addressId = address.id
  }
  if (!addressId) return NextResponse.json({ error: 'Could not save address' }, { status: 500 })

  const { skipped } = await syncLocalCartToDbCart(
    input.items.map((item) => ({
      slug: item.slug,
      size: item.size ?? '',
      quantity: item.quantity,
      productId: item.productId,
      variantId: item.variantId ?? null,
      customDesignId: item.customDesignId,
    })),
    user.id,
    admin
  )

  const orderResult = await createOrder({
    userId: user.id,
    email: user.email,
    phone: input.phone,
    shipping_address_id: addressId,
    coupon_code: input.couponCode,
    notes: input.notes,
    payment_method: 'razorpay',
    client: admin,
  })

  if ('error' in orderResult) {
    return NextResponse.json({ error: orderResult.error }, { status: 400 })
  }

  const { data: order } = await admin
    .from('orders')
    .select('total_amount, order_number')
    .eq('id', orderResult.orderId)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 500 })

  const razorpayAuth = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  ).toString('base64')

  const razorpayOrder = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${razorpayAuth}` },
    body: JSON.stringify({
      // The order's own total, read back from the database — never a figure
      // the app sent. Same rule as the quote endpoint.
      amount: order.total_amount,
      currency: 'INR',
      receipt: order.order_number,
      notes: { order_id: orderResult.orderId, channel: 'mobile' },
    }),
  }).then((r) => r.json()).catch(() => null)

  if (!razorpayOrder || razorpayOrder.error) {
    // The order exists and is unpaid. Left that way on purpose: it is
    // re-payable, and deleting it here would lose the cart the customer just
    // built. The app sends them back to the payment method step.
    return NextResponse.json(
      { error: razorpayOrder?.error?.description ?? 'Could not start the payment.' },
      { status: 502 }
    )
  }

  await setPaymentStatusInternal(orderResult.orderId, 'pending', { gatewayOrderId: razorpayOrder.id })

  return NextResponse.json({
    orderId: orderResult.orderId,
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    skippedItems: skipped,
  })
}
