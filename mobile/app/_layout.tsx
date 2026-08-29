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
  useFonts as useFraunces,
  Fraunces_300Light,
  Fraunces_300Light_Italic,
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
} from "@expo-google-fonts/fraunces";
import {
  useFonts as useArchivo,
  Archivo_400Regular,
  Archivo_400Regular_Italic,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
} from "@expo-google-fonts/archivo";
import {
  useFonts as useSpaceMono,
  SpaceMono_400Regular,
  SpaceMono_700Bold,
} from "@expo-google-fonts/space-mono";
// Inter is still loaded, but ONLY as the "Sans" option a shopper can apply to
// their own artwork in the customize studio's print canvas (StudioToolbar's
// FONTS list) — that is user-authored garment content, deliberately not tied
// to the brand system. It is not used for any app chrome.
import { useFonts as useInter, Inter_400Regular } from "@expo-google-fonts/inter";
import { useAuthStore } from "@/stores/auth";
import { ToastProvider } from "@/components/ui/Toast";
import { AppSplash } from "@/components/AppSplash";
import { C } from "@/lib/theme";

/**
 * What sits BEHIND a screen opened from a link.
 *
 * Cold-starting on a deep link (or a notification) builds a stack containing
 * exactly one route. Android's system back then has nothing to pop, so it
 * closes the app, and React Navigation refuses the header's back with
 * "The action 'GO_BACK' was not handled by any navigator".
 *
 * Naming the tabs as the anchor makes expo-router put them underneath any
 * deep-linked route, so back goes home instead of quitting. `anchor` is what
 * SDK 57 reads first — it still honours the older `initialRouteName`, per
 * getRoutesCore.js — and `lib/nav.ts` covers the remaining case this cannot:
 * a screen reached by `router.replace()`, which leaves no history either.
 */
export const unstable_settings = { anchor: "(tabs)" };


SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});


export default function RootLayout() {
  const [frauncesLoaded] = useFraunces({
    Fraunces_300Light,
    Fraunces_300Light_Italic,
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
  });
  const [archivoLoaded] = useArchivo({
    Archivo_400Regular,
    Archivo_400Regular_Italic,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
  });
  const [monoLoaded] = useSpaceMono({ SpaceMono_400Regular, SpaceMono_700Bold });
  const [interLoaded] = useInter({ Inter_400Regular });
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

  const fontsReady = frauncesLoaded && archivoLoaded && monoLoaded && interLoaded && iconFontsLoaded;
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
                {/* The product taxonomy, reachable from the shop's category
                    rail. Categories have existed since migration 004 and had
                    no route on mobile at all. */}
                <Stack.Screen name="category/[slug]" options={{ headerShown: false }} />
                {/* Long-form content — previously web-only, so the app had no
                    editorial surface at all. */}
                <Stack.Screen name="journal/index" options={{ headerShown: false }} />
                <Stack.Screen name="journal/[id]" options={{ headerShown: false }} />
                <Stack.Screen name="trails/index" options={{ headerShown: false }} />
                <Stack.Screen name="trails/[slug]" options={{ headerShown: false }} />
                <Stack.Screen name="about" options={{ headerShown: false }} />
                <Stack.Screen name="sustainability" options={{ headerShown: false }} />
                <Stack.Screen name="checkout/index" options={{ headerShown: false, presentation: "modal" }} />
                <Stack.Screen name="checkout/success" options={{ headerShown: false, gestureEnabled: false }} />
                <Stack.Screen name="checkout/cancelled" options={{ headerShown: false }} />
                <Stack.Screen name="orders/index" options={{ headerShown: false }} />
                <Stack.Screen name="orders/[id]/index" options={{ headerShown: false }} />
                <Stack.Screen name="orders/[id]/return" options={{ headerShown: false }} />
                <Stack.Screen name="saved" options={{ headerShown: false }} />
                {/* Every screen in this app draws its own header, so a route
                    missing from this list gets expo-router's default bar
                    stacked on top of one — which is exactly what /rent did
                    until these four lines existed. */}
                <Stack.Screen name="rent/[slug]" options={{ headerShown: false }} />
                {/* The confirmation is reached with `router.replace`, so there is
                    nothing behind it. Locking the gesture as well left no way off
                    the screen but its own buttons — `lib/nav.ts` sends its back
                    control to the locker instead, so the gesture can stay. */}
                <Stack.Screen name="rent/booked/[number]" options={{ headerShown: false }} />
                <Stack.Screen name="rent/bookings" options={{ headerShown: false }} />
                {/* Every screen in this app draws its own header. A route that
                    is not declared here inherits the native one and appears
                    with two stacked headers. */}
                <Stack.Screen name="addresses" options={{ headerShown: false }} />
                <Stack.Screen name="designs" options={{ headerShown: false }} />
                <Stack.Screen name="search" options={{ headerShown: false, presentation: "modal" }} />
                <Stack.Screen name="notifications" options={{ headerShown: false }} />
                <Stack.Screen name="settings" options={{ headerShown: false }} />
                <Stack.Screen name="auth/login" options={{ headerShown: false }} />
                <Stack.Screen name="auth/signup" options={{ headerShown: false }} />
                {/* The studio builds its own ink panel like every other screen — it was
                    the last route still using React Navigation's bar. */}
                <Stack.Screen name="customize/[slug]" options={{ headerShown: false }} />
              </Stack>
              {showSplash && <AppSplash />}
            </ToastProvider>
          </BottomSheetModalProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
