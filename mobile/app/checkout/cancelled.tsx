import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { C } from "@/lib/theme";

// Where the payment sheet lands when somebody closes it.
//
// ⚠ UNVERIFIED — see app/api/mobile/orders/razorpay/route.ts.
//
// The order EXISTS and is unpaid, and the cart is deliberately still full: a
// customer who dismissed the sheet by accident should be able to press Pay
// again rather than rebuild what they had. Nothing is cancelled here — the
// order stays payable, and an abandoned one is a business decision (a recovery
// email, a sweep) rather than something a closed browser tab should trigger.
//
// A screen only so the deep link has somewhere to land; it bounces straight
// back to checkout.
export default function PaymentCancelledScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();

  useEffect(() => {
    void orderId;
    router.replace("/checkout");
  }, [orderId]);

  return <View style={{ flex: 1, backgroundColor: C.paper }} />;
}
