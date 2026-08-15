import { Resend } from 'resend'

// Lazy, like getStripe() in lib/stripe.ts — constructing this at module scope
// throws immediately if RESEND_API_KEY isn't set, which crashes the build (and
// any other route) the moment something imports this file, even if that code
// path never actually sends an email at runtime.
let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!)
  return _resend
}

type SendEmailParams = {
  to: string | string[]
  subject: string
  html: string
  from?: string
}

export async function sendEmail({ to, subject, html, from }: SendEmailParams) {
  return getResend().emails.send({
    from: from ?? process.env.EMAIL_FROM ?? 'DEWDROPZ <noreply@dewdropz.com>',
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  })
}

export async function sendOrderConfirmationEmail(params: {
  email: string
  orderNumber: string
  orderDate: string
  items: Array<{ name: string; quantity: number; price: number }>
  subtotal: number
  shipping: number
  total: number
  shippingAddress: Record<string, unknown>
}) {
  const itemsHtml = params.items
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${item.name} × ${item.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">₹${(item.price / 100).toLocaleString('en-IN')}</td>
        </tr>`
    )
    .join('')

  const address = params.shippingAddress as Record<string, string>

  return sendEmail({
    to: params.email,
    subject: `Order Confirmed — ${params.orderNumber}`,
    html: `
      <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px 20px;">
        <h1 style="font-size:28px;letter-spacing:-0.5px;margin-bottom:8px;">DEWDROPZ</h1>
        <p style="font-style:italic;color:#7BA46F;">Thank you for your order.</p>
        <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;" />
        <p style="font-size:14px;color:#666;">Order <strong>${params.orderNumber}</strong></p>
        <p style="font-size:14px;color:#666;">${params.orderDate}</p>
        <table style="width:100%;border-collapse:collapse;margin:24px 0;">${itemsHtml}</table>
        <hr style="border:none;border-top:1px solid #ddd;" />
        <table style="width:100%;font-size:14px;">
          <tr><td>Subtotal</td><td style="text-align:right;">₹${(params.subtotal / 100).toLocaleString('en-IN')}</td></tr>
          <tr><td>Shipping</td><td style="text-align:right;">${params.shipping === 0 ? 'FREE' : `₹${(params.shipping / 100).toLocaleString('en-IN')}`}</td></tr>
          <tr style="font-weight:bold;font-size:16px;"><td>Total</td><td style="text-align:right;">₹${(params.total / 100).toLocaleString('en-IN')}</td></tr>
        </table>
        <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;" />
        <h3 style="font-size:14px;text-transform:uppercase;letter-spacing:1px;">Shipping To</h3>
        <p style="font-size:14px;color:#666;">
          ${address.full_name}<br/>
          ${address.address_line1}<br/>
          ${address.address_line2 ? address.address_line2 + '<br/>' : ''}
          ${address.city}, ${address.state} ${address.postal_code}
        </p>
        <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;" />
        <p style="font-size:13px;color:#999;">
          Need help? <a href="mailto:orders@dewdropz.com" style="color:#27481F;">orders@dewdropz.com</a>
        </p>
      </div>
    `,
  })
}

// Fired from cancelOrderInternal regardless of whether a refund was
// successfully issued alongside the cancellation — the customer needs to
// know their order stopped either way, and if a refund went through, when.
export async function sendOrderCancellationEmail(params: {
  email: string
  orderNumber: string
  refunded: boolean
  refundAmount?: number
}) {
  return sendEmail({
    to: params.email,
    subject: `Order Cancelled — ${params.orderNumber}`,
    html: `
      <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px 20px;">
        <h1 style="font-size:28px;letter-spacing:-0.5px;margin-bottom:8px;">DEWDROPZ</h1>
        <p style="font-style:italic;color:#7BA46F;">Your order has been cancelled.</p>
        <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;" />
        <p style="font-size:14px;color:#666;">Order <strong>${params.orderNumber}</strong> has been cancelled.</p>
        ${
          params.refunded
            ? `<p style="font-size:14px;color:#666;">A refund of <strong>₹${((params.refundAmount ?? 0) / 100).toLocaleString('en-IN')}</strong> has been issued and should reach your original payment method within 5-7 business days.</p>`
            : `<p style="font-size:14px;color:#666;">No payment had been captured for this order, so there's nothing to refund.</p>`
        }
        <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;" />
        <p style="font-size:13px;color:#999;">
          Need help? <a href="mailto:orders@dewdropz.com" style="color:#27481F;">orders@dewdropz.com</a>
        </p>
      </div>
    `,
  })
}

// Covers admin-issued refunds that aren't part of a cancellation (partial
// refunds, goodwill refunds, quality issues) — the cancellation email above
// already tells the customer about refunds tied to a cancelled order.
export async function sendRefundEmail(params: {
  email: string
  orderNumber: string
  amount: number
  partial: boolean
}) {
  return sendEmail({
    to: params.email,
    subject: `Refund Issued — ${params.orderNumber}`,
    html: `
      <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px 20px;">
        <h1 style="font-size:28px;letter-spacing:-0.5px;margin-bottom:8px;">DEWDROPZ</h1>
        <p style="font-style:italic;color:#7BA46F;">A refund is on its way.</p>
        <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;" />
        <p style="font-size:14px;color:#666;">
          ${params.partial ? 'A partial refund' : 'A full refund'} of <strong>₹${(params.amount / 100).toLocaleString('en-IN')}</strong>
          has been issued for order <strong>${params.orderNumber}</strong>.
        </p>
        <p style="font-size:14px;color:#666;">It should reach your original payment method within 5-7 business days.</p>
        <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;" />
        <p style="font-size:13px;color:#999;">
          Need help? <a href="mailto:orders@dewdropz.com" style="color:#27481F;">orders@dewdropz.com</a>
        </p>
      </div>
    `,
  })
}

export async function sendPaymentFailedEmail(params: { email: string; orderNumber: string }) {
  return sendEmail({
    to: params.email,
    subject: `Payment Failed — ${params.orderNumber}`,
    html: `
      <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px 20px;">
        <h1 style="font-size:28px;letter-spacing:-0.5px;margin-bottom:8px;">DEWDROPZ</h1>
        <p style="font-style:italic;color:#7BA46F;">Your payment didn't go through.</p>
        <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;" />
        <p style="font-size:14px;color:#666;">
          We couldn't process payment for order <strong>${params.orderNumber}</strong>. The items have not been charged
          and the order has not been placed — nothing has been reserved on our end past a short hold.
        </p>
        <p style="font-size:14px;color:#666;">Feel free to try again, or reach out if your card keeps getting declined.</p>
        <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;" />
        <p style="font-size:13px;color:#999;">
          Need help? <a href="mailto:orders@dewdropz.com" style="color:#27481F;">orders@dewdropz.com</a>
        </p>
      </div>
    `,
  })
}

export async function sendShipmentNotificationEmail(params: {
  email: string
  orderNumber: string
  carrier: string
  trackingNumber: string
  trackingUrl?: string
}) {
  return sendEmail({
    to: params.email,
    subject: `Shipped — ${params.orderNumber}`,
    html: `
      <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px 20px;">
        <h1 style="font-size:28px;letter-spacing:-0.5px;margin-bottom:8px;">DEWDROPZ</h1>
        <p style="font-style:italic;color:#7BA46F;">Your order is on its way.</p>
        <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;" />
        <p>Order <strong>${params.orderNumber}</strong> has been shipped via <strong>${params.carrier}</strong>.</p>
        <p>Tracking: <strong>${params.trackingNumber}</strong></p>
        ${params.trackingUrl ? `<a href="${params.trackingUrl}" style="display:inline-block;background:#27481F;color:white;padding:12px 24px;text-decoration:none;border-radius:2px;margin-top:16px;">Track Your Order</a>` : ''}
      </div>
    `,
  })
}

export async function sendAbandonedCartEmail(params: {
  email: string
  name: string | null
  recoveryUrl: string
  items: Array<{ name: string; quantity: number; price: number }>
}) {
  const itemsHtml = params.items
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${item.name} × ${item.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">₹${((item.price * item.quantity) / 100).toLocaleString('en-IN')}</td>
        </tr>`
    )
    .join('')

  const total = params.items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  // No discount code, no countdown, no "we noticed you were looking at…". A
  // reminder that the cart still exists is the whole job; training customers to
  // abandon carts because a coupon always follows is an expensive habit to buy.
  return sendEmail({
    to: params.email,
    subject: 'Your cart is still here',
    html: `
      <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px 20px;">
        <h1 style="font-size:28px;letter-spacing:-0.5px;margin-bottom:8px;">DEWDROPZ</h1>
        <p style="font-style:italic;color:#7BA46F;">You left something behind.</p>
        <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;" />
        <p style="font-size:15px;">${params.name ? `${params.name}, y` : 'Y'}our cart is saved and waiting.</p>
        <table style="width:100%;border-collapse:collapse;margin:24px 0;">${itemsHtml}</table>
        <p style="font-size:15px;"><strong>Total ₹${(total / 100).toLocaleString('en-IN')}</strong></p>
        <a href="${params.recoveryUrl}" style="display:inline-block;background:#27481F;color:white;padding:12px 24px;text-decoration:none;border-radius:2px;margin-top:16px;">Return to my cart</a>
        <p style="font-size:12px;color:#999;margin-top:32px;">If you have changed your mind, no action is needed — the cart will clear itself.</p>
      </div>
    `,
  })
}
