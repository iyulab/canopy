/**
 * Tags whose closing (or, for the two void elements, own) tag marks a break
 * between prose that must not run together — a table row's next cell, a
 * list's next item, the paragraph after a heading. Inline tags (`<code>`,
 * `<strong>`, `<a>`, ...) are deliberately left out: text that was adjacent
 * in the source stays adjacent, which is the point of stripping markup at all.
 */
const BLOCK_BOUNDARY_RE =
  /<\/(p|div|li|tr|td|th|h[1-6]|blockquote|pre|ul|ol|table|thead|tbody|tfoot|figure|figcaption|section|article|header|footer|aside|dt|dd)>|<(?:br|hr)\s*\/?>/gi;

/**
 * Strip markup and decode the entities a fragment of rendered HTML carries,
 * leaving plain text.
 *
 * Shared by every caller that needs a page's rendered HTML as prose rather
 * than markup — outline.ts's heading text and search-index.ts's indexed body
 * are the same operation on different inputs, and diverging would mean two
 * answers to "what does this HTML say".
 *
 * A block boundary becomes a space before the tags are stripped outright —
 * otherwise adjacent block elements (a table's cells, a list's items) read as
 * one run-on word: `<td>a</td><td>b</td>` must not become `ab`. Run-on
 * whitespace `\s+` collapses back to one space so a boundary never shows up
 * as a visible double space in an excerpt.
 */
export function htmlToText(html: string): string {
  return html
    .replace(BLOCK_BOUNDARY_RE, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // rehype-stringify emits a numeric reference for a character it cannot
    // name (Shiki's own escaping of `<`/`>` inside inline code came out as
    // `&#x3C;`, not `&lt;`, on real content) — decoding every numeric
    // reference generally, decimal or hex, covers those without chasing each
    // one the named list above misses.
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
