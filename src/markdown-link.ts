/**
 * Decide what a markdown link's URL means, and what it should become in the
 * published site.
 *
 * Kept apart from the mdast plugin so the classification — which is where all
 * the judgment lives — is unit-testable on strings alone.
 *
 * The rule canopy applies: a link that points at a document *inside the vault*
 * is rewritten to that document's published location; everything else is left
 * exactly as the author wrote it. Leaving a URL alone is always the safe
 * outcome, so anything that cannot be confidently resolved is passed through
 * rather than guessed at.
 */

/** A markdown link URL split into the part that addresses a document and the rest. */
export interface ParsedLinkUrl {
  /** The path portion, empty for a same-page link like `#section`. */
  path: string;
  /** Query and fragment, retained verbatim (e.g. `#heading`). */
  suffix: string;
}

/**
 * True when a URL addresses something outside this vault and must not be touched.
 *
 * Each case is a distinct authorial intent that rewriting would destroy:
 *  - a scheme (`https:`, `mailto:`, `tel:`) points off-site;
 *  - a protocol-relative URL (`//host/x`) is equally off-site;
 *  - a root-absolute path (`/help/x.png`) is a deployment path the author chose
 *    deliberately, and canopy does not know where the site will be mounted;
 *  - a bare fragment (`#section`) addresses the current page.
 */
export function isExternalUrl(url: string): boolean {
  return (
    url === "" ||
    url.startsWith("#") ||
    url.startsWith("/") ||
    /^[a-z][a-z0-9+.-]*:/i.test(url)
  );
}

/** Split a URL into its path and its query/fragment suffix. */
export function parseLinkUrl(url: string): ParsedLinkUrl {
  const cut = url.search(/[?#]/);
  return cut === -1
    ? { path: url, suffix: "" }
    : { path: url.slice(0, cut), suffix: url.slice(cut) };
}

/**
 * Turn a URL path into the filesystem path it addresses, undoing percent-encoding.
 *
 * A link target is a URL, and `a%20b/x.md` and `a b/x.md` are the same file to a
 * browser — so they must be the same file here too. This matters because canopy
 * itself writes the encoded form: every href it generates is percent-encoded per
 * segment, so without this a page could contain canopy's own encoded link to a
 * document in its sidebar and the author's identical link in the body, with only
 * one of the two resolving. Editors write the encoded form as well: inserting a
 * link to a path containing a space produces `%20` without the author typing it.
 *
 * Decoded **per segment**, never across the whole path: `%2F` is a slash inside
 * a single name, not a directory boundary, and decoding it into one would
 * address a different file than the author wrote.
 *
 * Returns `undefined` for a malformed escape (`%zz`, which `decodeURIComponent`
 * rejects). Guessing at a repair would invent a target; leaving the link alone
 * keeps a visibly-wrong URL visibly wrong.
 */
export function decodeLinkPath(path: string): string | undefined {
  const segments: string[] = [];
  for (const segment of path.split("/")) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return undefined;
    }
    if (decoded.includes("/")) {
      return undefined;
    }
    segments.push(decoded);
  }
  return segments.join("/");
}

/**
 * Resolve a vault-relative path against the directory of the document holding
 * the link, returning a POSIX path from the vault root — or `undefined` when it
 * escapes the vault.
 *
 * `..` is honored so a link can point at a sibling folder, but a path that walks
 * above the root addresses something canopy was never given and is left alone.
 */
export function resolveRelative(fromSitePath: string, target: string): string | undefined {
  const segments = fromSitePath.split("/").slice(0, -1);
  for (const part of target.split("/")) {
    if (part === "" || part === ".") {
      continue;
    }
    if (part === "..") {
      if (segments.length === 0) {
        return undefined; // escapes the vault root
      }
      segments.pop();
      continue;
    }
    segments.push(part);
  }
  return segments.join("/");
}

/**
 * The site path a markdown link should point at, or `undefined` to leave the
 * link untouched.
 *
 * `isPage` reports whether a candidate site path exists in this build. It is
 * consulted for *every* rewrite, including `.md` targets: a link to a file that
 * was never published is better left as written than rewritten into a URL that
 * 404s under a different name.
 *
 * Extension-less targets (`[x](./notes)`) are resolved only when they name a
 * real page. Authors use them for both documents and non-markdown assets, and
 * inventing an `.html` target for something that does not exist would turn a
 * visibly-wrong link into a plausible-looking broken one.
 */
export function resolveMarkdownLink(
  fromSitePath: string,
  url: string,
  isPage: (sitePath: string) => boolean,
): string | undefined {
  if (isExternalUrl(url)) {
    return undefined;
  }
  const { path } = parseLinkUrl(url);
  if (path === "") {
    return undefined;
  }
  // The target is a URL; the tree is filesystem paths. Cross that boundary
  // before any comparison, so the two spellings of one path meet as one.
  const decoded = decodeLinkPath(path);
  if (decoded === undefined) {
    return undefined;
  }
  const resolved = resolveRelative(fromSitePath, decoded);
  if (resolved === undefined) {
    return undefined;
  }

  const candidate = /\.md$/i.test(resolved)
    ? resolved.replace(/\.md$/i, ".html")
    : /\.[^/]+$/.test(resolved)
      ? resolved // an asset (image, pdf, …) — mirrored into the site as-is
      : `${resolved}.html`;

  return isPage(candidate) || candidate === resolved ? candidate : undefined;
}
