import 'server-only'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { sendOrderConfirmationEmail } from '@/lib/email'
import { sendSlackAlert } from '@/lib/slack'

// This lives in lib/, not actions/, and that is the point.
//
// It was an exported function in a 'use server' file, which makes it a real
// POST endpoint that anybody can call. It takes an order id, reads the order
// with the service-role client, and then SENDS MAIL to whatever address is on
// it — so an outsider who guessed or scraped an order id could have mailed a
// customer repeatedly, and rung the Slack channel each time, at our cost.
//
// Nothing user-facing ever called it. Its only caller is the job runner, which
// is server code and can import it directly. Moving it here removes the
// endpoint entirely rather than bolting a guard onto something that should
// never have been reachable.
export async function sendOrderConfirmationIfFirstTime(orderId: string) {
  const admin = createAdminSupabaseClient()
  const { data: order } = await admin
    .from('orders')
    .select('*, items:order_items(*)')
    .eq('id', orderId)
    .single()
  if (!order) return

  await sendOrderConfirmationEmail({
    email: order.email,
    orderNumber: order.order_number,
    orderDate: new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
    items: (order.items as { product_name: string; quantity: number; unit_price: number }[]).map((item) => ({
      name: item.product_name,
      quantity: item.quantity,
      price: item.unit_price,
    })),
    subtotal: order.subtotal,
    shipping: order.shipping_cost,
    total: order.total_amount,
    shippingAddress: order.shipping_address as Record<string, unknown>,
  })

  await sendSlackAlert(`:moneybag: New order ${order.order_number} — ₹${(order.total_amount / 100).toLocaleString('en-IN')} (${order.email})`)
}
