import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminSupabaseClient } from '@/lib/supabase'
import PayClient from './PayClient'

// ⚠ UNVERIFIED — see the header of app/api/mobile/orders/razorpay/route.ts.
// No Razorpay credentials exist in this repository, so this page has never
// loaded the checkout widget it is built around.
export const metadata: Metadata = {
  title: 'Complete your payment — DEWDROPZ',
  robots: { index: false, follow: false, nocache: true },
}

// The payment step, hosted on the storefront and opened by the app.
//
// WHY A WEB PAGE RATHER THAN A NATIVE SDK. `react-native-razorpay` would mean a
// native module to maintain, a rebuild to adopt, and the publishable key inside
// the app bundle. Razorpay's own checkout is a web widget; the app opens this
// page in a browser sheet, pays, and is returned by deep link. The same page
// works for any future client.
//
// WHAT SECURES IT. An order id is a v4 UUID and is not enumerable, which is the
// same reasoning 080 applies to share tokens. Somebody holding one can see the
// order number and the amount, and can pay it — neither of which is worth much
// to an attacker, and the second is arguably a favour. It deliberately does NOT
// show the address, the items or the customer's name.
//
// A STRONGER VERSION EXISTS and was not built: a single-use `pay_token` column
// minted per attempt, so a leaked URL stops working once used. That is a
// migration, and it is the right thing to add before this handles real volume.
export default async function PayPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params

  const admin = createAdminSupabaseClient()
  const { data: order } = await admin
    .from('orders')
    // An explicit, minimal column list. Nothing about who the customer is or
    // where the parcel is going belongs on a page reachable by URL alone.
    .select('id, order_number, total_amount, payment_status, payment_intent_id')
    .eq('id', orderId)
    .maybeSingle()

  if (!order || !order.payment_intent_id) notFound()

  return (
    <PayClient
      orderId={order.id}
      orderNumber={order.order_number}
      amount={order.total_amount}
      razorpayOrderId={order.payment_intent_id}
      alreadyPaid={order.payment_status === 'paid'}
      keyId={process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? ''}
    />
  )
}
