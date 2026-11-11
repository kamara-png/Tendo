import { parseVersion } from "./version";

export type AppRelease = {
  /** Bare version, e.g. "1.3.0". */
  version: string;
  /** Git tag, e.g. "v1.3.0". */
  tag: string;
  publishedAt: string;
  /** Release page, for the "view on GitHub" fallback. */
  htmlUrl: string;
  apkUrl: string;
  apkName: string;
  /** Size in bytes as reported by GitHub; used to sanity-check the download. */
  apkSize: number;
  /** Release body, shown as the changelog in the update dialog. */
  notes: string;
};

/** Accepts the release APK asset (e.g. `Tendo-v1.2.0.apk`). */
const isApkAsset = (name: string) => /^Tendo[-_].*\.apk$/i.test(name);

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Turns a GitHub "latest release" API payload into an `AppRelease`, or null if
 * it is a draft, a pre-release, has a non-semver tag, or has no Tendo APK.
 */
export function parseRelease(payload: unknown): AppRelease | null {
  if (!payload || typeof payload !== "object") return null;
  const release = payload as Record<string, unknown>;
  if (release.draft === true || release.prerelease === true) return null;

  const tag = asString(release.tag_name);
  const htmlUrl = asString(release.html_url);
  const publishedAt = asString(release.published_at);
  if (!tag || !htmlUrl || !publishedAt) return null;

  const parsed = parseVersion(tag);
  if (!parsed) return null;

  const assets = Array.isArray(release.assets) ? release.assets : [];
  for (const asset of assets) {
    if (!asset || typeof asset !== "object") continue;
    const entry = asset as Record<string, unknown>;
    const name = asString(entry.name);
    const url = asString(entry.browser_download_url);
    if (!name || !url || !isApkAsset(name)) continue;
    if (entry.state !== undefined && entry.state !== "uploaded") continue;

    return {
      version: `${parsed.major}.${parsed.minor}.${parsed.patch}`,
      tag,
      publishedAt,
      htmlUrl,
      apkUrl: url,
      apkName: name,
      apkSize: typeof entry.size === "number" ? entry.size : 0,
      notes:
        typeof release.body === "string" ? release.body.trim() : "",
    };
  }
  return null;
}
