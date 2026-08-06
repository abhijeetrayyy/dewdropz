import * as Haptics from "expo-haptics";

// Thin named wrapper so call sites read as intent ("haptics.tap()") instead
// of picking an ImpactFeedbackStyle enum value inline every time. Every call
// is fire-and-forget and swallows rejections — haptics are unsupported on
// some Android devices/emulators and must never throw into the caller.
export const haptics = {
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  select: () => Haptics.selectionAsync().catch(() => {}),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
};
