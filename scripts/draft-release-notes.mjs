#!/usr/bin/env node
// Drafts a changelog entry for an upcoming release from the commits since the
// last tag. The draft is raw material: edit it (group, dedupe, order by what
// users care about) before releasing.
//
//   node scripts/draft-release-notes.mjs 1.1.1 [--force]
import { execFileSync } from "node:child_process";
import {
  classifyCommits,
  findEntry,
  loadChangelog,
  normalizeVersion,
  saveChangelog,
} from "./lib/changelog.mjs";

const version = normalizeVersion(process.argv[2] ?? "");
const force = process.argv.includes("--force");
if (!version) {
  console.error("Usage: node scripts/draft-release-notes.mjs <X.Y.Z> [--force]");
  process.exit(1);
}

const entries = loadChangelog();
if (findEntry(entries, version) && !force) {
  console.error(`Notes for ${version} already exist. Use --force to overwrite.`);
  process.exit(1);
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
let range = [];
try {
  range = [`${git("describe", "--tags", "--abbrev=0")}..HEAD`];
} catch {
  // No tags yet: draft from the whole history.
}
const subjects = git("log", "--no-merges", "--pretty=%s", ...range)
  .split("\n")
  .filter(Boolean);

const draft = {
  version,
  publishedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  ...classifyCommits(subjects),
};
for (const key of ["added", "changed", "fixed"]) {
  if (draft[key].length === 0) delete draft[key];
}

saveChangelog([draft, ...entries.filter((entry) => entry.version !== version)]);
console.log(`Drafted notes for ${version} in src/constants/changelog.json.`);
console.log("Edit them, then run: node scripts/release.mjs", version);
