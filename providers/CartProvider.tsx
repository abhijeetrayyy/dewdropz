'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export interface CartLine {
  slug: string
  name: string
  price: number
  image: string
  size: string
  quantity: number
  // Only set for a customized item — real product/variant identity (no
  // fuzzy matching needed at checkout) and the design it's carrying. Every
  // customized line is distinct, even if it shares a slug+size with another.
  productId?: string
  variantId?: string | null
  customDesignId?: string
}

function sameLine(l: CartLine, slug: string, size: string, customDesignId?: string) {
  return customDesignId ? l.customDesignId === customDesignId : l.slug === slug && l.size === size && !l.customDesignId
}

interface CartContextValue {
  items: CartLine[]
  addItem: (item: Omit<CartLine, 'quantity'>, quantity?: number) => void
  updateQuantity: (slug: string, size: string, quantity: number, customDesignId?: string) => void
  removeItem: (slug: string, size: string, customDesignId?: string) => void
  clear: () => void
  count: number
  subtotal: number
}

const CartContext = createContext<CartContextValue | null>(null)
const STORAGE_KEY = 'dewdropz_cart'

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) setItems(JSON.parse(raw))
    } catch {
      // ignore malformed local storage
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items, hydrated])

  const addItem: CartContextValue['addItem'] = (item, quantity = 1) => {
    setItems((prev) => {
      // A customized design is never merged into an existing line — it's
      // always its own new entry, even if the same product/size is already
      // in the cart (as a plain item or a different design).
      if (item.customDesignId) {
        return [...prev, { ...item, quantity }]
      }
      const existing = prev.find((l) => sameLine(l, item.slug, item.size))
      if (existing) {
        return prev.map((l) => (sameLine(l, item.slug, item.size) ? { ...l, quantity: l.quantity + quantity } : l))
      }
      return [...prev, { ...item, quantity }]
    })
  }

  const updateQuantity: CartContextValue['updateQuantity'] = (slug, size, quantity, customDesignId) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((l) => !sameLine(l, slug, size, customDesignId))
        : prev.map((l) => (sameLine(l, slug, size, customDesignId) ? { ...l, quantity } : l))
    )
  }

  const removeItem: CartContextValue['removeItem'] = (slug, size, customDesignId) => {
    setItems((prev) => prev.filter((l) => !sameLine(l, slug, size, customDesignId)))
  }

  const clear = () => setItems([])

  const { count, subtotal } = useMemo(
    () => ({
      count: items.reduce((sum, l) => sum + l.quantity, 0),
      subtotal: items.reduce((sum, l) => sum + l.quantity * l.price, 0),
    }),
    [items]
  )

  return (
    <CartContext.Provider value={{ items, addItem, updateQuantity, removeItem, clear, count, subtotal }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
