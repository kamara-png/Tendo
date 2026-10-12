import Constants from "expo-constants";
import { Platform } from "react-native";

/** Short chime — kept for the once-a-day check-in reminder. */
export const CHIME_SOUND = "ck_chime.wav";
/** Longer looping alarm (~4.7s) used for todo alarms. */
export const ALARM_SOUND = "ck_alarm.wav";

export const TODO_CHANNEL_ID = "todo-reminders";
export const DAILY_CHANNEL_ID = "daily-reminders";

export const TODO_ALARM_CATEGORY = "todo-alarm";
export const SNOOZE_10 = "SNOOZE_10";
export const SNOOZE_60 = "SNOOZE_60";
export const DISMISS_ALARM = "DISMISS_ALARM";

/** Vibrate a few times so a todo alarm is hard to miss. */
const ALARM_VIBRATION = [0, 400, 250, 400, 250, 400];

// expo-notifications is intentionally lazy-loaded, and never loaded at all on
// Android Expo Go. Since SDK 53 the library throws during its own module
// evaluation in that environment (its DevicePushTokenAutoRegistration
// side-effect calls warnOfExpoGoPushUsage, which throws on Android), so even
// require() inside try/catch still surfaces a red-box error attributed to the
// require line. The only reliable workaround is to not require it there and
// degrade to in-app reminders. Full system notifications still work in a
// development / production build (EAS dev-client / apk) where the native
// module exists. (iOS Expo Go only warns, and local notifications work there,
// so the module is still allowed to load on iOS.)
type NotificationsModule = typeof import("expo-notifications");
type NotificationTriggerInput = Parameters<
  NotificationsModule["scheduleNotificationAsync"]
>[0]["trigger"];
type ChannelInput = Parameters<
  NotificationsModule["setNotificationChannelAsync"]
>[1];

let cached: NotificationsModule | null | undefined;

export function isExpoGo(): boolean {
  return Constants.appOwnership === "expo";
}

function loadNotifications(): NotificationsModule | null {
  if (cached !== undefined) return cached;
  if (Platform.OS === "web") {
    cached = null;
    return cached;
  }
  if (Platform.OS === "android" && isExpoGo()) {
    cached = null;
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require("expo-notifications") as NotificationsModule;
  } catch {
    cached = null;
  }
  return cached;
}

export function isSystemRemindersAvailable(): boolean {
  return loadNotifications() !== null;
}

export function secondsUntil(target: number): number {
  return Math.max(3, Math.ceil((target - Date.now()) / 1000));
}

let handlerReady = false;

export async function setupNotificationsAsync(): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications) return;
  if (!handlerReady) {
    try {
      // SDK 57 shape: no `shouldShowAlert` (use banner/list instead).
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
        }),
      });
      handlerReady = true;
    } catch (error) {
      console.warn("Notifications handler unavailable", error);
    }
  }
  try {
    await Notifications.setNotificationCategoryAsync(TODO_ALARM_CATEGORY, [
      { identifier: SNOOZE_10, buttonTitle: "Snooze 10 min" },
      { identifier: SNOOZE_60, buttonTitle: "Snooze 1 hour" },
      {
        identifier: DISMISS_ALARM,
        buttonTitle: "Dismiss",
        options: { isDestructive: true },
      },
    ]);
  } catch (error) {
    console.warn("Notification category unavailable", error);
  }
}

let channelReady = false;

/** Android "todo alarms" channel: long alarm sound + vibration. */
export async function ensureChannelAsync(): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications || Platform.OS !== "android") return;
  if (channelReady) return;
  try {
    const channel: ChannelInput = {
      name: "Todo alarms",
      importance: Notifications.AndroidImportance.MAX,
      sound: ALARM_SOUND,
      vibrationPattern: ALARM_VIBRATION,
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    };
    await Notifications.setNotificationChannelAsync(TODO_CHANNEL_ID, channel);
    channelReady = true;
  } catch (error) {
    console.warn("Notification channel unavailable", error);
  }
}

let dailyChannelReady = false;

/** Android "daily reminders" channel: keeps the short chime. */
export async function ensureDailyChannelAsync(): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications || Platform.OS !== "android") return;
  if (dailyChannelReady) return;
  try {
    await Notifications.setNotificationChannelAsync(DAILY_CHANNEL_ID, {
      name: "Daily reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: CHIME_SOUND,
    });
    dailyChannelReady = true;
  } catch (error) {
    console.warn("Daily reminder channel unavailable", error);
  }
}

export async function requestReminderPermissions(): Promise<boolean> {
  const Notifications = loadNotifications();
  if (!Notifications) return false;
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted || existing.status === "granted") return true;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted || requested.status === "granted";
  } catch (error) {
    console.warn("Notification permission request failed", error);
    return false;
  }
}

/** Current permission state, or null when system notifications are unavailable. */
export async function getReminderPermissionStatus(): Promise<boolean | null> {
  const Notifications = loadNotifications();
  if (!Notifications) return null;
  try {
    const status = await Notifications.getPermissionsAsync();
    return status.granted || status.status === "granted";
  } catch (error) {
    console.warn("Failed to read notification permissions", error);
    return null;
  }
}

/**
 * Schedule a local todo reminder. Returns the system notification id, or null
 * when system notifications are unavailable (Expo Go / web / missing module).
 * Callers should still persist `reminderAt` so the in-app fallback can fire.
 */
export async function scheduleReminderAsync(args: {
  title: string;
  body: string;
  timeMs: number;
  /** When set, adds snooze/dismiss actions bound to this todo. */
  habitId?: string;
}): Promise<string | null> {
  const Notifications = loadNotifications();
  if (!Notifications) return null;
  try {
    await ensureChannelAsync();
    const seconds = secondsUntil(args.timeMs);
    const trigger: NotificationTriggerInput =
      Platform.OS === "android"
        ? {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            channelId: TODO_CHANNEL_ID,
            seconds,
          }
        : {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds,
          };
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: args.title,
        body: args.body,
        sound: ALARM_SOUND,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        vibrate: ALARM_VIBRATION,
        ...(args.habitId
          ? {
              categoryIdentifier: TODO_ALARM_CATEGORY,
              data: { habitId: args.habitId },
            }
          : {}),
      },
      trigger,
    });
    return id;
  } catch (error) {
    console.warn("Failed to schedule system reminder", error);
    return null;
  }
}

/**
 * Listen for snooze/dismiss taps on a todo alarm notification. Returns a
 * subscription with a `.remove()` cleanup, or null when notifications are
 * unavailable. The handler is skipped for any other action.
 */
export function addReminderResponseListener(
  handler: (action: string, habitId: string | null) => void,
): { remove: () => void } | null {
  const Notifications = loadNotifications();
  if (!Notifications) return null;
  try {
    const subscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const action = response.actionIdentifier;
        if (
          action !== SNOOZE_10 &&
          action !== SNOOZE_60 &&
          action !== DISMISS_ALARM
        ) {
          return;
        }
        const data = response.notification.request.content.data as
          | { habitId?: string }
          | undefined;
        handler(action, data?.habitId ?? null);
      });
    return subscription;
  } catch (error) {
    console.warn("Failed to register reminder response listener", error);
    return null;
  }
}

/**
 * Read a snooze action that launched the app from a cold start and clear it so
 * it isn't replayed. Returns null when there is nothing pending.
 */
export function consumeLastReminderResponse(): {
  action: string;
  habitId: string | null;
} | null {
  const Notifications = loadNotifications();
  if (!Notifications) return null;
  try {
    const response = Notifications.getLastNotificationResponse();
    if (!response) return null;
    const action = response.actionIdentifier;
    if (
      action !== SNOOZE_10 &&
      action !== SNOOZE_60 &&
      action !== DISMISS_ALARM
    ) {
      return null;
    }
    const data = response.notification.request.content.data as
      | { habitId?: string }
      | undefined;
    Notifications.clearLastNotificationResponse();
    return { action, habitId: data?.habitId ?? null };
  } catch (error) {
    console.warn("Failed to read last reminder response", error);
    return null;
  }
}

export async function cancelReminderAsync(
  id: string | null | undefined,
): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications || !id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (error) {
    console.warn("Failed to cancel reminder", error);
  }
}

/**
 * Schedule a repeating daily reminder at a fixed hour/minute.
 * Returns the system notification id, or null when unavailable.
 */
export async function scheduleDailyReminderAsync(args: {
  title: string;
  body: string;
  hour: number;
  minute?: number;
}): Promise<string | null> {
  const Notifications = loadNotifications();
  if (!Notifications) return null;
  try {
    await ensureDailyChannelAsync();
    const trigger: NotificationTriggerInput =
      Platform.OS === "android"
        ? {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            channelId: DAILY_CHANNEL_ID,
            hour: args.hour,
            minute: args.minute ?? 0,
          }
        : {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: args.hour,
            minute: args.minute ?? 0,
          };
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: args.title,
        body: args.body,
        sound: CHIME_SOUND,
      },
      trigger,
    });
    return id;
  } catch (error) {
    console.warn("Failed to schedule daily reminder", error);
    return null;
  }
}
