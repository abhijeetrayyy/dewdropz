import { Resend } from 'resend'

// Lazy — constructing this at module scope
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
  /** A plain-text part. HTML-only mail is a measurable spam-score penalty and is
   *  unreadable on a watch or a screen reader — for messages whose entire job is
   *  arriving and being understood. */
  text?: string
  /** Several templates sign off "reply to this email". The default sender is a
   *  no-reply address, so those replies were going nowhere. */
  replyTo?: string
  /** Resend de-duplicates on this for 24h. The job queue is explicitly
   *  at-least-once (`lib/jobs.ts`), so a retry after a timeout genuinely does
   *  send twice; keying on `${subjectId}:${kind}` makes that free to prevent. */
  idempotencyKey?: string
}

/**
 * Send, and FAIL LOUDLY.
 *
 * THE BUG THIS ENDS
 *
 * This used to `return getResend().emails.send({...})` and nobody ever read the
 * result — not here, and not at any of the eight rental call sites. Resend does
 * not throw on an API error: it RESOLVES with `{ data: null, error: {...} }`
 * (see its `fetchRequest`, which catches `!response.ok` and returns the parsed
 * body). It throws only on a missing API key or a dead socket.
 *
 * So a 429 rate-limit, a 403 unverified-domain, a validation error or a
 * suppressed recipient all resolved normally. The caller then wrote a
 * `reminder_sent` row into `rental_events` and `lib/jobs.ts` marked the job
 * `done` — because nothing threw. No retry, no backoff, no `last_error`, no
 * Slack alert, and a positive audit row asserting the customer had been told.
 *
 * That defeated the entire queue. `lib/jobs.ts` exists because "a failed
 * order-confirmation email vanished with no record and no retry" — and with
 * Resend's return-don't-throw contract it still did.
 *
 * Rate limiting is the concrete case: Resend's default is 2 requests/second and
 * `runDueJobs` drains 20 in a tight loop. On a busy morning the first two send
 * and the next eighteen are 429'd, marked done, and logged as delivered.
 *
 * Three lines. They reconnect every template in this file — and every rental
 * template in `lib/rentalEmails.ts` — to the retry, backoff, `last_error` and
 * `/admin/jobs` machinery that already exist and are already correct.
 */
export async function sendEmail({
  to, subject, html, from, text, replyTo, idempotencyKey,
}: SendEmailParams) {
  const res = await getResend().emails.send(
    {
      from: from ?? process.env.EMAIL_FROM ?? 'DEWDROPZ <noreply@dewdropz.com>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(text ? { text } : {}),
      ...(replyTo ? { replyTo } : {}),
    },
    idempotencyKey ? { idempotencyKey } : undefined
  )

  if (res.error) {
    // The message carries the provider's own name and reason, so /admin/jobs
    // shows "Resend rate_limit_exceeded: Too many requests" rather than "failed".
    throw new Error(`Resend ${res.error.name}: ${res.error.message}`)
  }
  return res
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


/**
 * The email a rental booking promised and never sent.
 *
 * Both storefronts told the customer "we confirm by email" / "the email is on
 * its way" from the moment the feature shipped, and there was no rental email
 * anywhere in this file — six order emails, none for a booking. The screen was
 * making a promise the system could not keep, for a transaction where the
 * customer is expected to turn up at a shop on a particular day carrying a
 * number they were told would be sent to them.
 *
 * Deliberately plain: the booking number large, the dates, what to bring and
 * what the deposit does. Everything a person needs at the counter.
 */
export async function sendRentalConfirmationEmail(params: {
  email: string
  bookingNumber: string
  fulfilment: 'pickup' | 'ship'
  lines: Array<{ name: string; startsOn: string; endsOn: string; days: number; quantity: number }>
  rentAmount: number
  deliveryAmount: number
  taxAmount: number
  totalAmount: number
  depositAmount: number
}) {
  const money = (paise: number) =>
    `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: paise % 100 === 0 ? 0 : 2 })}`
  const day = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
    })

  const rows = params.lines
    .map(
      (l) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #DDD7C6">
          <strong style="color:#15150F">${l.name}</strong>${l.quantity > 1 ? ` × ${l.quantity}` : ''}<br>
          <span style="color:#52504A;font-size:13px">${day(l.startsOn)} → ${day(l.endsOn)} · ${l.days} day${l.days === 1 ? '' : 's'}</span>
        </td>
      </tr>`,
    )
    .join('')

  return sendEmail({
    to: params.email,
    subject: `Your gear is booked — ${params.bookingNumber}`,
    html: `<div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#FBF7EF;color:#15150F">
      <p style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#27481F;margin:0 0 8px">Held for you</p>
      <h1 style="font-size:26px;font-weight:400;margin:0 0 4px">Your gear is booked.</h1>
      <p style="font-size:22px;font-family:ui-monospace,monospace;margin:16px 0 24px">${params.bookingNumber}</p>

      <table style="width:100%;border-collapse:collapse;border-top:1px solid #DDD7C6">${rows}</table>

      <table style="width:100%;border-collapse:collapse;margin-top:20px;font-size:14px">
        <tr><td style="padding:4px 0;color:#52504A">Rental</td><td align="right">${money(params.rentAmount)}</td></tr>
        ${params.deliveryAmount > 0 ? `<tr><td style="padding:4px 0;color:#52504A">Delivery, both ways</td><td align="right">${money(params.deliveryAmount)}</td></tr>` : ''}
        <tr><td style="padding:4px 0;color:#52504A">GST</td><td align="right">${money(params.taxAmount)}</td></tr>
        <tr><td style="padding:8px 0;border-top:1px solid #DDD7C6"><strong>To pay</strong></td><td align="right" style="padding:8px 0;border-top:1px solid #DDD7C6"><strong>${money(params.totalAmount)}</strong></td></tr>
        <tr><td style="padding:4px 0;color:#52504A">Refundable deposit</td><td align="right">${money(params.depositAmount)}</td></tr>
      </table>

      <p style="margin-top:24px;font-size:14px;line-height:1.6;color:#52504A">
        ${
          params.fulfilment === 'ship'
            ? 'We pack it and post it to arrive on the first day of your booking. The return label is in the box.'
            : 'Collect from the Dehradun shop on the first day of your booking. Bring this number and some ID.'
        }
        ${
          params.fulfilment === 'ship'
            // Posted rentals are paid online BEFORE dispatch. Telling a posted
            // customer they pay "when you collect" describes a counter they
            // will never stand at, and it was sent to every one of them.
            ? 'We’ll send you a payment link before it goes out — the rental and the refundable deposit together.'
            : 'Nothing is charged now — you pay the rental and hand over the deposit when you collect.'
        }
        The deposit comes back when the gear does, less anything owed for a late return or damage, itemised.
      </p>
    </div>`,
  })
}
