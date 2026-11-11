import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyCommits,
  hasContent,
  normalizeVersion,
  renderNotes,
} from "./lib/changelog.mjs";
import { isGreater, nextVersion, versionCodeFor } from "./lib/version.mjs";

test("normalizeVersion strips a leading v and rejects junk", () => {
  assert.equal(normalizeVersion("v1.1.0"), "1.1.0");
  assert.equal(normalizeVersion("1.1.0"), "1.1.0");
  assert.equal(normalizeVersion("latest"), null);
  assert.equal(normalizeVersion("1.1"), null);
});

test("renderNotes groups bullets and skips empty sections", () => {
  const out = renderNotes({ version: "1.1.0", added: ["A"], fixed: ["B"], changed: [] });
  assert.equal(out, "## What's new\n\n### Added\n\n- A\n\n### Fixed\n\n- B\n");
});

test("hasContent is false for an entry with only blank lines", () => {
  assert.equal(hasContent({ added: ["  "], changed: [], fixed: [] }), false);
  assert.equal(hasContent(null), false);
  assert.equal(hasContent({ fixed: ["x"] }), true);
});

test("classifyCommits sorts subjects and drops internal ones", () => {
  const result = classifyCommits([
    "Add update checker",
    "feat(ui): material theme option",
    "Fix streak haptics",
    "Shrink APK below 50 MB",
    "chore: bump deps",
    "Release v1.0.0",
    "Merge branch 'x'",
  ]);
  assert.deepEqual(result, {
    added: ["Add update checker", "Material theme option"],
    changed: ["Shrink APK below 50 MB"],
    fixed: ["Fix streak haptics"],
  });
});

test("nextVersion handles bumps and explicit versions", () => {
  assert.equal(nextVersion("1.0.0", "patch"), "1.0.1");
  assert.equal(nextVersion("1.0.9", "minor"), "1.1.0");
  assert.equal(nextVersion("1.0.9", "major"), "2.0.0");
  assert.equal(nextVersion("1.0.0", "1.4.2"), "1.4.2");
  assert.equal(nextVersion("1.0.0", "bogus"), null);
});

test("isGreater and versionCodeFor agree with CI", () => {
  assert.ok(isGreater("1.10.0", "1.9.0"));
  assert.ok(!isGreater("1.2.0", "1.2.0"));
  assert.equal(versionCodeFor("1.1.0"), 10100);
});
