/**
 * Extract a page's heading structure — the table of contents a reader uses to
 * see what a long document contains and jump into it.
 *
 * Canopy already understands this structure: it assigns every heading an id so
 * `[[note#heading]]` can target one. Until now that knowledge only served links
 * *into* a page, never the reader already on it.
 *
 * Read from the rendered HTML rather than the mdast tree, because the ids are
 * assigned during rendering (rehype-slug) and the outline must carry the same
 * ones — deriving them a second time would risk two answers to "what is this
 * heading's id?".
 */

/** One heading in a page's outline. */
export interface OutlineItem {
  /** Heading level, as in `<h2>` → 2. */
  level: number;
  /** Heading text, with inline markup removed. */
  text: string;
  /** The heading's `id`, for a same-page anchor. */
  id: string;
}

/**
 * Levels that appear in an outline.
 *
 * `h1` is the document's own title — listing it would be an entry pointing at
 * the top of the page — and `h4` and deeper are usually detail a contents list
 * does not need. Fixed rather than configurable until something asks otherwise.
 */
const OUTLINE_LEVELS = [2, 3];

const HEADING = /<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;
const ID_ATTR = /\bid="([^"]*)"/i;

/** Strip inline markup and decode the entities an HTML heading may carry. */
function toText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

/**
 * Collect the outline of a rendered page body.
 *
 * A heading with no id is skipped: without one there is nothing to link to, and
 * an entry that scrolls nowhere is worse than an absent one.
 */
export function extractOutline(html: string): OutlineItem[] {
  const items: OutlineItem[] = [];
  for (const match of html.matchAll(HEADING)) {
    const level = Number(match[1]);
    if (!OUTLINE_LEVELS.includes(level)) {
      continue;
    }
    const id = match[2]?.match(ID_ATTR)?.[1];
    const text = toText(match[3] ?? "");
    if (id === undefined || id === "" || text === "") {
      continue;
    }
    items.push({ level, text, id });
  }
  return items;
}

/**
 * Whether an outline is worth showing.
 *
 * A single heading is not a structure to navigate — a contents list of one entry
 * is visual noise that says nothing the page does not already show.
 */
export function isOutlineUseful(outline: readonly OutlineItem[]): boolean {
  return outline.length >= 2;
}
