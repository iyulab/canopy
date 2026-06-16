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

function isIndexStem(stem: string): boolean {
  return stem.toLowerCase() === "index";
}

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
      // appearing as a separate "index" child.
      folder.sitePath = entry.sitePath;
    } else {
      const label = isIndexStem(stem)
        ? (entry.title ?? "Home") // root index = home page
        : (entry.title ?? stem);
      folder.pages.push({ label, sitePath: entry.sitePath, children: [] });
    }
  }
  return toNodes(root);
}
