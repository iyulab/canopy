import { buildNavigation, type NavEntry, type NavNode } from "./navigation.js";
import { pageName } from "./title.js";

/**
 * An externally supplied navigation order.
 *
 * Canopy derives navigation from paths, which fixes it to one shape: the root
 * index page first, then folders before pages, each alphabetical, folder labels
 * taken from directory names.
 * That is a reasonable default and the wrong answer for any document set with a
 * canonical order of its own — a release log reads newest-first, a guide reads
 * in teaching order — and directory names are URL segments, not display text.
 *
 * A spec supplies both. Canopy applies it and knows nothing about where it came
 * from: hand-written, generated, or emitted by a tool are all the same here.
 */
export interface NavSpec {
  /** Top-level items, in display order. */
  items: NavSpecItem[];
  /**
   * What happens to pages the spec places nowhere. `"report"` (the default)
   * leaves them out of the navigation and lists them in `AppliedNav.unplaced`;
   * `"append"` places them after the spec's own items, derived the way canopy
   * derives a tree with no spec at all.
   */
  unplaced?: "report" | "append";
}

/**
 * One entry: either a page (`path`) or a group of entries (`items`).
 *
 * A group may also carry a `path`, which makes its label link to that page —
 * the same thing a folder's `index.md` does in the derived tree.
 */
export interface NavSpecItem {
  /** Display text. Defaults to the page's title, then its filename stem. */
  label?: string;
  /** Vault-relative path of the page, with or without its extension. */
  path?: string;
  /** Nested entries, in display order. */
  items?: NavSpecItem[];
  /**
   * A vault directory whose pages fill this group, after any explicit
   * `items`: every page beneath it that the spec does not place elsewhere,
   * derived the way canopy derives a tree — folders first, a folder's index
   * page as the folder's own link. Lets a spec order one part of a site and
   * leave the rest to canopy. `""` is the whole vault.
   *
   * A group with `derive` and no `path` takes the directory's own index page
   * as its link, and without a `label` is named by that page, else by the
   * directory — exactly the node a derived tree would have made.
   */
  derive?: string;
  /**
   * Order the derived part by file name, in this direction, instead of by
   * the name a reader sees. Only meaningful with `derive`.
   */
  order?: "asc" | "desc";
}

/** Why a spec was rejected, phrased for someone editing the file. */
export class NavSpecError extends Error {}

function fail(message: string): never {
  throw new NavSpecError(message);
}

/** Normalize a spec path to the site path it addresses. */
function toSitePathKey(path: string): string {
  return path
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\.(md|html)$/i, "")
    .toLowerCase();
}

function validateItem(item: unknown, where: string): NavSpecItem {
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    fail(`${where}: expected an object with "label", "path", or "items"`);
  }
  const { label, path, items, derive, order } = item as Record<string, unknown>;
  if (label !== undefined && typeof label !== "string") {
    fail(`${where}: "label" must be a string`);
  }
  if (path !== undefined && typeof path !== "string") {
    fail(`${where}: "path" must be a string`);
  }
  if (items !== undefined && !Array.isArray(items)) {
    fail(`${where}: "items" must be an array`);
  }
  if (derive !== undefined && typeof derive !== "string") {
    fail(`${where}: "derive" must be a directory path`);
  }
  if (order !== undefined && order !== "asc" && order !== "desc") {
    fail(`${where}: "order" must be "asc" or "desc"`);
  }
  if (order !== undefined && derive === undefined) {
    // Explicit items are already in the order written; an order with nothing
    // to derive would be silently meaningless.
    fail(`${where}: "order" applies to derived pages, so it needs "derive"`);
  }
  if (path === undefined && items === undefined && derive === undefined) {
    fail(`${where}: needs a "path" (a page), "items" (a group), or "derive" (a directory)`);
  }
  // A group with no label would render as an unnamed heading, which reads as a
  // rendering bug rather than as the authoring mistake it is. A derived group
  // is named by its directory, the way a derived tree names a folder.
  if (path === undefined && label === undefined && derive === undefined) {
    fail(`${where}: a group needs a "label"`);
  }

  const children = ((items as unknown[]) ?? []).map((child, i) =>
    validateItem(child, `${where} > items[${i}]`),
  );
  return {
    ...(label === undefined ? {} : { label }),
    ...(path === undefined ? {} : { path }),
    ...(items === undefined ? {} : { items: children }),
    ...(derive === undefined ? {} : { derive: normalizeDir(derive as string) }),
    ...(order === undefined ? {} : { order: order as "asc" | "desc" }),
  };
}

function normalizeDir(dir: string): string {
  return dir.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+|\/+$/g, "");
}

/**
 * Parse and validate a navigation spec from JSON text.
 *
 * Validation is strict and its messages name the offending position, because
 * this file is hand-edited: a spec that is silently half-applied would look like
 * canopy ignoring the order it was given.
 */
export function parseNavSpec(json: string): NavSpec {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error) {
    fail(`not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    fail('expected an object with an "items" array');
  }
  const { items, unplaced } = raw as Record<string, unknown>;
  if (!Array.isArray(items)) {
    fail('"items" must be an array');
  }
  if (unplaced !== undefined && unplaced !== "report" && unplaced !== "append") {
    fail('"unplaced" must be "report" or "append"');
  }
  return {
    items: items.map((item, i) => validateItem(item, `items[${i}]`)),
    ...(unplaced === undefined ? {} : { unplaced: unplaced as "report" | "append" }),
  };
}

/** Pages placed by a spec, plus the ones it left out. */
export interface AppliedNav {
  nodes: NavNode[];
  /** Site paths in the build that the spec never mentioned. */
  unplaced: string[];
  /** Spec paths that match no page in the build. */
  missing: string[];
}

/**
 * Turn a spec plus this build's pages into a navigation tree.
 *
 * Order is the spec's order, verbatim — no sorting is applied to what a spec
 * lists, since supplying an order is the entire point. Labels fall back to the
 * page's title and then its filename stem, so a spec only has to name what it
 * wants to override.
 *
 * Placement runs in two passes: every page the spec names explicitly is
 * claimed first, and only then do `derive` groups, in document order, take
 * what is left beneath their directories. One pass would let an early derived
 * group swallow a page a later item names by path.
 *
 * Pages the spec places nowhere are reported rather than appended, unless the
 * spec asks otherwise: whether a missing page is an oversight or a deliberate
 * omission is the caller's call, not canopy's.
 */
export function applyNavSpec(spec: NavSpec, entries: readonly NavEntry[]): AppliedNav {
  const byKey = new Map<string, NavEntry>();
  for (const entry of entries) {
    byKey.set(toSitePathKey(entry.sitePath), entry);
  }

  const placed = new Set<string>();
  const missing: string[] = [];

  const claimExplicit = (items: readonly NavSpecItem[]): void => {
    for (const item of items) {
      if (item.path !== undefined) {
        const entry = byKey.get(toSitePathKey(item.path));
        if (entry !== undefined) placed.add(entry.sitePath);
      }
      claimExplicit(item.items ?? []);
    }
  };
  claimExplicit(spec.items);

  /** Unclaimed pages beneath `dir`, claimed as they are returned. */
  const claimBeneath = (dir: string): NavEntry[] => {
    const prefix = dir === "" ? "" : `${dir.toLowerCase()}/`;
    const found = entries.filter(
      (entry) => !placed.has(entry.sitePath) && entry.sitePath.toLowerCase().startsWith(prefix),
    );
    for (const entry of found) placed.add(entry.sitePath);
    return found;
  };

  const build = (items: readonly NavSpecItem[]): NavNode[] => {
    const nodes: NavNode[] = [];
    for (const item of items) {
      const children = build(item.items ?? []);
      let entry: NavEntry | undefined;
      if (item.path !== undefined) {
        entry = byKey.get(toSitePathKey(item.path));
        if (entry === undefined) {
          missing.push(item.path);
          // A group still renders without its own page; a leaf has nothing left.
          if (item.items === undefined && item.derive === undefined) {
            continue;
          }
        }
      }
      if (item.derive !== undefined) {
        const dir = item.derive;
        let beneath = claimBeneath(dir);
        if (item.path === undefined) {
          // The directory's own index page is the group's link, as it is for a
          // folder in a derived tree.
          const indexKey = toSitePathKey(dir === "" ? "index" : `${dir}/index`);
          const own = beneath.find((candidate) => toSitePathKey(candidate.sitePath) === indexKey);
          if (own !== undefined) {
            entry = own;
            beneath = beneath.filter((candidate) => candidate !== own);
          }
        }
        children.push(...deriveBeneath(dir, beneath, item.order));
      }
      // A spec supplies an order, not a different vocabulary: an entry it does
      // not label is named exactly as the derived tree would name it.
      const label =
        item.label ??
        (entry === undefined
          ? (item.derive?.split("/").pop() ?? "")
          : pageName(entry.sitePath, entry.title));
      nodes.push({
        label,
        ...(entry === undefined ? {} : { sitePath: entry.sitePath }),
        children,
      });
    }
    return nodes;
  };

  const nodes = build(spec.items);
  const rest = entries.filter((entry) => !placed.has(entry.sitePath));
  if (spec.unplaced === "append") {
    nodes.push(...buildNavigation(rest));
    return { nodes, unplaced: [], missing };
  }
  return { nodes, unplaced: rest.map((entry) => entry.sitePath), missing };
}

/**
 * The derived tree of `found`, all beneath `dir`, as that directory's children.
 *
 * Built on paths relative to `dir` and re-rooted afterwards, so the result is
 * the same tree `buildNavigation` gives a vault whose root is that directory.
 * Each page keeps its own spelling of the directory part of its path.
 */
function deriveBeneath(
  dir: string,
  found: readonly NavEntry[],
  order: "asc" | "desc" | undefined,
): NavNode[] {
  const options = order === undefined ? {} : { order };
  if (dir === "") return buildNavigation(found, options);
  const cut = dir.length + 1;
  const original = new Map<string, string>();
  const relative = found.map((entry) => {
    const rel = entry.sitePath.slice(cut);
    original.set(rel, entry.sitePath);
    return { ...entry, sitePath: rel };
  });
  const rebase = (nodes: NavNode[]): NavNode[] =>
    nodes.map((node) => ({
      ...node,
      ...(node.sitePath === undefined ? {} : { sitePath: original.get(node.sitePath) ?? node.sitePath }),
      children: rebase(node.children),
    }));
  return rebase(buildNavigation(relative, options));
}
