import { router, type Href } from "expo-router";

/**
 * Going back, when there may be nothing to go back TO.
 *
 * THE BUG THIS EXISTS FOR. `router.back()` is a no-op when the current screen
 * is the only one on the stack, and React Navigation says so out loud:
 *
 *     The action 'GO_BACK' was not handled by any navigator
 *
 * That is not a rare state. It happens on a cold start from a deep link or a
 * notification, and — more often — after any `router.replace()`, which is
 * exactly how the rental flow reaches its confirmation screen. The back button
 * is right there, looks pressable, and does nothing at all.
 *
 * So every back control goes through here and names where it should land when
 * there is no history: the shelf above it, not a dead end. `replace` rather
 * than `push` for the fallback, so a user cannot build a stack of parents by
 * pressing back repeatedly.
 */
export function goBack(fallback: Href = "/(tabs)") {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

/**
 * Where to go after signing in.
 *
 * Auth screens are reached from somewhere with an intention — the checkout
 * gate, a saved list, "your rentals" — and dropping the person on Account
 * afterwards makes them find their way back to what they were doing. Mobile
 * relied on `goBack()`, which works only while the history happens to be
 * right: arrive at login from a deep link, or bounce through signup, and the
 * intent is gone.
 *
 * The web has carried `?redirectTo=` for exactly this since launch, with a
 * guard against open redirects. This is the app's version of the same idea; it
 * only ever accepts in-app paths, so there is no open-redirect to guard, but it
 * still refuses anything that is not a rooted path.
 */
export function afterAuth(next: string | undefined, fallback: Href = "/(tabs)/account") {
  const safe = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : null;
  // `replace`, not `push`: the login screen must not stay under the thing the
  // person actually wanted, or Back returns them to a form they have finished.
  router.replace((safe ?? fallback) as Href);
}
