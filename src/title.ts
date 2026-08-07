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
 * What is deliberately *not* here is the last rung. "No name at all" is answered
 * differently depending on where the page sits — the site's front page, the
 * front of a folder, or an ordinary page — and that is positional knowledge the
 * navigation tree and the shell each already hold. This function reports only
 * whether the document names itself.
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
