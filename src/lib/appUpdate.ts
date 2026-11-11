import AsyncStorage from "@react-native-async-storage/async-storage";
import { parseRelease, type AppRelease } from "./githubRelease";

export const LATEST_RELEASE_URL =
  "https://api.github.com/repos/kamara-png/Tendo/releases/latest";

/** Launch checks run at most this often; the Settings button always checks. */
export const AUTO_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

const REQUEST_TIMEOUT_MS = 8000;
const CACHE_KEY = "tendo.appUpdate.cache";
const DISMISSED_KEY = "tendo.appUpdate.dismissedVersion";

export type AppUpdateCache = {
  checkedAt: number;
  /** The newest published release, or null if there was none at check time. */
  release: AppRelease | null;
};

export async function readCache(): Promise<AppUpdateCache | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<AppUpdateCache>;
    if (typeof value.checkedAt !== "number") return null;
    return {
      checkedAt: value.checkedAt,
      release: value.release ?? null,
    };
  } catch {
    return null;
  }
}

async function writeCache(cache: AppUpdateCache): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // A cache that can't be written only costs one extra network call.
  }
}

/** True when the last check is older than the auto-check interval. */
export async function isAutoCheckDue(now = Date.now()): Promise<boolean> {
  const cache = await readCache();
  return !cache || now - cache.checkedAt >= AUTO_CHECK_INTERVAL_MS;
}

export async function getDismissedVersion(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

export async function setDismissedVersion(version: string): Promise<void> {
  try {
    await AsyncStorage.setItem(DISMISSED_KEY, version);
  } catch {
    // Worst case the launch prompt shows again next time.
  }
}

/**
 * Asks GitHub for the latest release and caches the result. Throws on network
 * or HTTP errors so callers can tell "no update" from "couldn't check". A repo
 * with no releases yet (404) is a normal "no update".
 */
export async function checkLatestRelease(): Promise<AppUpdateCache> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let release: AppRelease | null = null;
  try {
    const response = await fetch(LATEST_RELEASE_URL, {
      signal: controller.signal,
      headers: { Accept: "application/vnd.github+json" },
    });
    if (response.status === 403 || response.status === 429) {
      throw new Error("GitHub is rate-limiting update checks. Try again later.");
    }
    if (response.status !== 404) {
      if (!response.ok) {
        throw new Error(`Update check failed (HTTP ${response.status}).`);
      }
      release = parseRelease(await response.json());
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The update check timed out. Check your connection.");
    }
    if (error instanceof TypeError) {
      throw new Error("Couldn't reach GitHub. Check your connection.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  const cache: AppUpdateCache = { checkedAt: Date.now(), release };
  await writeCache(cache);
  return cache;
}
