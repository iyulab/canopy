/**
 * Strip markup and decode the entities a fragment of rendered HTML carries,
 * leaving plain text.
 *
 * Shared by every caller that needs a page's rendered HTML as prose rather
 * than markup — outline.ts's heading text and search-index.ts's indexed body
 * are the same operation on different inputs, and diverging would mean two
 * answers to "what does this HTML say".
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}
