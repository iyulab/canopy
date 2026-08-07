/**
 * The name a document gives itself.
 *
 * A page's name leaves the site in three places at once — the sidebar entry, the
 * browser tab, and the text of every backlink pointing at it — and those three
 * must agree. Answering the question here, once, is what keeps them agreeing;
 * the earlier split between "what the navigation calls this page" and "what the
 * `<title>` calls it" was a rendering bug, not a design.
 *
 * The order is a ladder from most explicit to least:
 *
 *   frontmatter `title`  →  the opening `h1`  →  (the caller's positional rule)
 *
 * Frontmatter is first because it is the author naming the page deliberately,
 * for this tool. The `h1` is next because it is the author naming the page
 * anyway, for readers — and a document that opens with `# 주문 목록` has already
 * said what it is called. Reaching past that for the filename names the page
 * something its own author never wrote, which on a non-English site means the
 * name that reaches the reader is in the wrong language entirely.
 *
 * The last rung is positional, and it is here too: a page that names itself
 * nowhere is named for where it sits. Three callers need that answer — the
 * shell's `<title>`, the derived navigation tree, and a supplied nav spec — and
 * when they each carried their own copy they drifted apart, so a spec-driven
 * site called a folder's front page "index" while a derived one called it by
 * the folder.
 */

import { extractFirstHeading } from "./outline.js";

/**
 * The title a document declares, or `undefined` when it declares none.
 *
 * `html` is the rendered body, not the source markdown: the heading has already
 * been parsed by then, so reading it here needs no second pass over the
 * document and no second markdown parser to disagree with the first.
 */
export function declaredTitle(
  frontmatter: Record<string, unknown>,
  html: string,
): string | undefined {
  const explicit = frontmatter.title;
  if (typeof explicit === "string") {
    return explicit;
  }
  return extractFirstHeading(html);
}

/**
 * Is this filename stem an index — the page a folder is entered by?
 *
 * Lives beside the naming ladder because that is the only thing it decides: an
 * index page is named for what it opens rather than for its file. Navigation
 * imports it from here so the tree and the name cannot answer differently.
 */
export function isIndexStem(stem: string): boolean {
  return stem.toLowerCase() === "index";
}

/** Stem of a site path — the filename without its extension. */
function stemOf(sitePath: string): string {
  const file = sitePath.split("/").pop() ?? sitePath;
  return file.replace(/\.html$/i, "");
}

/**
 * What to call a page: the name it declared, else the name its position gives it.
 *
 * `declared` is `declaredTitle`'s answer, passed in rather than recomputed so a
 * caller holding it already — the navigation tree carries one per entry — does
 * not rescan a rendered body to ask again.
 *
 * The positional rule: an ordinary page is called by its filename, and an index
 * page by what it opens — the folder it fronts, or, with no folder above it, the
 * site itself. "index" is a filename convention rather than a name, and it is
 * the one string that must never reach a reader, since a page's name is what
 * leaves the site: the sidebar entry, the browser tab, the bookmark, the search
 * result, the link preview.
 */
export function pageName(sitePath: string, declared: string | undefined): string {
  if (declared !== undefined) {
    return declared;
  }
  const stem = stemOf(sitePath);
  if (!isIndexStem(stem)) {
    return stem;
  }
  return sitePath.split("/").filter(Boolean).at(-2) ?? "Home";
}
