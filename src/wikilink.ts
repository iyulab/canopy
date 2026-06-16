/**
 * Parse the inside of a `[[...]]` wikilink into its parts.
 *
 * Supports `[[target]]`, `[[target|alias]]`, `[[target#heading]]`, and
 * `[[target#heading|alias]]`. Block anchors (`[[note#^id]]`) are not resolved
 * specially in this version — they need a per-document block-id index — so the
 * `^id` is treated as an ordinary heading fragment.
 */
export interface WikiTarget {
  /** Note name or path reference; empty for a same-page heading link. */
  target: string;
  /** Heading fragment after `#`, if any. */
  heading: string | undefined;
  /** Display alias after `|`, if any. */
  alias: string | undefined;
}

export function parseWikiTarget(inner: string): WikiTarget {
  let rest = inner.trim();

  let alias: string | undefined;
  const pipe = rest.indexOf("|");
  if (pipe !== -1) {
    alias = rest.slice(pipe + 1).trim() || undefined;
    rest = rest.slice(0, pipe).trim();
  }

  let heading: string | undefined;
  const hash = rest.indexOf("#");
  if (hash !== -1) {
    heading = rest.slice(hash + 1).trim() || undefined;
    rest = rest.slice(0, hash).trim();
  }

  return { target: rest, heading, alias };
}
