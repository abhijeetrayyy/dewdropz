import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { ENV } from "@/lib/env";
import type { Session, User } from "@supabase/supabase-js";

type AuthStore = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  initialized: boolean;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ error?: string }>;
  /** Sends the password-reset email. The app had no recovery path at all. */
  resetPassword: (email: string) => Promise<{ error?: string }>;
  /** Irreversible. Deletes the account server-side, then clears the session. */
  deleteAccount: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  session: null,
  user: null,
  isLoading: true,
  initialized: false,

  // `initialized` guards against subscribing to onAuthStateChange twice —
  // the root layout can legitimately re-run this on a fast-refresh/remount,
  // and the previous version never captured (or tore down) the subscription
  // handle at all.
  initialize: async () => {
    if (get().initialized) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    set({
      session,
      user: session?.user ?? null,
      isLoading: false,
      initialized: true,
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
    });
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { error: error.message };
    return {};
  },

  signUp: async (email, password, fullName) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) return { error: error.message };
    return {};
  },

  // Deliberately redirects to the WEB app's reset page rather than a deep link
  // back into the app: the recovery link is opened from a mail client, often
  // on a different device from the one that's locked out, and a browser page
  // works everywhere an app-scheme link does not.
  resetPassword: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${ENV.siteUrl}/auth/reset-password`,
    });
    if (error) return { error: error.message };
    return {};
  },

  /**
   * Delete this account for real, then sign out.
   *
   * The app used to raise a support email under a "Delete account" label — the
   * customer was told their data was gone when nothing had been deleted, and
   * Apple 5.1.1(v) requires deletion to actually happen in the app. The server
   * verifies the session token and deletes only that token's own user; see
   * app/api/mobile/account/route.ts for what survives (orders do, by schema).
   */
  deleteAccount: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { error: "Your session expired. Please sign in again." };

    try {
      const res = await fetch(`${ENV.apiUrl}/api/mobile/account`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return { error: typeof data?.error === "string" ? data.error : "Could not delete your account." };
      }
    } catch {
      return { error: "Could not reach us just now. Check your connection and try again." };
    }

    // The account is gone; the local session is now a token for a user that
    // does not exist. Clearing it is not optional cleanup.
    await supabase.auth.signOut();
    set({ user: null, session: null });
    return {};
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null });
  },
}));
