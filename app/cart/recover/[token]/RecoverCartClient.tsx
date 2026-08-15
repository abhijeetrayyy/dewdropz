'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/providers/CartProvider'

type Line = { slug: string; name: string; price: number; image: string; size: string; quantity: number }

// Puts the saved cart back and gets out of the way. Runs once — a StrictMode
// double-invoke or a re-render must not double the quantities of a cart the
// customer is being handed back.
export default function RecoverCartClient({ lines }: { lines: Line[] }) {
  const router = useRouter()
  const { items, addItem } = useCart()
  const restored = useRef(false)

  useEffect(() => {
    if (restored.current) return
    restored.current = true

    for (const line of lines) {
      // Anything already in the local cart is left alone: the customer's
      // current session is more recent than the email, and silently topping up
      // a quantity they just set is the sort of thing nobody notices until they
      // have been charged for two.
      const present = items.some((i) => i.slug === line.slug && i.size === line.size)
      if (present) continue
      addItem(
        { slug: line.slug, name: line.name, price: line.price, image: line.image, size: line.size },
        line.quantity
      )
    }

    router.replace('/cart?recovered=1')
    // Restoring is a one-shot on mount; re-running as the cart fills would undo
    // the guard above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
      <p className="font-body text-sm text-mid">Restoring your cart…</p>
    </main>
  )
}
