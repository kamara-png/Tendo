#!/usr/bin/env node
// Prints the GitHub Release notes for a version, straight from
// src/constants/changelog.json. The release workflow publishes this output, so
// the notes on GitHub and the in-app "What's new" can never disagree.
//
//   node scripts/release-notes.mjs v1.1.0
//
// Exits 1 if the version has no changelog entry or the entry is empty.
import {
  findEntry,
  hasContent,
  loadChangelog,
  normalizeVersion,
  renderNotes,
} from "./lib/changelog.mjs";

const version = normalizeVersion(process.argv[2] ?? "");
if (!version) {
  console.error("Usage: node scripts/release-notes.mjs <vX.Y.Z>");
  process.exit(1);
}

const entry = findEntry(loadChangelog(), version);
if (!entry || !hasContent(entry)) {
  console.error(
    `src/constants/changelog.json has no notes for ${version}.\n` +
      `Draft them with: node scripts/draft-release-notes.mjs ${version}`,
  );
  process.exit(1);
}

process.stdout.write(renderNotes(entry));
