import type { Root, Link, Definition } from "mdast";
import type { VFile } from "vfile";
import { visit } from "unist-util-visit";
import { relativeHref } from "./site-path.js";
import { resolveMarkdownLink, parseLinkUrl } from "./markdown-link.js";
import type { WikiContext } from "./remark-wikilink.js";

/**
 * Rewrite ordinary markdown links (`[text](note.md)`) that point inside the
 * vault so they address the published page, and record them as outgoing links.
 *
 * Wikilinks already got this treatment; without it the two syntaxes disagreed —
 * the same target written `[[note]]` worked while `[text](note.md)` shipped the
 * source path and 404'd, and only the wikilink appeared in the backlink graph.
 * Both are links between documents, so both resolve the same way and both count
 * as references.
 *
 * The context is the same one wikilinks read, but this plugin uses only its
 * `isPage`/`fromSitePath`: markdown link targets are *paths* relative to the
 * document, not tree-wide names, so `WikiContext.resolve` is deliberately not
 * consulted here (see `LinkIndex.has`).
 *
 * Anything not confidently inside the vault is left exactly as written — see
 * `resolveMarkdownLink` for which cases those are.
 */
export default function remarkMarkdownLink() {
  return (tree: Root, file: VFile): void => {
    const ctx = file.data.wiki as WikiContext | undefined;
    if (ctx?.isPage === undefined) {
      return;
    }
    const { fromSitePath, isPage } = ctx;
    const outgoing = new Set<string>(
      Array.isArray(file.data.wikiLinks) ? (file.data.wikiLinks as string[]) : [],
    );

    const rewrite = (node: Link | Definition): void => {
      const resolved = resolveMarkdownLink(fromSitePath, node.url, isPage);
      if (resolved === undefined) {
        return;
      }
      const { suffix } = parseLinkUrl(node.url);
      node.url = relativeHref(fromSitePath, resolved) + suffix;
      // Assets are not pages, so they are not references between documents.
      if (/\.html$/i.test(resolved) && resolved !== fromSitePath) {
        outgoing.add(resolved);
      }
    };

    visit(tree, "link", rewrite);
    // Reference-style links (`[text][id]` with `[id]: note.md` elsewhere) carry
    // their URL on the definition node, so the same rule has to reach there too.
    visit(tree, "definition", rewrite);

    file.data.wikiLinks = [...outgoing];
  };
}
