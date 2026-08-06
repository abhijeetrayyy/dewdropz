import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { mobileCheckoutSchema } from '@/lib/validations'
import { syncLocalCartToDbCart } from '@/actions/checkout'
import { createOrder } from '@/actions/orders'

// The mobile client has no cookie session for RLS to key off, so it can't use
// the web checkout's cookie-bound flow as-is. Instead: verify the caller's
// Supabase access token directly, then do every write (address insert, cart
// sync, order creation) through the admin client, explicitly scoped to the
// token-verified user id rather than relying on auth.uid().
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  const { data: address, error: addressError } = await admin
    .from('addresses')
    .insert({
      user_id: user.id,
      type: 'shipping',
      full_name: input.fullName,
      phone: input.phone,
      address_line1: input.addressLine1,
      address_line2: input.addressLine2 ?? null,
      city: input.city,
      state: input.state,
      postal_code: input.postalCode,
      country: 'India',
    })
    .select('id')
    .single()

  if (addressError || !address) {
    return NextResponse.json({ error: 'Could not save address' }, { status: 500 })
  }

  const { skipped } = await syncLocalCartToDbCart(
    input.items.map((item) => ({ slug: item.slug, size: item.size ?? '', quantity: item.quantity })),
    user.id,
    admin
  )

  const result = await createOrder({
    userId: user.id,
    email: user.email,
    phone: input.phone,
    shipping_address_id: address.id,
    notes: input.notes,
    payment_method: 'cod',
    client: admin,
  })

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ success: true, orderId: result.orderId, skippedItems: skipped })
}
