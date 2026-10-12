import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { readSettings } from "./settings";

export type HapticStyle = "light" | "medium" | "heavy" | "selection";

const IOS_IMPACT = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
} as const;

const ANDROID_TAP = {
  light: Haptics.AndroidHaptics.Context_Click,
  medium: Haptics.AndroidHaptics.Long_Press,
  heavy: Haptics.AndroidHaptics.Confirm,
  selection: Haptics.AndroidHaptics.Segment_Tick,
} as const;

/** Best-effort feedback that honors the "Haptic feedback" toggle in Settings. */
async function whenEnabled(action: () => Promise<void>): Promise<void> {
  try {
    const settings = await readSettings();
    if (settings.haptics === false) return;
    await action();
  } catch {
    // Haptics are best-effort; never break the UI over them.
  }
}

/** Short haptic tap for button presses and list toggles. */
export function tapFeedback(style: HapticStyle = "light"): Promise<void> {
  return whenEnabled(() => {
    if (Platform.OS === "android") {
      return Haptics.performAndroidHapticsAsync(ANDROID_TAP[style]);
    }
    if (style === "selection") {
      return Haptics.selectionAsync();
    }
    return Haptics.impactAsync(IOS_IMPACT[style]);
  });
}

/** Feedback for a successful action (e.g. a todo checked off). */
export function successFeedback(): Promise<void> {
  return whenEnabled(() =>
    Platform.OS === "android"
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  );
}
