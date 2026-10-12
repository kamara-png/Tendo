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
  /** Date (YYYY-MM-DD) the task was completed, or null while pending. */
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
};

export type Streak = {
  id: string;
  name: string;
  checks: string[];
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;

const asNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

/**
 * Validate and normalise a stored/imported habit. Returns null for entries that
 * are too malformed to be usable (missing id/name), so a bad backup can never
 * crash a list. `completedDate` is preserved; the legacy boolean is only a
 * fallback for very old data.
 */
const migrateHabit = (raw: unknown): Habit | null => {
  const r = asRecord(raw);
  if (!r || typeof r.id !== "string" || typeof r.name !== "string") return null;
  return {
    id: r.id,
    name: r.name,
    completedDate:
      typeof r.completedDate === "string"
        ? r.completedDate
        : r.completed === true
          ? todayKey()
          : null,
    createdAt: asNumber(r.createdAt, Date.now()),
    reminderAt: typeof r.reminderAt === "number" ? r.reminderAt : null,
    notificationId:
      typeof r.notificationId === "string" ? r.notificationId : null,
  };
};

const migrateNote = (raw: unknown): Note | null => {
  const r = asRecord(raw);
  if (!r || typeof r.id !== "string") return null;
  return {
    id: r.id,
    title: typeof r.title === "string" ? r.title : "",
    body: typeof r.body === "string" ? r.body : "",
    updatedAt: asNumber(r.updatedAt, Date.now()),
    pinned: r.pinned === true,
  };
};

const migrateStreak = (raw: unknown): Streak | null => {
  const r = asRecord(raw);
  if (!r || typeof r.id !== "string" || typeof r.name !== "string") return null;
  return { id: r.id, name: r.name, checks: asStringArray(r.checks) };
};

export async function loadHabits(options?: {
  throwOnError?: boolean;
}): Promise<Habit[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.habits);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(migrateHabit)
      .filter((habit): habit is Habit => habit !== null);
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
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(migrateNote)
      .filter((note): note is Note => note !== null);
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
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(migrateStreak)
      .filter((streak): streak is Streak => streak !== null);
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

type StorageListener = () => void;

const storageListeners = new Set<StorageListener>();

/**
 * Subscribe to out-of-band data changes (e.g. Settings clearing or importing
 * data) so a mounted screen can reload instead of re-saving stale state.
 */
export function subscribeStorageChanges(listener: StorageListener): () => void {
  storageListeners.add(listener);
  return () => {
    storageListeners.delete(listener);
  };
}

/** Notify listeners that stored data changed outside their own state updates. */
export function notifyStorageChanged(): void {
  for (const listener of storageListeners) listener();
}
