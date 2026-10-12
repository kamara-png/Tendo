import AsyncStorage from "@react-native-async-storage/async-storage";
import { todayKey } from "./dates";

export const STORAGE_KEYS = {
  habits: "habits",
  notes: "notes",
  streaks: "streaks",
  settings: "settings",
  theme: "theme",
  accent: "accent",
} as const;

export type Habit = {
  id: string;
  name: string;
  /** Date (YYYY-MM-DD) the task was last completed. Once set, the task is
   * hidden from the active list (carry-forward) and only resurfaces in the
   * "Done today" section on that same day. */
  completedDate: string | null;
  createdAt: number;
  reminderAt: number | null;
  notificationId: string | null;
};

export type Note = {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
  /** Pinned notes float to the top of the list. */
  pinned: boolean;
  /** Lowercase tags used for filtering. */
  tags: string[];
};

export type Streak = {
  id: string;
  name: string;
  checks: string[];
};

type LegacyHabit = {
  id: string;
  name: string;
  completed?: boolean;
  createdAt?: number;
  reminderAt?: number | null;
  notificationId?: string | null;
};

type LegacyNote = {
  id: string;
  title?: string;
  body?: string;
  updatedAt?: number;
  pinned?: boolean;
  tags?: string[];
};

type LegacyStreak = {
  id: string;
  name: string;
  checks?: string[];
};

const migrateHabit = (raw: LegacyHabit): Habit => ({
  id: raw.id,
  name: raw.name,
  completedDate: raw.completed ? todayKey() : null,
  createdAt: raw.createdAt ?? Date.now(),
  reminderAt: raw.reminderAt ?? null,
  notificationId: raw.notificationId ?? null,
});

const migrateNote = (raw: LegacyNote): Note => ({
  id: raw.id,
  title: raw.title ?? "",
  body: raw.body ?? "",
  updatedAt: raw.updatedAt ?? Date.now(),
  pinned: raw.pinned ?? false,
  tags: Array.isArray(raw.tags)
    ? raw.tags.filter((t): t is string => typeof t === "string")
    : [],
});

const migrateStreak = (raw: LegacyStreak): Streak => ({
  id: raw.id,
  name: raw.name,
  checks: Array.isArray(raw.checks) ? raw.checks : [],
});

const isArray = (value: unknown): value is unknown[] => Array.isArray(value);

export async function loadHabits(options?: {
  throwOnError?: boolean;
}): Promise<Habit[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.habits);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    if (!isArray(parsed)) return [];
    return parsed.map((raw) => migrateHabit(raw as LegacyHabit));
  } catch (error) {
    console.error("Failed to load habits", error);
    if (options?.throwOnError) throw error;
    return [];
  }
}

export async function saveHabits(habits: Habit[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.habits, JSON.stringify(habits));
  } catch (error) {
    console.error("Failed to save habits", error);
  }
}

export async function loadNotes(options?: {
  throwOnError?: boolean;
}): Promise<Note[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.notes);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    if (!isArray(parsed)) return [];
    return parsed.map((raw) => migrateNote(raw as LegacyNote));
  } catch (error) {
    console.error("Failed to load notes", error);
    if (options?.throwOnError) throw error;
    return [];
  }
}

export async function saveNotes(notes: Note[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(notes));
  } catch (error) {
    console.error("Failed to save notes", error);
  }
}

export async function loadStreaks(options?: {
  throwOnError?: boolean;
}): Promise<Streak[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.streaks);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    if (!isArray(parsed)) return [];
    return parsed.map((raw) => migrateStreak(raw as LegacyStreak));
  } catch (error) {
    console.error("Failed to load streaks", error);
    if (options?.throwOnError) throw error;
    return [];
  }
}

export async function saveStreaks(streaks: Streak[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.streaks, JSON.stringify(streaks));
  } catch (error) {
    console.error("Failed to save streaks", error);
  }
}