/**
 * Derive a site navigation tree from flat page paths.
 *
 * Canopy receives a flat list of documents, never a consumer's tree model, so
 * the hierarchy is reconstructed here from the POSIX `sitePath` segments
 * alone. Pure and deterministic: the same entries always yield the same tree.
 */

/** A page to place in the navigation tree. */
export interface NavEntry {
  /** Output path within the site, e.g. "notes/idea.html". */
  sitePath: string;
  /** Display title (e.g. from frontmatter); falls back to the file stem. */
  title?: string | undefined;
}

/** A node in the navigation tree: a folder, a page, or a folder with an index. */
export interface NavNode {
  /** Display label. */
  label: string;
  /** Link target; present for pages and for folders that have an index page. */
  sitePath?: string;
  /** Child nodes; non-empty for folders. */
  children: NavNode[];
}

interface FolderBuilder {
  label: string;
  sitePath: string | undefined;
  folders: Map<string, FolderBuilder>;
  pages: NavNode[];
}

function emptyFolder(label: string): FolderBuilder {
  return { label, sitePath: undefined, folders: new Map(), pages: [] };
}

import { isIndexStem, pageName } from "./title.js";

// Re-exported from its home beside the naming ladder: callers reaching for the
// index rule are usually asking what to call a page.
export { isIndexStem } from "./title.js";

function byLabel(a: NavNode, b: NavNode): number {
  return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
}

function toNodes(folder: FolderBuilder): NavNode[] {
  const folderNodes = [...folder.folders.values()]
    .map((child): NavNode => {
      const node: NavNode = { label: child.label, children: toNodes(child) };
      if (child.sitePath !== undefined) {
        node.sitePath = child.sitePath;
      }
      return node;
    })
    .sort(byLabel);
  const pageNodes = [...folder.pages].sort(byLabel);
  // Folders first, then leaf pages — each alphabetical, for stable output.
  return [...folderNodes, ...pageNodes];
}

export function buildNavigation(entries: NavEntry[]): NavNode[] {
  const root = emptyFolder("");
  for (const entry of entries) {
    const segments = entry.sitePath.split("/").filter(Boolean);
    if (segments.length === 0) {
      continue;
    }
    const fileSegment = segments[segments.length - 1] ?? "";
    const dirs = segments.slice(0, -1);

    let folder = root;
    for (const dir of dirs) {
      let next = folder.folders.get(dir);
      if (next === undefined) {
        next = emptyFolder(dir);
        folder.folders.set(dir, next);
      }
      folder = next;
    }

    const stem = fileSegment.replace(/\.html$/i, "");
    if (isIndexStem(stem) && folder !== root) {
      // A folder's index page links the folder node itself rather than
      // appearing as a separate "index" child — and names it, since the folder
      // node and that page are the one entry a reader clicks. `pageName` gives
      // back the directory name when the page names itself nowhere, which is
      // the label the folder already had.
      folder.sitePath = entry.sitePath;
      folder.label = pageName(entry.sitePath, entry.title);
    } else {
      folder.pages.push({
        label: pageName(entry.sitePath, entry.title),
        sitePath: entry.sitePath,
        children: [],
      });
    }
  }
  return toNodes(root);
}

/** One page's position in the flattened reading order — label and target. */
export interface FlatNavEntry {
  sitePath: string;
  label: string;
}

/**
 * Depth-first order of every linked page in the tree — the order a reader
 * encounters them following the sidebar top to bottom. A folder with its own
 * index page is included at its own position, before its children, matching
 * how the sidebar renders it (a node's own link, then its children's list).
 *
 * Takes any `NavNode[]`, derived (`buildNavigation`) or spec-driven
 * (`applyNavSpec`) alike — both produce the same tree shape, so one function
 * flattens either.
 */
export function flattenNav(nodes: NavNode[]): FlatNavEntry[] {
  const entries: FlatNavEntry[] = [];
  for (const node of nodes) {
    if (node.sitePath !== undefined) {
      entries.push({ sitePath: node.sitePath, label: node.label });
    }
    entries.push(...flattenNav(node.children));
  }
  return entries;
}
