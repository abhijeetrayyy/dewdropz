'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export interface CartLine {
  slug: string
  name: string
  price: number
  gradient: string
  size: string
  quantity: number
}

interface CartContextValue {
  items: CartLine[]
  addItem: (item: Omit<CartLine, 'quantity'>, quantity?: number) => void
  updateQuantity: (slug: string, size: string, quantity: number) => void
  removeItem: (slug: string, size: string) => void
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
      const existing = prev.find((l) => l.slug === item.slug && l.size === item.size)
      if (existing) {
        return prev.map((l) =>
          l.slug === item.slug && l.size === item.size ? { ...l, quantity: l.quantity + quantity } : l
        )
      }
      return [...prev, { ...item, quantity }]
    })
  }

  const updateQuantity: CartContextValue['updateQuantity'] = (slug, size, quantity) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((l) => !(l.slug === slug && l.size === size))
        : prev.map((l) => (l.slug === slug && l.size === size ? { ...l, quantity } : l))
    )
  }

  const removeItem: CartContextValue['removeItem'] = (slug, size) => {
    setItems((prev) => prev.filter((l) => !(l.slug === slug && l.size === size)))
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
