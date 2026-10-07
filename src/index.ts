import type { SourceTree, SiteBundle, RenderedPage, Backlink } from "./contract.js";
import { toSitePath } from "./site-path.js";
import { renderDocument } from "./render.js";
import { buildNavigation, type NavEntry } from "./navigation.js";
import { buildLinkIndex } from "./links.js";
import { applyNavSpec } from "./nav-spec.js";
import { extractOutline } from "./outline.js";
import { declaredTitle } from "./title.js";
import { syntheticIndexPaths } from "./layout.js";
import { orderStreams, syntheticStreamPages } from "./stream.js";

export type {
  SourceDocument,
  SourceTree,
  RenderedPage,
  SiteBundle,
  OutputFile,
  Backlink,
} from "./contract.js";
export { toSitePath, relativeHref, pageUrl, fileUrl } from "./site-path.js";
export { parseFrontmatter } from "./frontmatter.js";
export { frontmatterDate, formatPageDate } from "./page-date.js";
export { renderMarkdown, renderDocument } from "./render.js";
export { buildNavigation } from "./navigation.js";
export type { NavEntry, NavNode } from "./navigation.js";
export { buildLinkIndex } from "./links.js";
export {
  isExternalUrl,
  parseLinkUrl,
  decodeLinkPath,
  resolveRelative,
  resolveMarkdownLink,
  type ParsedLinkUrl,
} from "./markdown-link.js";
export {
  parseNavSpec,
  applyNavSpec,
  NavSpecError,
  type NavSpec,
  type NavSpecItem,
  type AppliedNav,
} from "./nav-spec.js";
export { renderPage, pageTitle, renderContentsPage, languageName, type ShellOptions } from "./shell.js";
export { extractOutline, extractFirstHeading, isOutlineUseful, type OutlineItem } from "./outline.js";
export { declaredTitle, pageName, isIndexStem } from "./title.js";
export {
  parseLayout,
  resolvePageLayout,
  layoutFragments,
  streamDirs,
  streamIndexPath,
  syntheticIndexPaths,
  LayoutError,
  PROFILES,
  REGIONS,
  type Layout,
  type LayoutRule,
  type PageLayout,
  type Profile,
  type RegionName,
} from "./layout.js";
export {
  CONTROL_SLOTS,
  FragmentError,
  fragmentHref,
  fragmentLinks,
  fragmentProblems,
  pageSlotKeys,
  pageSlotProblems,
  pageSlotText,
  renderFragment,
  type ControlSlot,
  type FragmentContext,
} from "./regions.js";
export { emitSite, type EmitOptions } from "./emit.js";
export { renderFeed, feedPath } from "./feed.js";
export { buildSearchIndex, type SearchIndexEntry } from "./search-index.js";
export { CANOPY_TOKENS } from "./tokens.js";
export { BASE_CSS } from "./styles.js";
export { THEME_HOOKS, type ThemeHook } from "./theme-hooks.js";
export { callerStylesheetPath } from "./stylesheets.js";
export {
  outputCollisions,
  type OutputCollision,
  type OutputOwner,
  type OutputPlan,
} from "./output-paths.js";
export { readingMinutes } from "./reading-time.js";


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
  const sitePaths = tree.documents.map((doc) => toSitePath(doc.path));
  // A stream folder with no index page of its own gets one written for it, and
  // it is a page like any other: links and wikilinks can reach it, so it goes
  // into the index every link is resolved against.
  const synthetic = syntheticIndexPaths(tree.layout, sitePaths);

  // Pass 1: index (paths only — no content needed).
  const index = buildLinkIndex([...sitePaths, ...synthetic]);

  // Pass 2: render in parallel; the wiki context resolves links per page.
  // `tree.rehypePlugins` is passed by reference to every call, which is what
  // lets render.ts's pipeline cache build the extended processor once for the
  // whole build rather than once per document (see render.ts's `processor`).
  const rendered = await Promise.all(
    tree.documents.map(async (doc) => {
      const sitePath = toSitePath(doc.path);
      const { frontmatter, html, outgoing } = await renderDocument(
        doc.content,
        {
          resolve: (target) => index.resolve(target),
          isPage: (candidate) => index.has(candidate),
          fromSitePath: sitePath,
        },
        tree.rehypePlugins,
      );
      // Named once, here: the name reaches the navigation, the tab, and every
      // backlink pointing at this page, and re-deriving it per reference would
      // rescan the body once per inbound link.
      const title = declaredTitle(frontmatter, html);
      return { sourcePath: doc.path, sitePath, frontmatter, html, outgoing, title };
    }),
  );

  // Pass 3: invert outgoing links into backlinks.
  const backlinksByTarget = new Map<string, Backlink[]>();
  for (const page of rendered) {
    for (const target of page.outgoing) {
      const list = backlinksByTarget.get(target) ?? [];
      list.push({ sitePath: page.sitePath, title: page.title });
      backlinksByTarget.set(target, list);
    }
  }

  const byPath = (a: Backlink, b: Backlink) => a.sitePath.localeCompare(b.sitePath);
  const pages: RenderedPage[] = [
    ...rendered.map((page) => ({
      sourcePath: page.sourcePath,
      sitePath: page.sitePath,
      frontmatter: page.frontmatter,
      html: page.html,
      backlinks: (backlinksByTarget.get(page.sitePath) ?? []).sort(byPath),
      outline: extractOutline(page.html),
    })),
    ...syntheticStreamPages(tree.layout, synthetic).map((page) => ({
      ...page,
      backlinks: (backlinksByTarget.get(page.sitePath) ?? []).sort(byPath),
    })),
  ];

  // Pass 2 already named every rendered page; a written page's name is its
  // frontmatter title.
  const entries: NavEntry[] = [
    ...rendered.map((page) => ({ sitePath: page.sitePath, title: page.title })),
    ...pages.slice(rendered.length).map((page) => ({
      sitePath: page.sitePath,
      title: declaredTitle(page.frontmatter, page.html),
    })),
  ];
  if (tree.nav !== undefined) {
    const applied = applyNavSpec(tree.nav, entries);
    return { pages, navigation: orderStreams(applied.nodes, pages, tree.layout), navReport: applied };
  }
  return { pages, navigation: orderStreams(buildNavigation(entries), pages, tree.layout) };
}
