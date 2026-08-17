'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/providers/CartProvider'
import { syncLocalCartToDbCart } from '@/actions/checkout'
import { createAddress } from '@/actions/addresses'
import { createOrder } from '@/actions/orders'
import { createRazorpayOrder } from '@/actions/payments'
import { previewCheckoutTotals } from '@/actions/promotions'
import { formatPrice } from '@/lib/utils'
import type { Address } from '@/types/database'

const RAZORPAY_SCRIPT_ID = 'razorpay-checkout-js'

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.getElementById(RAZORPAY_SCRIPT_ID)) return resolve(true)
    const script = document.createElement('script')
    script.id = RAZORPAY_SCRIPT_ID
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

const emptyAddressForm = {
  full_name: '', phone: '', address_line1: '', address_line2: '',
  city: '', state: '', postal_code: '', country: 'India',
}

export default function CheckoutClient({
  userId,
  email,
  initialAddresses,
}: {
  userId: string
  email: string
  initialAddresses: Address[]
}) {
  const router = useRouter()
  const { items, subtotal, clear } = useCart()

  const [addresses, setAddresses] = useState(initialAddresses)
  const [selectedAddressId, setSelectedAddressId] = useState(
    initialAddresses.find((a) => a.is_default)?.id ?? initialAddresses[0]?.id ?? ''
  )
  const [addingAddress, setAddingAddress] = useState(initialAddresses.length === 0)
  const [addressForm, setAddressForm] = useState(emptyAddressForm)
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'cod'>('razorpay')
  // Survives re-renders; reset after a successful order.
  const idempotencyKey = useRef<string | null>(null)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState('')
  // Automatic offers, resolved server-side against real product prices. Shown
  // before payment: a discount a customer only discovers on the confirmation
  // page is a discount they didn't get to decide with.
  const [quote, setQuote] = useState<{
    subtotal: number
    promotions: { label: string; amount: number; freeShipping: boolean }[]
    promoDiscount: number
    freeShipping: boolean
    couponDiscount: number
    couponError?: string
    totalDiscount: number
  }>({ subtotal: 0, promotions: [], promoDiscount: 0, freeShipping: false, couponDiscount: 0, totalDiscount: 0 })

  // The code that has actually been applied, separate from what is being typed —
  // otherwise every keystroke would re-price the cart.
  const [couponInput, setCouponInput] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState('')
  const [couponBusy, setCouponBusy] = useState(false)

  const cartKey = items.map((i) => `${i.slug}:${i.size}:${i.quantity}`).join('|')
  useEffect(() => {
    let cancelled = false
    previewCheckoutTotals(
      items.map((i) => ({ slug: i.slug, size: i.size, quantity: i.quantity, variantId: i.variantId ?? null })),
      appliedCoupon || undefined,
      userId
    )
      .then((r) => {
        if (cancelled) return
        setQuote(r)
        // A code that stops qualifying because the cart changed has to come off,
        // or the summary keeps promising a discount checkout will refuse.
        if (r.couponError && appliedCoupon) {
          setAppliedCoupon('')
          setError(r.couponError)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
    // Keyed on the cart's contents, not the array identity, so re-renders don't
    // re-query and a quantity change does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, appliedCoupon, userId])

  async function applyCoupon() {
    const code = couponInput.trim().toUpperCase()
    if (!code) return
    setCouponBusy(true)
    setError('')
    try {
      const r = await previewCheckoutTotals(
        items.map((i) => ({ slug: i.slug, size: i.size, quantity: i.quantity, variantId: i.variantId ?? null })),
        code,
        userId
      )
      if (r.couponError) { setError(r.couponError); return }
      setAppliedCoupon(code)
      setCouponInput('')
    } catch {
      setError('Could not check that code')
    } finally {
      setCouponBusy(false)
    }
  }

  async function handleSaveAddress() {
    setError('')
    const result = await createAddress({ ...addressForm, is_default: addresses.length === 0 })
    if ('error' in result) {
      setError(typeof result.error === 'string' ? result.error : 'Please check the address fields')
      return
    }
    if (result.address) {
      setAddresses((prev) => [...prev, result.address])
      setSelectedAddressId(result.address.id)
    }
    setAddingAddress(false)
    setAddressForm(emptyAddressForm)
  }

  async function placeOrder() {
    setError('')
    if (!selectedAddressId) { setError('Add a shipping address to continue'); return }
    if (items.length === 0) { setError('Your cart is empty'); return }

    setPlacing(true)
    try {
      const { skipped } = await syncLocalCartToDbCart(
        items.map((i) => ({
          slug: i.slug,
          size: i.size,
          quantity: i.quantity,
          productId: i.productId,
          variantId: i.variantId,
          customDesignId: i.customDesignId,
        })),
        userId
      )
      if (skipped.length === items.length) {
        setError('These items are no longer available. Please update your cart.')
        setPlacing(false)
        return
      }

      if (paymentMethod === 'cod') {
        // Minted once per attempt and held in a ref, so a double-clicked button
        // or a retry after a dropped response reuses it and gets the original
        // order back instead of placing a second one.
        if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID()
        const result = await createOrder({
          userId, email, shipping_address_id: selectedAddressId, payment_method: 'cod',
          coupon_code: appliedCoupon || undefined,
          idempotencyKey: idempotencyKey.current,
        })
        if ('error' in result) {
          setError(typeof result.error === 'string' ? result.error : 'Could not place order')
          setPlacing(false)
          return
        }
        idempotencyKey.current = null
        clear()
        router.push(`/account/orders/${result.orderId}?success=true`)
        return
      }

      // Same key discipline as the COD path. This one matters more: without it
      // a retried "pay" creates a second order and a second Razorpay intent, so
      // the customer can be charged twice for one basket.
      if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID()
      const rpResult = await createRazorpayOrder({
        userId, email, shipping_address_id: selectedAddressId,
        coupon_code: appliedCoupon || undefined,
        idempotencyKey: idempotencyKey.current,
      })
      if ('error' in rpResult) {
        setError(typeof rpResult.error === 'string' ? rpResult.error : 'Could not start payment')
        setPlacing(false)
        return
      }

      const scriptLoaded = await loadRazorpayScript()
      if (!scriptLoaded) {
        setError('Could not load the payment gateway. Check your connection and try again.')
        setPlacing(false)
        return
      }

      const razorpay = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? '',
        amount: rpResult.amount,
        currency: 'INR',
        name: 'DEWDROPZ',
        description: 'Trail-tested gear',
        order_id: rpResult.razorpayOrderId,
        prefill: { email },
        theme: { color: '#27481F' },
        handler: async (response) => {
          const verifyRes = await fetch('/api/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: rpResult.orderId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          }).then((r) => r.json())

          if (verifyRes.error) {
            setError('Payment could not be verified. If you were charged, contact support with your order number.')
            setPlacing(false)
            return
          }
          // The attempt is finished; a later checkout must mint a fresh key.
          idempotencyKey.current = null
          clear()
          router.push(`/account/orders/${rpResult.orderId}?success=true`)
        },
        modal: {
          ondismiss: () => setPlacing(false),
        },
      })
      razorpay.open()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
      setPlacing(false)
    }
  }

  if (items.length === 0) {
    return (
      <section className="bg-paper px-6 md:px-10 pt-40 pb-24 min-h-[50vh] flex items-center justify-center text-center">
        <div>
          <h1 className="font-display font-light text-3xl text-text">Your cart is empty.</h1>
          <p className="mt-3 font-body text-sm text-mid">Add something before checking out.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-paper px-6 md:px-10 pt-32 pb-24 md:pt-40 min-h-[70vh]">
      <div className="max-w-5xl mx-auto">
        <h1 className="font-display font-light text-[clamp(32px,5vw,48px)] text-text mb-10">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-8">
            <div>
              <h2 className="font-body text-[10px] tracking-[0.15em] text-text uppercase mb-4">Shipping Address</h2>

              {!addingAddress && addresses.length > 0 && (
                <div className="space-y-2">
                  {addresses.map((a) => (
                    <label
                      key={a.id}
                      className={`block border rounded-sm p-4 cursor-pointer transition-colors ${selectedAddressId === a.id ? 'border-forest bg-forest/5' : 'border-rule'}`}
                    >
                      <input
                        type="radio"
                        name="address"
                        className="hidden"
                        checked={selectedAddressId === a.id}
                        onChange={() => setSelectedAddressId(a.id)}
                      />
                      <div className="font-body text-sm text-text font-medium">{a.full_name}</div>
                      <div className="font-body text-xs text-mid mt-1">
                        {a.address_line1}{a.address_line2 ? `, ${a.address_line2}` : ''}, {a.city}, {a.state} {a.postal_code}
                      </div>
                      <div className="font-body text-xs text-mid mt-0.5">{a.phone}</div>
                    </label>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAddingAddress(true)}
                    className="font-body text-xs text-forest underline underline-offset-2 mt-2"
                  >
                    + Add a new address
                  </button>
                </div>
              )}

              {addingAddress && (
                <div className="border border-rule rounded-sm p-5 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input value={addressForm.full_name} onChange={(e) => setAddressForm({ ...addressForm, full_name: e.target.value })} placeholder="Full name" className="border border-rule rounded-sm px-3 py-2 text-sm font-body" />
                    <input value={addressForm.phone} onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })} placeholder="Phone" className="border border-rule rounded-sm px-3 py-2 text-sm font-body" />
                  </div>
                  <input value={addressForm.address_line1} onChange={(e) => setAddressForm({ ...addressForm, address_line1: e.target.value })} placeholder="Address line 1" className="w-full border border-rule rounded-sm px-3 py-2 text-sm font-body" />
                  <input value={addressForm.address_line2} onChange={(e) => setAddressForm({ ...addressForm, address_line2: e.target.value })} placeholder="Address line 2 (optional)" className="w-full border border-rule rounded-sm px-3 py-2 text-sm font-body" />
                  <div className="grid grid-cols-3 gap-3">
                    <input value={addressForm.city} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} placeholder="City" className="border border-rule rounded-sm px-3 py-2 text-sm font-body" />
                    <input value={addressForm.state} onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })} placeholder="State" className="border border-rule rounded-sm px-3 py-2 text-sm font-body" />
                    <input value={addressForm.postal_code} onChange={(e) => setAddressForm({ ...addressForm, postal_code: e.target.value })} placeholder="Pincode" className="border border-rule rounded-sm px-3 py-2 text-sm font-body" />
                  </div>
                  <div className="flex gap-3 pt-1">
                    {addresses.length > 0 && (
                      <button type="button" onClick={() => setAddingAddress(false)} className="font-body text-xs text-mid underline underline-offset-2">
                        Cancel
                      </button>
                    )}
                    <button type="button" onClick={handleSaveAddress} className="font-body text-xs text-forest underline underline-offset-2">
                      Save address
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <h2 className="font-body text-[10px] tracking-[0.15em] text-text uppercase mb-4">Payment Method</h2>
              <div className="flex gap-3">
                {(['razorpay', 'cod'] as const).map((method) => (
                  <label
                    key={method}
                    className={`flex-1 border rounded-sm p-4 cursor-pointer text-center transition-colors ${paymentMethod === method ? 'border-forest bg-forest/5' : 'border-rule'}`}
                  >
                    <input type="radio" name="payment" className="hidden" checked={paymentMethod === method} onChange={() => setPaymentMethod(method)} />
                    <span className="font-body text-sm text-text">{method === 'razorpay' ? 'Card / UPI / Netbanking' : 'Cash on Delivery'}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="border border-rule rounded-lg p-6 sticky top-28">
              <h2 className="font-body text-[10px] tracking-[0.15em] text-text uppercase mb-4">Order Summary</h2>
              {items.map((item) => (
                <div key={`${item.slug}-${item.size}`} className="flex items-center justify-between font-body text-sm text-mid py-2">
                  <span className="truncate pr-2">{item.name} × {item.quantity}</span>
                  <span className="text-text tabular-nums shrink-0">{formatPrice(item.price * item.quantity)}</span>
                </div>
              ))}
              {quote.promotions.map((p) => (
                <div key={p.label} className="flex items-center justify-between font-body text-sm py-2 text-forest">
                  <span className="truncate pr-2">{p.label}</span>
                  <span className="tabular-nums shrink-0">{p.freeShipping ? 'Free shipping' : `−${formatPrice(p.amount)}`}</span>
                </div>
              ))}

              {quote.couponDiscount > 0 && (
                <div className="flex items-center justify-between font-body text-sm py-2 text-forest">
                  <span className="truncate pr-2">Coupon {appliedCoupon}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="tabular-nums">−{formatPrice(quote.couponDiscount)}</span>
                    <button
                      type="button"
                      onClick={() => setAppliedCoupon('')}
                      className="text-mid hover:text-text"
                      aria-label={`Remove coupon ${appliedCoupon}`}
                    >
                      ×
                    </button>
                  </span>
                </div>
              )}

              {!appliedCoupon && (
                <div className="flex gap-2 py-3 border-t border-rule mt-2">
                  <input
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon() } }}
                    placeholder="Coupon code"
                    aria-label="Coupon code"
                    className="flex-1 min-w-0 border border-rule rounded-sm px-3 py-2 font-body text-sm uppercase tracking-wide placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:border-forest"
                  />
                  <button
                    type="button"
                    onClick={applyCoupon}
                    disabled={couponBusy || !couponInput.trim()}
                    className="px-4 py-2 border border-forest text-forest font-body text-[10px] tracking-[0.12em] uppercase rounded-sm disabled:opacity-40 hover:bg-forest hover:text-paper transition-colors"
                  >
                    {couponBusy ? '…' : 'Apply'}
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between font-body text-sm text-mid py-2 border-t border-rule">
                <span>Shipping &amp; tax</span>
                <span className="text-mid">{quote.freeShipping ? 'Shipping free · tax at checkout' : 'Calculated after address'}</span>
              </div>
              <div className="flex items-center justify-between font-body text-base font-medium py-4">
                <span className="text-text">Subtotal</span>
                <span className="text-forest tabular-nums">{formatPrice(Math.max(0, subtotal - quote.totalDiscount))}</span>
              </div>

              {error && <p className="text-clay text-xs font-body mb-3">{error}</p>}

              <button
                type="button"
                onClick={placeOrder}
                disabled={placing}
                className="w-full bg-forest text-paper px-6 py-3.5 text-[10px] tracking-[0.12em] uppercase font-body font-medium rounded-sm hover:bg-forest-mid transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {placing ? 'Placing Order...' : 'Place Order'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
