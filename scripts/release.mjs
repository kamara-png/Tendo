#!/usr/bin/env node
// Cuts a release: verifies the notes exist, bumps the version, commits, and
// creates an annotated tag. It never pushes; you review and push yourself.
//
//   node scripts/release.mjs patch|minor|major|X.Y.Z [--dry-run]
//
// Pushing the tag is what triggers the Build & Release workflow.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import {
  findEntry,
  hasContent,
  loadChangelog,
} from "./lib/changelog.mjs";
import { isGreater, nextVersion, versionCodeFor } from "./lib/version.mjs";

const dryRun = process.argv.includes("--dry-run");
const request = process.argv.slice(2).find((arg) => !arg.startsWith("--"));

const fail = (message) => {
  console.error(`✖ ${message}`);
  process.exit(1);
};
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

if (!request) fail("Usage: node scripts/release.mjs patch|minor|major|X.Y.Z [--dry-run]");

const app = readJson("app.json");
const current = app.expo.version;
const version = nextVersion(current, request);
if (!version) fail(`Don't understand "${request}". Use patch, minor, major or X.Y.Z.`);
const tag = `v${version}`;

// The version in app.json may already be bumped (for example when a PR added
// a native module and had to move the runtime version). Allow that case.
if (version !== current && !isGreater(version, current)) {
  fail(`${version} is not newer than the current version ${current}.`);
}

if (git("status", "--porcelain")) fail("Working tree is not clean. Commit or stash first.");
const branch = git("rev-parse", "--abbrev-ref", "HEAD");
if (branch !== "main") fail(`Release from main, not "${branch}".`);
if (git("tag", "--list", tag)) fail(`Tag ${tag} already exists. Never reuse a version; ship the next one.`);

const entry = findEntry(loadChangelog(), version);
if (!entry || !hasContent(entry)) {
  fail(
    `src/constants/changelog.json has no notes for ${version}.\n` +
      `  Draft them with: node scripts/draft-release-notes.mjs ${version}`,
  );
}

console.log(`Releasing ${current} → ${version} (versionCode ${versionCodeFor(version)})`);
if (dryRun) {
  console.log("Dry run: checks passed, nothing changed.");
  process.exit(0);
}

if (version !== current) {
  app.expo.version = version;
  app.expo.android = { ...app.expo.android, versionCode: versionCodeFor(version) };
  writeFileSync("app.json", `${JSON.stringify(app, null, 2)}\n`);

  const pkg = readJson("package.json");
  pkg.version = version;
  writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);

  const lock = readJson("package-lock.json");
  lock.version = version;
  lock.packages[""].version = version;
  writeFileSync("package-lock.json", `${JSON.stringify(lock, null, 2)}\n`);

  git("add", "app.json", "package.json", "package-lock.json");
  git("commit", "-m", `Release ${tag}`);
}

git("tag", "-a", tag, "-m", `Tendo ${version}`);
console.log(`✔ Created annotated tag ${tag}`);
console.log(`\nNext: git push origin main && git push origin ${tag}`);
