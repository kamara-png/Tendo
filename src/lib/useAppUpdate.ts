import Constants from "expo-constants";
import { Platform } from "react-native";
import { useSyncExternalStore } from "react";
import {
  checkLatestRelease,
  getDismissedVersion,
  isAutoCheckDue,
  readCache,
  setDismissedVersion,
} from "./appUpdate";
import { downloadApk, installApk } from "./apkInstaller";
import type { AppRelease } from "./githubRelease";
import { isNewerVersion } from "./version";

export type AppUpdatePhase =
  | "idle"
  | "checking"
  | "upToDate"
  | "available"
  | "downloading"
  | "installing";

export type AppUpdateState = {
  phase: AppUpdatePhase;
  release: AppRelease | null;
  /** 0–100 while downloading. */
  progress: number;
  error: string | null;
  checkedAt: number | null;
  /** Whether the launch prompt should be on screen. */
  promptOpen: boolean;
};

/** The installed binary's version. OTA updates never change it. */
export function installedVersion(): string {
  return Constants.expoConfig?.version ?? "0.0.0";
}

/** The installer only exists on Android, and dev builds load code from a PC. */
export const appUpdatesSupported = Platform.OS === "android" && !__DEV__;

function message(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong while updating.";
}

// A tiny module-level store so the root-layout prompt and the Settings screen
// always see the same update state without a state-management dependency.
let state: AppUpdateState = {
  phase: "idle",
  release: null,
  progress: 0,
  error: null,
  checkedAt: null,
  promptOpen: false,
};

const listeners = new Set<() => void>();

const setState = (patch: Partial<AppUpdateState>) => {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => state;

const busyPhases: AppUpdatePhase[] = ["checking", "downloading", "installing"];

/** `force` is a manual check; otherwise it is the throttled launch check. */
export async function checkForUpdates(
  { force = false }: { force?: boolean } = {},
): Promise<void> {
  if (!appUpdatesSupported) return;
  if (busyPhases.includes(state.phase)) return;
  if (!force && !(await isAutoCheckDue())) return;

  const previous = state.phase;
  setState({ phase: "checking", error: null });
  try {
    const cache = await checkLatestRelease();
    const release = cache.release;
    const newer =
      !!release && isNewerVersion(release.version, installedVersion());

    if (!release || !newer) {
      setState({
        phase: "upToDate",
        release: null,
        checkedAt: cache.checkedAt,
      });
      return;
    }

    const dismissed = await getDismissedVersion();
    setState({
      phase: "available",
      release,
      checkedAt: cache.checkedAt,
      promptOpen: !force && dismissed !== release.version,
    });
  } catch (error) {
    // A failed background check stays silent; only a manual one reports it.
    setState({
      phase: previous,
      error: force ? message(error) : null,
    });
  }
}

/** Loads the cached check result so an update shows instantly, even offline. */
export async function hydrateUpdateCache(): Promise<void> {
  if (!appUpdatesSupported) return;
  const cache = await readCache();
  if (!cache) return;
  const newer =
    cache.release && isNewerVersion(cache.release.version, installedVersion());
  if (state.phase !== "idle") return;
  setState({
    phase: newer ? "available" : "idle",
    release: newer ? cache.release : null,
    checkedAt: cache.checkedAt,
  });
}

/** Downloads the APK and opens Android's installer. */
export async function startUpdate(): Promise<void> {
  const release = state.release;
  if (!release || state.phase === "downloading" || state.phase === "installing")
    return;

  setState({ phase: "downloading", progress: 0, error: null });
  try {
    const fileUri = await downloadApk(release, (progress) =>
      setState({ progress }),
    );
    setState({ phase: "installing" });
    await installApk(fileUri);
    // The call returns once the installer closes. If we're still running,
    // the install was cancelled or blocked, so offer it again.
    setState({ phase: "available" });
  } catch (error) {
    setState({ phase: "available", error: message(error) });
  }
}

/** "Later" on the launch prompt: stay quiet about this version until the next one. */
export async function dismissUpdatePrompt(): Promise<void> {
  const release = state.release;
  setState({ promptOpen: false });
  if (release) await setDismissedVersion(release.version);
}

export function useAppUpdate(): AppUpdateState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
