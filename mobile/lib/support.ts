import { Alert, Linking, Share } from "react-native";
import { SITE } from "./editorial";
import { ENV } from "./env";
import * as WebBrowser from "expo-web-browser";

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

/**
 * Open a page of the storefront inside the app.
 *
 * `expo-web-browser` rather than `Linking.openURL`: an in-app SFSafariViewController
 * / Custom Tab keeps the person in the app, which matters most for the one
 * thing this is used for — a privacy policy somebody is reading because they
 * are deciding whether to trust the app they are currently inside.
 */
export async function openWebPage(path: string) {
  try {
    await WebBrowser.openBrowserAsync(webUrl(path), {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    });
  } catch {
    // A browser that refuses to open is not worth an alert; the address is
    // reachable from the site itself.
  }
}
