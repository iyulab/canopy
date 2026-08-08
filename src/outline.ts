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

import { htmlToText } from "./html-text.js";

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
    const text = htmlToText(match[3] ?? "");
    if (id === undefined || id === "" || text === "") {
      continue;
    }
    items.push({ level, text, id });
  }
  return items;
}

/**
 * The name a document gives itself in its opening `h1`, or `undefined` when it
 * gives none.
 *
 * This is the other half of the sentence `OUTLINE_LEVELS` starts: `h1` is left
 * out of the outline *because* it is the page's title rather than a section of
 * it — so here it is, for whoever has to name the page. Read from the same
 * rendered HTML, in the same shape, so a page costs no extra parse to name.
 *
 * Unlike an outline entry, no `id` is required: an outline entry has to be
 * linkable, while a title is only text.
 */
export function extractFirstHeading(html: string): string | undefined {
  for (const match of html.matchAll(HEADING)) {
    if (Number(match[1]) !== 1) {
      continue;
    }
    const text = htmlToText(match[3] ?? "");
    if (text !== "") {
      return text;
    }
  }
  return undefined;
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
