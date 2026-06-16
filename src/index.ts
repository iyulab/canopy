import type { SourceTree, SiteBundle, RenderedPage, Backlink } from "./contract.js";
import { toSitePath } from "./site-path.js";
import { renderDocument } from "./render.js";
import { buildNavigation, type NavEntry } from "./navigation.js";
import { buildLinkIndex } from "./links.js";

export type {
  SourceDocument,
  SourceTree,
  RenderedPage,
  SiteBundle,
  OutputFile,
  Backlink,
} from "./contract.js";
export { toSitePath, relativeHref } from "./site-path.js";
export { parseFrontmatter } from "./frontmatter.js";
export { renderMarkdown, renderDocument } from "./render.js";
export { buildNavigation } from "./navigation.js";
export type { NavEntry, NavNode } from "./navigation.js";
export { buildLinkIndex } from "./links.js";
export { renderPage, pageTitle, type ShellOptions } from "./shell.js";
export { emitSite, type EmitOptions } from "./emit.js";
export { CANOPY_TOKENS } from "./tokens.js";
export { BASE_CSS } from "./styles.js";

function titleOf(frontmatter: Record<string, unknown>): string | undefined {
  return typeof frontmatter.title === "string"
    ? frontmatter.title
    : undefined;
}

/**
 * Build a static site bundle from a source tree, in three passes:
 *  1. Index every page path so wikilink targets can be resolved tree-wide.
 *  2. Render each document in parallel, rewriting wikilinks to relative hrefs
 *     and collecting each page's outgoing links.
 *  3. Invert outgoing links into per-page backlinks (pure, deterministic).
 *
 * Stateless: the same input always yields the same output.
 */
export async function build(tree: SourceTree): Promise<SiteBundle> {
  // Pass 1: index (paths only — no content needed).
  const index = buildLinkIndex(tree.documents.map((doc) => toSitePath(doc.path)));

  // Pass 2: render in parallel; the wiki context resolves links per page.
  const rendered = await Promise.all(
    tree.documents.map(async (doc) => {
      const sitePath = toSitePath(doc.path);
      const { frontmatter, html, outgoing } = await renderDocument(doc.content, {
        resolve: (target) => index.resolve(target),
        fromSitePath: sitePath,
      });
      return { sourcePath: doc.path, sitePath, frontmatter, html, outgoing };
    }),
  );

  // Pass 3: invert outgoing links into backlinks.
  const backlinksByTarget = new Map<string, Backlink[]>();
  for (const page of rendered) {
    for (const target of page.outgoing) {
      const list = backlinksByTarget.get(target) ?? [];
      list.push({ sitePath: page.sitePath, title: titleOf(page.frontmatter) });
      backlinksByTarget.set(target, list);
    }
  }

  const pages: RenderedPage[] = rendered.map((page) => ({
    sourcePath: page.sourcePath,
    sitePath: page.sitePath,
    frontmatter: page.frontmatter,
    html: page.html,
    backlinks: (backlinksByTarget.get(page.sitePath) ?? []).sort((a, b) =>
      a.sitePath.localeCompare(b.sitePath),
    ),
  }));

  const entries: NavEntry[] = pages.map((page) => ({
    sitePath: page.sitePath,
    title: titleOf(page.frontmatter),
  }));
  return { pages, navigation: buildNavigation(entries) };
}
