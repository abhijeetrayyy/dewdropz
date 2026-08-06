import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts as useFraunces,
  Fraunces_300Light,
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_600SemiBold,
} from "@expo-google-fonts/fraunces";
import {
  useFonts as useInter,
  Inter_400Regular,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import {
  useFonts as useSpaceMono,
  SpaceMono_400Regular,
  SpaceMono_700Bold,
} from "@expo-google-fonts/space-mono";
import { useAuthStore } from "@/stores/auth";
import { ToastProvider } from "@/components/ui/Toast";
import { C, F } from "@/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const stackScreenHeader = {
  headerStyle: { backgroundColor: C.paper },
  headerTintColor: C.text,
  headerTitleStyle: { fontFamily: F.display, fontSize: 16, color: C.text },
  // `headerBackTitleVisible: false` is the old React Navigation v6 prop and
  // is a no-op on the v7 stack this project runs — it was silently falling
  // back to the previous route's raw segment name as the back-button label,
  // which is how "(tabs)" (the route group's literal folder name) ended up
  // rendered as visible UI text next to the back chevron.
  headerBackButtonDisplayMode: "minimal" as const,
  headerBackTitle: "",
  headerShadowVisible: false,
};

export default function RootLayout() {
  const [frauncesLoaded] = useFraunces({
    Fraunces_300Light,
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_600SemiBold,
  });
  const [interLoaded] = useInter({ Inter_400Regular, Inter_600SemiBold });
  const [monoLoaded] = useSpaceMono({ SpaceMono_400Regular, SpaceMono_700Bold });
  const initialize = useAuthStore((s) => s.initialize);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    initialize().finally(() => setAuthReady(true));
  }, [initialize]);

  const fontsReady = frauncesLoaded && interLoaded && monoLoaded;
  const ready = fontsReady && authReady;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Fonts failing to resolve used to leave the native splash screen up
  // forever with no fallback — cap the wait at 4s and render anyway rather
  // than stranding the user on a blank/splash screen indefinitely.
  useEffect(() => {
    const t = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 4000);
    return () => clearTimeout(t);
  }, []);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <BottomSheetModalProvider>
            <ToastProvider>
              {/* Default: dark icons for the cream/paper screens (tabs, checkout,
                  orders). The full-bleed dark-hero screens (product, collections,
                  auth) mount their own light-icon override locally. */}
              <StatusBar style="dark" />
              <Stack screenOptions={{ contentStyle: { backgroundColor: C.paper } }}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="product/[slug]" options={{ headerTransparent: true, headerTintColor: "#FFFFFF", headerTitle: "", headerBackButtonDisplayMode: "minimal", headerBackTitle: "" }} />
                <Stack.Screen name="collections/[slug]" options={{ headerTransparent: true, headerTintColor: "#FFFFFF", headerTitle: "", headerBackButtonDisplayMode: "minimal", headerBackTitle: "" }} />
                <Stack.Screen name="checkout" options={{ ...stackScreenHeader, title: "Checkout", presentation: "modal" }} />
                <Stack.Screen name="orders/index" options={{ ...stackScreenHeader, title: "Orders" }} />
                <Stack.Screen name="orders/[id]" options={{ ...stackScreenHeader, title: "" }} />
                <Stack.Screen name="auth/login" options={{ headerTransparent: true, headerTintColor: "#FFFFFF", headerTitle: "", headerBackButtonDisplayMode: "minimal", headerBackTitle: "" }} />
                <Stack.Screen name="auth/signup" options={{ headerTransparent: true, headerTintColor: "#FFFFFF", headerTitle: "", headerBackButtonDisplayMode: "minimal", headerBackTitle: "" }} />
              </Stack>
            </ToastProvider>
          </BottomSheetModalProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
