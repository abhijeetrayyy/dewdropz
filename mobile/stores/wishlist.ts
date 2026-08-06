import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

type WishlistStore = {
  slugs: string[];
  toggle: (slug: string) => void;
  has: (slug: string) => boolean;
  count: () => number;
};

// Persisted the same way the web app's WishlistProvider persists to
// localStorage — the mobile equivalent (AsyncStorage) so saved items survive
// an app relaunch instead of resetting to empty every cold start.
export const useWishlistStore = create<WishlistStore>()(
  persist(
    (set, get) => ({
      slugs: [],

      toggle: (slug) =>
        set((state) => ({
          slugs: state.slugs.includes(slug)
            ? state.slugs.filter((s) => s !== slug)
            : [...state.slugs, slug],
        })),

      has: (slug) => get().slugs.includes(slug),

      count: () => get().slugs.length,
    }),
    {
      name: "dewdropz-wishlist",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ slugs: state.slugs }),
    },
  ),
);
