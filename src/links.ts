/**
 * Build-wide index that resolves a wikilink target to a site path.
 *
 * Targets may be a bare note name (`idea`) or a path (`notes/idea`). Matching
 * is case-insensitive. When several notes share a name, resolution is
 * deterministic — shortest path wins, ties broken lexicographically — so the
 * stateless-build guarantee holds regardless of input order.
 */
export interface LinkIndex {
  /** Resolve a target to its site path, or undefined when unresolved. */
  resolve(target: string): string | undefined;
  /**
   * The page at `sitePath` in this build, spelled as the build spells it — or
   * undefined when there is none. The path is matched whole, ignoring case, so
   * `Guide/Install.html` answers `guide/install.html`: a link that reaches a
   * page this way must be written in the page's spelling, or a host that tells
   * letter case apart serves nothing at it.
   *
   * Distinct from `resolve`, and deliberately so: `resolve` implements wikilink
   * semantics, where a bare name may match a note anywhere in the tree. A
   * markdown link is a *path* relative to the document containing it, so it must
   * be checked against that one location and no other — `[x](notes.md)` next to
   * a `notes.md` means that file, never a same-named note in another folder.
   */
  page(sitePath: string): string | undefined;
}

function normalizeTarget(target: string): string {
  return target
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\.(md|html)$/i, "")
    .toLowerCase();
}

export function buildLinkIndex(sitePaths: readonly string[]): LinkIndex {
  const byName = new Map<string, string[]>();
  const byPath = new Map<string, string>();

  for (const sitePath of sitePaths) {
    const noExt = sitePath.replace(/\.html$/i, "");
    byPath.set(noExt.toLowerCase(), sitePath);
    const stem = noExt.split("/").pop() ?? noExt;
    const key = stem.toLowerCase();
    const list = byName.get(key) ?? [];
    list.push(sitePath);
    byName.set(key, list);
  }

  for (const list of byName.values()) {
    list.sort(
      (a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b),
    );
  }

  return {
    resolve(target) {
      const norm = normalizeTarget(target);
      if (norm.includes("/")) {
        return byPath.get(norm);
      }
      return byName.get(norm)?.[0];
    },
    page(sitePath) {
      return /\.html$/i.test(sitePath)
        ? byPath.get(sitePath.slice(0, -".html".length).toLowerCase())
        : undefined;
    },
  };
}
