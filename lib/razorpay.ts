import crypto from 'crypto'

/**
 * Razorpay's REST API, with the response actually checked.
 *
 * Lifted out of `lib/orders-internal.ts` unchanged, because rentals now take
 * payments too and the alternative was a second copy. A second copy of a
 * gateway client is how one of them ends up with the error handling and the
 * other does not — and this one carries a lesson worth keeping: every call used
 * to be `.then(r => r.json())`, so a 404 or a 401 parsed happily into an object
 * with no `items`, which then read as "no captured payment" and let the caller
 * report success.
 */
export async function razorpayCall(
  path: string,
  init?: { method?: string; body?: string },
): Promise<{ body: Record<string, unknown> } | { error: string }> {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) {
    return { error: 'Razorpay credentials are not configured on this deployment' }
  }
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: init?.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
    body: init?.body,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const described = (body as { error?: { description?: string } }).error?.description
    return { error: `Razorpay ${res.status}: ${described ?? res.statusText}` }
  }
  return { body: body as Record<string, unknown> }
}

/**
 * Does this signature actually belong to this order and payment?
 *
 * Constant-time, and length-checked first — `crypto.timingSafeEqual` throws on
 * a length mismatch rather than returning false, so an attacker sending a short
 * signature would get a 500 instead of a rejection, which is both a worse
 * experience and a side channel.
 */
export function razorpaySignatureValid(input: {
  gatewayOrderId: string
  gatewayPaymentId: string
  signature: string
}): boolean {
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keySecret) return false

  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${input.gatewayOrderId}|${input.gatewayPaymentId}`)
    .digest('hex')

  if (input.signature.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(input.signature), Buffer.from(expected))
}

/** Create an order at the gateway. Amount is paise, like everything else. */
export async function createGatewayOrder(input: {
  amount: number
  receipt: string
  notes?: Record<string, string>
}): Promise<{ id: string; amount: number } | { error: string }> {
  const res = await razorpayCall('/orders', {
    method: 'POST',
    body: JSON.stringify({
      amount: input.amount,
      currency: 'INR',
      receipt: input.receipt.slice(0, 40), // Razorpay caps the receipt field
      notes: input.notes ?? {},
    }),
  })
  if ('error' in res) return res

  const id = typeof res.body.id === 'string' ? res.body.id : null
  if (!id) return { error: 'Razorpay accepted the order but returned no id' }
  return { id, amount: Number(res.body.amount ?? input.amount) }
}

/** Reverse a captured payment, in whole or in part. */
export async function refundGatewayPayment(
  paymentId: string,
  amount: number,
): Promise<{ refundId: string } | { error: string }> {
  if (amount <= 0) return { error: 'A refund of nothing is not a refund' }

  const res = await razorpayCall(`/payments/${paymentId}/refund`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  })
  if ('error' in res) return res

  const refundId = typeof res.body.id === 'string' ? res.body.id : null
  if (!refundId) return { error: 'Razorpay accepted the refund but returned no refund id' }
  return { refundId }
}
