import { ENV } from "../env";

// Garment mockups are authored in admin as site-relative paths (e.g.
// "/custom/hoodie/hoodie-front.png") because the web app serves them straight
// out of /public. A native app has no origin to resolve "/..." against, so
// those URLs load as nothing at all — a blank grey card with no error.
//
// Resolving them against the API base keeps the stored value portable: the
// same row works on web, and points at whatever host this build talks to.
// Absolute URLs (Supabase storage, Unsplash) pass through untouched.
export function resolveAssetUrl(url: string | undefined | null): string {
  if (!url) return "";
  if (/^(https?:|data:|file:)/i.test(url)) return url;
  if (url.startsWith("/")) return `${ENV.apiUrl.replace(/\/$/, "")}${url}`;
  return url;
}
