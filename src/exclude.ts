/**
 * Decide which vault paths are kept out of a published site.
 *
 * Two rules stack, in this order:
 *  1. Tooling state — dot-prefixed directories and `node_modules` — is never
 *     published. This is not configurable: those paths hold an editor's or a
 *     build tool's own bookkeeping, not the author's content.
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
  return name.startsWith(".") || name === "node_modules";
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
 * Build a predicate for "is this vault path excluded from publishing?".
 *
 * Applied to markdown and assets alike: a draft folder's images have no reason
 * to be on the web once its notes are not.
 */
export function createExcluder(
  patterns: readonly string[] = [],
): (path: string) => boolean {
  const active = patterns.filter((p) => p.trim() !== "");
  if (active.length === 0) {
    return () => false;
  }
  return (path) => active.some((pattern) => matchesPattern(path, pattern));
}
