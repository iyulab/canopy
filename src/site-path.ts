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

/** The site's base URL without a trailing slash — what every absolute URL below joins onto. */
function siteBase(siteUrl: string): string {
  return siteUrl.replace(/\/+$/, "");
}

/**
 * The one absolute URL a page is canonically reached by, given where the site
 * is published.
 *
 * A directory's index page *is* the directory: `guide/index.html` and `guide/`
 * are one page, and naming both would ask a crawler to treat it as two — so
 * the index filename folds away. This is the rule behind `rel="canonical"`,
 * `og:url`, and every `hreflang` alternate the shell writes, and it is
 * exported so a caller writing a sitemap can name each page by exactly the
 * same string rather than restating the rule and drifting from it.
 * `encodeURI` leaves the separators alone and fixes what a URL cannot carry
 * raw — the whole-URL counterpart of the per-segment encoding `relativeHref`
 * does below.
 */
export function pageUrl(siteUrl: string, sitePath: string): string {
  const canonical = sitePath.replace(/^\/+/, "").replace(/(^|\/)index\.html$/i, "$1");
  return `${siteBase(siteUrl)}/${encodeURI(canonical)}`;
}

/**
 * The absolute URL of a published file that is not a page — an image a link
 * preview shows, say. No index folding: `assets/index.html` would be a page,
 * but a file is reached by its own full name.
 */
export function fileUrl(siteUrl: string, sitePath: string): string {
  return `${siteBase(siteUrl)}/${encodeURI(sitePath.replace(/^\/+/, ""))}`;
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
