import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "./storage";

export const SETTINGS_KEY = STORAGE_KEYS.settings;

export type SettingsState = {
  haptics: boolean;
  dailyReminders: boolean;
  dailyHour: number;
  dailyMinute: number;
  dailyNotificationId: string | null;
  confirmDelete: boolean;
  weekStartsMonday: boolean;
  introSeen: boolean;
};

export const DEFAULT_SETTINGS: SettingsState = {
  haptics: true,
  dailyReminders: false,
  dailyHour: 9,
  dailyMinute: 0,
  dailyNotificationId: null,
  confirmDelete: false,
  weekStartsMonday: true,
  introSeen: false,
};

export async function readSettings(): Promise<SettingsState> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return raw
      ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<SettingsState>) }
      : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function writeSettings(next: SettingsState): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}
