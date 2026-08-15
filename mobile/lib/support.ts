import { Alert, Linking, Share } from "react-native";
import { SITE } from "./editorial";
import { ENV } from "./env";

// Outbound actions — mail and the OS share sheet. Both used to be scattered
// as dead `onPress={() => {}}` handlers on buttons that looked live; they are
// centralised here so every "contact us" in the app opens the same mailbox
// with a subject the inbox can actually triage.

/**
 * Opens the user's mail client, pre-addressed to support. Falls back to an
 * alert naming the address, because a device with no mail client configured
 * would otherwise swallow the tap silently.
 */
export async function contactSupport(subject: string, body?: string) {
  const url =
    `mailto:${SITE.email}` +
    `?subject=${encodeURIComponent(subject)}` +
    (body ? `&body=${encodeURIComponent(body)}` : "");

  try {
    const ok = await Linking.canOpenURL(url);
    if (!ok) throw new Error("no mail client");
    await Linking.openURL(url);
  } catch {
    Alert.alert("Email us", `Write to ${SITE.email} and we'll pick it up from there.`);
  }
}

/** Public web URL for a piece of app content, for the share sheet. */
export function webUrl(path: string) {
  return `${ENV.siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * The OS share sheet. Errors are swallowed: on iOS a user dismissing the sheet
 * resolves normally, but a share target that fails mid-flight rejects, and
 * that is not something to interrupt the user about.
 */
export async function shareLink(title: string, path: string) {
  try {
    const url = webUrl(path);
    await Share.share({ title, message: `${title} — ${url}`, url });
  } catch {
    // dismissed or unavailable — nothing to report
  }
}
