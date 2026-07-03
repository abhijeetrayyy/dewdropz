import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

type SendEmailParams = {
  to: string | string[]
  subject: string
  html: string
  from?: string
}

export async function sendEmail({ to, subject, html, from }: SendEmailParams) {
  return resend.emails.send({
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
