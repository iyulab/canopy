/**
 * Map a source markdown path to its path within the site bundle.
 *
 * Pure and deterministic — the same input always yields the same output,
 * which is the bedrock of Canopy's stateless-build guarantee. Markdown
 * files become `.html`; every other path (assets) passes through unchanged.
 */
export function toSitePath(sourcePath: string): string {
  const normalized = sourcePath.replace(/\\/g, "/").replace(/^\/+/, "");
  return normalized.replace(/\.md$/i, ".html");
}

/**
 * Compute a relative href from one site path to another.
 *
 * Links must be relative to the current page, not root-absolute: a published
 * site is often served from a sub-path (e.g. GitHub project pages at
 * `/repo/`), where `/notes/idea.html` would break. Both arguments are site
 * paths like "notes/idea.html". Pure and deterministic; reused by navigation
 * and assets, not just wikilinks.
 *
 * Each path segment is URL-encoded so a filename with a space (or other
 * URL-unsafe character) yields a valid href — "deep dive.html" becomes
 * "deep%20dive.html" — which static hosts serve correctly. The output file is
 * still written under its raw name; only the link is encoded.
 */
export function relativeHref(from: string, to: string): string {
  const fromDir = from.split("/").slice(0, -1);
  const toParts = to.split("/");
  let shared = 0;
  while (
    shared < fromDir.length &&
    shared < toParts.length - 1 &&
    fromDir[shared] === toParts[shared]
  ) {
    shared += 1;
  }
  const up = fromDir.length - shared;
  const segments = [
    ...Array.from({ length: up }, () => ".."),
    ...toParts.slice(shared),
  ];
  const relative = segments.length > 0 ? segments : [toParts[toParts.length - 1] ?? ""];
  return relative.map((segment) => encodeURIComponent(segment)).join("/");
}
