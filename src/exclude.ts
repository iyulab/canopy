/**
 * Decide which vault paths are kept out of a published site.
 *
 * Two rules stack, in this order:
 *  1. Tooling state — dot-prefixed directories and files, and `node_modules` —
 *     is never published. This is not configurable: those paths hold an
 *     editor's, a version-control system's or a build tool's own bookkeeping
 *     (`.git/`, `.gitignore`, `.env`, `.DS_Store`), not the author's content,
 *     and some of it is secret.
 *  2. Caller-supplied patterns exclude content the author keeps in the vault but
 *     does not want on the web — drafts, archives, generated scratch.
 *
 * Rule 2 exists because rule 1 cannot express it. Dot-prefixing a draft folder
 * would hide it from the file explorer and note app too, which is a different
 * intention: "do not publish this" is not "do not show me this".
 *
 * Matching is deliberately small — see `matchesPattern`. A vault is a folder of
 * notes, and the patterns that come up are "this folder" and "this kind of
 * file"; a full ignore-file dialect can be added if real use ever needs it.
 */

/** Directories whose contents are never published, whatever the caller asks for. */
export function isSkippedDir(name: string): boolean {
  return isHidden(name) || name === "node_modules";
}

/** Files that are never published, whatever the caller asks for. */
export function isSkippedFile(name: string): boolean {
  return isHidden(name);
}

function isHidden(name: string): boolean {
  return name.startsWith(".");
}

/**
 * Match a POSIX vault-relative path against one pattern.
 *
 * Supported, and nothing else:
 *  - `drafts/**` — that directory and everything beneath it
 *  - `drafts` — the same, written without the suffix; a bare name is read as a
 *    path prefix because "exclude this folder" is what callers mean by it
 *  - `*.tmp` — any file with that extension, at any depth
 *  - `notes/scratch.md` — one exact path
 *
 * A pattern is compared case-insensitively, matching how the link index resolves
 * paths, so a vault on a case-insensitive filesystem behaves the same as its
 * checkout on a case-sensitive one.
 */
export function matchesPattern(path: string, pattern: string): boolean {
  const p = path.toLowerCase();
  const raw = pattern.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
  if (raw === "") {
    return false;
  }

  if (raw.startsWith("*.")) {
    return p.endsWith(raw.slice(1));
  }

  const dir = raw.replace(/\/\*\*$/, "").replace(/\/+$/, "");
  return p === dir || p.startsWith(`${dir}/`);
}

/**
 * An exclusion predicate that also remembers which patterns did any work.
 *
 * A pattern that excludes nothing is usually a path written from the wrong
 * place — `_archive` for what is really `docs/_archive` — and it fails the way
 * a mistyped key does: the pattern looks right and the folder ships anyway.
 * The walk already tests every pattern against every path it visits, so it can
 * say which ones ever matched without a second walk with pruning turned off.
 */
export interface ExclusionTracker {
  /** Is this path excluded? Records every pattern that claims it. */
  excludes(path: string): boolean;
  /**
   * Note that a directory was pruned. Its contents are never visited, so a
   * pattern naming something inside it cannot be said to have matched nothing
   * — a broader rule already excluded the tree it spoke about, which is
   * redundancy rather than a mistake.
   */
  pruned(dirPath: string): void;
  /**
   * Place-naming patterns that left the vault exactly as they found it.
   *
   * An extension pattern is left out: `*.tmp` in a vault with no scratch files
   * is a standing rule about what may never ship, not a claim that something
   * is there to remove.
   */
  unused(): string[];
}

export function trackExclusions(patterns: readonly string[] = []): ExclusionTracker {
  const active = patterns.filter((p) => p.trim() !== "");
  const used = new Set<string>();
  return {
    excludes(path) {
      let excluded = false;
      for (const pattern of active) {
        if (!matchesPattern(path, pattern)) continue;
        used.add(pattern);
        excluded = true;
      }
      return excluded;
    },
    pruned(dirPath) {
      const prefix = `${dirPath.toLowerCase()}/`;
      for (const pattern of active) {
        if (normalizePattern(pattern).startsWith(prefix)) used.add(pattern);
      }
    },
    unused() {
      return active.filter((pattern) => !used.has(pattern) && !isExtensionPattern(pattern));
    },
  };
}

function normalizePattern(pattern: string): string {
  return pattern
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/\*\*$/, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

function isExtensionPattern(pattern: string): boolean {
  return pattern.replace(/\\/g, "/").replace(/^\.\//, "").startsWith("*.");
}
