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

export const ENV = {
  supabaseUrl: extra.supabaseUrl as string,
  supabaseAnonKey: extra.supabaseAnonKey as string,
  apiUrl: (extra.apiUrl as string | undefined) ?? defaultApiUrl,
  appName: "DEWDROPZ",
};
