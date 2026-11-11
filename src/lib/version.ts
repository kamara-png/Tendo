export type SemVer = {
  major: number;
  minor: number;
  patch: number;
};

/** Parses `1.2.3` or `v1.2.3` (and ignores a `-suffix`). Returns null if invalid. */
export function parseVersion(input: string): SemVer | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(input.trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/** Negative if a < b, 0 if equal, positive if a > b. Null if either is invalid. */
export function compareVersions(a: string, b: string): number | null {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return null;
  return (
    left.major - right.major ||
    left.minor - right.minor ||
    left.patch - right.patch
  );
}

/** True only when `candidate` is strictly newer than `installed`. */
export function isNewerVersion(candidate: string, installed: string): boolean {
  const result = compareVersions(candidate, installed);
  return result !== null && result > 0;
}
