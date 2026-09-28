import { describe, expect, it } from "vitest";
import { isSkippedDir, isSkippedFile, matchesPattern, trackExclusions } from "./exclude.js";

describe("isSkippedDir", () => {
  it("skips dot-prefixed directories and node_modules", () => {
    for (const name of [".git", ".obsidian", ".some-unknown-tool", "node_modules"]) {
      expect(isSkippedDir(name), name).toBe(true);
    }
  });

  it("keeps ordinary directories", () => {
    for (const name of ["notes", "guide", "update-note", "_drafts"]) {
      expect(isSkippedDir(name), name).toBe(false);
    }
  });
});

describe("isSkippedFile", () => {
  it("skips dot-prefixed files", () => {
    for (const name of [".env", ".gitignore", ".DS_Store", ".nojekyll", ".draft.md"]) {
      expect(isSkippedFile(name), name).toBe(true);
    }
  });

  it("keeps ordinary files", () => {
    for (const name of ["index.md", "shot.png", "_notes.md", "node_modules"]) {
      expect(isSkippedFile(name), name).toBe(false);
    }
  });
});

describe("matchesPattern", () => {
  it("matches a directory and everything beneath it", () => {
    for (const pattern of ["drafts/**", "drafts", "drafts/"]) {
      expect(matchesPattern("drafts/a.md", pattern), pattern).toBe(true);
      expect(matchesPattern("drafts/deep/b.png", pattern), pattern).toBe(true);
      expect(matchesPattern("drafts", pattern), pattern).toBe(true);
    }
  });

  it("does not match a directory whose name merely starts the same", () => {
    // "drafts" must not swallow "drafts-published/".
    expect(matchesPattern("drafts-published/a.md", "drafts")).toBe(false);
    expect(matchesPattern("draftsy.md", "drafts")).toBe(false);
  });

  it("matches an extension at any depth", () => {
    expect(matchesPattern("scratch.tmp", "*.tmp")).toBe(true);
    expect(matchesPattern("a/b/scratch.tmp", "*.tmp")).toBe(true);
    expect(matchesPattern("scratch.md", "*.tmp")).toBe(false);
  });

  it("matches one exact path", () => {
    expect(matchesPattern("notes/scratch.md", "notes/scratch.md")).toBe(true);
    expect(matchesPattern("notes/other.md", "notes/scratch.md")).toBe(false);
  });

  it("is case-insensitive and accepts backslashes and a ./ prefix", () => {
    expect(matchesPattern("Drafts/A.md", "drafts")).toBe(true);
    expect(matchesPattern("drafts/a.md", "Drafts\\**")).toBe(true);
    expect(matchesPattern("drafts/a.md", "./drafts")).toBe(true);
  });

  it("ignores an empty pattern rather than matching everything", () => {
    expect(matchesPattern("a.md", "")).toBe(false);
  });
});

describe("trackExclusions", () => {
  it("excludes nothing when given no patterns", () => {
    expect(trackExclusions().excludes("drafts/a.md")).toBe(false);
  });

  it("excludes a path matching any pattern", () => {
    const tracker = trackExclusions(["_orphaned/**", "*.tmp"]);
    expect(tracker.excludes("_orphaned/old.md")).toBe(true);
    expect(tracker.excludes("a/b.tmp")).toBe(true);
    expect(tracker.excludes("guide/a.md")).toBe(false);
  });

  it("ignores blank patterns instead of excluding everything", () => {
    expect(trackExclusions(["", "   "]).excludes("guide/a.md")).toBe(false);
  });

  it("reports a place-naming pattern that matched nothing", () => {
    const tracker = trackExclusions(["drafts", "_archive"]);
    tracker.excludes("drafts");
    expect(tracker.unused()).toEqual(["_archive"]);
  });

  it("does not report an extension pattern that matched nothing", () => {
    const tracker = trackExclusions(["*.tmp"]);
    tracker.excludes("guide/a.md");
    expect(tracker.unused()).toEqual([]);
  });

  it("counts a pattern inside a pruned directory as used, not as a mistake", () => {
    const tracker = trackExclusions(["drafts", "drafts/old"]);
    tracker.excludes("drafts");
    tracker.pruned("drafts");
    expect(tracker.unused()).toEqual([]);
  });
});
