import { readFileSync, writeFileSync } from "node:fs";

export const CHANGELOG_PATH = "src/constants/changelog.json";
const SECTIONS = [
  ["added", "Added"],
  ["changed", "Changed"],
  ["fixed", "Fixed"],
];

export function loadChangelog(path = CHANGELOG_PATH) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function saveChangelog(entries, path = CHANGELOG_PATH) {
  writeFileSync(path, `${JSON.stringify(entries, null, 2)}\n`);
}

/** Accepts "1.3.0" or "v1.3.0". */
export function normalizeVersion(input) {
  const match = /^v?(\d+\.\d+\.\d+)$/.exec(String(input).trim());
  return match ? match[1] : null;
}

export function findEntry(entries, version) {
  return entries.find((entry) => entry.version === version) ?? null;
}

export function hasContent(entry) {
  return SECTIONS.some(([key]) => (entry?.[key] ?? []).some((line) => line.trim()));
}

/** Markdown for a GitHub Release body: a "What's new" section with grouped bullets. */
export function renderNotes(entry) {
  const lines = ["## What's new", ""];
  for (const [key, label] of SECTIONS) {
    const items = (entry[key] ?? []).filter((line) => line.trim());
    if (items.length === 0) continue;
    lines.push(`### ${label}`, "", ...items.map((item) => `- ${item}`), "");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

/** Sorts commit subjects into Added / Changed / Fixed, dropping internal-only ones. */
export function classifyCommits(subjects) {
  const entry = { added: [], changed: [], fixed: [] };
  for (const raw of subjects) {
    const subject = raw.trim();
    if (!subject) continue;
    if (/^(release v?\d|merge )/i.test(subject)) continue;
    if (/^(chore|ci|test|docs|build)(\(.+\))?:/i.test(subject)) continue;

    const text = subject
      .replace(/^(feat|fix|refactor|perf)(\(.+\))?:\s*/i, "")
      .replace(/^./, (char) => char.toUpperCase());

    if (/^(feat|add)/i.test(subject)) entry.added.push(text);
    else if (/^fix/i.test(subject)) entry.fixed.push(text);
    else entry.changed.push(text);
  }
  return entry;
}
