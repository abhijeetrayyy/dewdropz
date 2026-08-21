import Constants from "expo-constants";
import { Platform } from "react-native";

// app.json's `extra` block is the single source of truth for which Supabase
// project this app talks to — no hardcoded fallback here on purpose. A second,
// silently-different fallback project was exactly how this app ended up
// pointed at the wrong backend for months; failing loudly beats that.
const extra = Constants.expoConfig?.extra;
if (!extra?.supabaseUrl || !extra?.supabaseAnonKey) {
  throw new Error(
    "Missing Supabase config in app.json's `extra` block (supabaseUrl/supabaseAnonKey)."
  );
}

// The web app's Next.js API routes (currently just /api/mobile/checkout) run
// on the same machine as `npm run dev` during local development. The
// Android emulator can't reach the host via `localhost` — it maps that to
// itself — so it needs the special `10.0.2.2` alias instead; iOS
// Simulator shares the host's loopback directly. `extra.apiUrl` in app.json
// overrides this for a physical device (LAN IP) or a deployed URL later.
const defaultApiUrl = Platform.OS === "android" ? "http://10.0.2.2:3010" : "http://localhost:3010";

/**
 * Rewrites a loopback host to the Android emulator's alias for the host
 * machine.
 *
 * The `defaultApiUrl` above was dead code: app.json sets `extra.apiUrl` to
 * "http://localhost:3010", which took precedence, so the Android branch never
 * ran. On an emulator `localhost` is the emulator itself, so every garment
 * mockup (resolved against this base), the checkout POST and the studio's
 * image upload all pointed at nothing. iOS was fine, which is exactly why it
 * went unnoticed.
 *
 * Doing it here rather than by editing app.json keeps one config value working
 * on both platforms — a LAN IP or a deployed URL passes through untouched.
 */
function forEmulator(url: string): string {
  if (Platform.OS !== "android") return url;
  return url.replace(/\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/, "//10.0.2.2");
}

/** Loopback and the Android emulator's alias for the host machine. */
const LOOPBACK = /\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(?=[:/]|$)/;

/**
 * The API base, with one rule a release build cannot break.
 *
 * `app.json` ships `extra.apiUrl = "http://localhost:3010"`, which is right for
 * development and catastrophic anywhere else: checkout, design save, image
 * upload AND every garment mockup (resolveAssetUrl builds them from this) all
 * resolve against it. A TestFlight or Play build would show a studio with no
 * garment in it and fail every write, and it would fail quietly — the app has
 * no image error state.
 *
 * It would also fail even if something were listening, because cleartext HTTP
 * is enabled only in the DEBUG Android manifests and iOS ATS is
 * `NSAllowsArbitraryLoads: false`.
 *
 * The fix is not "remember to edit app.json before release". Outside __DEV__ a
 * loopback base is refused and the public site is used instead — the API routes
 * are served by the same Next app as the storefront, so `siteUrl` is the right
 * origin for both. A real LAN IP or a deployed URL still passes through, so
 * device development is unaffected.
 */
const siteUrl = ((extra.siteUrl as string | undefined) ?? "https://dewdropz.shop").replace(/\/$/, "");
const configuredApiUrl = (extra.apiUrl as string | undefined) ?? defaultApiUrl;
const apiUrl =
  !__DEV__ && LOOPBACK.test(configuredApiUrl) ? siteUrl : forEmulator(configuredApiUrl);

export const ENV = {
  supabaseUrl: extra.supabaseUrl as string,
  supabaseAnonKey: extra.supabaseAnonKey as string,
  apiUrl,
  // The PUBLIC storefront, which is a different thing from `apiUrl` — that one
  // points at a dev machine's loopback in development. Anything a customer
  // could end up holding (a shared product link, a link in an email) has to be
  // built from this instead, or it ships `http://localhost:3010/...` to them.
  siteUrl,
  appName: "DEWDROPZ",
};
