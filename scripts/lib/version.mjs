/** Same formula as .github/workflows/build.yml. */
export function versionCodeFor(version) {
  const [major, minor, patch] = version.split(".").map(Number);
  return major * 10000 + minor * 100 + patch;
}

/** Resolves "patch" | "minor" | "major" | "X.Y.Z" against the current version. */
export function nextVersion(current, request) {
  if (/^\d+\.\d+\.\d+$/.test(request)) return request;
  const [major, minor, patch] = current.split(".").map(Number);
  if (request === "major") return `${major + 1}.0.0`;
  if (request === "minor") return `${major}.${minor + 1}.0`;
  if (request === "patch") return `${major}.${minor}.${patch + 1}`;
  return null;
}

/** True when `next` is strictly greater than `current`. */
export function isGreater(next, current) {
  const a = next.split(".").map(Number);
  const b = current.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}
