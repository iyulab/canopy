import type { RenderedPage } from "./contract.js";
import { htmlToText } from "./html-text.js";
import { pageTitle } from "./shell.js";

/**
 * One page's contribution to the site's search index.
 *
 * Short keys because this ships to every reader's browser as JSON: `p`ath,
 * `t`itle, `h`eadings, `b`ody. canopy already holds all four while
 * rendering — a client-side search UI does not get to reparse markdown, so
 * whatever it can search is whatever shape this carries.
 */
export interface SearchIndexEntry {
  /** The page's site path, e.g. "notes/idea.html" — where a match navigates to. */
  p: string;
  /** The page's title, the same string `pageTitle` gives the shell's `<title>`. */
  t: string;
  /** Heading text, in document order — the same entries `.canopy-outline` lists. */
  h: string[];
  /** The page's rendered body as plain text, markup stripped, untruncated. */
  b: string;
}

/**
 * Build the search index for a rendered site: one entry per page, using data
 * canopy already computed while rendering rather than asking a consumer to
 * reparse markdown for it.
 *
 * Untruncated: Wave 2's own size measurement (cycle-25) found real sites stay
 * in the low hundreds of KB gzipped even with full page bodies, so there is no
 * size pressure to cut text short here — and doing so would cost a search
 * result's snippet the context a reader searched for.
 */
export function buildSearchIndex(pages: readonly RenderedPage[]): SearchIndexEntry[] {
  return pages.map((page) => ({
    p: page.sitePath,
    t: pageTitle(page),
    h: page.outline.map((item) => item.text),
    b: htmlToText(page.html),
  }));
}
