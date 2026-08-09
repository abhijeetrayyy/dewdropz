import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

type CartItem = {
  productId: string;
  slug: string;
  name: string;
  price: number;
  image: string;
  size?: string;
  quantity: number;
  // Set only for lines designed in the studio. Two different designs of the
  // same product and size are genuinely different products to fulfil, so this
  // participates in the dedupe key rather than merging them into one line.
  customDesignId?: string;
  colorName?: string;
  variantId?: string | null;
};

// Identity of a cart line. Plain items still collapse by product+size exactly
// as before; customized ones only ever merge with themselves.
function sameLine(a: CartItem, b: { productId: string; size?: string; customDesignId?: string }) {
  return (
    a.productId === b.productId &&
    a.size === b.size &&
    (a.customDesignId ?? null) === (b.customDesignId ?? null)
  );
}

type CartStore = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (productId: string, size?: string, customDesignId?: string) => void;
  updateQuantity: (productId: string, quantity: number, size?: string, customDesignId?: string) => void;
  clearCart: () => void;
  itemCount: () => number;
  subtotal: () => number;
};

// Persisted the same way the web app's CartProvider persists to localStorage —
// the mobile equivalent (AsyncStorage) so a cart survives an app relaunch
// instead of resetting to empty every cold start.
export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item, quantity = 1) =>
        set((state) => {
          const existing = state.items.find((i) => sameLine(i, item));
          if (existing) {
            return {
              items: state.items.map((i) =>
                sameLine(i, item) ? { ...i, quantity: i.quantity + quantity } : i,
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity }] };
        }),

      removeItem: (productId, size, customDesignId) =>
        set((state) => ({
          items: state.items.filter(
            (i) => !sameLine(i, { productId, size, customDesignId }),
          ),
        })),

      updateQuantity: (productId, quantity, size, customDesignId) =>
        set((state) => {
          const target = { productId, size, customDesignId };
          if (quantity <= 0) {
            return { items: state.items.filter((i) => !sameLine(i, target)) };
          }
          return {
            items: state.items.map((i) =>
              sameLine(i, target) ? { ...i, quantity } : i,
            ),
          };
        }),

      clearCart: () => set({ items: [] }),

      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      subtotal: () =>
        get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    {
      name: "dewdropz-cart",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
