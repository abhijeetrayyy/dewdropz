import { supabase } from "./supabase";
import { ENV } from "./env";
import { useCartStore, type CartItem } from "@/stores/cart";

/**
 * Hand the guest's pack to the account they just signed into.
 *
 * Checkout requires an account, so everybody meets the sign-in screen holding a
 * full pack. Before this, that pack lived only in this device's AsyncStorage
 * and reached the database once, at checkout — so it never followed the
 * account. Fill a pack on the phone, sign in on the website, and the website's
 * cart was empty.
 *
 * The merge rule lives on the server (`actions/cartAdoption.ts`) and is shared
 * with the web sign-in form, because two implementations of "what happens to my
 * cart when I sign in" would drift, and the drift would be somebody's order.
 * The union wins; identical lines add their quantities.
 *
 * FAILURE IS NOT FATAL. A network error here leaves the local pack exactly as
 * it was and checkout still syncs it, so the worst case is the behaviour we had
 * before this existed. Signing in must never cost somebody their cart.
 */
export async function adoptCartForSignedInUser(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return;

  // Rentals booked as a guest under this address become theirs. Runs whether or
  // not there is a local pack — the two are unrelated, and somebody who booked
  // gear on the website and then signs into the app should find it waiting.
  void claimGuestBookings(session.access_token);

  const local = useCartStore.getState().items;
  if (local.length === 0) return;

  try {
    const res = await fetch(`${ENV.apiUrl}/api/mobile/cart/adopt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        lines: local.map((i) => ({
          slug: i.slug,
          size: i.size,
          quantity: i.quantity,
          productId: i.productId,
          variantId: i.variantId ?? null,
          customDesignId: i.customDesignId,
        })),
      }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { items?: CartItem[] };
    // Adopt the merged cart wholesale, rather than keeping a second local copy
    // that starts diverging from the account the moment it is written.
    if (Array.isArray(data.items)) useCartStore.getState().replaceItems(data.items);
  } catch {
    // Keep the local pack and carry on.
  }
}

/** Best-effort, and never blocking a sign-in. */
async function claimGuestBookings(token: string): Promise<void> {
  try {
    await fetch(`${ENV.apiUrl}/api/mobile/rentals/claim`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // The lookup screen still finds it; nothing is lost by this failing.
  }
}
