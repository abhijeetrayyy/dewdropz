import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import * as Font from "expo-font";
import {
  useFonts as useBricolage,
  BricolageGrotesque_500Medium,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from "@expo-google-fonts/bricolage-grotesque";
import {
  useFonts as useArchivo,
  Archivo_400Regular,
  Archivo_400Regular_Italic,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
} from "@expo-google-fonts/archivo";
import {
  useFonts as useInstrumentSerif,
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from "@expo-google-fonts/instrument-serif";
import {
  useFonts as useSpaceMono,
  SpaceMono_400Regular,
  SpaceMono_700Bold,
} from "@expo-google-fonts/space-mono";
import { useAuthStore } from "@/stores/auth";
import { ToastProvider } from "@/components/ui/Toast";
import { AppSplash } from "@/components/AppSplash";
import { C, F } from "@/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const stackScreenHeader = {
  headerStyle: { backgroundColor: C.paper },
  headerTintColor: C.ink,
  headerTitleStyle: { fontFamily: F.bodyBold, fontSize: 16, color: C.ink },
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
  const [bricolageLoaded] = useBricolage({
    BricolageGrotesque_500Medium,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });
  const [archivoLoaded] = useArchivo({
    Archivo_400Regular,
    Archivo_400Regular_Italic,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
  });
  const [serifLoaded] = useInstrumentSerif({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
  });
  const [monoLoaded] = useSpaceMono({ SpaceMono_400Regular, SpaceMono_700Bold });
  // The two Material Symbols Rounded cuts (FILL 0 / FILL 1) aren't Google-Fonts
  // packages — they're pre-instanced static TTFs pulled directly from the
  // fonts.gstatic.com CSS endpoint (see components/ui/Icon.tsx for why: RN
  // can't animate a variable font's FILL axis, so the "on" state is a font
  // swap between two static cuts instead).
  const [iconFontsLoaded, setIconFontsLoaded] = useState(false);
  useEffect(() => {
    Font.loadAsync({
      MaterialSymbolsRounded: require("../assets/fonts/MaterialSymbolsRounded.ttf"),
      MaterialSymbolsRoundedFill: require("../assets/fonts/MaterialSymbolsRoundedFill.ttf"),
    })
      .then(() => setIconFontsLoaded(true))
      .catch(() => setIconFontsLoaded(true));
  }, []);
  const initialize = useAuthStore((s) => s.initialize);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    initialize().finally(() => setAuthReady(true));
  }, [initialize]);

  const fontsReady = bricolageLoaded && archivoLoaded && serifLoaded && monoLoaded && iconFontsLoaded;
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

  // Screen 01 "Splash" holds under 1.2s "only while fonts and the cart
  // hydrate, then pushes forward on its own" — `ready` already tracks the
  // fonts/auth hydration; this just keeps the JS AppSplash mounted for one
  // more beat so it isn't a single-frame flash once everything resolves fast.
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setShowSplash(false), 550);
    return () => clearTimeout(t);
  }, [ready]);

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
                {/* Every in-scope screen below builds its own in-content header
                    (frosted circular back button, large title) per the design —
                    the native React Navigation header is switched off rather
                    than styled. */}
                <Stack.Screen name="product/[slug]" options={{ headerShown: false }} />
                <Stack.Screen name="collections/index" options={{ headerShown: false }} />
                <Stack.Screen name="collections/[slug]" options={{ headerShown: false }} />
                {/* Long-form content — previously web-only, so the app had no
                    editorial surface at all. */}
                <Stack.Screen name="journal/index" options={{ headerShown: false }} />
                <Stack.Screen name="journal/[id]" options={{ headerShown: false }} />
                <Stack.Screen name="about" options={{ headerShown: false }} />
                <Stack.Screen name="sustainability" options={{ headerShown: false }} />
                <Stack.Screen name="checkout/index" options={{ headerShown: false, presentation: "modal" }} />
                <Stack.Screen name="checkout/success" options={{ headerShown: false, gestureEnabled: false }} />
                <Stack.Screen name="orders/index" options={{ headerShown: false }} />
                <Stack.Screen name="orders/[id]" options={{ headerShown: false }} />
                <Stack.Screen name="saved" options={{ headerShown: false }} />
                <Stack.Screen name="search" options={{ headerShown: false, presentation: "modal" }} />
                <Stack.Screen name="notifications" options={{ headerShown: false }} />
                <Stack.Screen name="settings" options={{ headerShown: false }} />
                <Stack.Screen name="auth/login" options={{ headerShown: false }} />
                <Stack.Screen name="auth/signup" options={{ headerShown: false }} />
                <Stack.Screen name="customize/[slug]" options={{ ...stackScreenHeader, title: "Customize" }} />
              </Stack>
              {showSplash && <AppSplash />}
            </ToastProvider>
          </BottomSheetModalProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
