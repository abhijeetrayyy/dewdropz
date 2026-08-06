import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { CheckCircle2, XCircle } from "lucide-react-native";
import { C, F } from "@/lib/theme";
import { haptics } from "@/lib/haptics";

type ToastVariant = "default" | "success" | "error";
type ToastItem = { id: number; message: string; variant: ToastVariant };

// Module-level dispatcher so `toast.show(...)` can be called from anywhere —
// event handlers, store actions, non-component code — without every call
// site needing to be inside a component that can reach the provider's
// context. The provider registers itself here on mount, same pattern
// libraries like `sonner` use under the hood.
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

  const show = useCallback((message: string, variant: ToastVariant = "default") => {
    const id = nextId.current++;
    setItems((cur) => [...cur, { id, message, variant }]);
    if (variant === "success") haptics.success();
    else if (variant === "error") haptics.error();
    else haptics.tap();
    setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), 2200);
  }, []);

  useEffect(() => {
    dispatch = show;
    return () => {
      dispatch = null;
    };
  }, [show]);

  return (
    <ToastContext.Provider value={null}>
      {children}
      <View pointerEvents="none" style={[s.stack, { top: insets.top + 8 }]}>
        {items.map((t) => (
          <Animated.View key={t.id} entering={FadeInDown.springify().damping(16)} exiting={FadeOutUp} style={s.toast}>
            {t.variant === "success" ? (
              <CheckCircle2 size={16} strokeWidth={2} color={C.sage} />
            ) : t.variant === "error" ? (
              <XCircle size={16} strokeWidth={2} color={C.clay} />
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
    gap: 8,
    backgroundColor: C.ink,
    borderWidth: 1,
    borderColor: C.paper + "1A",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    maxWidth: 420,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  text: { fontFamily: F.body, fontSize: 13, color: C.paper, flexShrink: 1 },
});
