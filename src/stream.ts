import type { RenderedPage } from "./contract.js";
import { type Layout, resolvePageLayout, streamDirs, streamIndexPath } from "./layout.js";
import { flattenNav, type NavNode } from "./navigation.js";
import { pageDate } from "./page-date.js";
import { escapeHtml } from "./shell.js";
import { declaredTitle, pageName } from "./title.js";

/**
 * Stream folders in a build: the index page a stream needs to be read from, and
 * the one order every view of a stream shares — newest first.
 *
 * The order lives in the navigation tree itself, not in each view that shows a
 * stream: the index's listing, the search index, `list --json` and any later
 * prev/next all read the tree, so ordering it once means no view can disagree
 * with another about which post comes first.
 */

/**
 * The index pages `syntheticIndexPaths` named, as pages: titled from the
 * layout's `title` for that folder, else the folder's own name. Their only
 * content is that title — the stream's listing is the shell's to draw.
 */
export function syntheticStreamPages(layout: Layout | undefined, sitePaths: readonly string[]): RenderedPage[] {
  return sitePaths.map((sitePath) => {
    const dir = sitePath === "index.html" ? "" : sitePath.slice(0, -"/index.html".length);
    const rule = dir === "" ? layout?.default : layout?.dirs?.[dir];
    const title = rule?.title ?? (dir.split("/").pop() || "Contents");
    return {
      sourcePath: "",
      sitePath,
      frontmatter: { title },
      html: `<h1>${escapeHtml(title)}</h1>`,
      backlinks: [],
      outline: [],
    };
  });
}

/**
 * Newest day first. Within a day, a post with a time comes before an untimed
 * one, and timed posts go latest first. Undated pages (and dates that are not
 * dates) come last, by path, since nothing says where else they belong.
 */
export function streamOrder(a: RenderedPage, b: RenderedPage): number {
  const da = pageDate(a);
  const db = pageDate(b);
  if (da === undefined || db === undefined) {
    if (da !== db) return da === undefined ? 1 : -1;
    return a.sitePath.localeCompare(b.sitePath);
  }
  const byDay = db.slice(0, 10).localeCompare(da.slice(0, 10));
  if (byDay !== 0) return byDay;
  return db.localeCompare(da) || a.sitePath.localeCompare(b.sitePath);
}

/** A tree with every node for `remove` taken out; a folder left with nothing in it goes too. */
function prune(nodes: readonly NavNode[], remove: ReadonlySet<string>): NavNode[] {
  return nodes.flatMap((node): NavNode[] => {
    const children = prune(node.children, remove);
    // A removed page's own children that are not removed move up to its place.
    if (node.sitePath !== undefined && remove.has(node.sitePath)) return children;
    if (node.sitePath === undefined && node.children.length > 0 && children.length === 0) return [];
    return [{ ...node, children }];
  });
}

function orderStream(
  nodes: NavNode[],
  pages: readonly RenderedPage[],
  layout: Layout | undefined,
  dir: string,
): NavNode[] {
  const indexPath = streamIndexPath(dir).toLowerCase();
  const members = pages
    .filter(
      (page) =>
        page.sitePath.toLowerCase() !== indexPath && resolvePageLayout(layout, page.sitePath).streamDir === dir,
    )
    .sort(streamOrder);
  if (members.length === 0) return nodes;

  // Keep the names the tree already gave (a navigation spec's labels among
  // them); a page the tree never placed is named the way the tree names any.
  const labels = new Map(flattenNav(nodes).map((entry) => [entry.sitePath, entry.label]));
  const entries: NavNode[] = members.map((page) => ({
    label: labels.get(page.sitePath) ?? pageName(page.sitePath, declaredTitle(page.frontmatter, page.html)),
    sitePath: page.sitePath,
    children: [],
  }));
  const rest = prune(nodes, new Set(members.map((page) => page.sitePath)));

  if (dir === "") {
    const [first, ...others] = rest;
    return first?.sitePath?.toLowerCase() === indexPath ? [first, ...entries, ...others] : [...entries, ...rest];
  }
  let placed = false;
  const place = (list: NavNode[]): NavNode[] =>
    list.map((node) => {
      if (!placed && node.sitePath?.toLowerCase() === indexPath) {
        placed = true;
        return { ...node, children: [...entries, ...node.children] };
      }
      return { ...node, children: place(node.children) };
    });
  const result = place(rest);
  // A tree that never placed the index (a spec that left it out) has nowhere to
  // hang the stream; it is left exactly as the spec made it.
  return placed ? result : nodes;
}

/** The navigation tree with every stream folder's pages under its index, newest first. */
export function orderStreams(
  nodes: NavNode[],
  pages: readonly RenderedPage[],
  layout: Layout | undefined,
): NavNode[] {
  return streamDirs(layout).reduce((tree, dir) => orderStream(tree, pages, layout, dir), nodes);
}
