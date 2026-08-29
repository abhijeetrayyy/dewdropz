/**
 * Turning a thrown error into a sentence a shopper can act on.
 *
 * The studio used to surface `err.message` directly. That reads fine when the
 * message came from our own API — "Please pick an image under 10MB." — and
 * catastrophically when it did not:
 *
 *   fetch failed: UnexpectedException: The network connection was lost.
 *   (at ExpoModulesCore/Promise.swift:56)
 *
 * A shopper cannot do anything with a Swift file path, and a customer reading
 * an internal stack location on a shopping app has been shown something that
 * was never meant for them. It is the same class of defect as the checkout
 * total that omitted GST and the product page that claimed "INCL. ALL TAXES":
 * the screen saying something untrue, or unusable, about what just happened.
 *
 * THE RULE: our own messages pass through, because they were written for this
 * exact moment. Anything else is classified and replaced. Nothing is swallowed
 * silently — the fallback still tells the shopper what failed and what to do.
 */

/** Shapes that only ever come from a transport failure, not from our API. */
const NETWORK_MARKERS = [
  "network",
  "fetch failed",
  "unexpectedexception",
  "timeout",
  "timed out",
  "connection",
  "offline",
  "econnrefused",
  "enotfound",
];

/**
 * A message is ours if it reads like a sentence we wrote: short, plain, and
 * free of the machinery that leaks from a native module or a fetch.
 */
function looksLikeOurs(message: string): boolean {
  const m = message.trim();
  if (m.length === 0 || m.length > 160) return false;
  const lower = m.toLowerCase();
  if (NETWORK_MARKERS.some((k) => lower.includes(k))) return false;
  // Stack locations, file paths, module names, JSON — never ours.
  if (/\.(swift|ts|tsx|js|java|kt|mm):\d+|\bat\s+\w+\.|https?:\/\/|[{}[\]]/.test(m)) return false;
  return true;
}

export function studioErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const raw = err.message ?? "";
  if (looksLikeOurs(raw)) return raw;
  if (NETWORK_MARKERS.some((k) => raw.toLowerCase().includes(k))) {
    return "That didn't reach us — check your connection and try again.";
  }
  return fallback;
}
