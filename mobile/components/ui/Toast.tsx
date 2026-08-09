import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInUp, FadeOutDown } from "react-native-reanimated";
import { C, F, R } from "@/lib/theme";
import { haptics } from "@/lib/haptics";
import { Icon } from "./Icon";

// Module-level dispatcher so `toast.show(...)` works from anywhere — event
// handlers, store actions, non-component code — without every call site
// needing to sit under the provider's context. The provider registers itself
// here on mount; same pattern `sonner` uses.
type ToastVariant = "default" | "success" | "error";
type ToastItem = { id: number; message: string; variant: ToastVariant };

let dispatch: ((message: string, variant?: ToastVariant) => void) | null = null;

export const toast = {
  show: (message: string, variant: ToastVariant = "default") => dispatch?.(message, variant),
  success: (message: string) => dispatch?.(message, "success"),
  error: (message: string) => dispatch?.(message, "error"),
};

const ToastContext = createContext(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const insets = useSafeAreaInsets();
  const nextId = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const show = useCallback((message: string, variant: ToastVariant = "default") => {
    const id = nextId.current++;
    setItems((cur) => [...cur, { id, message, variant }]);
    if (variant === "success") haptics.success();
    else if (variant === "error") haptics.error();
    else haptics.tap();
    const timer = setTimeout(() => {
      setItems((cur) => cur.filter((t) => t.id !== id));
      timers.current.delete(id);
    }, 2400);
    timers.current.set(id, timer);
  }, []);

  useEffect(() => {
    dispatch = show;
    return () => {
      dispatch = null;
    };
  }, [show]);

  // Toasts fire from anywhere, including screens that unmount immediately
  // after (e.g. "Order placed" then a replace()). Without this, those pending
  // timers keep a setState alive against a torn-down provider.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={null}>
      {children}
      {/* Bottom-anchored: a toast confirming "added to pack" belongs near the
          thumb and the action that caused it, not up by the status bar where
          v4 put it (and where it collided with every screen's header). */}
      <View pointerEvents="none" style={[s.stack, { bottom: insets.bottom + 92 }]}>
        {items.map((t) => (
          <Animated.View key={t.id} entering={FadeInUp.springify().damping(17)} exiting={FadeOutDown.duration(180)} style={s.toast}>
            {t.variant === "success" ? (
              <Icon name="check_circle" size={16} color={C.forest12} filled />
            ) : t.variant === "error" ? (
              <Icon name="error" size={16} color={C.clay} filled />
            ) : null}
            <Text style={s.text} numberOfLines={2}>
              {t.message}
            </Text>
          </Animated.View>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  useContext(ToastContext);
  return toast;
}

const s = StyleSheet.create({
  stack: { position: "absolute", left: 16, right: 16, zIndex: 999, gap: 8, alignItems: "center" },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: C.ink,
    borderRadius: R.pill,
    paddingVertical: 13,
    paddingHorizontal: 20,
    maxWidth: 420,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
  text: { fontFamily: F.bodySemiBold, fontSize: 14, color: C.paper, flexShrink: 1, letterSpacing: -0.1 },
});
