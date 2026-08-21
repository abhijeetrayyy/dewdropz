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

  // REUSE THE ADDRESS THE SHOPPER PICKED. DO NOT WRITE A NEW ONE.
  //
  // This inserted unconditionally, on every single checkout, even when the app
  // had just filled the form FROM a saved address. So the address book grew by
  // one identical row per order and the picker turned into a list of duplicates
  // of the same house — with no way to delete any of them, because the app has
  // no address management at all.
  //
  // Ownership is re-checked here rather than trusted: this runs on the admin
  // client, where RLS is not enforced, so an id from the request is only
  // honoured if it belongs to the token-verified user.
  let addressId: string | null = null

  if (input.addressId) {
    const { data: owned } = await admin
      .from('addresses')
      .select('id')
      .eq('id', input.addressId)
      .eq('user_id', user.id)
      .maybeSingle()
    addressId = owned?.id ?? null
  }

  // A new address, or a saved id that did not check out — write one row.
  if (!addressId) {
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
    addressId = address.id
  }

  // Unreachable — the branch above either sets it or returns — but createOrder
  // takes a string, and a cast here would be the kind of lie this file avoids.
  if (!addressId) {
    return NextResponse.json({ error: 'Could not save address' }, { status: 500 })
  }

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

  const result = await createOrder({
    userId: user.id,
    email: user.email,
    phone: input.phone,
    shipping_address_id: addressId,
    // Re-validated inside createOrder against the same validateCoupon the
    // quote used. A code that expired in the minutes between seeing the
    // discount and pressing the button fails the order rather than billing a
    // total nobody agreed to.
    coupon_code: input.couponCode,
    notes: input.notes,
    payment_method: 'cod',
    client: admin,
  })

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ success: true, orderId: result.orderId, skippedItems: skipped })
}
