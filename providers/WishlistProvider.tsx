'use client'

import { createContext, useContext, useState, useEffect } from 'react'

type WishlistContextType = {
  items: string[]
  toggleItem: (slug: string) => void
  hasItem: (slug: string) => boolean
}

const WishlistContext = createContext<WishlistContextType | null>(null)

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<string[]>([])

  useEffect(() => {
    const stored = localStorage.getItem('dewdropz_wishlist')
    if (stored) {
      try {
        setItems(JSON.parse(stored))
      } catch (e) {}
    }
  }, [])

  const toggleItem = (slug: string) => {
    setItems((prev) => {
      const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
      localStorage.setItem('dewdropz_wishlist', JSON.stringify(next))
      return next
    })
  }

  const hasItem = (slug: string) => items.includes(slug)

  return (
    <WishlistContext.Provider value={{ items, toggleItem, hasItem }}>
      {children}
    </WishlistContext.Provider>
  )
}

export function useWishlist() {
  const context = useContext(WishlistContext)
  if (!context) throw new Error('useWishlist must be used within WishlistProvider')
  return context
}
