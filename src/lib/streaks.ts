import { dayKey, shiftDays } from "./dates";

/** Parse a `YYYY-MM-DD` check key to a local-midnight timestamp, or null. */
export const checkTime = (key: string): number | null => {
  const parts = key.split("-").map(Number);
  if (parts.length !== 3) return null;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
};

/**
 * Length of the run of consecutive checked days ending today (or yesterday, so
 * a streak isn't lost before the day is over).
 */
export const currentStreak = (checks: string[], from: Date = new Date()): number => {
  const set = new Set(checks);
  let cursor = new Date(from);
  if (!set.has(dayKey(cursor))) cursor = shiftDays(cursor, -1);
  let length = 0;
  while (set.has(dayKey(cursor))) {
    length += 1;
    cursor = shiftDays(cursor, -1);
  }
  return length;
};

/** Longest run of consecutive checked days, all-time. */
export const longestStreak = (checks: string[]): number => {
  const days = Array.from(new Set(checks))
    .map((key) => checkTime(key))
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const day of days) {
    run =
      prev !== null && Math.round((day - prev) / 86400000) === 1 ? run + 1 : 1;
    if (run > best) best = run;
    prev = day;
  }
  return best;
};
